from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
import logging
import os
import sys
import traceback
import time
import json
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from config import get_settings
from database import ping_db, close_db, get_db
from schemas import StatusResponse

# Load settings early so logging config can use them
settings = get_settings()

# ============================================================
# Logging Configuration - Debug mode for development
# ============================================================
_level_name = (settings.LOG_LEVEL or "INFO").upper()
LOG_LEVEL = getattr(logging, _level_name, logging.INFO)
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

SENSITIVE_KEYS = {
    "password",
    "token",
    "secret",
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "authorization",
}


def mask_sensitive_data(value):
    """Recursively mask sensitive values inside dicts/lists."""
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if str(k).lower() in SENSITIVE_KEYS:
                out[k] = "***MASKED***"
            else:
                out[k] = mask_sensitive_data(v)
        return out
    if isinstance(value, list):
        return [mask_sensitive_data(v) for v in value]
    return value


def sanitize_query_params(query_params):
    """Return a sanitized dict of query params (masking sensitive keys)."""
    qp = dict(query_params)
    out = {}
    for k, v in qp.items():
        if str(k).lower() in SENSITIVE_KEYS:
            out[k] = "***MASKED***"
        else:
            out[k] = v
    return out


def redact_db_url(db_url: str) -> str:
    """
    Best-effort redaction for DB URLs to avoid leaking credentials in logs.
    Keeps scheme + host/port + path, removes user/password.
    """
    try:
        if not db_url:
            return ""
        parts = urlsplit(db_url)
        netloc = parts.hostname or ""
        if parts.port:
            netloc = f"{netloc}:{parts.port}"
        return urlunsplit((parts.scheme, netloc, parts.path, "", ""))
    except Exception:
        return "<redacted>"

# ============================================================
# Helper function to log all registered routes
# ============================================================
def log_registered_routes(app: FastAPI):
    """Log all registered routes for debugging"""
    logger.info("   📋 All registered routes:")
    route_count = 0
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            methods = sorted(route.methods - {"HEAD", "OPTIONS"})
            if methods:
                methods_str = ", ".join(methods)
                logger.info(f"      {methods_str:20} {route.path}")
                route_count += 1
    logger.info(f"   ✅ Total: {route_count} routes registered")


