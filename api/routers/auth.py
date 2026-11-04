"""FROZEN capability module — auth-roles (Option-B). Placed verbatim into a generated
app's `api/routers/auth.py` by the TemplateMutationCompiler when the Architect selects the
`auth-roles` capability. Generated APIDev code NEVER edits this file (it is frozen); app
logic calls these endpoints.

Zero new dependencies: password hashing uses stdlib `hashlib.pbkdf2_hmac` + `secrets`, so
the app needs no bcrypt/passlib/jwt package. Sessions are opaque bearer tokens stored in a
`sessions` collection (no external identity provider). Multi-role accounts (the freelancer
reference app's two-sided marketplace) are first-class: a user carries the roles they may
act as plus an `active_role`, and `/api/auth/switch-role` flips it.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import math
import re
import secrets
import time
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError, OperationFailure

# Zero-dep email shape check (pydantic's EmailStr would pull in email-validator).
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

from database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

# The bearer scheme is DECLARED rather than parsed by hand so it reaches the app's OpenAPI
# document: FastAPI records a `SecurityBase` dependency as a `securitySchemes` entry plus a
# per-route `security` requirement, and a raw `Header` parameter records neither. Everything
# downstream that reads the generated app's `/openapi.json` — the extraction the pipeline runs
# against the booted server — otherwise sees every protected endpoint as public.
#
# `auto_error=False` is deliberate and load-bearing, and the reason is VERSION-SPECIFIC — check
# it before bumping the pin. On `fastapi==0.110.0`, which `api/requirements.txt` pins, an absent
# header under `auto_error=True` is a **403** (measured; newer FastAPI answers 401 instead). This
# module has already spent 403 on a different meaning: "you are who you say you are, that value
# is wrong" (`change_password`, `delete_account`, `switch_role`). The frozen `AuthProvider.tsx`
# interceptor keys the whole sign-out path off 401 and deliberately leaves 403 alone, so letting
# FastAPI answer a missing token with 403 would make the one case that really does mean "this
# session is gone" the one case that no longer signs the user out. Owning the refusal also keeps
# it identical across FastAPI versions, which matters more than the saved branch: the test venv
# is NOT on the pinned version, so a behaviour inherited from FastAPI is a behaviour the suite
# cannot speak for. Declaring the scheme is a documentation change; the status code is ours.
_bearer_scheme = HTTPBearer(auto_error=False)

_PBKDF2_ROUNDS = 200_000
# Session lifetime has TWO clocks and they answer different questions.
#
# IDLE is the sliding one: a session stays alive while it is being used. That is what "stay
# signed in" means to a user, and refreshing it is the whole point of tracking `last_seen_at`.
#
# ABSOLUTE is the ceiling, measured from an IMMUTABLE `created_at`. Without it a sliding window
# is renewable forever, so a stolen token is a permanent credential as long as the thief keeps
# using it — the reason `created_at` must never be refreshed in place.
#
# Ninety days is not a validator constraint, though an earlier draft of this comment said it
# was. The integration validator does hold ONE bearer token per validation pass, but
# `_generate_validator_db_name` clears it on every server boot and every boot path mints through
# there, so the binding interval is a single pass — seconds — against a throwaway per-boot
# database. Even a one-minute cap would not expire it. Ninety days is chosen for the user: long
# enough that a working app does not sign people out for no reason, short enough that a stolen
# token stops being a credential inside a quarter.
_SESSION_IDLE_TTL_SECONDS = 30 * 24 * 60 * 60
_SESSION_ABSOLUTE_MAX_SECONDS = 90 * 24 * 60 * 60
# How stale `last_seen_at` must be before a request pays to refresh it. Without this every
# authenticated request is a write; at one day, a session used constantly costs one write a day.
_SESSION_REFRESH_AFTER_SECONDS = 24 * 60 * 60
_MAX_PASSWORD_LEN = 256  # cap so a huge password can't be used to burn PBKDF2 CPU
# RFC 5321's maximum forward-path length, in OCTETS — measured after encoding, not in code
# points, because a cap on code points is not a cap on memory: 254 astral characters are 1016
# bytes. Enforced for the same reason as _MAX_PASSWORD_LEN: an unbounded email is
# attacker-controlled input that this module RETAINS (as a throttle key below, and as a `users`
# document at signup), so without a cap "4096 entries" is not a memory bound at all — 4096
# one-megabyte addresses are 4 GB.
_MAX_EMAIL_LEN = 254
# Privileged roles must never be self-assigned at signup — app logic grants them.
_RESERVED_ROLES = {"admin", "owner", "superuser", "superadmin", "root", "staff", "moderator"}
# T24. One-time codes for email verification and password reset. A CODE rather than a link: a
# generated app is a mobile app, so there is no browser session to land a link in, and a six-digit
# code is something a person can carry from their mail app to the app they are already standing in.
#
# Six digits is a million possibilities, which is only enough BECAUSE of the two bounds below —
# five attempts per code and a fifteen-minute life. Widen either and the digits stop being enough.
_CODE_DIGITS = 6
_CODE_TTL_SECONDS = 15 * 60
_CODE_MAX_ATTEMPTS = 5
# How long before a new code can be requested for the same purpose. Bounds both mail spend and
# using someone else's inbox as a nuisance channel.
_CODE_RESEND_COOLDOWN_SECONDS = 60
#: Purposes are separate namespaces on purpose: a code minted to verify an address must not be
#: usable to reset a password. Without this a verification code mailed to a compromised inbox
#: becomes a password reset.
_PURPOSE_VERIFY_EMAIL = "email_verify"
_PURPOSE_RESET_PASSWORD = "password_reset"
_indexes_ready = False

# Login throttle. Only REFUSED logins count and a success clears the counter, so a client that
# legitimately logs in on every request is never throttled — only one guessing passwords is.
# Same-email logins are serialized (see _login_lock) so the count holds against a concurrent
# attacker; the counter itself is a plain tally of failures.
#
# What this does NOT do, stated plainly because the generous limit invites the opposite reading:
#  - It does not protect a user from a DELIBERATE lockout. An attacker who knows an email can
#    hold it at 429 indefinitely for ~2 requests/minute. Keying on the client IP as well would
#    fix that, but the generated backend sits behind a proxy and the only client address
#    available is a spoofable forwarded header — keying on it would let the same attacker
#    bypass the throttle entirely, which is the worse of the two failures.
#  - It does not bound the PBKDF2 CPU an anonymous caller can spend. The key is the email, so a
#    fresh address per request is never throttled, and `/signup` has the identical sink. That
#    needs per-IP limiting at the edge, not a per-email counter here (TODOS #63).
#
# Keep the budget comfortably above what one INTEGRATION-VALIDATION run does: a contract may
# legitimately carry `expected_status: 401` login steps, and nothing downstream understands a
# 429 — `_classify_endpoint_failure` maps it to the generic "status" kind, which route-infers
# onto this very file. Repair is forbidden to write a frozen file, so a throttled validation
# step would be a gate failure the loop structurally cannot clear.
_LOGIN_MAX_FAILURES = 10
_LOGIN_WINDOW_SECONDS = 300
# In-process and therefore per-worker — a multi-process deploy multiplies the effective limit.
# That is accepted: a shared store is a new dependency, and this module is zero-dep by design.
_LOGIN_ATTEMPT_CAPACITY = 4096
#: email -> (failures in the current window, monotonic time the window opened).
#: An OrderedDict used as an LRU. Bounded in BOTH dimensions or it is itself the
#: memory-exhaustion attack it prevents: _LOGIN_ATTEMPT_CAPACITY bounds the entry count and
#: _MAX_EMAIL_LEN bounds each key, which measures ~1.8 MiB full (str objects, not key bytes).
_login_failures: "OrderedDict[str, Tuple[int, float]]" = OrderedDict()
# Stripes for the per-email login lock (see _login_lock). Fixed-size, so unlike the table above
# it needs no cap: nothing an attacker sends can add an entry.
_LOGIN_LOCK_STRIPES = 64
_login_locks: "List[asyncio.Lock]" = []


#: Mongo's IndexOptionsConflict: createIndex refusing because an index on this key already
#: exists with different options. For THIS module that can only mean a different
#: expireAfterSeconds, because the spec it requests never carries anything else — which is
#: exactly what makes collMod the right repair, since collMod edits the TTL and nothing else.
#:
#: Deliberately NOT widened to 86 (IndexKeySpecsConflict), which mongod 5.0+ raises instead
#: once the existing index carries a partial filter, sparse or unique. (A differing NAME is
#: still 85 on every version from 4.4 to 8.0.) Catching it
#: reads like more coverage and is the opposite: collMod would return successfully having
#: silently dropped every requested option except the TTL. Measured against mongod 8.0 —
#: asking for a PARTIAL TTL over a plain one raises 86, collMod returns normally, and the
#: filter is simply absent from the resulting index. So a release that changed this index's
#: SHAPE rather than its duration would believe it had shipped a change it had not, and on
#: 6.0+ a pre-existing unique index would be preserved into an intermittent 500 in
#: `_issue_token`. If the shape ever does change, the repair is drop-and-recreate; an
#: uncaught 86 is the signal that it has not been written yet.
_INDEX_OPTIONS_CONFLICT = 85
#: Mongo's IndexNotFound, the expected result of dropping an index that is already gone.
_INDEX_NOT_FOUND = 27
#: A deadline already in the past, for a session whose own timestamps cannot be read.
_EXPIRED = datetime.min.replace(tzinfo=timezone.utc)


async def _drop_legacy_created_at_ttl(db) -> None:
    """Remove the pre-T13 TTL index on `created_at`, if this app still has one.

    Not tidying — leaving it is a correctness bug. That index deletes every session 30 days
    after it was ISSUED, which is exactly the deadline the sliding window exists to move: an app
    someone uses daily would sign them out on day 30 regardless, and the new `expires_at` index
    would look like it simply did not work.

    `IndexNotFound` is the expected outcome on every app created after T13 and on every one that
    has already been through this once, so it is the only code swallowed. Anything else — an
    unauthorized user, a read-only replica — propagates, because silently keeping a legacy index
    that deletes live sessions is precisely the failure this exists to prevent.

    Addressed by NAME, which is both broader and narrower than "the legacy TTL index". Broader:
    it removes anything called `created_at_1`, including a plain query index an app happened to
    create on the same field. Narrower: a TTL index built with a custom name, or descending,
    survives. Both are accepted — `created_at_1` is what `create_index("created_at", ...)`
    produces, so it is exactly what THIS module wrote, and dropping a duplicate query index
    costs a rebuild while missing a live TTL index costs sessions.
    """
    try:
        await db["sessions"].drop_index("created_at_1")
    except OperationFailure as exc:
        if exc.code != _INDEX_NOT_FOUND:
            raise


async def _ensure_session_ttl_index(db) -> None:
    """Create the sessions TTL index, or retune the one already there.

    Keyed on `expires_at` with `expireAfterSeconds=0`, i.e. "delete this document once the
    instant in this field has passed". That is what lets each session carry its OWN deadline —
    a single fixed offset from `created_at` cannot express a sliding one.

    `create_index` is idempotent only for IDENTICAL options. Against an existing index on the
    same key with a different `expireAfterSeconds` it raises, so without this the first person
    to change this index's options breaks every app that ever created the old one: signup and
    login both call `_ensure_indexes`, so nobody can get in — existing bearer tokens keep
    working, since `current_user` does not touch the indexes, but no new session can be issued.
    There is no repair path either: this file is frozen, so the loop cannot touch it.

    `collMod` is Mongo's documented way to change a TTL in place. Only the options conflict is
    caught: any other OperationFailure (auth, a read-only replica) is a real failure and
    propagates, because swallowing it would leave the app with no TTL index at all — sessions
    never expiring and the collection growing without bound — and say nothing.

    A collMod failure propagates for the same reason, and it has three measured causes:

      * `Unauthorized` (13). collMod is a dbAdmin action, and the two grants an Atlas
        application user normally holds — readWrite and readWriteAnyDatabase — do NOT include
        it. `MONGODB_URL` is entirely user-supplied, so on such a deployment the repair below
        cannot run and the app stays 500 until the TTL is fixed by hand or the user is granted
        dbAdmin. Not a regression (every conflict used to 500), but it is the reason this is
        documented rather than presented as a guarantee.
      * `InvalidOptions` (72) on mongod <= 5.0, converting a PLAIN index on this key into a
        TTL one. Fixed in 6.0, which is the floor on Atlas.
      * `AmbiguousIndexKeyPattern` (181) when two indexes share `{created_at: 1}` with
        different options, since the repair addresses the index by key pattern. Addressing it
        by NAME instead would fix that and break the commoner case — a differing name is an 85
        this module must still repair — so the key pattern is the deliberate trade.
    """
    await _ensure_ttl_index(db, "sessions", "expires_at")


async def _ensure_ttl_index(db, collection: str, field: str) -> None:
    """Create a `expireAfterSeconds=0` TTL index on `collection.field`, or retune it in place.

    Generalised out of the sessions-only version by T24, which added a SECOND TTL index (for
    `auth_codes`) and gave it a bare `create_index` — reintroducing, on a new index, the exact
    failure the docstring above exists to prevent. Every TTL index in this frozen file goes
    through here now, so the repair cannot be forgotten for the next one: there is no version of
    "we changed a TTL" that should 500 an app forever with no way to fix it.

    Caught against a REAL mongod (8.0.10): re-issuing an identical spec is silently fine, and
    changing `expireAfterSeconds` raises 85, which collMod repairs. See the caveats above for the
    three measured ways the repair itself can fail — they apply here identically.
    """
    try:
        await db[collection].create_index(field, expireAfterSeconds=0)
    except OperationFailure as exc:
        if exc.code != _INDEX_OPTIONS_CONFLICT:
            raise
        await db.command(
            {
                "collMod": collection,
                "index": {
                    "keyPattern": {field: 1},
                    "expireAfterSeconds": 0,
                },
            }
        )


async def _ensure_indexes(db) -> None:
    """Idempotent: create the indexes once per process. Mongo's create_index is itself
    idempotent, but the guard avoids the round-trip on every request. The sessions TTL index
    auto-expires tokens (no server-side revocation infra needed) and bounds collection growth
    for every session this module issues. Rows written before sliding expiry shipped carry no
    `expires_at`, so the index cannot see them and nothing reaps them — they are unreachable
    (their tokens no longer resolve) but not deleted."""
    global _indexes_ready
    if _indexes_ready:
        return
    await db["users"].create_index("email", unique=True)
    await db["sessions"].create_index("token", unique=True)
    await _ensure_session_ttl_index(db)
    await _drop_legacy_created_at_ttl(db)
    # T24 codes. One live code per (user, purpose) — the unique index is what makes a resend
    # REPLACE rather than accumulate, so a user with three codes in their inbox does not have
    # three chances to guess. The TTL is a sweep, not the check: `_consume_code` compares
    # `expires_at` itself, because Mongo's expiry pass is asynchronous and best-effort.
    await db["auth_codes"].create_index([("user_id", 1), ("purpose", 1)], unique=True)
    # Through the hardened helper, NOT a bare create_index. A changed TTL on this index would
    # otherwise 500 every signup, login and reset in every app that ever created the old one,
    # with no repair path because this file is frozen — T6's failure, on a newer index.
    await _ensure_ttl_index(db, "auth_codes", "expires_at")
    _indexes_ready = True


def _pbkdf2(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ROUNDS
    ).hex()


async def _hash_password(password: str, salt: str) -> str:
    # 200k-round PBKDF2 is CPU-bound; run it off the event loop so concurrent auth requests
    # can't stall health checks and every other request on the single-threaded loop.
    return await asyncio.to_thread(_pbkdf2, password, salt)


def _hash_token(token: str) -> str:
    """Session tokens are stored HASHED, never in the clear. `secrets.token_urlsafe(32)` is
    256 bits of entropy, so a plain sha256 is enough — the reason passwords need PBKDF2 (they
    are low-entropy and guessable) does not apply, and a per-request 200k-round KDF on the hot
    `current_user` path would be a self-inflicted DoS. What this buys: a leaked database dump
    or a query-log line no longer hands the reader live sessions for every signed-in user."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _sweep_login_failures(now: float) -> None:
    """Drop entries whose window has elapsed. Called from BOTH the read and the write path:
    only-on-failure would let an attacker fill the table, fall silent, and leave the memory
    resident on an app that never fails a login again."""
    stale = [
        key
        for key, (_, started) in _login_failures.items()
        if now - started >= _LOGIN_WINDOW_SECONDS
    ]
    for key in stale:
        _login_failures.pop(key, None)


