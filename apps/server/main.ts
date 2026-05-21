import { Elysia } from 'elysia';
import * as v from 'valibot';
import { ClientMessageSchema } from '@fun-poker/protocol';
import { GameManager } from './src/game/manager';

const game = new GameManager();

// Connection identity. MVP: the client passes ?userId=... on the socket URL;
// real authentication is follow-up work.
const wsUser = new WeakMap<object, string>();

const app = new Elysia()
  .get('/', () => ({ ok: true }))
  .ws('/ws', {
    open(ws) {
      const query = (ws.data as { query?: Record<string, string | undefined> })
        .query;
      const userId = query?.userId ?? `anon-${crypto.randomUUID()}`;
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
      game.handle(userId, parsed.output);
    },
    close(ws) {
      const userId = wsUser.get(ws.raw);
      if (userId !== undefined) game.disconnect(userId);
      wsUser.delete(ws.raw);
    },
  })
  .listen(8080);

console.log(`Listening on ${app.server!.url}`);
