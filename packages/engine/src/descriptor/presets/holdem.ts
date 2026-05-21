import type { Variant } from '../variant';

export const texasHoldem: Variant = {
  id: 'texas-holdem',
  name: "Texas Hold'em",
  deck: { standardDecks: 1, jokers: 0 },
  burnCards: false,
  stages: [
    { kind: 'deal-hole', count: 2 },
    { kind: 'betting-round' },
    { kind: 'deal-community', count: 3 },
    { kind: 'betting-round' },
    { kind: 'deal-community', count: 1 },
    { kind: 'betting-round' },
    { kind: 'deal-community', count: 1 },
    { kind: 'betting-round' },
    { kind: 'showdown' },
  ],
  betting: { kind: 'no-limit' },
  ranking: 'high',
  selection: { holeMin: 0, holeMax: 2, communityMin: 3, communityMax: 5 },
};
