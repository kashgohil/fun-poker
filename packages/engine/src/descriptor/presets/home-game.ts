import type { Variant } from '../variant';
import { texasHoldem } from './holdem';

// The house game: two 52-card decks plus four jokers, jokers fully wild.
export const homeGame: Variant = {
  id: 'home-game',
  name: 'Two-Deck Joker Hold’em',
  deck: { standardDecks: 2, jokers: 4 },
  wild: {
    mode: 'full',
    twoWildsSameCard: true,
    naturalBeatsWild: false,
  },
  burnCards: false,
  stages: texasHoldem.stages,
  betting: { kind: 'no-limit' },
  ranking: 'high',
  selection: { holeMin: 0, holeMax: 2, communityMin: 3, communityMax: 5 },
};
