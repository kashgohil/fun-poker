import { test, expect } from 'bun:test';
import type { Card, Rank, Suit } from '../src/cards/card';
import type { WildRule } from '../src/descriptor/variant';
import { evaluate5 } from '../src/eval/evaluate';
import { compareHands } from '../src/eval/compare';

function c(s: string): Card {
  if (s === 'Jk') return { kind: 'joker', copyIndex: 0 };
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

test('category ordering is strictly increasing in strength', () => {
  const ladder = [
    h('Ks', 'Jh', '9d', '7c', '3s'), // high card
    h('7s', '7h', 'Kd', '9c', '2s'), // pair
    h('7s', '7h', '4d', '4c', '2s'), // two pair
    h('7s', '7h', '7d', 'Kc', '2s'), // trips
    h('9s', '8h', '7d', '6c', '5s'), // straight
    h('As', 'Js', '9s', '6s', '3s'), // flush
    h('Ks', 'Kh', 'Kd', '2c', '2d'), // full house
    h('9s', '9h', '9d', '9c', 'Kd'), // quads
    h('Ah', 'Kh', 'Qh', 'Jh', 'Th'), // straight flush
  ].map((hand) => evaluate5(hand));

  for (let i = 1; i < ladder.length; i++) {
    expect(compareHands(ladder[i]!, ladder[i - 1]!)).toBeGreaterThan(0);
  }
});

test('five of a kind beats a straight flush', () => {
  const wild: WildRule = {
    mode: 'full',
    twoWildsSameCard: true,
    naturalBeatsWild: false,
  };
  const fiveOfAKind = evaluate5(h('As', 'Ah', 'Ad', 'Ac', 'Jk'), { wild });
  const straightFlush = evaluate5(h('Ah', 'Kh', 'Qh', 'Jh', 'Th'));
  expect(compareHands(fiveOfAKind, straightFlush)).toBeGreaterThan(0);
});

test('identical hands tie (chop)', () => {
  const a = evaluate5(h('As', 'Ah', 'Kd', 'Qc', 'Js'));
  const b = evaluate5(h('Ad', 'Ac', 'Kh', 'Qs', 'Jh'));
  expect(compareHands(a, b)).toBe(0);
});

test('higher kicker wins within the same category', () => {
  const aceKing = evaluate5(h('As', 'Ah', 'Kd', 'Qc', 'Js'));
  const aceQueen = evaluate5(h('Ad', 'Ac', 'Qh', 'Js', '9h'));
  expect(compareHands(aceKing, aceQueen)).toBeGreaterThan(0);
});

test('short-deck: a flush beats a full house', () => {
  const flush = evaluate5(h('As', 'Js', '9s', '7s', '6s'), { shortDeck: true });
  const fullHouse = evaluate5(h('Ks', 'Kh', 'Kd', '9c', '9d'), {
    shortDeck: true,
  });
  expect(flush.category).toBe('flush');
  expect(fullHouse.category).toBe('full-house');
  expect(compareHands(flush, fullHouse)).toBeGreaterThan(0);
});

test('naturalBeatsWild: a natural hand wins an otherwise-equal wild hand', () => {
  const wild: WildRule = {
    mode: 'full',
    twoWildsSameCard: true,
    naturalBeatsWild: true,
  };
  const natural = evaluate5(h('As', 'Ah', 'Ad', 'Ac', 'Kd'), { wild });
  const wildMade = evaluate5(h('As', 'Ah', 'Ad', 'Jk', 'Kd'), { wild });

  expect(natural.category).toBe('quads');
  expect(wildMade.category).toBe('quads');
  expect(compareHands(natural, wildMade, wild)).toBeGreaterThan(0);
  // Without the house rule the two are an exact tie.
  expect(compareHands(natural, wildMade)).toBe(0);
});