# ============================================================
# Async Lifespan: Initialize and cleanup MongoDB connection
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Async lifespan context manager for FastAPI.

    Startup: Test MongoDB connection and create shared-flat indexes
    Shutdown: Close MongoDB client
    """
    logger.info("🚀 Starting up API server...")
    logger.info(f"   Project: {settings.PROJECT_NAME}")
    logger.info(f"   Version: {settings.VERSION}")

    # Test MongoDB connection and create indexes used by shared-flat routes.
    try:
        logger.info("   🔍 Testing MongoDB connection...")
        await ping_db()
        logger.info(f"   ✅ MongoDB connection successful: {redact_db_url(settings.MONGODB_URL)}")
        logger.info(f"   📦 Database: {settings.MONGODB_DATABASE}")

        db = await get_db()
        await db["flatmates"].create_index("user_id", unique=True)
        await db["flatmates"].create_index("flat_key")
        await db["items"].create_index([("flat_key", 1), ("created_at", -1)])
        await db["items"].create_index("payer_id")
        logger.info("   ✅ Shared-flat indexes ready")
    except Exception as e:
        logger.error(f"   ❌ MongoDB connection or index setup failed: {type(e).__name__}: {str(e)}")
        logger.error(f"   MongoDB URL: {redact_db_url(settings.MONGODB_URL)}")
        if settings.DEBUG:
            logger.error(f"   Stack trace: {traceback.format_exc()}")
        else:
            logger.exception("   MongoDB setup exception details:")
        raise

    # Log routes in debug mode
    if settings.DEBUG:
        log_registered_routes(app)

    yield  # App is running

    # Shutdown: close MongoDB connection
    logger.info("🛑 Shutting down API server...")
    await close_db()
    logger.info("   ✅ MongoDB connection closed")


# ============================================================
# FastAPI App with async lifespan
# ============================================================
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)


# ============================================================
# CORS Middleware - Required for mobile preview (web iframe)
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Preview auth gate - the hosted (Fly) backend is publicly reachable, so require a
# per-preview token on every request except health and CORS preflight. Active only
# when PREVIEW_TOKEN is set (hosted preview); local dev leaves it unset.
# ============================================================
_PREVIEW_TOKEN = os.environ.get("PREVIEW_TOKEN")


@app.middleware("http")
async def _preview_token_gate(request: Request, call_next):
    if _PREVIEW_TOKEN and request.method != "OPTIONS" and request.url.path != "/api/health":
        if request.headers.get("X-Preview-Token") != _PREVIEW_TOKEN:
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid preview token"})
    return await call_next(request)


# ============================================================
# Global Exception Handlers - Catches ALL errors with details
# ============================================================
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed logging"""
    logger.error(f"❌ Validation Error on {request.method} {request.url.path}")
    logger.error(f"   Errors: {exc.errors()}")

    # Try to log the request body that caused the error (sanitized + bounded)
    try:
        request_id = getattr(request.state, "request_id", "unknown")
        content_type = (request.headers.get("content-type") or "").lower()
        content_length = request.headers.get("content-length")
        body_max_bytes = 64 * 1024

        if content_length and content_length.isdigit() and int(content_length) > body_max_bytes:
            logger.error(f"   [{request_id}] Request Body: <skipped: content-length {content_length} exceeds {body_max_bytes} bytes>")
        elif any(ct in content_type for ct in ["multipart/form-data", "application/octet-stream"]):
            logger.error(f"   [{request_id}] Request Body: <skipped: content-type {content_type}>")
        else:
            body = await request.body()
            if body:
                try:
                    body_json = json.loads(body.decode("utf-8", errors="replace"))
                    logger.error(
                        f"   [{request_id}] Request Body: {json.dumps(mask_sensitive_data(body_json), separators=(',', ':'))}"
                    )
                except json.JSONDecodeError:
                    logger.error(f"   [{request_id}] Request Body (raw): {body.decode('utf-8', errors='replace')[:500]}")
    except:
        pass

    # Format errors for response
    error_messages = []
    for error in exc.errors():
        loc = " -> ".join(str(l) for l in error["loc"])
        msg = error["msg"]
        error_messages.append(f"{loc}: {msg}")

    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation Error",
            # ENCODED, NOT RAW, and this is not defensive tidying — it is the whole bug.
            #
            # Under pydantic v2 a custom `field_validator` that raises `ValueError` puts the
            # EXCEPTION INSTANCE into the error's `ctx`. `json.dumps` cannot serialise it, so
            # this handler raised `TypeError: Object of type ValueError is not JSON
            # serializable`, the global Exception handler caught THAT, and a bad request body
            # came back as a 500 whose message named a serialisation failure instead of the
            # real problem. FastAPI's own default handler calls `jsonable_encoder` first; this
            # replacement dropped it, and every generated app inherited that.
            #
            # Built-in pydantic errors were unaffected — their ctx is serialisable — which is
            # exactly why it survived: the common path looked right. Measured on the Wander
            # build's own backend (2026-09-12): {"display_name": 123} gave a clean 422, and
            # {"distance_unit": "miles"} gave a 500. Then it failed a real run's backend gate
            # on `POST /api/trips` with reversed dates — a failure APIDev could not repair,
            # because the defect is in this frozen file and not in anything it wrote.
            "errors": jsonable_encoder(exc.errors()),
            "message": "; ".join(error_messages)
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with logging"""
    logger.warning(f"⚠️  HTTP {exc.status_code} on {request.method} {request.url.path}")
    logger.warning(f"   Detail: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all handler for unexpected errors"""
    logger.error(f"💥 Unhandled Exception on {request.method} {request.url.path}")
    logger.error(f"   Type: {type(exc).__name__}")
    if settings.DEBUG:
        logger.error(f"   Message: {str(exc)}")
        logger.error(f"   Stack Trace:\n{''.join(traceback.format_tb(exc.__traceback__))}")
    else:
        logger.exception("   Exception details (stack trace):")

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
            **(
                {"error_type": type(exc).__name__, "message": str(exc)}
                if settings.DEBUG
                else {}
            )
        }
    )


