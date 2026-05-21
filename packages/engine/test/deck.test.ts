import { test, expect } from 'bun:test';
import { buildDeck, deckSize } from '../src/cards/deck';
import { cardId } from '../src/cards/card';
import type { DeckSpec } from '../src/descriptor/variant';

test('single standard deck has 52 cards', () => {
  const deck = buildDeck({ standardDecks: 1, jokers: 0 });
  expect(deck.length).toBe(52);
  expect(deck.every((c) => c.kind === 'standard')).toBe(true);
});

test('two decks have 104 cards', () => {
  expect(buildDeck({ standardDecks: 2, jokers: 0 }).length).toBe(104);
});

test('two decks plus four jokers — the home game', () => {
  const spec: DeckSpec = { standardDecks: 2, jokers: 4 };
  const deck = buildDeck(spec);
  expect(deck.length).toBe(108);
  expect(deck.length).toBe(deckSize(spec));
  expect(deck.filter((c) => c.kind === 'joker').length).toBe(4);
});

test('short deck removes 2-5 leaving 36 cards', () => {
  const spec: DeckSpec = {
    standardDecks: 1,
    jokers: 0,
    removeRanks: ['2', '3', '4', '5'],
  };
  const deck = buildDeck(spec);
  expect(deck.length).toBe(36);
  expect(deck.length).toBe(deckSize(spec));
  expect(deck.some((c) => c.kind === 'standard' && c.rank === '2')).toBe(false);
});

test('multi-deck produces genuine duplicate cards', () => {
  const deck = buildDeck({ standardDecks: 2, jokers: 0 });
  const aceSpades = deck.filter(
    (c) => c.kind === 'standard' && c.rank === 'A' && c.suit === 's',
  );
  expect(aceSpades.length).toBe(2);
  // ...but each duplicate still has a unique identity.
  expect(aceSpades[0] && cardId(aceSpades[0])).not.toBe(
    aceSpades[1] && cardId(aceSpades[1]),
  );
});

test('every card in a multi-deck shoe has a unique id', () => {
  const deck = buildDeck({ standardDecks: 2, jokers: 4 });
  const ids = new Set(deck.map(cardId));
  expect(ids.size).toBe(deck.length);
});
