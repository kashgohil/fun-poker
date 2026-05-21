import { test, expect } from 'bun:test';
import {
  type BettingConfig,
  type PlayerBetStatus,
  applyAction,
  legalActions,
  openBettingRound,
  roundClosed,
  uncalledBet,
} from '../src/betting/round';

type Spec = { stack: number; committed?: number; status?: PlayerBetStatus };

function open(specs: Spec[], firstToAct: number, currentBet = 0, lastRaise = 20) {
  return openBettingRound({
    players: specs.map((s, i) => ({
      seat: i,
      stack: s.stack,
      committed: s.committed ?? 0,
      status: s.status ?? 'active',
    })),
    firstToAct,
    currentBet,
    lastRaiseSize: lastRaise,
  });
}

const NL: BettingConfig = {
  structure: { kind: 'no-limit' },
  bigBlind: 20,
  street: 1,
  priorPot: 0,
};

function kinds(round: ReturnType<typeof open>): string[] {
  return legalActions(round, NL).map((o) => o.kind);
}

test('a check-around closes the round', () => {
  let r = open([{ stack: 1000 }, { stack: 1000 }, { stack: 1000 }], 0);
  r = applyAction(r, NL, { kind: 'check' });
  r = applyAction(r, NL, { kind: 'check' });
  expect(roundClosed(r)).toBe(false);
  r = applyAction(r, NL, { kind: 'check' });
  expect(roundClosed(r)).toBe(true);
});

test('a bet called all the way around closes the round', () => {
  let r = open([{ stack: 1000 }, { stack: 1000 }, { stack: 1000 }], 0);
  r = applyAction(r, NL, { kind: 'bet', to: 100 });
  r = applyAction(r, NL, { kind: 'call' });
  expect(roundClosed(r)).toBe(false);
  r = applyAction(r, NL, { kind: 'call' });
  expect(roundClosed(r)).toBe(true);
  expect(r.currentBet).toBe(100);
});

test('a raise reopens the action for players who already acted', () => {
  let r = open([{ stack: 1000 }, { stack: 1000 }, { stack: 1000 }], 0);
  r = applyAction(r, NL, { kind: 'bet', to: 100 }); // p0
  r = applyAction(r, NL, { kind: 'raise', to: 300 }); // p1
  // p2 has not acted; p0 must act again and may re-raise.
  expect(r.toAct).toBe(2);
  r = applyAction(r, NL, { kind: 'call' }); // p2
  expect(r.toAct).toBe(0);
  expect(kinds(r)).toContain('raise');
});

test('cannot check while facing a bet', () => {
  let r = open([{ stack: 1000 }, { stack: 1000 }], 0);
  r = applyAction(r, NL, { kind: 'bet', to: 100 });
  expect(() => applyAction(r, NL, { kind: 'check' })).toThrow();
});

test('minimum raise equals the size of the previous raise', () => {
  let r = open([{ stack: 1000 }, { stack: 1000 }], 0);
  r = applyAction(r, NL, { kind: 'bet', to: 100 }); // raise size 100
  const raise = legalActions(r, NL).find((o) => o.kind === 'raise');
  expect(raise?.kind).toBe('raise');
  if (raise?.kind === 'raise') expect(raise.min).toBe(200);
});

test('a short all-in raises the bet but does NOT reopen re-raising', () => {
  // p0 bets 100 and p1 calls — both have now acted on the 100 bet.
  let r = open([{ stack: 1000 }, { stack: 1000 }, { stack: 150 }], 0);
  r = applyAction(r, NL, { kind: 'bet', to: 100 });
  r = applyAction(r, NL, { kind: 'call' });
  // p2 shoves 150 — only +50 over the bet, less than the 100 raise size.
  r = applyAction(r, NL, { kind: 'all-in' });
  expect(r.currentBet).toBe(150);
  // p0 already acted on the bet: may call the short all-in, not re-raise.
  expect(r.toAct).toBe(0);
  expect(kinds(r)).toContain('call');
  expect(kinds(r)).not.toContain('raise');
});

test('the big blind keeps the option when the pot is only limped', () => {
  // Preflop: SB=10, BB=20 already committed; UTG (seat 2) acts first.
  let r = open(
    [
      { stack: 990, committed: 10 },
      { stack: 980, committed: 20 },
      { stack: 1000 },
    ],
    2,
    20,
    20,
  );
  r = applyAction(r, NL, { kind: 'call' }); // UTG limps
  r = applyAction(r, NL, { kind: 'call' }); // SB completes
  // Action is back on the BB even though everyone matched — the option.
  expect(r.toAct).toBe(1);
  expect(kinds(r)).toContain('check');
  r = applyAction(r, NL, { kind: 'check' });
  expect(roundClosed(r)).toBe(true);
});

test('an all-in for less than the bet is just an all-in call', () => {
  let r = open([{ stack: 1000 }, { stack: 300 }], 0);
  r = applyAction(r, NL, { kind: 'bet', to: 500 });
  r = applyAction(r, NL, { kind: 'all-in' }); // p1 can only cover 300
  expect(r.currentBet).toBe(500); // unchanged — not a raise
  expect(r.players[1]?.status).toBe('all-in');
  expect(r.players[1]?.committed).toBe(300);
});

test('uncalledBet returns the unmatched excess to the bettor', () => {
  let r = open([{ stack: 1000 }, { stack: 1000 }], 0);
  r = applyAction(r, NL, { kind: 'bet', to: 250 });
  r = applyAction(r, NL, { kind: 'fold' });
  expect(uncalledBet(r)).toEqual({ seat: 0, amount: 250 });
});
