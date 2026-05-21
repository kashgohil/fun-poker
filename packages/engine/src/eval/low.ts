import {
  type Card,
  type Rank,
  type StandardCard,
  RANKS,
  SUITS,
} from '../cards/card';
import type { HandSelection, WildRule } from '../descriptor/variant';
import { rankValue } from './hand';
import { combinations, evaluate5, isWild } from './evaluate';

// Two low-hand systems:
//  - 'a5-low': ace-to-five. Ace is low; straights and flushes are ignored.
//  - '27-low': deuce-to-seven. Ace is high; straights and flushes count
//    against you (it is a high-hand ranking, read upside down).
export type LowSystem = 'a5-low' | '27-low';

// A resolved low hand. `value` is an array where lexicographically SMALLER
// means a BETTER low hand.
export type LowHand = {
  system: LowSystem;
  value: number[];
  cards: Card[];
  wildsUsed: number;
};

const ALL_STANDARD: StandardCard[] = RANKS.flatMap((rank) =>
  SUITS.map((suit): StandardCard => ({ kind: 'standard', rank, suit, copyIndex: 0 })),
);

function aceLowValue(rank: Rank): number {
  return rank === 'A' ? 1 : rankValue(rank);
}

// Ace-to-five value: [category, ...ranks]. Category 0 = no pair (best),
// rising through pair/two-pair/trips/full-house/quads.
function a5Value(cards: readonly StandardCard[]): number[] {
  const values = cards.map((c) => aceLowValue(c.rank));
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  const groups = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || b[0] - a[0],
  );
  const topCount = groups[0]?.[1] ?? 0;
  const secondCount = groups[1]?.[1] ?? 0;

  let category: number;
  if (groups.length === 5) category = 0;
  else if (topCount === 4) category = 5;
  else if (topCount === 3 && secondCount === 2) category = 4;
  else if (topCount === 3) category = 3;
  else if (topCount === 2 && secondCount === 2) category = 2;
  else category = 1;

  const ranks = groups.flatMap(([v, c]) => Array<number>(c).fill(v));
  return [category, ...ranks];
}

function classifyLowNatural(
  cards: readonly StandardCard[],
  system: LowSystem,
): number[] {
  if (system === 'a5-low') return a5Value(cards);
  // 2-7: rank it as a high hand; a lower high hand is a better low.
  const hv = evaluate5(cards);
  return [hv.strength, ...hv.tiebreakers];
}

// Compares two low `value` arrays: > 0 if `a` is the better (lower) hand.
export function compareLowValue(
  a: readonly number[],
  b: readonly number[],
): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return bv - av; // smaller value => better => positive
  }
  return 0;
}

export function compareLow(a: LowHand, b: LowHand): number {
  return compareLowValue(a.value, b.value);
}

// Evaluates exactly 5 cards as a low hand, resolving jokers to the best low.
export function evaluateLow5(
  cards: readonly Card[],
  system: LowSystem,
  opts: { wild?: WildRule } = {},
): LowHand {
  const wilds: Card[] = [];
  const naturals: StandardCard[] = [];
  for (const card of cards) {
    if (isWild(card)) wilds.push(card);
    else naturals.push(card);
  }

  if (wilds.length === 0) {
    return {
      system,
      value: classifyLowNatural(naturals, system),
      cards: [...cards],
      wildsUsed: 0,
    };
  }

  const distinctOnly = opts.wild?.twoWildsSameCard === false;
  const used = new Set<string>();
  const chosen: StandardCard[] = [];
  let best: number[] | null = null;

  const assign = (i: number): void => {
    if (i === wilds.length) {
      const value = classifyLowNatural([...naturals, ...chosen], system);
      if (best === null || compareLowValue(value, best) > 0) best = value;
      return;
    }
    for (const cand of ALL_STANDARD) {
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
    throw new Error('unreachable: low wild resolution produced no hand');
  }
  return { system, value: best, cards: [...cards], wildsUsed: wilds.length };
}

// An ace-to-five low qualifies for "eight or better" if it has no pair and
// its highest card is an 8 or lower. Only meaningful for hi/lo split games.
export function qualifiesEightOrBetter(low: LowHand): boolean {
  return (
    low.system === 'a5-low' &&
    low.value[0] === 0 &&
    (low.value[1] ?? 99) <= 8
  );
}

// Best low hand respecting a variant's hole/community selection rule.
export function bestLowSelected(
  hole: readonly Card[],
  community: readonly Card[],
  selection: HandSelection,
  system: LowSystem,
  opts: { wild?: WildRule } = {},
): LowHand {
  let best: LowHand | null = null;
  const hMax = Math.min(selection.holeMax, hole.length);
  for (let h = selection.holeMin; h <= hMax; h++) {
    const c = 5 - h;
    if (c < selection.communityMin || c > selection.communityMax) continue;
    if (c < 0 || c > community.length) continue;
    for (const hc of combinations(hole, h)) {
      for (const cc of combinations(community, c)) {
        const low = evaluateLow5([...hc, ...cc], system, opts);
        if (best === null || compareLow(low, best) > 0) best = low;
      }
    }
  }
  if (best === null) {
    throw new Error('bestLowSelected: no legal 5-card hand for this selection');
  }
  return best;
}

function rankChar(value: number): string {
  if (value === 1 || value === 14) return 'A';
  return ({ 10: 'T', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[
    value
  ] ?? String(value);
}

// Human-readable description, e.g. "8-6-4-3-A low".
export function describeLow(low: LowHand): string {
  return `${low.value.slice(1).map(rankChar).join('-')} low`;
}
