import { Elysia } from 'elysia';
import * as v from 'valibot';
import { ClientMessageSchema } from '@fun-poker/protocol';
import { chipRepo } from '@fun-poker/db';
import { auth, userIdFromConnection } from './src/auth/auth';
import { GameManager } from './src/game/manager';

const game = new GameManager();

// Maps each live socket to its authenticated user id.
const wsUser = new WeakMap<object, string>();

const app = new Elysia()
  .get('/', () => ({ ok: true }))
  // Better Auth owns every route under /api/auth/* (sign-up, sign-in, OAuth
  // callbacks, session). It reads the raw Request directly.
  .all('/api/auth/*', ({ request }) => auth.handler(request))
  // The signed-in player's profile and chip balance — used by the lobby.
  .get('/api/me', async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      return { error: 'unauthorized' };
    }
    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      balance: await chipRepo.getBalance(session.user.id),
    };
  })
  .ws('/ws', {
    async open(ws) {
      const data = ws.data as {
        headers?: Record<string, string | undefined>;
        query?: Record<string, string | undefined>;
      };
      // Mobile clients pass their session cookie as ?cookie= because the
      // React Native WebSocket cannot attach cookie headers on connect.
      const userId = await userIdFromConnection(
        data.headers?.cookie ?? data.query?.cookie,
        data.query?.token,
      );
      if (userId === null) {
        ws.raw.close(4001, 'unauthorized');
        return;
      }
      // Key by the raw socket — it is stable across open/message/close,
      // whereas the ElysiaWS wrapper may be recreated per event.
      wsUser.set(ws.raw, userId);
      game.connect(userId, { send: (data) => void ws.raw.send(data) });
    },
    message(ws, raw) {
      const userId = wsUser.get(ws.raw);
      if (userId === undefined) return;
      const parsed = v.safeParse(ClientMessageSchema, raw);
      if (!parsed.success) {
        ws.raw.send(
          JSON.stringify({
            type: 'error',
            code: 'invalid-message',
            message: parsed.issues.map((i) => i.message).join('; '),
          }),
        );
        return;
      }
      void game.handle(userId, parsed.output).catch((err) => {
        console.error('[ws] handler error', err);
      });
    },
    close(ws) {
      const userId = wsUser.get(ws.raw);
      if (userId !== undefined) game.disconnect(userId);
      wsUser.delete(ws.raw);
    },
  })
  .listen(8080);

console.log(`Listening on ${app.server!.url}`);

// Graceful shutdown: return every table stack to its owner's bank before exit.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void game.shutdown().finally(() => process.exit(0));
  });
}