# ============================================================
# Request Logging Middleware - Logs ALL incoming requests
# ============================================================
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Generate (or forward) a request ID for tracking
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    request.state.request_id = request_id

    # Start timing
    start_time = time.perf_counter()

    # Log incoming request
    logger.info(f"📥 [{request_id}] {request.method} {request.url.path}")
    # Avoid leaking query strings in logs; log sanitized query params separately.
    logger.debug(f"   [{request_id}] Full URL: {request.url.replace(query='')}")
    logger.debug(f"   [{request_id}] Client: {request.client.host if request.client else 'unknown'}")

    # Log query parameters if present
    if request.query_params:
        logger.debug(f"   [{request_id}] Query Params: {sanitize_query_params(request.query_params)}")

    # Log request body for POST/PUT/PATCH (we need to cache it to avoid breaking downstream)
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            content_type = (request.headers.get("content-type") or "").lower()
            content_length = request.headers.get("content-length")
            body_max_bytes = 64 * 1024  # keep logs bounded

            # Avoid buffering/logging large bodies and common binary uploads
            should_read_body = True
            if content_length and content_length.isdigit() and int(content_length) > body_max_bytes:
                should_read_body = False
                logger.info(f"   [{request_id}] Body: <skipped: content-length {content_length} exceeds {body_max_bytes} bytes>")
            elif any(ct in content_type for ct in ["multipart/form-data", "application/octet-stream"]):
                should_read_body = False
                logger.info(f"   [{request_id}] Body: <skipped: content-type {content_type}>")

            if should_read_body:
                body = await request.body()
                if body:
                    # Try to parse as JSON for prettier logging
                    try:
                        body_json = json.loads(body.decode("utf-8", errors="replace"))
                        logger.info(f"   [{request_id}] Body: {json.dumps(mask_sensitive_data(body_json), separators=(',', ':'))}")
                    except json.JSONDecodeError:
                        logger.info(f"   [{request_id}] Body (raw): {body.decode('utf-8', errors='replace')[:500]}")
        except Exception as e:
            logger.debug(f"   [{request_id}] Could not read body: {e}")

    # If we consumed the body, we need to allow downstream to read it again.
    # ASGI: subsequent calls should return an empty body with more_body=False (not http.disconnect).
    if body is not None:
        cached_body = body
        body_sent = False

        async def receive():
            nonlocal body_sent, cached_body
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": cached_body, "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        request = Request(request.scope, receive)

    # Process the request
    try:
        response = await call_next(request)
    except Exception as e:
        # Log any exception that bubbles up
        process_time = time.perf_counter() - start_time
        logger.error(f"💥 [{request_id}] Exception after {process_time:.3f}s: {type(e).__name__}: {str(e)}")
        raise

    # Calculate processing time
    process_time = time.perf_counter() - start_time

    # Log response
    status_emoji = "✅" if response.status_code < 400 else "❌"
    logger.info(f"📤 [{request_id}] {status_emoji} {response.status_code} in {process_time:.3f}s")

    # Propagate request id to clients (helps correlate client/server logs)
    response.headers["X-Request-ID"] = request_id

    # Extra logging for errors
    if response.status_code >= 400:
        logger.warning(f"   [{request_id}] Error Response: {response.status_code}")
        if response.status_code == 404:
            # Show available routes that might match
            requested_path = request.url.path
            requested_method = request.method
            logger.warning(f"   [{request_id}] ❌ Route not found: {requested_method} {requested_path}")

            # Collect all routes
            all_routes = []
            matching_method_routes = []
            similar_path_routes = []

            for route in app.routes:
                if hasattr(route, "methods") and hasattr(route, "path"):
                    route_methods = sorted(route.methods - {"HEAD", "OPTIONS"})
                    if route_methods:
                        methods_str = ", ".join(route_methods)
                        route_info = (methods_str, route.path)
                        all_routes.append(route_info)

                        # Routes matching the requested method
                        if requested_method in route.methods:
                            matching_method_routes.append(route_info)

                        # Routes with similar path (same first segment)
                        requested_first_seg = requested_path.split("/")[1] if len(requested_path.split("/")) > 1 else ""
                        route_first_seg = route.path.split("/")[1] if len(route.path.split("/")) > 1 else ""
                        if requested_first_seg and route_first_seg and requested_first_seg == route_first_seg:
                            similar_path_routes.append(route_info)

            # Show routes in priority order
            if matching_method_routes:
                logger.warning(f"   [{request_id}] 💡 Routes with {requested_method} method:")
                for methods, path in matching_method_routes:
                    logger.warning(f"      {methods:20} {path}")

            if similar_path_routes and not matching_method_routes:
                logger.warning(f"   [{request_id}] 💡 Routes with similar path:")
                for methods, path in similar_path_routes[:5]:
                    logger.warning(f"      {methods:20} {path}")

            # Always show all routes if we don't have good matches
            if not matching_method_routes and not similar_path_routes:
                logger.warning(f"   [{request_id}] 💡 All available routes:")
                for methods, path in all_routes:
                    logger.warning(f"      {methods:20} {path}")

            logger.warning(f"   [{request_id}] 💡 Tip: Use GET /debug/routes to see all endpoints")

        elif response.status_code == 422:
            logger.warning(f"   [{request_id}] Hint: Check request body format and required fields")
        elif response.status_code == 401:
            logger.warning(f"   [{request_id}] Hint: Authentication required - check token/credentials")
        elif response.status_code == 403:
            logger.warning(f"   [{request_id}] Hint: Permission denied - check user permissions")
        elif response.status_code >= 500:
            logger.error(f"   [{request_id}] Server Error! Check logs above for details")

    return response


