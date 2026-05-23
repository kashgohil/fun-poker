import { test, expect } from 'bun:test';
import type { SeatState } from '@fun-poker/protocol';
import { applyServerMessage, initialGameState } from '../src/lib/game-store';

function seat(over: Partial<SeatState> & { seat: number }): SeatState {
  return {
    seat: over.seat,
    userId: over.userId ?? `u${over.seat}`,
    displayName: over.displayName ?? `P${over.seat}`,
    stack: over.stack ?? 1000,
    status: over.status ?? 'active',
    currentBet: over.currentBet ?? 0,
    hasButton: over.hasButton ?? false,
  };
}

function withSeats(...seats: SeatState[]) {
  return applyServerMessage(initialGameState, {
    type: 'table-snapshot',
    snapshot: {
      tableId: 'main',
      config: {
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 400,
        maxBuyIn: 4000,
        maxSeats: 12,
        actionTimeoutMs: 30000,
      },
      seats,
      hand: null,
    },
  });
}

test('table-snapshot populates the seats', () => {
  const next = withSeats(seat({ seat: 0 }), seat({ seat: 1 }));
  expect(next.tableId).toBe('main');
  expect(Object.keys(next.seats).sort()).toEqual(['0', '1']);
});

test('player-joined adds a new seat', () => {
  const next = applyServerMessage(withSeats(seat({ seat: 0 })), {
    type: 'player-joined',
    seat: seat({ seat: 1 }),
  });
  expect(next.seats[1]?.userId).toBe('u1');
});

test('player-left removes the seat', () => {
  const next = applyServerMessage(withSeats(seat({ seat: 0 }), seat({ seat: 1 })), {
    type: 'player-left',
    seat: 1,
    userId: 'u1',
  });
  expect(next.seats[1]).toBeUndefined();
});

test('hand-started marks the button and resets the hand state', () => {
  const seats = withSeats(seat({ seat: 0 }), seat({ seat: 1 }));
  const next = applyServerMessage(seats, {
    type: 'hand-started',
    handId: 'h1',
    buttonSeat: 1,
    activeSeats: [0, 1],
  });
  expect(next.handId).toBe('h1');
  expect(next.street).toBe('preflop');
  expect(next.seats[1]?.hasButton).toBe(true);
  expect(next.seats[0]?.hasButton).toBe(false);
});

test('blinds-posted debits stacks and bumps current bets', () => {
  const seats = withSeats(
    seat({ seat: 0, stack: 1000 }),
    seat({ seat: 1, stack: 1000 }),
  );
  const next = applyServerMessage(seats, {
    type: 'blinds-posted',
    smallBlind: { seat: 0, amount: 10 },
    bigBlind: { seat: 1, amount: 20 },
  });
  expect(next.seats[0]).toMatchObject({ stack: 990, currentBet: 10 });
  expect(next.seats[1]).toMatchObject({ stack: 980, currentBet: 20 });
});

test('hole-cards-dealt stores the hero hand privately', () => {
  const next = applyServerMessage(initialGameState, {
    type: 'hole-cards-dealt',
    handId: 'h1',
    cards: [
      { kind: 'standard', rank: 'A', suit: 's', copyIndex: 0 },
      { kind: 'standard', rank: 'K', suit: 'h', copyIndex: 0 },
    ],
  });
  expect(next.myHole).toHaveLength(2);
});

test('street-dealt appends community cards and clears per-street bets', () => {
  let s = withSeats(seat({ seat: 0, currentBet: 50 }));
  s = applyServerMessage(s, {
    type: 'street-dealt',
    street: 'flop',
    cards: [
      { kind: 'standard', rank: '7', suit: 's', copyIndex: 0 },
      { kind: 'standard', rank: '8', suit: 's', copyIndex: 0 },
      { kind: 'standard', rank: '9', suit: 's', copyIndex: 0 },
    ],
  });
  expect(s.street).toBe('flop');
  expect(s.community).toHaveLength(3);
  expect(s.seats[0]?.currentBet).toBe(0);
});

test('action-request sets who is to act and what they may do', () => {
  const next = applyServerMessage(initialGameState, {
    type: 'action-request',
    seat: 2,
    legalActions: [{ kind: 'fold' }, { kind: 'call', amount: 20 }],
    deadlineUnixMs: 1700000000000,
  });
  expect(next.toActSeat).toBe(2);
  expect(next.legalActions).toHaveLength(2);
});

test('action-taken updates the seat stack and bet', () => {
  const s = withSeats(seat({ seat: 0, stack: 1000, currentBet: 20 }));
  const next = applyServerMessage(s, {
    type: 'action-taken',
    seat: 0,
    action: 'raise',
    amount: 60,
    stackAfter: 960, // paid 40 more
  });
  expect(next.seats[0]).toMatchObject({ stack: 960, currentBet: 60 });
  expect(next.toActSeat).toBeNull();
});

test('action-taken with fold marks the seat folded', () => {
  const s = withSeats(seat({ seat: 0 }));
  const next = applyServerMessage(s, {
    type: 'action-taken',
    seat: 0,
    action: 'fold',
    stackAfter: 1000,
  });
  expect(next.seats[0]?.status).toBe('folded');
});

test('hand-ended applies final stacks and stores awards', () => {
  const s = withSeats(
    seat({ seat: 0, stack: 950 }),
    seat({ seat: 1, stack: 950 }),
  );
  const next = applyServerMessage(s, {
    type: 'hand-ended',
    handId: 'h1',
    awards: [{ seat: 0, potIndex: 0, amount: 100 }],
    finalStacks: [
      { seat: 0, stack: 1050 },
      { seat: 1, stack: 950 },
    ],
  });
  expect(next.seats[0]?.stack).toBe(1050);
  expect(next.seats[1]?.stack).toBe(950);
  expect(next.handId).toBeNull();
  expect(next.lastAwards).toHaveLength(1);
});
