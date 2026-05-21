import type { Variant } from '../variant';

export const crazyPineapple: Variant = {
  id: 'crazy-pineapple',
  name: 'Crazy Pineapple',
  deck: { standardDecks: 1, jokers: 0 },
  burnCards: false,
  stages: [
    { kind: 'deal-hole', count: 3 },
    { kind: 'betting-round' }, // preflop, with 3 hole cards
    { kind: 'deal-community', count: 3 },
    { kind: 'betting-round' }, // flop, still 3 hole cards
    { kind: 'discard', count: 1 }, // each player discards down to 2
    { kind: 'deal-community', count: 1 },
    { kind: 'betting-round' },
    { kind: 'deal-community', count: 1 },
    { kind: 'betting-round' },
    { kind: 'showdown' },
  ],
  betting: { kind: 'no-limit' },
  ranking: 'high',
  // After the discard a hand plays like Hold'em — 0-2 hole cards.
  selection: { holeMin: 0, holeMax: 2, communityMin: 3, communityMax: 5 },
};
