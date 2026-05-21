import { test, expect } from 'bun:test';
import { mulberry32, shuffle } from '../src/cards/shuffle';
import { buildDeck } from '../src/cards/deck';
import { cardId } from '../src/cards/card';

test('mulberry32 yields values in [0, 1)', () => {
  const rng = mulberry32(12345);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});

test('same seed produces the same shuffle — replay determinism', () => {
  const deck = buildDeck({ standardDecks: 1, jokers: 0 });
  const a = shuffle(deck, mulberry32(42)).map(cardId);
  const b = shuffle(deck, mulberry32(42)).map(cardId);
  expect(a).toEqual(b);
});

test('different seeds produce different shuffles', () => {
  const deck = buildDeck({ standardDecks: 1, jokers: 0 });
  const a = shuffle(deck, mulberry32(1)).map(cardId);
  const b = shuffle(deck, mulberry32(2)).map(cardId);
  expect(a).not.toEqual(b);
});

test('shuffle is a permutation — same cards, no loss or duplication', () => {
  const deck = buildDeck({ standardDecks: 2, jokers: 4 });
  const shuffled = shuffle(deck, mulberry32(7));
  expect(shuffled.length).toBe(deck.length);
  expect(new Set(shuffled.map(cardId))).toEqual(new Set(deck.map(cardId)));
});

test('shuffle does not mutate the input deck', () => {
  const deck = buildDeck({ standardDecks: 1, jokers: 0 });
  const before = deck.map(cardId);
  shuffle(deck, mulberry32(99));
  expect(deck.map(cardId)).toEqual(before);
});
