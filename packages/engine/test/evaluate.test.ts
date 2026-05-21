import { test, expect } from 'bun:test';
import type { Card, Rank, Suit } from '../src/cards/card';
import type { HandSelection, WildRule } from '../src/descriptor/variant';
import { evaluate5, bestOfPool, bestSelected } from '../src/eval/evaluate';
import { describeHand } from '../src/eval/hand';

let jokerSeq = 0;
function c(s: string): Card {
  if (s === 'Jk') return { kind: 'joker', copyIndex: jokerSeq++ };
  return {
    kind: 'standard',
    rank: s[0] as Rank,
    suit: s[1] as Suit,
    copyIndex: 0,
  };
}
function h(...cards: string[]): Card[] {
  return cards.map(c);
}

const JOKER_WILD: WildRule = {
  mode: 'full',
  twoWildsSameCard: true,
  naturalBeatsWild: false,
};

// --- natural classification -------------------------------------------------

test('royal flush', () => {
  const hv = evaluate5(h('Ah', 'Kh', 'Qh', 'Jh', 'Th'));
  expect(hv.category).toBe('straight-flush');
  expect(describeHand(hv)).toBe('Royal Flush');
});

test('straight flush, wheel (5-high)', () => {
  const hv = evaluate5(h('5h', '4h', '3h', '2h', 'Ah'));
  expect(hv.category).toBe('straight-flush');
  expect(hv.tiebreakers[0]).toBe(5);
});

test('four of a kind', () => {
  const hv = evaluate5(h('9s', '9h', '9d', '9c', 'Kd'));
  expect(hv.category).toBe('quads');
  expect(hv.tiebreakers).toEqual([9, 13]);
});

test('full house', () => {
  const hv = evaluate5(h('Ks', 'Kh', 'Kd', '2c', '2d'));
  expect(hv.category).toBe('full-house');
  expect(describeHand(hv)).toBe('Full House, Kings full of Twos');
});

test('flush', () => {
  const hv = evaluate5(h('As', 'Js', '9s', '6s', '3s'));
  expect(hv.category).toBe('flush');
});

test('plain straight including the wheel', () => {
  expect(evaluate5(h('9s', '8h', '7d', '6c', '5s')).category).toBe('straight');
  const wheel = evaluate5(h('5h', '4d', '3c', '2s', 'Ah'));
  expect(wheel.category).toBe('straight');
  expect(wheel.tiebreakers[0]).toBe(5);
});

test('trips, two pair, pair, high card', () => {
  expect(evaluate5(h('7s', '7h', '7d', 'Kc', '2s')).category).toBe('trips');
  expect(evaluate5(h('7s', '7h', '4d', '4c', '2s')).category).toBe('two-pair');
  expect(evaluate5(h('7s', '7h', 'Kd', '9c', '2s')).category).toBe('pair');
  expect(evaluate5(h('Ks', 'Jh', '9d', '7c', '3s')).category).toBe('high-card');
});

// --- multi-deck edge cases --------------------------------------------------

test('a straight needs distinct ranks — a paired hand is not a straight', () => {
  // Two aces (multi-deck) cannot both sit in a 5-card straight.
  const hv = evaluate5(h('Ah', 'Ad', 'Kh', 'Qh', 'Jh'));
  expect(hv.category).toBe('pair');
});

test('a flush may contain duplicate ranks (multi-deck)', () => {
  // Two Ace of hearts from a two-deck shoe — still a valid flush.
  const hv = evaluate5(h('Ah', 'Ah', 'Kh', 'Qh', '2h'));
  expect(hv.category).toBe('flush');
});

test('five of a kind from five natural aces (multi-deck)', () => {
  const hv = evaluate5(h('As', 'Ah', 'Ad', 'Ac', 'Ah'));
  expect(hv.category).toBe('five-of-a-kind');
  expect(hv.tiebreakers[0]).toBe(14);
});

// --- wild cards -------------------------------------------------------------

test('a joker completes four of a kind', () => {
  const hv = evaluate5(h('As', 'Ah', 'Ad', 'Kd', 'Jk'), { wild: JOKER_WILD });
  expect(hv.category).toBe('quads');
  expect(hv.tiebreakers[0]).toBe(14);
  expect(hv.wildsUsed).toBe(1);
});

test('a joker makes five of a kind', () => {
  const hv = evaluate5(h('As', 'Ah', 'Ad', 'Ac', 'Jk'), { wild: JOKER_WILD });
  expect(hv.category).toBe('five-of-a-kind');
  expect(hv.wildsUsed).toBe(1);
});

test('two jokers resolve to the best possible hand', () => {
  const hv = evaluate5(h('As', 'Ah', 'Ad', 'Jk', 'Jk'), { wild: JOKER_WILD });
  expect(hv.category).toBe('five-of-a-kind');
  expect(hv.wildsUsed).toBe(2);
});

// --- pool / selection -------------------------------------------------------

test('bestOfPool picks the best 5 from a 7-card Hold-em pool', () => {
  // Hole As Ks + board As Kd Kh 2c 7d => best is a full house (Kings full).
  const hv = bestOfPool(h('As', 'Ks', 'Ad', 'Kd', 'Kh', '2c', '7d'));
  expect(hv.category).toBe('full-house');
});

test('bestSelected enforces Omaha exactly-2-hole + exactly-3-community', () => {
  const omaha: HandSelection = {
    holeMin: 2, holeMax: 2, communityMin: 3, communityMax: 3,
  };
  // 4 heart hole cards, but only 2 hearts on the board.
  const hole = h('Ah', 'Kh', 'Qh', 'Jh');
  const board = h('2h', '3h', '4s', '5s', '6s');

  // Unconstrained, six hearts are reachable => a flush.
  expect(bestOfPool([...hole, ...board]).category).toBe('flush');

  // Omaha rules: 2 hole + 3 community can never gather 5 hearts => no flush.
  expect(bestSelected(hole, board, omaha).category).not.toBe('flush');
});
