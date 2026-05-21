import type { Variant } from '../variant';

export const omaha: Variant = {
  id: 'omaha',
  name: 'Pot-Limit Omaha',
  deck: { standardDecks: 1, jokers: 0 },
  burnCards: false,
  stages: [
    { kind: 'deal-hole', count: 4 },
    { kind: 'betting-round' },
    { kind: 'deal-community', count: 3 },
    { kind: 'betting-round' },
    { kind: 'deal-community', count: 1 },
    { kind: 'betting-round' },
    { kind: 'deal-community', count: 1 },
    { kind: 'betting-round' },
    { kind: 'showdown' },
  ],
  betting: { kind: 'pot-limit' },
  ranking: 'high',
  // The defining Omaha rule: exactly 2 hole cards + exactly 3 community cards.
  selection: { holeMin: 2, holeMax: 2, communityMin: 3, communityMax: 3 },
};
