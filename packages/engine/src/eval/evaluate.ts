import {
  type Card,
  type JokerCard,
  type StandardCard,
  RANKS,
  SUITS,
} from '../cards/card';
import type { HandSelection, WildRule } from '../descriptor/variant';
import {
  type EvalOptions,
  type HandCategory,
  type HandValue,
  categoryStrength,
  rankValue,
} from './hand';
import { compareHands } from './compare';

// Jokers are the only wild cards.
export function isWild(card: Card): card is JokerCard {
  return card.kind === 'joker';
}

const ALL_STANDARD: StandardCard[] = RANKS.flatMap((rank) =>
  SUITS.map((suit): StandardCard => ({ kind: 'standard', rank, suit, copyIndex: 0 })),
);

const ACES: StandardCard[] = SUITS.map(
  (suit): StandardCard => ({ kind: 'standard', rank: 'A', suit, copyIndex: 0 }),
);

function wildCandidates(wild?: WildRule): StandardCard[] {
  // 'bug' mode: a partial wild — approximated as wild only for aces (which
  // also completes straights and flushes). Full bug semantics can be refined.
  return wild?.mode === 'bug' ? ACES : ALL_STANDARD;
}

// Detects a straight from 5 rank values. Requires 5 distinct ranks — duplicate
// ranks (possible with multi-deck) can never form a straight.
function detectStraight(values: number[], shortDeck?: boolean): number | null {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length !== 5) return null;

  const hi = unique[0] as number;
  const lo = unique[4] as number;
  if (hi - lo === 4) return hi; // plain consecutive run

  // Wheel: ace plays low. Standard A-2-3-4-5; short-deck A-6-7-8-9.
  if (shortDeck) {
    if (unique.join(',') === '14,9,8,7,6') return 9;
  } else if (unique.join(',') === '14,5,4,3,2') {
    return 5;
  }
  return null;
}

function make(
  category: HandCategory,
  tiebreakers: number[],
  cards: readonly Card[],
  wildsUsed: number,
  shortDeck?: boolean,
): HandValue {
  return {
    category,
    strength: categoryStrength(category, shortDeck),
    tiebreakers,
    wildsUsed,
    cards: cards.slice(),
  };
}

// Classifies exactly 5 standard (non-wild) cards into a HandValue.
function classifyNatural(
  cards: readonly StandardCard[],
  original: readonly Card[],
  wildsUsed: number,
  opts: EvalOptions,
): HandValue {
  const values = cards.map((c) => rankValue(c.rank)).sort((a, b) => b - a);

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  // Groups sorted by count desc, then rank value desc.
  const groups = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || b[0] - a[0],
  );
  const top = groups[0] as [number, number];
  const second = groups[1];

  const isFlush = new Set(cards.map((c) => c.suit)).size === 1;
  const straightHigh = detectStraight(values, opts.shortDeck);

  const sd = opts.shortDeck;
  const mk = (cat: HandCategory, tb: number[]) =>
    make(cat, tb, original, wildsUsed, sd);

  if (top[1] >= 5) return mk('five-of-a-kind', [top[0]]);
  if (straightHigh !== null && isFlush) {
    return mk('straight-flush', [straightHigh]);
  }
  if (top[1] === 4) {
    const kicker = groups.find((g) => g[0] !== top[0]) as [number, number];
    return mk('quads', [top[0], kicker[0]]);
  }
  if (top[1] === 3 && second && second[1] >= 2) {
    return mk('full-house', [top[0], second[0]]);
  }
  if (isFlush) return mk('flush', values);
  if (straightHigh !== null) return mk('straight', [straightHigh]);
  if (top[1] === 3) {
    const kickers = values.filter((v) => v !== top[0]);
    return mk('trips', [top[0], ...kickers]);
  }
  if (top[1] === 2 && second && second[1] === 2) {
    const hp = Math.max(top[0], second[0]);
    const lp = Math.min(top[0], second[0]);
    const kicker = values.find((v) => v !== hp && v !== lp) as number;
    return mk('two-pair', [hp, lp, kicker]);
  }
  if (top[1] === 2) {
    const kickers = values.filter((v) => v !== top[0]);
    return mk('pair', [top[0], ...kickers]);
  }
  return mk('high-card', values);
}

// Evaluates exactly 5 cards, resolving any wild cards to their best value.
export function evaluate5(cards: readonly Card[], opts: EvalOptions = {}): HandValue {
  const wilds: Card[] = [];
  const naturals: StandardCard[] = [];
  for (const card of cards) {
    if (isWild(card)) wilds.push(card);
    else naturals.push(card);
  }

  if (wilds.length === 0) {
    return classifyNatural(naturals, cards, 0, opts);
  }

  // Brute-force wild resolution: try every assignment, keep the best hand.
  const candidates = wildCandidates(opts.wild);
  const distinctOnly = opts.wild?.twoWildsSameCard === false;
  let best: HandValue | null = null;
  const chosen: StandardCard[] = [];
  const used = new Set<string>();

  const assign = (i: number): void => {
    if (i === wilds.length) {
      const hv = classifyNatural(
        [...naturals, ...chosen],
        cards,
        wilds.length,
        opts,
      );
      if (best === null || compareHands(hv, best, opts.wild) > 0) best = hv;
      return;
    }
    for (const cand of candidates) {
      const key = `${cand.rank}${cand.suit}`;
      if (distinctOnly && used.has(key)) continue;
      used.add(key);
      chosen.push(cand);
      assign(i + 1);
      chosen.pop();
      if (distinctOnly) used.delete(key);
    }
  };
  assign(0);

  if (best === null) {
    throw new Error('unreachable: wild resolution produced no hand');
  }
  return best;
}

export function combinations<T>(items: readonly T[], k: number): T[][] {
  const result: T[][] = [];
  const combo: T[] = [];
  const recurse = (start: number): void => {
    if (combo.length === k) {
      result.push(combo.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i] as T);
      recurse(i + 1);
      combo.pop();
    }
  };
  recurse(0);
  return result;
}

// Best 5-card hand from a flat pool (e.g. Hold'em: 2 hole + 5 community).
export function bestOfPool(pool: readonly Card[], opts: EvalOptions = {}): HandValue {
  let best: HandValue | null = null;
  for (const combo of combinations(pool, 5)) {
    const hv = evaluate5(combo, opts);
    if (best === null || compareHands(hv, best, opts.wild) > 0) best = hv;
  }
  if (best === null) throw new Error('bestOfPool needs at least 5 cards');
  return best;
}

// Best 5-card hand respecting a variant's hole/community selection rule
// (e.g. Omaha: exactly 2 hole + exactly 3 community).
export function bestSelected(
  hole: readonly Card[],
  community: readonly Card[],
  selection: HandSelection,
  opts: EvalOptions = {},
): HandValue {
  let best: HandValue | null = null;
  const hMax = Math.min(selection.holeMax, hole.length);
  for (let h = selection.holeMin; h <= hMax; h++) {
    const c = 5 - h;
    if (c < selection.communityMin || c > selection.communityMax) continue;
    if (c < 0 || c > community.length) continue;
    for (const hc of combinations(hole, h)) {
      for (const cc of combinations(community, c)) {
        const hv = evaluate5([...hc, ...cc], opts);
        if (best === null || compareHands(hv, best, opts.wild) > 0) best = hv;
      }
    }
  }
  if (best === null) {
    throw new Error('bestSelected: no legal 5-card hand for this selection');
  }
  return best;
}
