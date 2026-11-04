import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '@/config/api';

/**
 * FROZEN capability module — auth-roles (Option-B). Placed by the TemplateMutationCompiler
 * when the Architect selects the `auth-roles` capability, and wired into the app via
 * mobile/src/providers/AppProviders.tsx (also by the compiler). Generated RNDev code NEVER
 * edits this file; screens call `useAuth()` to read the session and act on the active role.
 *
 * The session SURVIVES a reload on device: the bearer token is kept in the platform keystore
 * (Keychain on iOS, EncryptedSharedPreferences on Android) via expo-secure-store, and on mount
 * the provider re-validates it against GET /api/auth/me before trusting it.
 *
 * ON WEB THERE IS NO PERSISTENCE, and that is a statement about Naapy's preview rather than a
 * gap to close later. expo-secure-store has no web implementation, and the obvious fallback
 * does not work either: `MobilePreview.jsx` sandboxes the preview iframe WITHOUT
 * `allow-same-origin`, so real `localStorage` throws and an in-memory shim is injected in its
 * place. A web session would therefore appear to persist in a browser and silently not persist
 * on the surface every demo actually runs on — worse than not persisting at all. Web keeps the
 * in-memory behaviour, deliberately.
 *
 * The 401 interceptor lives HERE and not in `@/config/api` (eng review F2). That file's "FROZEN"
 * is a comment — `is_placed_module_file` does not cover it — and this provider already imports
 * `apiClient` from it, so an interceptor there would need an event emitter to reach this state.
 * Registered in a mount effect and ejected on unmount, so a remount does not stack handlers.
 */
/**
 * The wire shape of an account. Mirrors the backend's `AuthUser` model in
 * `api/routers/auth.py` field for field — both halves are frozen, so a divergence is one
 * nothing in the app can repair. `verified_at` was on the server shape from T24 and missing
 * here, while the capability docs tell RNDev to read `user.verified_at` on an account screen:
 * a `tsc` failure (TS2339) on the exact code those docs ask for.
 */