@app.get("/", response_model=StatusResponse)
def read_root():
    logger.debug("Health check: root endpoint called")
    return StatusResponse(status="ok", message=f"{settings.PROJECT_NAME} API is running")

@app.get("/api/health")
async def api_health_check():
    """App-specific health check for the validator and the preview host."""
    logger.debug("Health check: /api/health endpoint called")
    workspace_id = os.environ.get("NAAPY_WORKSPACE_ID")
    if not workspace_id:
        # Infer from filesystem: .../workspaces/<workspace_id>/api/main.py
        try:
            p = Path(__file__).resolve()
            if p.parents[1].name and p.parents[2].name == "workspaces":
                workspace_id = p.parents[1].name
        except Exception:
            workspace_id = None

    # Fast DB connectivity probe so an unreachable Atlas is visible here, not only as
    # failing data requests later.
    db_ok = False
    try:
        await ping_db()
        db_ok = True
    except Exception as e:
        logger.warning(f"Health DB ping failed: {e}")

    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "debug": settings.DEBUG,
        "workspace_id": workspace_id,
        "revision": os.environ.get("NAAPY_REVISION"),
        "db": "connected" if db_ok else "error",
    }

@app.get("/debug/routes")
def list_routes():
    """List all available routes - helpful for debugging 404s"""
    routes = []
    for route in app.routes:
        if hasattr(route, "methods"):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": route.name
            })
    logger.info(f"📋 Listing {len(routes)} available routes")
    return {"routes": routes}

# ============================================================
# Include your routers here
# Example: from routers import items
#          app.include_router(items.router, prefix="/api/items", tags=["items"])
# ============================================================
from routers import flatmates, items, balances  # noqa: E402
app.include_router(flatmates.router, prefix="/api/flatmates", tags=["flatmates"])
app.include_router(items.router, prefix="/api/items", tags=["items"])
app.include_router(balances.router, prefix="/api/balances", tags=["balances"])

# >>> naapy-capabilities (managed backend routers — do not edit) >>>
from routers import auth as _cap_auth_roles  # noqa: E402
app.include_router(_cap_auth_roles.router)
# <<< naapy-capabilities <<<
