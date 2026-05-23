import * as SecureStore from 'expo-secure-store';
import type { ClientMessage, ServerMessage } from '@fun-poker/protocol';
import { SERVER_URL, SESSION_COOKIE_KEY } from './auth-client';

export type GameSocket = {
  send: (msg: ClientMessage) => void;
  close: () => void;
};

// Opens a WebSocket to the game server, attaching the Better Auth session
// cookie via query string (React Native cannot send cookie headers on a
// WebSocket connection).
export function connectGameSocket(handlers: {
  onMessage: (msg: ServerMessage) => void;
  onConnected: (connected: boolean) => void;
}): GameSocket {
  const cookie = SecureStore.getItem(SESSION_COOKIE_KEY) ?? '';
  const wsUrl = SERVER_URL.replace(/^http/, 'ws');
  const url = `${wsUrl}/ws?cookie=${encodeURIComponent(cookie)}`;
  const ws = new WebSocket(url);

  ws.onopen = () => handlers.onConnected(true);
  ws.onclose = () => handlers.onConnected(false);
  ws.onerror = () => handlers.onConnected(false);
  ws.onmessage = (event) => {
    if (typeof event.data !== 'string') return;
    try {
      handlers.onMessage(JSON.parse(event.data) as ServerMessage);
    } catch {
      // Ignore malformed frames; the server only sends JSON.
    }
  };

  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
  };
}