def _login_retry_after(email: str) -> int:
    """Seconds the caller must wait, or 0 when it may attempt a login now."""
    now = time.monotonic()
    _sweep_login_failures(now)
    entry = _login_failures.get(email)
    if entry is None:
        return 0
    failures, started = entry
    if failures < _LOGIN_MAX_FAILURES:
        return 0
    # Touched so an entry under active attack is the LAST thing LRU eviction reaches — the
    # attacker's own probing would otherwise age its key to the front, and the flood that
    # fills the table would evict the very counter that is holding it back.
    _login_failures.move_to_end(email)
    return max(1, math.ceil(_LOGIN_WINDOW_SECONDS - (now - started)))


def _record_login_failure(email: str) -> None:
    """Count a login that was actually REFUSED for bad credentials.

    Not "an attempt": charging the counter on the way in and releasing it on success looks
    like it closes the concurrency hole below, and does — but it also throttles a burst of
    CORRECT logins (measured: 15 concurrent valid sign-ins, 5 refused with a 300-second
    Retry-After and a "too many failed attempts" message, on an account that had no failures),
    and it leaks a permanent +1 whenever the database errors mid-request. The lock in `login`
    is what closes the hole; this stays a plain failure count.
    """
    now = time.monotonic()
    _sweep_login_failures(now)
    # The sweep just removed everything whose window elapsed, using this same `now`, so an
    # entry surviving here is always inside its window — no reset branch is reachable.
    failures, started = _login_failures.pop(email, (0, now))
    _login_failures[email] = (failures + 1, started)
    while len(_login_failures) > _LOGIN_ATTEMPT_CAPACITY:
        # LRU eviction. An attacker CAN flush a victim's counter by posting enough distinct
        # emails, which is why the cap is large; a bounded table that forgets is still
        # strictly better than an unbounded one that OOMs.
        _login_failures.popitem(last=False)


