import type { Rank, Suit } from '../cards/card';

// A deck is described, not hardcoded: any number of standard 52-card decks,
// any number of jokers, with optional ranks removed (short-deck).
export type DeckSpec = {
  readonly standardDecks: number;
  readonly jokers: number;
  readonly removeRanks?: readonly Rank[];
};

// What counts as a wild card.
export type WildSource =
  | { readonly kind: 'joker' }
  | { readonly kind: 'rank'; readonly rank: Rank }
  | { readonly kind: 'card'; readonly rank: Rank; readonly suit: Suit };

export type WildRule = {
  readonly sources: readonly WildSource[];
  // 'full' = becomes any card; 'bug' = wild only for aces, straights, flushes.
  readonly mode: 'full' | 'bug';
  // May two wild cards resolve to the same card?
  readonly twoWildsSameCard: boolean;
  // Tiebreaker: a natural hand beats an equal wild-made hand.
  readonly naturalBeatsWild: boolean;
};

export type BettingStructure =
  | { readonly kind: 'no-limit' }
  | { readonly kind: 'pot-limit' }
  | {
      readonly kind: 'fixed-limit';
      // Streets (0-indexed) that use the big-bet size; earlier use small bet.
      readonly bigBetFromStreet: number;
      readonly raiseCap: number;
    }
  | { readonly kind: 'spread-limit'; readonly min: number; readonly max: number };

// A variant's hand is a program: an ordered list of stages the engine walks.
export type Stage =
  | { readonly kind: 'deal-hole'; readonly count: number; readonly faceUp?: number }
  | { readonly kind: 'deal-community'; readonly count: number }
  | { readonly kind: 'betting-round' }
  | { readonly kind: 'draw'; readonly maxDiscard: number }
  | { readonly kind: 'discard'; readonly count: number }
  | { readonly kind: 'showdown' };

export type RankingSystem = 'high' | 'a5-low' | '27-low' | 'badugi';

// Constraints on how the best hand is formed from hole + community cards.
// Hold'em: 0-2 hole, 3-5 community. Omaha: exactly 2 hole, exactly 3 community.
export type HandSelection = {
  readonly holeMin: number;
  readonly holeMax: number;
  readonly communityMin: number;
  readonly communityMax: number;
};

export type SplitRule = {
  // Low half qualifier; high half always plays.
  readonly low: 'a5-8-or-better';
};

export type Variant = {
  readonly id: string;
  readonly name: string;
  readonly deck: DeckSpec;
  readonly wild?: WildRule;
  // Burn a card before each community deal (common in casinos, not home games).
  readonly burnCards: boolean;
  readonly stages: readonly Stage[];
  readonly betting: BettingStructure;
  readonly ranking: RankingSystem;
  readonly selection: HandSelection;
  // Present for hi/lo split games.
  readonly split?: SplitRule;
  // Short-deck rankings: flush beats full house, A-6-7-8-9 is a straight.
  readonly shortDeckRanking?: boolean;
};
