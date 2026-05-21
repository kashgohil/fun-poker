import { test, expect } from 'bun:test';
import type { ServerMessage } from '@fun-poker/protocol';
import { GameManager } from '../src/game/manager';

// A fake connection that records every message the server pushes.
class Spy {
  readonly messages: ServerMessage[] = [];
  send(data: string): void {
    this.messages.push(JSON.parse(data) as ServerMessage);
  }
}

test('two bots play a full hand through the server game loop', () => {
  const game = new GameManager();
  const alice = new Spy();
  const bob = new Spy();
  game.connect('alice', alice);
  game.connect('bob', bob);

  // Both sit down; the second join brings the table to two players and the
  // first hand starts automatically.
  game.handle('alice', { type: 'join-table', tableId: 'main', buyIn: 1000 });
  game.handle('bob', { type: 'join-table', tableId: 'main', buyIn: 1000 });

  // alice took seat 0, bob seat 1 (first free seats, in join order).
  const userForSeat: Record<number, string> = { 0: 'alice', 1: 'bob' };

  // Drive the hand: respond to each action request by checking or calling.
  let guard = 0;
  while (guard++ < 300) {
    if (alice.messages.some((m) => m.type === 'hand-ended')) break;
    const request = [...alice.messages]
      .reverse()
      .find((m): m is Extract<ServerMessage, { type: 'action-request' }> =>
        m.type === 'action-request',
      );
    if (!request) throw new Error('hand running but no action requested');
    const user = userForSeat[request.seat];
    if (!user) throw new Error(`unknown seat ${request.seat}`);
    const canCheck = request.legalActions.some((o) => o.kind === 'check');
    game.handle(user, canCheck ? { type: 'check' } : { type: 'call' });
  }

  // The hand reached a conclusion.
  expect(alice.messages.some((m) => m.type === 'hand-ended')).toBe(true);
  expect(alice.messages.some((m) => m.type === 'showdown')).toBe(true);
  // No errors were produced along the way.
  expect(alice.messages.some((m) => m.type === 'error')).toBe(false);

  // Chips are conserved once the hand settles back onto the seats.
  const table = game.getTable('main');
  if (!table) throw new Error('table missing');
  const total = [...table.seats.values()].reduce((s, x) => s + x.stack, 0);
  expect(total).toBe(2000);
});

test('an out-of-turn action is rejected with an error', () => {
  const game = new GameManager();
  const alice = new Spy();
  const bob = new Spy();
  game.connect('alice', alice);
  game.connect('bob', bob);
  game.handle('alice', { type: 'join-table', tableId: 'main', buyIn: 1000 });
  game.handle('bob', { type: 'join-table', tableId: 'main', buyIn: 1000 });

  // Heads-up: the button (seat 0 = alice) acts first preflop. Bob acting now
  // is out of turn.
  game.handle('bob', { type: 'fold' });
  expect(bob.messages.some((m) => m.type === 'error')).toBe(true);
});