export type AuthUser = {
  id: string;
  email: string;
  roles: string[];
  active_role: string | null;
  /** ISO-8601, or null until the address is proven — or forever, if the app has no flow for it. */
  verified_at: string | null;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  /**
   * True until the stored session has been re-validated on mount. A gate or a screen that
   * branches on `isAuthenticated` before this clears shows its signed-out state for a keystore
   * read PLUS a network round trip — not a frame — on an app the user is in fact signed into.
   * On a cold-starting hosted backend that is long enough to invite them to type a password.
   */
  isRestoring: boolean;
  activeRole: string | null;
  signup: (email: string, password: string, roles?: string[]) => Promise<AuthUser>;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  switchRole: (role: string) => Promise<AuthUser>;
  /**
   * Rotate the password and sign every OTHER device out; this one stays signed in. Rejects with
   * a 403 when `currentPassword` is wrong — surface `error.response.data.detail`, and note that
   * a wrong current password does NOT log the user out (the server avoids 401 for exactly that
   * reason).
   */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /**
   * Delete the account, then sign out locally. IRREVERSIBLE — require an explicit confirmation
   * in the UI before calling. Takes the password because the server re-authenticates before
   * destroying anything; a 403 means the password was wrong and nothing was deleted.
   */
  deleteAccount: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'naapy.auth.token';
/** expo-secure-store is native-only; calling it on web throws rather than degrading. */
const CAN_PERSIST = Platform.OS !== 'web';

function applyToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

async function persistToken(token: string | null) {
  // Best-effort by design. A keystore write that fails (a locked device, a wiped keychain
  // entry) must not fail the sign-in the user just completed — they stay signed in for this
  // session and are asked again next launch, which is the pre-persistence behaviour.
  if (!CAN_PERSIST) return;
  try {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // Intentionally silent: see above.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(CAN_PERSIST);
  //: Bumped by every restore run and by unmount. A reply whose generation is stale belongs to
  //: a session that has already been superseded and must not touch state.
  const restoreGeneration = useRef(0);
  //: Whether an unvalidated bearer is currently applied to the shared client by THIS run.
  const stored_applied = useRef(false);

  const clearSession = useCallback(() => {
    applyToken(null);
    setToken(null);
    setUser(null);
    void persistToken(null);
  }, []);

  // Restore on mount. The stored token is re-validated against the server rather than trusted:
  // it may have been revoked by a logout on another device, or have passed the session
  // lifetime while the app was closed, and a token that fails is worse than no token — every
  // screen would render as signed-in and then 401 one request at a time.
  //
  // GENERATION-GUARDED, not just unmount-guarded. Restoring is slow (a keystore read plus a
  // round trip), and the reason the user is looking at a sign-in screen is usually that the
  // stored token is stale — so "someone signs in while this is in flight" is the COMMON case,
  // not an edge one. Without the generation check a late reply from the old token overwrites
  // the new session: on 200 the app renders the previous user while the wire carries the new
  // one, and on 401 it signs the new user straight back out and deletes their stored token.
  useEffect(() => {
    if (!CAN_PERSIST) return;
    const generation = ++restoreGeneration.current;
    const isCurrent = () => generation === restoreGeneration.current;

    (async () => {
      let stored: string | null = null;
      try {
        stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!stored || !isCurrent()) return;
        applyToken(stored);
        stored_applied.current = true;
        // `skipAuthClear` keeps this request out of the 401 interceptor below. That handler
        // means "the session I am holding just died", and during restore there is no session
        // yet — letting it fire here is how a newly signed-in user got cleared.
        const { data } = await apiClient.get('/api/auth/me', { skipAuthClear: true } as never);
        if (!isCurrent()) return;
        setToken(stored);
        setUser(data as AuthUser);
        stored_applied.current = false;  // now a real session, not an unvalidated bearer
      } catch (error: any) {
        if (!isCurrent()) return;
        applyToken(null);
        stored_applied.current = false;
        // Evicted only when the SERVER rejected it. A network failure must not sign someone
        // out of a plane journey — but a 401 means this token is dead, and leaving it in the
        // keystore makes every future cold start re-apply it and burn another doomed request.
        if (error?.response?.status === 401) {
          void persistToken(null);
        }
      } finally {
        if (isCurrent()) setIsRestoring(false);
      }
    })();

    return () => {
      // Supersede this run AND undo its side effect. `apiClient` is a module singleton, so a
      // bearer applied before validation outlives the component that applied it: after a
      // remount the new provider reports signed-out while every request still carries an
      // unvalidated token.
      restoreGeneration.current += 1;
      if (stored_applied.current) {
        applyToken(null);
        stored_applied.current = false;
      }
    };
  }, []);

  // A 401 on any app request means this session is gone — expired, or revoked elsewhere. Clear
  // it here so the app reacts once, instead of every screen discovering it independently.
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;
  useEffect(() => {
    const id = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        // Only when a session actually existed. A 401 from /login is "wrong password", and
        // clearing state there would be a no-op that also swallows the reason.
        if (
          error?.response?.status === 401 &&
          tokenRef.current &&
          !error?.config?.skipAuthClear
        ) {
          clearSession();
        }
        return Promise.reject(error);
      },
    );
    return () => {
      apiClient.interceptors.response.eject(id);
    };
  }, [clearSession]);

  const signup = useCallback(
    async (email: string, password: string, roles?: string[]) => {
      const { data } = await apiClient.post('/api/auth/signup', { email, password, roles });
      applyToken(data.token);
      setToken(data.token);
      setUser(data.user);
      await persistToken(data.token);
      return data.user as AuthUser;
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post('/api/auth/login', { email, password });
    applyToken(data.token);
    setToken(data.token);
    setUser(data.user);
    await persistToken(data.token);
    return data.user as AuthUser;
  }, []);

  const logout = useCallback(async () => {
    // Revoke server-side too (best-effort) so the token can't be reused, then clear local state.
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Ignore network/401 — clearing local state below still signs the user out on-device.
    }
    clearSession();
  }, [clearSession]);

  const switchRole = useCallback(async (role: string) => {
    const { data } = await apiClient.post('/api/auth/switch-role', { role });
    setUser(data);
    return data as AuthUser;
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      // Snake_case on the wire: the request model is ChangePasswordRequest, not a camelCase DTO.
      await apiClient.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      // No token change and no re-login: the server keeps THIS session and revokes the others.
    },
    [],
  );

  const deleteAccount = useCallback(
    async (password: string) => {
      // axios carries a DELETE body only under `data`. Passing `{ password }` as the second
      // argument would be read as request CONFIG, so the field would silently never be sent and
      // the server would answer 422 — a confusing failure for a button that looks correct.
      await apiClient.delete('/api/auth/me', { data: { password } });
      // Local state only after the server confirms. Clearing first would sign the user out of an
      // account that still exists whenever the call fails (wrong password, offline).
      clearSession();
    },
    [clearSession],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      isRestoring,
      activeRole: user?.active_role ?? null,
      signup,
      login,
      logout,
      switchRole,
      changePassword,
      deleteAccount,
    }),
    [
      user,
      token,
      isRestoring,
      signup,
      login,
      logout,
      switchRole,
      changePassword,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider> (wired via AppProviders).');
  }
  return ctx;
}
