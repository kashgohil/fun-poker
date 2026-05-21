import { test, expect } from 'bun:test';
import {
  MAX_WILD_CARDS,
  countWildCards,
  validateVariant,
} from '../src/descriptor/validate';
import { texasHoldem } from '../src/descriptor/presets/holdem';
import type { Variant, WildRule } from '../src/descriptor/variant';

const JOKER_WILD: WildRule = {
  mode: 'full',
  twoWildsSameCard: true,
  naturalBeatsWild: false,
};

test('max wild cards is four', () => {
  expect(MAX_WILD_CARDS).toBe(4);
});

test('plain Hold-em has no wild cards and is valid', () => {
  expect(countWildCards(texasHoldem.deck)).toBe(0);
  expect(validateVariant(texasHoldem)).toEqual([]);
});

test('the two-deck home game with four jokers is valid', () => {
  const variant: Variant = {
    ...texasHoldem,
    id: 'home-game',
    deck: { standardDecks: 2, jokers: 4 },
    wild: JOKER_WILD,
  };
  expect(countWildCards(variant.deck)).toBe(4);
  expect(validateVariant(variant)).toEqual([]);
});

test('five jokers is rejected', () => {
  const variant: Variant = {
    ...texasHoldem,
    id: 'too-wild',
    deck: { standardDecks: 2, jokers: 5 },
    wild: JOKER_WILD,
  };
  expect(validateVariant(variant)).toHaveLength(1);
});

test('eight jokers across two decks is rejected', () => {
  const variant: Variant = {
    ...texasHoldem,
    id: 'too-many-jokers',
    deck: { standardDecks: 2, jokers: 8 },
    wild: JOKER_WILD,
  };
  expect(countWildCards(variant.deck)).toBe(8);
  expect(validateVariant(variant)).toHaveLength(1);
});
