export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'T' | 'J' | 'Q' | 'K' | 'A';

export type Suit = 's' | 'h' | 'd' | 'c';

export const RANKS: readonly Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A',
];

export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'];

// A card is either a standard playing card or a joker.
// `copyIndex` distinguishes otherwise-identical cards in a multi-deck shoe,
// so every card in a built deck has a unique identity even with duplicates.
export type StandardCard = {
  readonly kind: 'standard';
  readonly rank: Rank;
  readonly suit: Suit;
  readonly copyIndex: number;
};

export type JokerCard = {
  readonly kind: 'joker';
  readonly copyIndex: number;
};

export type Card = StandardCard | JokerCard;

export function isJoker(card: Card): card is JokerCard {
  return card.kind === 'joker';
}

// Stable, unique string identity for a card — safe as a Set/Map key.
export function cardId(card: Card): string {
  return card.kind === 'joker'
    ? `joker#${card.copyIndex}`
    : `${card.rank}${card.suit}#${card.copyIndex}`;
}

// Human-readable label, ignoring copy index (e.g. "As", "Joker").
export function cardLabel(card: Card): string {
  return card.kind === 'joker' ? 'Joker' : `${card.rank}${card.suit}`;
}
