import type { Card, Rank } from '../cards/card';
import type { WildRule } from '../descriptor/variant';

export type HandCategory =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'trips'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'quads'
  | 'straight-flush'
  | 'five-of-a-kind';

// A fully resolved 5-card hand value, comparable via compareHands.
export type HandValue = {
  readonly category: HandCategory;
  // Category strength as a number (depends on short-deck ordering).
  readonly strength: number;
  // Tiebreaker rank values, most significant first. Same length within a
  // category, so two same-category hands compare element-by-element.
  readonly tiebreakers: readonly number[];
  // How many wild cards the 5-card hand contains (for naturalBeatsWild).
  readonly wildsUsed: number;
  // The 5 cards forming the hand (originals — wilds appear as jokers).
  readonly cards: readonly Card[];
};

export type EvalOptions = {
  readonly wild?: WildRule;
  // Short-deck rankings: flush beats full house; A-6-7-8-9 is a straight.
  readonly shortDeck?: boolean;
};

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

export function rankValue(rank: Rank): number {
  return RANK_VALUE[rank];
}

const RANK_NAME: Record<number, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven',
  8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King',
  14: 'Ace',
};

export function rankName(value: number): string {
  return RANK_NAME[value] ?? String(value);
}

// Standard ordering, weakest -> strongest.
const STANDARD_ORDER: readonly HandCategory[] = [
  'high-card', 'pair', 'two-pair', 'trips', 'straight', 'flush',
  'full-house', 'quads', 'straight-flush', 'five-of-a-kind',
];

// Short-deck swaps flush and full-house (flushes are rarer with 36 cards).
const SHORT_DECK_ORDER: readonly HandCategory[] = [
  'high-card', 'pair', 'two-pair', 'trips', 'straight', 'full-house',
  'flush', 'quads', 'straight-flush', 'five-of-a-kind',
];

export function categoryStrength(
  category: HandCategory,
  shortDeck?: boolean,
): number {
  const order = shortDeck ? SHORT_DECK_ORDER : STANDARD_ORDER;
  return order.indexOf(category);
}

// Human-readable description, e.g. "Full House, Kings full of Twos".
export function describeHand(hand: HandValue): string {
  const t = hand.tiebreakers;
  const n = (i: number) => rankName(t[i] ?? 0);
  switch (hand.category) {
    case 'five-of-a-kind':
      return `Five of a Kind, ${n(0)}s`;
    case 'straight-flush':
      return (t[0] ?? 0) === 14
        ? 'Royal Flush'
        : `Straight Flush, ${n(0)}-high`;
    case 'quads':
      return `Four of a Kind, ${n(0)}s`;
    case 'full-house':
      return `Full House, ${n(0)}s full of ${n(1)}s`;
    case 'flush':
      return `Flush, ${n(0)}-high`;
    case 'straight':
      return `Straight, ${n(0)}-high`;
    case 'trips':
      return `Three of a Kind, ${n(0)}s`;
    case 'two-pair':
      return `Two Pair, ${n(0)}s and ${n(1)}s`;
    case 'pair':
      return `Pair of ${n(0)}s`;
    case 'high-card':
      return `${n(0)}-high`;
  }
}