def _clear_login_failures(email: str) -> None:
    _login_failures.pop(email, None)


def _reject_if_throttled(email: str) -> None:
    retry_after = _login_retry_after(email)
    if retry_after:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def _login_lock(email: str) -> asyncio.Lock:
    """A STRIPE lock, not one lock per email.

    Serializing same-email logins is what makes the failure budget hold against a concurrent
    attacker rather than only a sequential one: `_hash_password` hands off to a thread, so
    without it every in-flight guess reads the counter before any of them writes it — measured
    at 200 concurrent guesses against a 10-failure budget, all 200 evaluated.

    Striped because a dict of locks keyed by email is one more unbounded attacker-keyed table,
    and the bookkeeping to bound it safely costs more than the occasional collision between two
    unrelated addresses. A stripe is held for the user lookup plus one PBKDF2 — ~16 ms against
    a local database, more when Mongo is remote or the thread pool is busy, so a collision
    costs a queued login rather than a failed one.

    `hash()` is randomized per process, so which addresses share a stripe is not predictable
    from outside; it does not have to be stable across restarts, only within one.
    """
    if not _login_locks:
        # Built on first use rather than at import so the list can be reset. A CONTENDED
        # asyncio.Lock binds to the loop it first blocked on, which matters only where a
        # process runs more than one loop — a test harness, never `uvicorn main:app`.
        _login_locks.extend(asyncio.Lock() for _ in range(_LOGIN_LOCK_STRIPES))
    return _login_locks[hash(email) % _LOGIN_LOCK_STRIPES]


def _roles_of(doc: dict) -> List[str]:
    """The roles an account may act as, whatever its document actually holds.

    **ONE definition, used by the permission check AND the response, and that is the point.**
    `switch_role` used to test `body.role not in doc.get("roles", [])` against the raw value, so
    a `roles` field holding a STRING made `in` a substring test: an account whose roles read
    `"administrator"` could switch into `"admin"` — a role it does not have — and every
    downstream `user['active_role']` check would then believe it. Sanitizing only the response
    would have made that escalation *less* visible rather than fixing it, because the body would
    stop echoing the malformed value.

    `.get("roles", [])` is not enough either: a default applies only to a MISSING key, so an
    explicit `null` returns None — harmless while this shape was typed `dict`, a 500 against
    `AuthUser.roles: List[str]`. And `list(x or [])` is worse than both: `list("admin")` is
    `['a','d','m','i','n']`, five invented roles served with a 200.

    Falling back to NO roles is the only safe direction. A malformed field must not be able to
    invent a permission, and an account that holds nothing readable holds nothing.

    **Elements are filtered, not just the container**, and that is what keeps the narrowing from
    costing more than it buys. `AuthUser.roles` is `List[str]`, so a single non-string element
    makes pydantic reject the whole response — a **500 on /me, /login, /signup AND /switch-role**,
    i.e. an account that can never sign in again on any device, in a file no repair loop can
    touch. The realistic way to get there is an app router's own "become a provider" flow doing
    `$addToSet: {"roles": body.role}` with a null or an int. Dropping the element serves the
    account with the roles it can actually prove, which is both the safe direction for permission
    and the recoverable one for the user.
    """
    roles = doc.get("roles")
    if not isinstance(roles, list):
        return []
    return [role for role in roles if isinstance(role, str)]


