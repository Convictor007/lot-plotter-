import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Build URL for Expo Router API routes.
 * - Web: same-origin path `/api/...` works.
 * - Native: packager host (e.g. `http://192.168.x.x:8081/api/...`).
 * - Override: set `EXPO_PUBLIC_API_URL` (no trailing slash), e.g. `http://10.0.2.2:8081` for Android emulator.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const explicit = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (explicit) {
    return `${explicit}${p}`;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return p;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const base = hostUri.startsWith('http') ? hostUri : `http://${hostUri}`;
    return `${base.replace(/\/$/, '')}${p}`;
  }
  return p;
}
