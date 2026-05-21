import { type Card, type Rank, RANKS, SUITS } from './card';
import type { DeckSpec } from '../descriptor/variant';

// Builds an ordered (unshuffled) deck from a spec. Every card has a unique
// identity via copyIndex, so multi-deck shoes contain real duplicates.
export function buildDeck(spec: DeckSpec): Card[] {
  const removed = new Set<Rank>(spec.removeRanks ?? []);
  const ranks = RANKS.filter((r) => !removed.has(r));
  const cards: Card[] = [];

  for (let copy = 0; copy < spec.standardDecks; copy++) {
    for (const rank of ranks) {
      for (const suit of SUITS) {
        cards.push({ kind: 'standard', rank, suit, copyIndex: copy });
      }
    }
  }

  for (let j = 0; j < spec.jokers; j++) {
    cards.push({ kind: 'joker', copyIndex: j });
  }

  return cards;
}

export function deckSize(spec: DeckSpec): number {
  const rankCount = RANKS.length - (spec.removeRanks?.length ?? 0);
  return spec.standardDecks * rankCount * SUITS.length + spec.jokers;
}