def _public_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "roles": _roles_of(doc),
        # Same reasoning as `_roles_of`, one field over: `Optional[str]` rejects an int, and the
        # cost of that rejection is a permanently unsignable-in account rather than a wrong
        # label. None means "no active role", which is what an unreadable one amounts to.
        #
        # This normalizes the RESPONSE only. `current_user` hands a router the RAW document, so
        # an app that writes `active_role` itself — bypassing `switch_role`, which validates
        # against `_roles_of` — still reads back what it wrote. Nothing this module can do about
        # that, and worth knowing before treating this line as a guarantee.
        "active_role": doc["active_role"] if isinstance(doc.get("active_role"), str) else None,
        # `email` deliberately NOT normalized. Every fallback is worse than the failure: an empty
        # string is an identity field the client keys on, and only signup writes this — it is the
        # unique index. A malformed email should be loud.
        # T24. ISO-8601 or None. Exposed so app logic can nudge an unverified user without
        # needing a second endpoint, and so a screen can tell "not verified yet" from
        # "verification is not a thing in this app".
        "verified_at": (
            doc["verified_at"].isoformat() if isinstance(doc.get("verified_at"), datetime) else None
        ),
    }


def _normalized_email(v: str) -> str:
    """Strip, fold case, then length-check — in that order, because a `Field(max_length=...)`
    constraint runs BEFORE the validator and would 422 a legal address that is only over the
    limit while it still carries the whitespace we are about to remove.

    Measured in encoded BYTES. `len()` on a str counts code points, and this value is what
    bounds the throttle table's memory — 254 astral characters are 1016 bytes, i.e. a 4x
    understatement of the bound the caller thinks it set."""
    v = v.strip().lower()
    if len(v.encode("utf-8")) > _MAX_EMAIL_LEN:
        raise ValueError("email address is too long")
    return v


class SignupRequest(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=_MAX_PASSWORD_LEN)
    # Roles the account may act as. Defaults to a single 'user' role; a two-sided
    # marketplace passes e.g. ["client", "provider"]. Privileged roles are rejected here
    # (see _RESERVED_ROLES) — app logic, not self-service signup, grants those.
    roles: List[str] = Field(default_factory=lambda: ["user"])
    active_role: Optional[str] = None

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        v = _normalized_email(v)
        if not _EMAIL_RE.match(v):
            raise ValueError("invalid email address")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str = Field(max_length=_MAX_PASSWORD_LEN)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return _normalized_email(v)


class SwitchRoleRequest(BaseModel):
    role: str


class ChangePasswordRequest(BaseModel):
    # `current_password` carries no min_length: it is checked against the stored hash, and a
    # minimum here would 422 an account whose password predates a raised floor instead of
    # letting its owner change it — the exact person the endpoint exists for.
    current_password: str = Field(max_length=_MAX_PASSWORD_LEN)
    new_password: str = Field(min_length=6, max_length=_MAX_PASSWORD_LEN)


class DeleteAccountRequest(BaseModel):
    #: Re-authentication for an IRREVERSIBLE action. A bearer token is enough to read and
    #: mutate this account's data, but destroying it is the one operation with no undo, so it
    #: costs the password as well — a captured token alone cannot delete the account.
    password: str = Field(max_length=_MAX_PASSWORD_LEN)


class AuthUser(BaseModel):
    """The PUBLIC shape of an account — exactly what `_public_user` builds, and what
    signup/login/me/switch-role put on the wire.

    **Not what `current_user` hands an app router.** That is the raw `users` document, keyed by
    `_id` (a bson `ObjectId`) with no `id` key at all. The two are deliberately different and the
    capability docs say so; typing this one does not merge them.

    Declared as a model rather than left as `dict` so the extracted OpenAPI carries the fields an
    app's screens actually bind to. A bare `dict` documents an auth response as "an object", which
    is the same thing it documents an error as.
    """

    id: str
    email: str
    roles: List[str] = Field(default_factory=list)
    active_role: Optional[str] = None
    #: ISO-8601, or None when the account is unverified or the app has no verification flow.
    #: A string rather than a `datetime` because `_public_user` has already called `.isoformat()`
    #: — typing it as a datetime would re-parse and re-render a value that is already final.
    verified_at: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: AuthUser


