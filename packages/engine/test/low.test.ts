import { test, expect } from 'bun:test';
import type { Card, Rank, Suit } from '../src/cards/card';
import type { HandSelection, WildRule } from '../src/descriptor/variant';
import {
  bestLowSelected,
  compareLow,
  evaluateLow5,
  qualifiesEightOrBetter,
} from '../src/eval/low';

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

const JOKER_WILD: WildRule = {
  mode: 'full',
  twoWildsSameCard: true,
  naturalBeatsWild: false,
};

// --- ace-to-five ------------------------------------------------------------

test('a5: the wheel 5-4-3-2-A is the best low', () => {
  const wheel = evaluateLow5(h('5h', '4d', '3c', '2s', 'Ah'), 'a5-low');
  expect(wheel.value).toEqual([0, 5, 4, 3, 2, 1]);
});

test('a5: the lower second card wins between equal high cards', () => {
  const a = evaluateLow5(h('8h', '6d', '4c', '3s', '2h'), 'a5-low');
  const b = evaluateLow5(h('8d', '7c', '5h', '4s', '3d'), 'a5-low');
  expect(compareLow(a, b)).toBeGreaterThan(0);
});

test('a5: the ace plays low', () => {
  const withAce = evaluateLow5(h('6h', '4d', '3c', '2s', 'Ah'), 'a5-low');
  const withoutAce = evaluateLow5(h('7h', '5d', '4c', '3s', '2h'), 'a5-low');
  expect(compareLow(withAce, withoutAce)).toBeGreaterThan(0);
});

test('a5: any no-pair hand beats a paired hand', () => {
  const paired = evaluateLow5(h('2h', '2d', '3c', '4s', '5h'), 'a5-low');
  const noPair = evaluateLow5(h('Kh', '8d', '6c', '4s', '2h'), 'a5-low');
  expect(compareLow(noPair, paired)).toBeGreaterThan(0);
});

// --- deuce-to-seven ---------------------------------------------------------

test('27: 7-5-4-3-2 beats a straight (straights count against you)', () => {
  const best = evaluateLow5(h('7h', '5d', '4c', '3s', '2h'), '27-low');
  const straight = evaluateLow5(h('6h', '5d', '4c', '3s', '2h'), '27-low');
  expect(compareLow(best, straight)).toBeGreaterThan(0);
});

test('27: the ace is high, so a king-high beats an ace-high', () => {
  const kingHigh = evaluateLow5(h('Kh', '8d', '5c', '4s', '3h'), '27-low');
  const aceHigh = evaluateLow5(h('Ah', '8d', '5c', '4s', '3h'), '27-low');
  expect(compareLow(kingHigh, aceHigh)).toBeGreaterThan(0);
});

// --- eight-or-better qualifier ---------------------------------------------

test('eight-or-better: an 8-high no-pair hand qualifies', () => {
  expect(
    qualifiesEightOrBetter(evaluateLow5(h('8h', '6d', '4c', '3s', '2h'), 'a5-low')),
  ).toBe(true);
});

test('eight-or-better: a 9-high hand does not qualify', () => {
  expect(
    qualifiesEightOrBetter(evaluateLow5(h('9h', '6d', '4c', '3s', '2h'), 'a5-low')),
  ).toBe(false);
});

test('eight-or-better: a paired hand does not qualify', () => {
  expect(
    qualifiesEightOrBetter(evaluateLow5(h('8h', '8d', '4c', '3s', '2h'), 'a5-low')),
  ).toBe(false);
});

// --- wild cards -------------------------------------------------------------

test('a5: a joker resolves to make the best low', () => {
  const low = evaluateLow5(h('Jk', '2h', '3d', '4c', '5s'), 'a5-low', {
    wild: JOKER_WILD,
  });
  expect(low.value).toEqual([0, 5, 4, 3, 2, 1]); // joker -> ace, the wheel
  expect(low.wildsUsed).toBe(1);
});

// --- selection --------------------------------------------------------------

test('bestLowSelected enforces Omaha exactly-2-hole + exactly-3-community', () => {
  const omaha: HandSelection = {
    holeMin: 2, holeMax: 2, communityMin: 3, communityMax: 3,
  };
  const hole = h('Ah', '2d', 'Kc', 'Qs');
  const board = h('3h', '4d', '5c', 'Jh', 'Th');
  // Best 2 hole (A,2) + 3 community (3,4,5) => A-2-3-4-5, the wheel.
  const low = bestLowSelected(hole, board, omaha, 'a5-low');
  expect(low.value).toEqual([0, 5, 4, 3, 2, 1]);
});
