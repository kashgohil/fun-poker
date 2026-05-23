import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

// The server's base URL. Override with EXPO_PUBLIC_SERVER_URL — a physical
// device needs the dev machine's LAN IP rather than localhost.
export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:8080';

export const authClient = createAuthClient({
  baseURL: SERVER_URL,
  plugins: [
    expoClient({
      scheme: 'mobile',
      storagePrefix: 'funpoker',
      storage: SecureStore,
    }),
  ],
});