async def current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db=Depends(get_db),
) -> dict:
    """FastAPI dependency: resolve the bearer token to a user doc, or 401. App routers
    add `user=Depends(current_user)` to protect an endpoint and read `user['active_role']`
    for role-scoped behavior.

    Returns the RAW users document, not `AuthUser` — see that model's docstring.

    **HTTP routes only.** `HTTPBearer.__call__` takes a `Request`, so this dependency raises a
    `TypeError` on a `@router.websocket` handshake, where the old hand-rolled `Header` parameter
    happened to work. No frozen module has an authenticated socket (`realtime`'s `/ws/{channel}`
    takes none), so nothing ships broken — but an app router that wants one must read the token
    off `websocket.query_params` or the subprotocol and call the lookup itself.
    """
    # `.strip()` is not decoration. FastAPI's header split is `partition(" ")`, which on the
    # version generated apps pin (0.110.0) returns the remainder UNSTRIPPED — so a client
    # sending `Bearer  <token>` with two spaces, or a trailing newline from a copied value,
    # hands us a token that hashes to nothing and 401s a caller holding a perfectly good
    # session. The hand-rolled parser this replaced stripped, so dropping it would be a
    # regression introduced by a change that was supposed to be documentation-only.
    token = (credentials.credentials if credentials else "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    session = await db["sessions"].find_one({"token": _hash_token(token)})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Checked HERE, not left to the TTL index. Mongo's expiry sweep runs about once a minute
    # and is best-effort under load, so an expired session stays readable for an unbounded
    # window after its deadline — relying on the index means a session that is over its limit
    # keeps authenticating until a background task gets round to it.
    now = _now()
    deadline = _session_deadline(session)
    if deadline is not None and now >= deadline:
        # Best-effort: the sweep would get there eventually, but removing it now makes the
        # 401 durable rather than dependent on how busy the server is.
        await db["sessions"].delete_one({"_id": session["_id"]})
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db["users"].find_one({"_id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    await _slide_session(db, session, now)
    return user


def _now() -> datetime:
    """The one place this module reads the wall clock.

    A single seam rather than scattered `datetime.now(timezone.utc)` calls, because the
    alternative for tests is replacing the `datetime` CLASS — which breaks the `isinstance`
    check in `_as_utc`, so every stored timestamp reads as unparseable and every expiry test
    passes for the wrong reason.
    """
    return datetime.now(timezone.utc)


def _as_utc(value) -> Optional[datetime]:
    """A stored datetime as timezone-aware UTC, or None.

    PyMongo returns naive datetimes unless the client was built `tz_aware`, and the generated
    app's is not. Comparing one of those against an aware `now` raises TypeError — inside
    `current_user`, i.e. a 500 on every authenticated request — so the boundary is normalized
    here rather than assumed anywhere.
    """
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _session_deadline(session: dict) -> Optional[datetime]:
    """When this session stops being valid: the earlier of its idle deadline and its absolute
    ceiling. None when the record carries neither, which no session this module issues does.

    `expires_at` may be absent on a session issued before sliding expiry shipped. Falling back
    to `created_at + idle` gives those exactly the window they were sold, rather than treating
    a missing field as either immortal or already dead.
    """
    created_at = _as_utc(session.get("created_at"))
    if created_at is None:
        # No usable `created_at` means the absolute ceiling cannot be computed at all, and a
        # ceiling that silently disappears is the same as not having one — a record with a
        # tampered or corrupted timestamp would authenticate forever. Fails CLOSED: this module
        # writes `created_at` on every session it issues, so a record without one did not come
        # from here.
        return _EXPIRED
    expires_at = _as_utc(session.get("expires_at"))
    if expires_at is None:
        expires_at = created_at + timedelta(seconds=_SESSION_IDLE_TTL_SECONDS)
    ceiling = created_at + timedelta(seconds=_SESSION_ABSOLUTE_MAX_SECONDS)
    return min(expires_at, ceiling)


async def _slide_session(db, session: dict, now: datetime) -> None:
    """Push this session's deadline out, at most once per `_SESSION_REFRESH_AFTER_SECONDS`.

    Two guards, and they do different jobs. The local staleness check avoids the round trip
    entirely on the overwhelmingly common request, using the document already in hand. The
    CONDITIONAL FILTER is what makes it correct: two concurrent requests both pass the local
    check, and only one matches the filter, so the write happens once without a lock or a
    counter (eng review F11).

    Never past the absolute ceiling — sliding is what keeps a live session alive, not a way to
    outlive the cap that makes a stolen token eventually worthless.
    """
    last_seen = _as_utc(session.get("last_seen_at")) or _as_utc(session.get("created_at"))
    if last_seen is not None and now - last_seen < timedelta(
        seconds=_SESSION_REFRESH_AFTER_SECONDS
    ):
        return

    created_at = _as_utc(session.get("created_at")) or now
    deadline = min(
        now + timedelta(seconds=_SESSION_IDLE_TTL_SECONDS),
        created_at + timedelta(seconds=_SESSION_ABSOLUTE_MAX_SECONDS),
    )
    await db["sessions"].update_one(
        {
            "_id": session["_id"],
            "$or": [
                # `$lte`, matching the local check's `<` exactly. With a strict `$lt` the two
                # disagree on the boundary instant: the local check lets the request through
                # and the filter refuses it, so `last_seen_at` never advances and EVERY later
                # request calls update_one. Measured at 31 writes over 20 days instead of 19.
                {"last_seen_at": {"$lte": now - timedelta(seconds=_SESSION_REFRESH_AFTER_SECONDS)}},
                {"last_seen_at": {"$exists": False}},
            ],
        },
        {"$set": {"last_seen_at": now, "expires_at": deadline}},
    )


async def _issue_token(db, user_id: ObjectId) -> str:
    """Returns the RAW token to the caller and stores only its hash — the raw value exists
    nowhere but in the response body and the client's own storage.

    `created_at` is written once and never touched again: it is what the absolute ceiling is
    measured from, and refreshing it would make a stolen token renewable forever.
    """
    token = secrets.token_urlsafe(32)
    now = _now()
    await db["sessions"].insert_one(
        {
            "token": _hash_token(token),
            "user_id": user_id,
            "created_at": now,
            "last_seen_at": now,
            "expires_at": now + timedelta(seconds=_SESSION_IDLE_TTL_SECONDS),
        }
    )
    return token


@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(body: SignupRequest, db=Depends(get_db)):
    await _ensure_indexes(db)
    roles = body.roles or ["user"]
    reserved = [r for r in roles if r.strip().lower() in _RESERVED_ROLES]
    if reserved:
        # Prevent privilege escalation: a user cannot self-assign admin/owner/etc. at signup.
        raise HTTPException(status_code=403, detail=f"Roles not allowed at signup: {reserved}")
    active_role = body.active_role or roles[0]
    if active_role not in roles:
        raise HTTPException(status_code=422, detail="active_role must be one of roles")
    if await db["users"].find_one({"email": body.email}):
        raise HTTPException(status_code=409, detail="Email already registered")
    salt = secrets.token_hex(16)
    doc = {
        "email": str(body.email),
        "salt": salt,
        "password_hash": await _hash_password(body.password, salt),
        "roles": roles,
        "active_role": active_role,
        "created_at": _now(),
        # T24. None until the address is proven. Deliberately does NOT gate login: an app that
        # locks people out until they check their mail loses the ones whose code went to spam, and
        # this module cannot know whether a given app needs that. App logic reads the flag from
        # /api/auth/me and decides.
        "verified_at": None,
    }
    try:
        result = await db["users"].insert_one(doc)
    except DuplicateKeyError:
        # Lost the race against a concurrent signup for the same email — the unique index
        # rejected it. Return the same 409 as the pre-check, not an uncaught 500.
        raise HTTPException(status_code=409, detail="Email already registered")
    doc["_id"] = result.inserted_id
    token = await _issue_token(db, result.inserted_id)
    return {"token": token, "user": _public_user(doc)}


# A fixed dummy salt so a login for a non-existent email still runs the PBKDF2 work an existing
# account would — without it, the fast "user not found" path is a timing oracle for enumerating
# which emails are registered.
_DUMMY_SALT = secrets.token_hex(16)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db=Depends(get_db)):
    await _ensure_indexes(db)
    email = str(body.email)
    # Throttled BEFORE the PBKDF2 work and before the user lookup: the point is to make an
    # online guessing attack expensive for the attacker, not for this server. Applied whether
    # or not the email exists, so the 429 is not itself an account-enumeration oracle. Checked
    # once here without the lock so an already-throttled flood is refused without queueing.
    _reject_if_throttled(email)
    async with _login_lock(email):
        # Re-checked under the lock, and THIS is the authoritative one: same-email logins are
        # serialized, so the count a guess reads already includes every guess before it.
        _reject_if_throttled(email)
        user = await db["users"].find_one({"email": email})
        salt = user.get("salt", _DUMMY_SALT) if user else _DUMMY_SALT
        candidate = await _hash_password(body.password, salt)
        stored = user.get("password_hash", "") if user else ""
        # Constant-time compare so the hash check itself isn't a timing oracle.
        if not user or not hmac.compare_digest(stored, candidate):
            _record_login_failure(email)
            raise HTTPException(status_code=401, detail="Invalid email or password")
        _clear_login_failures(email)
    token = await _issue_token(db, user["_id"])
    return {"token": token, "user": _public_user(user)}


@router.get("/me", response_model=AuthUser)
async def me(user=Depends(current_user)):
    return _public_user(user)


@router.post("/logout", response_model=dict)
async def logout(authorization: Optional[str] = Header(default=None), db=Depends(get_db)):
    """Server-side logout: revoke the bearer token so it can't be reused (client-side header
    clearing alone leaves a captured token valid until its TTL). Idempotent — no error if the
    token is already gone.

    **The one route here that deliberately does NOT take `Depends(_bearer_scheme)`.** FastAPI
    emits a `security` requirement for any route holding a `SecurityBase` dependency and has no
    way to express "optional" — so declaring the scheme here would document a guard this handler
    does not impose. Logout answers 200 to a bare request BY DESIGN, and the pipeline already
    depends on that in production source: `/api/auth/logout` is in
    `IntegrationValidator._UNAUTHENTICATED_AUTH_ROUTES`. A document that disagreed would be a
    standing finding for M2 PR-R's drift diff on a file no agent can repair — the exact class of
    lie this whole change exists to remove.
    """
    scheme, _, param = (authorization or "").partition(" ")
    token = param.strip()
    if scheme.lower() == "bearer" and token:
        await db["sessions"].delete_one({"token": _hash_token(token)})
    return {"ok": True}


@router.post("/switch-role", response_model=AuthUser)
async def switch_role(body: SwitchRoleRequest, user=Depends(current_user), db=Depends(get_db)):
    if body.role not in _roles_of(user):
        raise HTTPException(status_code=403, detail="Role not permitted for this account")
    await db["users"].update_one({"_id": user["_id"]}, {"$set": {"active_role": body.role}})
    user["active_role"] = body.role
    return _public_user(user)


async def _verify_password(user: dict, password: str) -> bool:
    """Constant-time check of a plaintext password against a user document's stored hash.

    Shared by change-password and delete-account so neither grows its own copy of the
    salt-lookup-then-compare dance. `_DUMMY_SALT` is the fallback for the same reason login uses
    it: a document with no salt must still cost the PBKDF2 work rather than answering instantly.
    """
    salt = user.get("salt", _DUMMY_SALT)
    candidate = await _hash_password(password, salt)
    return hmac.compare_digest(user.get("password_hash", ""), candidate)


def _bearer_token_hash(credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    """The hash of the caller's own bearer token, or None if the header is absent/malformed.

    Strips for the reason `current_user` strips: on the pinned FastAPI the credential arrives
    with any extra separator whitespace still attached, and an unstripped value here hashes to
    something no session holds — which would silently turn "keep the caller's own session" into
    "revoke every session including the caller's".
    """
    token = (credentials.credentials if credentials else "").strip()
    return _hash_token(token) if token else None


@router.post("/change-password", response_model=dict)
async def change_password(
    body: ChangePasswordRequest,
    user=Depends(current_user),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db=Depends(get_db),
):
    """Rotate this account's password, then sign every OTHER device out.

    Answers **403** — never 401 — when `current_password` is wrong. This is not cosmetic: the
    frozen AuthProvider registers a response interceptor that treats ANY 401 on an
    authenticated request as "this session is gone", clears the token and signs the user out.
    A 401 here would mean a single typo in the current-password field logged you out of the app,
    with the new password never set. 403 says "you are who you say you are, that value is wrong".

    A failure here deliberately does NOT feed the login throttle. That table is keyed by email,
    and its own comment above records that an attacker who knows an address can hold it at 429;
    letting an authenticated endpoint add to the count would hand exactly that lockout to anyone
    holding a stolen token — the person the password rotation is trying to evict.

    Sessions: every session for this user is revoked EXCEPT the caller's own, so rotating your
    password evicts a thief without also signing you out of the device you are typing on. That
    choice is pinned by `test_changing_the_password_keeps_the_callers_session_and_kills_the_rest`.
    """
    if not await _verify_password(user, body.current_password):
        raise HTTPException(status_code=403, detail="Current password is incorrect")

    # Sessions are revoked BEFORE the new password is written, and that order is the
    # crash-safety property — the same argument `delete_account` makes for deleting the user
    # first. Crash after the write but before the revoke leaves the password rotated and the
    # thief's session still authenticating: the security goal silently unmet, with nothing to
    # tell the user their rotation did not do the thing they rotated for. Crash in THIS order
    # leaves the password unchanged and the other devices signed out — conservative, and visible
    # enough that the user simply tries again.
    revoke = {"user_id": user["_id"]}
    keep = _bearer_token_hash(credentials)
    if keep is not None:
        revoke["token"] = {"$ne": keep}
    await db["sessions"].delete_many(revoke)

    # A NEW salt as well as a new hash: reusing the old salt would leave two hashes of two
    # different passwords under one salt, which is not a break here but is the habit that becomes
    # one the moment anything precomputes against a known salt.
    new_salt = secrets.token_hex(16)
    # CONDITIONAL on the very hash this request verified. Without that filter the check above and
    # the write below are a read-modify-write across an await, over a document another request can
    # change in between: two concurrent rotations both verify the same old password and both
    # write, so the loser's new password is silently discarded while its caller is told the change
    # succeeded — and the user then cannot log in with the password the app accepted from them.
    result = await db["users"].update_one(
        {"_id": user["_id"], "password_hash": user.get("password_hash", "")},
        {
            "$set": {
                "salt": new_salt,
                "password_hash": await _hash_password(body.new_password, new_salt),
            }
        },
    )
    if result.matched_count == 0:
        # 409, not 401: a 401 would make the frozen provider's interceptor sign the user out.
        raise HTTPException(
            status_code=409, detail="Password was changed by another request. Try again."
        )
    return {"ok": True}


@router.delete("/me", response_model=dict)
async def delete_account(
    body: DeleteAccountRequest, user=Depends(current_user), db=Depends(get_db)
):
    """Delete this account and every session it owns. Requires the password (see
    `DeleteAccountRequest`) and answers 403 on a wrong one, for the interceptor reason spelled
    out in `change_password`.

    **This does NOT delete the app's own documents, and that is a decided scope, not an
    oversight.** Documents in generated collections carry no ownership field — nothing in the
    pipeline requires or verifies one (TODOS #65) — so there is no link from a document back to
    this user to cascade along. The consequence worth stating plainly for a store review: what
    remains after this call is data that was never associated with the account in the first
    place, rather than retained personal data belonging to a deleted user.

    Deletion order is the USER FIRST, then its sessions, and that is deliberate. `current_user`
    already answers 401 "User no longer exists" for a session whose user is gone, so a crash
    between the two statements leaves tokens that are inert. The reverse order would leave a live
    account with no sessions — whose password still works — which is a failed deletion that looks
    like a successful one.
    """
    if not await _verify_password(user, body.password):
        raise HTTPException(status_code=403, detail="Password is incorrect")
    await db["users"].delete_one({"_id": user["_id"]})
    await db["sessions"].delete_many({"user_id": user["_id"]})
    return {"ok": True}


# ============================================================================================
# T24 — email verification and password reset by one-time code.
#
# HOW MAIL LEAVES A GENERATED APP. It has no provider credentials of its own, so it posts to
# Naapy's shared proxy, authenticating with the pair NAAPY_WORKSPACE_ID + PREVIEW_TOKEN that the
# preview host injects. That pair IS the tier boundary, and its absence is load-bearing in two
# places rather than being an oversight:
#
#   * a RELEASE build carries no preview token, so a store binary cannot spend Naapy's mail;
#   * a VALIDATOR run has none either (PREVIEW_TOKEN is set only on the hosted preview path),
#     so a validation pass structurally cannot email a real person. That is why this module
#     needs no test-mode switch: the credential it would need simply is not there.
#
# Sent over stdlib urllib in a worker thread, not httpx. This module promises zero new
# dependencies (see the file header) and the generated app's requirements.txt has no HTTP client;
# `asyncio.to_thread` is what keeps a blocking send off the event loop.
# ============================================================================================
_MAIL_PROXY_PATH = "/api/mail/send"
_MAIL_TIMEOUT_SECONDS = 15


class _MailUnavailable(RuntimeError):
    """This app cannot send email at all — no proxy URL, or no preview-token pair."""


def _mail_proxy_target() -> Tuple[str, str, str]:
    """(url, workspace_id, preview_token), or raise `_MailUnavailable`.

    All three are required. A missing one is not a degraded send, it is no send — and the reason
    matters when reading a log: a release build legitimately has no token, while a preview missing
    NAAPY_API_BASE_URL is a misconfiguration on Naapy's side.
    """
    import os

    base = (os.environ.get("NAAPY_API_BASE_URL") or "").strip().rstrip("/")
    workspace_id = (os.environ.get("NAAPY_WORKSPACE_ID") or "").strip()
    token = (os.environ.get("PREVIEW_TOKEN") or "").strip()
    if not base:
        raise _MailUnavailable("NAAPY_API_BASE_URL is unset, so there is no mail proxy to reach")
    if not workspace_id or not token:
        # The expected state for a release build and for a validator run. Named as such so nobody
        # reads it as a bug and "fixes" it by baking a token into a store binary.
        raise _MailUnavailable(
            "no NAAPY_WORKSPACE_ID + PREVIEW_TOKEN pair — this build is not a hosted preview, so "
            "it cannot use Naapy's shared mail tier"
        )
    return base + _MAIL_PROXY_PATH, workspace_id, token


#: Bounded because the value is surfaced in this app's own UI and logs, and an error body is not
#: something this app controls the size of.
_MAX_PROXY_DETAIL_LEN = 200


def _proxy_detail(exc) -> str:
    """The proxy's `detail`, as a `: reason` suffix, or "" when there isn't one.

    Never raises and never re-raises: this runs while ALREADY handling a failed send, so a
    surprise here would replace a useful "domain not verified" with an unrelated traceback.
    """
    import json as _json

    try:
        body = exc.read().decode("utf-8", "replace")
    except Exception:
        return ""
    try:
        detail = _json.loads(body).get("detail")
    except Exception:
        detail = body
    if not isinstance(detail, str) or not detail.strip():
        return ""
    return ": " + " ".join(detail.split())[:_MAX_PROXY_DETAIL_LEN]


def _post_mail(url: str, workspace_id: str, token: str, payload: dict) -> None:
    """Blocking POST to the proxy. Runs in a thread — see `_send_app_email`."""
    import json as _json
    import urllib.error
    import urllib.request

    request = urllib.request.Request(
        url,
        data=_json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Naapy-Workspace-Id": workspace_id,
            "X-Preview-Token": token,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=_MAIL_TIMEOUT_SECONDS) as response:
            if response.status >= 300:  # pragma: no cover - urlopen raises on 4xx/5xx
                raise _MailUnavailable(f"mail proxy answered {response.status}")
    except urllib.error.HTTPError as exc:
        # 429 is the shared-tier cap, 503 is "no provider configured", 502 is the upstream provider
        # refusing. All three are the proxy working correctly, and each carries a `detail` saying
        # which — so the body is READ here rather than thrown away. An earlier version of this
        # claimed to carry the detail through while passing only `exc.code`, which is why a
        # misconfigured shared tier reached a user as the bare word "500".
        raise _MailUnavailable(
            f"mail proxy refused the send ({exc.code}){_proxy_detail(exc)}"
        ) from exc
    except urllib.error.URLError as exc:
        raise _MailUnavailable(f"mail proxy unreachable: {exc.reason}") from exc


async def _send_app_email(to: str, subject: str, text: str) -> None:
    """Send one email through Naapy's proxy, or raise `_MailUnavailable`."""
    url, workspace_id, token = _mail_proxy_target()
    await asyncio.to_thread(
        _post_mail, url, workspace_id, token, {"to": to, "subject": subject, "text": text}
    )


def _new_code() -> str:
    """A zero-padded numeric code. `secrets.randbelow` rather than `random`: this value is a
    credential for the next fifteen minutes."""
    return f"{secrets.randbelow(10 ** _CODE_DIGITS):0{_CODE_DIGITS}d}"


async def _issue_code(db, user_id: ObjectId, purpose: str) -> Optional[str]:
    """Mint and store a code, or return None when the cooldown says not yet.

    Stores only the HASH, for the same reason session tokens are hashed: a database copy must not
    be a set of live credentials. The upsert on (user_id, purpose) is what makes a resend REPLACE —
    three codes in an inbox would be three chances to guess.
    """
    now = _now()
    existing = await db["auth_codes"].find_one({"user_id": user_id, "purpose": purpose})
    if existing is not None:
        issued_at = _as_utc(existing.get("created_at"))
        if issued_at is not None and now - issued_at < timedelta(
            seconds=_CODE_RESEND_COOLDOWN_SECONDS
        ):
            return None
    # ATTEMPTS CARRY FORWARD across a replacement, and that is the whole reason the five-guess
    # bound means anything. Resetting them here would make the bound "five guesses per resend": an
    # attacker who knows an address drives /forgot-password once a minute and gets five fresh
    # guesses each time, indefinitely, against a space of only a million. Carried forward, five
    # wrong guesses close the door for the rest of the code's fifteen-minute life however many
    # codes are requested.
    #
    # The cost is a deliberate one: someone who fumbles five times waits for the window rather than
    # resending out of it. And as with the login throttle, an attacker who knows an address can hold
    # that door shut — the same trade, recorded in the same place, for the same reason.
    carried = int((existing or {}).get("attempts", 0)) if existing is not None else 0
    if existing is not None:
        previous_deadline = _as_utc(existing.get("expires_at"))
        if previous_deadline is None or now >= previous_deadline:
            carried = 0   # the old window closed on its own; a new one starts clean
    code = _new_code()
    await db["auth_codes"].update_one(
        {"user_id": user_id, "purpose": purpose},
        {
            "$set": {
                "user_id": user_id,
                "purpose": purpose,
                "code_hash": _hash_token(code),
                "created_at": now,
                "expires_at": now + timedelta(seconds=_CODE_TTL_SECONDS),
                "attempts": carried,
            }
        },
        upsert=True,
    )
    return code


async def _consume_code(db, user_id: ObjectId, purpose: str, code: str) -> None:
    """Spend a code, or raise HTTPException. Success means the code is GONE.

    The single-use guarantee is the `delete_one` result, not the read: two requests arriving with
    the same valid code both pass the comparison, and only the one whose delete matched may
    proceed. Checking `deleted_count` is what makes that a guarantee rather than a race.

    Expiry is compared here rather than left to the TTL index, for the reason `current_user`
    already does it: Mongo's expiry sweep is asynchronous and best-effort, so an expired code stays
    readable for an unbounded window after its deadline.
    """
    doc = await db["auth_codes"].find_one({"user_id": user_id, "purpose": purpose})
    if doc is None:
        raise HTTPException(status_code=400, detail="That code is not valid. Request a new one.")

    deadline = _as_utc(doc.get("expires_at"))
    if deadline is None or _now() >= deadline:
        await db["auth_codes"].delete_one({"_id": doc["_id"]})
        raise HTTPException(status_code=400, detail="That code has expired. Request a new one.")

    if int(doc.get("attempts", 0)) >= _CODE_MAX_ATTEMPTS:
        # Burned by BLANKING the hash, not by deleting the row. Deleting would take the attempt
        # count with it, and `_issue_code` carries that count forward — so a delete here would hand
        # the bypass back: burn five, request a new code, get five more. An empty hash can never
        # match, because `_hash_token` of anything is 64 hex characters.
        await db["auth_codes"].update_one({"_id": doc["_id"]}, {"$set": {"code_hash": ""}})
        raise HTTPException(
            status_code=400, detail="Too many incorrect attempts. Request a new code."
        )

    if not hmac.compare_digest(str(doc.get("code_hash", "")), _hash_token(code)):
        await db["auth_codes"].update_one({"_id": doc["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="That code is not valid.")

    result = await db["auth_codes"].delete_one({"_id": doc["_id"]})
    if getattr(result, "deleted_count", 0) != 1:
        raise HTTPException(status_code=400, detail="That code has already been used.")


class VerifyEmailRequest(BaseModel):
    code: str = Field(min_length=1, max_length=32)


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return _normalized_email(v)


class ResetPasswordRequest(BaseModel):
    email: str
    code: str = Field(min_length=1, max_length=32)
    new_password: str = Field(min_length=6, max_length=_MAX_PASSWORD_LEN)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return _normalized_email(v)


@router.post("/request-email-verification", response_model=dict)
async def request_email_verification(user=Depends(current_user), db=Depends(get_db)):
    """Mail the signed-in user a verification code. Authenticated, so no enumeration concern."""
    await _ensure_indexes(db)
    if user.get("verified_at") is not None:
        return {"ok": True, "already_verified": True}
    code = await _issue_code(db, user["_id"], _PURPOSE_VERIFY_EMAIL)
    if code is None:
        raise HTTPException(
            status_code=429,
            detail=f"A code was just sent. Wait {_CODE_RESEND_COOLDOWN_SECONDS}s before asking "
                   "for another.",
        )
    try:
        await _send_app_email(
            str(user["email"]),
            "Your verification code",
            f"Your verification code is {code}. It expires in "
            f"{_CODE_TTL_SECONDS // 60} minutes.",
        )
    except _MailUnavailable as exc:
        # The code is dropped rather than left waiting for mail that will never arrive — otherwise
        # the cooldown blocks a retry after the transport is fixed.
        await db["auth_codes"].delete_one({"user_id": user["_id"], "purpose": _PURPOSE_VERIFY_EMAIL})
        raise HTTPException(status_code=503, detail=f"Email is not available: {exc}")
    return {"ok": True}


@router.post("/verify-email", response_model=dict)
async def verify_email(
    body: VerifyEmailRequest, user=Depends(current_user), db=Depends(get_db)
):
    """Prove the address. Idempotent-ish: an already-verified account reports success without
    spending a code, so a double tap is not an error."""
    await _ensure_indexes(db)
    if user.get("verified_at") is not None:
        return {"ok": True, "already_verified": True}
    await _consume_code(db, user["_id"], _PURPOSE_VERIFY_EMAIL, body.code)
    now = _now()
    await db["users"].update_one({"_id": user["_id"]}, {"$set": {"verified_at": now}})
    return {"ok": True, "verified_at": now.isoformat()}


@router.post("/forgot-password", response_model=dict)
async def forgot_password(body: ForgotPasswordRequest, db=Depends(get_db)):
    """Start a reset. ALWAYS answers 200 with the same body.

    Enumeration safety is the whole shape of this endpoint: a 404 for an unknown address turns it
    into a free "is this person a user of this app" oracle, which for some generated apps — a
    therapy directory, a dating app — is the sensitive fact rather than an incidental one.

    Honest limit: the RESPONSE is identical, but the work is not. An existing address costs a code
    write and a proxy round trip, so a determined attacker can still distinguish by timing. Closing
    that needs the send moved off the request path, which needs a queue this module does not have.
    The body and status are what a casual prober sees, and they are identical.
    """
    await _ensure_indexes(db)
    user = await db["users"].find_one({"email": str(body.email)})
    if user is not None:
        code = await _issue_code(db, user["_id"], _PURPOSE_RESET_PASSWORD)
        # A cooldown hit is silent here. Telling the caller "wait 60s" would confirm the address
        # exists, which is precisely what this endpoint refuses to reveal.
        if code is not None:
            try:
                await _send_app_email(
                    str(user["email"]),
                    "Your password reset code",
                    f"Your password reset code is {code}. It expires in "
                    f"{_CODE_TTL_SECONDS // 60} minutes. If you did not ask for this, ignore "
                    "this message — your password has not changed.",
                )
            except _MailUnavailable:
                # Swallowed deliberately: a 503 here would also be an oracle, since it can only
                # happen on the branch where the address exists.
                await db["auth_codes"].delete_one(
                    {"user_id": user["_id"], "purpose": _PURPOSE_RESET_PASSWORD}
                )
    return {"ok": True, "detail": "If that address has an account, a reset code is on its way."}


@router.post("/reset-password", response_model=dict)
async def reset_password(body: ResetPasswordRequest, db=Depends(get_db)):
    """Finish a reset: consume the code, set the password, and sign every device out.

    Revoking ALL sessions is the point rather than a side effect. Someone resetting a password is
    frequently someone who believes another person has access, and leaving that person's session
    alive makes the reset theatre. There is no session to preserve here anyway — this endpoint is
    unauthenticated by construction.
    """
    await _ensure_indexes(db)
    user = await db["users"].find_one({"email": str(body.email)})
    if user is None:
        # Same message as a wrong code. Distinguishing them would rebuild the oracle that
        # /forgot-password exists to avoid.
        raise HTTPException(status_code=400, detail="That code is not valid. Request a new one.")

    await _consume_code(db, user["_id"], _PURPOSE_RESET_PASSWORD, body.code)

    new_salt = secrets.token_hex(16)
    await db["users"].update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "salt": new_salt,
                "password_hash": await _hash_password(body.new_password, new_salt),
            }
        },
    )
    await db["sessions"].delete_many({"user_id": user["_id"]})
    # A reset also proves control of the inbox, so it verifies the address if it was not already.
    # Not doing this would leave a user who reset their password still nagged to "verify" the very
    # mailbox they just received a code at.
    if user.get("verified_at") is None:
        await db["users"].update_one({"_id": user["_id"]}, {"$set": {"verified_at": _now()}})
    _clear_login_failures(str(body.email))
    return {"ok": True}
