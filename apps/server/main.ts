import { Elysia } from 'elysia';
import * as v from 'valibot';
import {
  ClientMessageSchema,
  type ServerMessage,
} from '@fun-poker/protocol';

function send(ws: { send: (data: string) => void }, msg: ServerMessage) {
  ws.send(JSON.stringify(msg));
}

const app = new Elysia()
  .get('/', () => ({ ok: true }))
  .ws('/ws', {
    open(ws) {
      // Placeholder: a real impl would look up the user's current table
      // and send a TableSnapshot here.
      send(ws, { type: 'pong', ts: Date.now() });
    },
    message(ws, raw) {
      const parsed = v.safeParse(ClientMessageSchema, raw);
      if (!parsed.success) {
        send(ws, {
          type: 'error',
          code: 'invalid-message',
          message: parsed.issues.map((i) => i.message).join('; '),
        });
        return;
      }

      const msg = parsed.output;
      switch (msg.type) {
        case 'ping':
          send(ws, { type: 'pong', ts: msg.ts });
          return;
        case 'chat':
          // Echo for now; real impl broadcasts to the table room.
          send(ws, {
            type: 'chat-received',
            fromUserId: 'self',
            fromDisplayName: 'you',
            text: msg.text,
            ts: Date.now(),
          });
          return;
        default:
          // All other client actions land here until the game loop is wired.
          send(ws, {
            type: 'error',
            code: 'internal',
            message: `handler not implemented: ${msg.type}`,
          });
      }
    },
  })
  .listen(8080);

console.log(`Listening on ${app.server!.url}`);
