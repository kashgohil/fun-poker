import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

// The server's base URL. Override with EXPO_PUBLIC_SERVER_URL — a physical
// device needs the dev machine's LAN IP rather than localhost.
export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:8080';

const STORAGE_PREFIX = 'funpoker';
// The Expo plugin persists the session cookie under `${prefix}_cookie`.
export const SESSION_COOKIE_KEY = `${STORAGE_PREFIX}_cookie`;

export const authClient = createAuthClient({
  baseURL: SERVER_URL,
  plugins: [
    expoClient({
      scheme: 'mobile',
      storagePrefix: STORAGE_PREFIX,
      storage: SecureStore,
    }),
  ],
});
