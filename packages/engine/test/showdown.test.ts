import { test, expect } from 'bun:test';
import type { Card, Rank, Suit } from '../src/cards/card';
import type { Variant } from '../src/descriptor/variant';
import { texasHoldem } from '../src/descriptor/presets/holdem';
import type { SidePot } from '../src/betting/pots';
import { type ShowdownPlayer, resolveShowdown } from '../src/machine/showdown';

function c(s: string): Card {
  if (s === 'Jk') return { kind: 'joker', copyIndex: 0 };
  return {
    kind: 'standard',
    rank: s[0] as Rank,
    suit: s[1] as Suit,
    copyIndex: 0,
  };
}
const h = (...cards: string[]): Card[] => cards.map(c);

const ascending = (seats: readonly number[]): number[] =>
  [...seats].sort((a, b) => a - b);

const hiLo: Variant = {
  ...texasHoldem,
  id: 'omaha-hi-lo-ish',
  ranking: 'high',
  split: { low: 'a5-8-or-better' },
};

function player(seat: number, ...cards: string[]): ShowdownPlayer {
  return { seat, hole: h(...cards), folded: false };
}
function onePot(amount: number, ...seats: number[]): SidePot[] {
  return [{ amount, eligibleSeats: seats }];
}
function totalAwarded(awards: { amount: number }[]): number {
  return awards.reduce((s, a) => s + a.amount, 0);
}

test('hi/lo split: the high half and low half go to different players', () => {
  // Board low cards are 8-5-4-2 — gapped, so they form no straight.
  const community = h('8h', '5d', '4c', '2s', 'Kc');
  const players = [
    player(0, 'Ad', '7d'), // qualifying low A-4-5-7-8; only ace-high
    player(1, 'Kd', 'Qh'), // pair of kings; no low
  ];
  const { awards } = resolveShowdown(
    hiLo,
    players,
    community,
    onePot(100, 0, 1),
    ascending,
  );
  const bySeat = (s: number) =>
    awards.filter((a) => a.seat === s).reduce((x, a) => x + a.amount, 0);
  expect(bySeat(1)).toBe(50); // high half
  expect(bySeat(0)).toBe(50); // low half
  expect(totalAwarded(awards)).toBe(100);
});

test('hi/lo split: a tied low quarters the pot', () => {
  // The board itself is a 7-5-4-3-2 low — both players play it.
  const community = h('7h', '5d', '4c', '3s', '2h');
  const players = [
    player(0, '7d', '7s'), // trips sevens for the high
    player(1, 'Kd', 'Qc'), // king-high
  ];
  const { awards } = resolveShowdown(
    hiLo,
    players,
    community,
    onePot(100, 0, 1),
    ascending,
  );
  const bySeat = (s: number) =>
    awards.filter((a) => a.seat === s).reduce((x, a) => x + a.amount, 0);
  expect(bySeat(0)).toBe(75); // high half (50) + quarter of the low (25)
  expect(bySeat(1)).toBe(25); // quarter of the low
  expect(totalAwarded(awards)).toBe(100);
});

test('hi/lo split: with no qualifying low the high hand scoops', () => {
  const community = h('Kh', 'Qd', 'Jc', 'Th', '9s');
  const players = [
    player(0, 'Ah', 'Ad'), // broadway straight, T-J-Q-K-A
    player(1, '2c', '3c'), // 9-high straight
  ];
  const { awards } = resolveShowdown(
    hiLo,
    players,
    community,
    onePot(100, 0, 1),
    ascending,
  );
  expect(awards).toHaveLength(1);
  expect(awards[0]).toEqual({ seat: 0, potIndex: 0, amount: 100 });
});

test('pure lowball: the lowest hand wins the whole pot', () => {
  const razz: Variant = {
    ...texasHoldem,
    id: 'razz-ish',
    ranking: 'a5-low',
    selection: { holeMin: 5, holeMax: 5, communityMin: 0, communityMax: 0 },
  };
  const players = [
    player(0, '7h', '5d', '4c', '3s', '2h'), // 7-low
    player(1, '9h', '8d', '7c', '6s', '5h'), // 9-low
  ];
  const { awards } = resolveShowdown(razz, players, [], onePot(100, 0, 1), ascending);
  expect(awards).toEqual([{ seat: 0, potIndex: 0, amount: 100 }]);
});

test('hi/lo split conserves chips even with an odd pot', () => {
  const community = h('8h', '5d', '4c', '2s', 'Kc');
  const players = [player(0, 'Ad', '7d'), player(1, 'Kd', 'Qh')];
  const { awards } = resolveShowdown(
    hiLo,
    players,
    community,
    onePot(101, 0, 1),
    ascending,
  );
  expect(totalAwarded(awards)).toBe(101); // odd chip not lost
});
