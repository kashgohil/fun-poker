import { test, expect } from 'bun:test';
import type { ServerMessage } from '@fun-poker/protocol';
import { GameManager } from '../src/game/manager';
import type { ChipService } from '../src/game/chips';

// An in-memory chip bank, so the game loop can be tested without a database.
class FakeChips implements ChipService {
  private readonly balances = new Map<string, number>();
  constructor(initial: Record<string, number> = {}) {
    for (const [u, b] of Object.entries(initial)) this.balances.set(u, b);
  }
  async getBalance(userId: string): Promise<number> {
    return this.balances.get(userId) ?? 0;
  }
  async ensureWallet(userId: string): Promise<void> {
    if (!this.balances.has(userId)) this.balances.set(userId, 0);
  }
  async adjust(userId: string, delta: number): Promise<number> {
    const next = (this.balances.get(userId) ?? 0) + delta;
    if (next < 0) throw new Error('insufficient chip balance');
    this.balances.set(userId, next);
    return next;
  }
}

// A fake connection that records every message the server pushes.
class Spy {
  readonly messages: ServerMessage[] = [];
  send(data: string): void {
    this.messages.push(JSON.parse(data) as ServerMessage);
  }
}

test('two bots play a full hand, and chips stay conserved across banks and table', async () => {
  const chips = new FakeChips({ alice: 5000, bob: 5000 });
  const game = new GameManager(chips);
  const alice = new Spy();
  const bob = new Spy();
  game.connect('alice', alice);
  game.connect('bob', bob);

  await game.handle('alice', { type: 'join-table', tableId: 'main', buyIn: 1000 });
  await game.handle('bob', { type: 'join-table', tableId: 'main', buyIn: 1000 });

  // Each buy-in debited the bank.
  expect(await chips.getBalance('alice')).toBe(4000);
  expect(await chips.getBalance('bob')).toBe(4000);

  const userForSeat: Record<number, string> = { 0: 'alice', 1: 'bob' };
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
    await game.handle(user, canCheck ? { type: 'check' } : { type: 'call' });
  }

  expect(alice.messages.some((m) => m.type === 'hand-ended')).toBe(true);
  expect(alice.messages.some((m) => m.type === 'error')).toBe(false);

  // Total chips = banks + table stacks = the 10,000 we started with.
  const table = game.getTable('main');
  if (!table) throw new Error('table missing');
  const onTable = [...table.seats.values()].reduce((s, x) => s + x.stack, 0);
  const inBanks =
    (await chips.getBalance('alice')) + (await chips.getBalance('bob'));
  expect(onTable + inBanks).toBe(10000);
});

test('joining debits the bank and leaving returns the stack', async () => {
  const chips = new FakeChips({ solo: 5000 });
  const game = new GameManager(chips);
  game.connect('solo', new Spy());

  await game.handle('solo', { type: 'join-table', tableId: 'main', buyIn: 1000 });
  expect(await chips.getBalance('solo')).toBe(4000); // bought in

  // Only one player — no hand is running, so leaving cashes out immediately.
  await game.handle('solo', { type: 'leave-table', tableId: 'main' });
  expect(await chips.getBalance('solo')).toBe(5000); // cashed back out
  expect(game.getTable('main')?.seats.size).toBe(0);
});

test('a buy-in larger than the bank balance is rejected', async () => {
  const chips = new FakeChips({ broke: 500 });
  const game = new GameManager(chips);
  const spy = new Spy();
  game.connect('broke', spy);

  await game.handle('broke', { type: 'join-table', tableId: 'main', buyIn: 1000 });

  const err = spy.messages.find((m) => m.type === 'error');
  expect(err?.type).toBe('error');
  if (err?.type === 'error') expect(err.code).toBe('insufficient-funds');
  expect(await chips.getBalance('broke')).toBe(500); // untouched
  expect(game.getTable('main')?.seats.size).toBe(0); // not seated
});

test('a buy-in below the table minimum is rejected', async () => {
  const chips = new FakeChips({ rich: 100000 });
  const game = new GameManager(chips);
  const spy = new Spy();
  game.connect('rich', spy);

  // Table is 10/20 blinds => minimum buy-in is 400.
  await game.handle('rich', { type: 'join-table', tableId: 'main', buyIn: 100 });

  expect(spy.messages.some((m) => m.type === 'error')).toBe(true);
  expect(game.getTable('main')?.seats.size).toBe(0);
});

test('an out-of-turn action is rejected with an error', async () => {
  const chips = new FakeChips({ alice: 5000, bob: 5000 });
  const game = new GameManager(chips);
  const alice = new Spy();
  const bob = new Spy();
  game.connect('alice', alice);
  game.connect('bob', bob);
  await game.handle('alice', { type: 'join-table', tableId: 'main', buyIn: 1000 });
  await game.handle('bob', { type: 'join-table', tableId: 'main', buyIn: 1000 });

  // Heads-up: the button (seat 0 = alice) acts first preflop, so bob is early.
  await game.handle('bob', { type: 'fold' });
  expect(bob.messages.some((m) => m.type === 'error')).toBe(true);
});

test('graceful shutdown returns every table stack to the bank', async () => {
  const chips = new FakeChips({ alice: 5000, bob: 5000 });
  const game = new GameManager(chips);
  game.connect('alice', new Spy());
  game.connect('bob', new Spy());
  await game.handle('alice', { type: 'join-table', tableId: 'main', buyIn: 1000 });
  await game.handle('bob', { type: 'join-table', tableId: 'main', buyIn: 1000 });

  await game.shutdown();

  // Every chip is back in a bank; the table is empty.
  const total =
    (await chips.getBalance('alice')) + (await chips.getBalance('bob'));
  expect(total).toBe(10000);
  expect(game.getTable('main')?.seats.size).toBe(0);
});
