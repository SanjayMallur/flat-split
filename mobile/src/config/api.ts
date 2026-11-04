import { Platform } from 'react-native';
import axios, { AxiosInstance } from 'axios';

// ============================================================
// API Configuration — FROZEN
// ============================================================
// Generated hooks call this client; do not edit. The base URL and preview token
// are injected at runtime by the web preview host (window.__NAAPY_CONFIG__),
// because env vars are inlined at build time and can't point a deployed web
// preview at a live backend.
// ============================================================

const getApiBaseUrl = (): string => {
  // 0. Runtime config injected by the web preview host (edge function `preview`).
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // @ts-ignore
    const runtimeUrl = window.__NAAPY_CONFIG__?.apiBaseUrl;
    if (runtimeUrl) return runtimeUrl;
  }

  // 1. Expo public env var (preferred for production builds).
  // @ts-ignore
  const expoPublicUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (expoPublicUrl) return expoPublicUrl;

  // 2. Local development defaults (port 8003 = generated apps).
  if (Platform.OS === 'android') {
    // Android emulator reaches the host machine via 10.0.2.2.
    return 'http://10.0.2.2:8003';
  }
  return 'http://localhost:8003';
};

export const API_BASE_URL = getApiBaseUrl();

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Hosted preview: the public backend requires a per-preview token.
//  - web: injected at runtime ONLY, by the preview host into window.__NAAPY_CONFIG__.
//    The web bundle is persisted and reused across previews, so it must NEVER read a
//    build-time token (that would bake one preview's secret into every reuse).
//  - native (Expo Go over exp.direct): inlined at build time from EXPO_PUBLIC_PREVIEW_TOKEN
//    by the hosted Metro runner, since native has no window to read a runtime config from.
//    Native bundles are built fresh per Metro machine, so a build-time token is scoped
//    to that one preview.
const getPreviewToken = (): string | undefined => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      return window.__NAAPY_CONFIG__?.previewToken || undefined;
    }
    return undefined;
  }
  // @ts-ignore
  return process.env.EXPO_PUBLIC_PREVIEW_TOKEN || undefined;
};

const previewToken = getPreviewToken();
if (previewToken) {
  apiClient.defaults.headers.common['X-Preview-Token'] = previewToken;
}
