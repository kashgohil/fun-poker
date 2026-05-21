import { test, expect } from 'bun:test';
import {
  type BettingConfig,
  applyAction,
  legalActions,
  openBettingRound,
} from '../src/betting/round';

function open(stacks: number[], firstToAct: number) {
  return openBettingRound({
    players: stacks.map((stack, i) => ({
      seat: i,
      stack,
      committed: 0,
      status: 'active' as const,
    })),
    firstToAct,
    currentBet: 0,
    lastRaiseSize: 20,
  });
}

test('no-limit: the maximum bet is the whole stack', () => {
  const config: BettingConfig = {
    structure: { kind: 'no-limit' },
    bigBlind: 20,
    street: 1,
    priorPot: 0,
  };
  const r = open([1000, 1000], 0);
  const bet = legalActions(r, config).find((o) => o.kind === 'bet');
  if (bet?.kind === 'bet') expect(bet.max).toBe(1000);
});

test('pot-limit: opening bet is capped at the pot', () => {
  const config: BettingConfig = {
    structure: { kind: 'pot-limit' },
    bigBlind: 20,
    street: 1,
    priorPot: 60,
  };
  const r = open([1000, 1000], 0);
  const bet = legalActions(r, config).find((o) => o.kind === 'bet');
  if (bet?.kind === 'bet') expect(bet.max).toBe(60); // exactly the pot
});

test('pot-limit: a raise is capped at a pot-sized raise', () => {
  const config: BettingConfig = {
    structure: { kind: 'pot-limit' },
    bigBlind: 20,
    street: 1,
    priorPot: 60,
  };
  let r = open([1000, 1000], 0);
  r = applyAction(r, config, { kind: 'bet', to: 60 });
  // Pot is now 60 + 60 = 120; call 60 -> 180; raise by 180 -> total 240.
  const raise = legalActions(r, config).find((o) => o.kind === 'raise');
  if (raise?.kind === 'raise') expect(raise.max).toBe(240);
});

test('fixed-limit: bet sizes are fixed and step up on later streets', () => {
  const early: BettingConfig = {
    structure: { kind: 'fixed-limit', bigBetFromStreet: 2, raiseCap: 3 },
    bigBlind: 20,
    street: 0,
    priorPot: 0,
  };
  const late: BettingConfig = { ...early, street: 2 };

  const earlyBet = legalActions(open([1000, 1000], 0), early).find(
    (o) => o.kind === 'bet',
  );
  if (earlyBet?.kind === 'bet') {
    expect(earlyBet.min).toBe(20);
    expect(earlyBet.max).toBe(20);
  }
  const lateBet = legalActions(open([1000, 1000], 0), late).find(
    (o) => o.kind === 'bet',
  );
  if (lateBet?.kind === 'bet') {
    expect(lateBet.min).toBe(40);
    expect(lateBet.max).toBe(40);
  }
});

test('fixed-limit: the raise cap closes off further raising', () => {
  const config: BettingConfig = {
    structure: { kind: 'fixed-limit', bigBetFromStreet: 2, raiseCap: 3 },
    bigBlind: 20,
    street: 0,
    priorPot: 0,
  };
  let r = open([1000, 1000], 0);
  r = applyAction(r, config, { kind: 'bet', to: 20 }); // opening bet
  r = applyAction(r, config, { kind: 'raise', to: 40 }); // raise 1
  r = applyAction(r, config, { kind: 'raise', to: 60 }); // raise 2
  r = applyAction(r, config, { kind: 'raise', to: 80 }); // raise 3 (cap)
  expect(legalActions(r, config).some((o) => o.kind === 'raise')).toBe(false);
});
