import type { Card } from '../cards/card';
import type { Variant } from '../descriptor/variant';
import type { SidePot } from '../betting/pots';
import { type HandValue, describeHand } from '../eval/hand';
import { compareHands } from '../eval/compare';
import { bestSelected } from '../eval/evaluate';
import {
  type LowHand,
  type LowSystem,
  bestLowSelected,
  compareLow,
  describeLow,
  qualifiesEightOrBetter,
} from '../eval/low';
import type { Award, Reveal } from './state';

export type ShowdownPlayer = { seat: number; hole: Card[]; folded: boolean };

// Returns the seats tied for the best hand under `compare` (> 0 = a beats b).
function bestSeats<T>(
  seats: readonly number[],
  get: (seat: number) => T,
  compare: (a: T, b: T) => number,
): number[] {
  let winners: number[] = [];
  for (const seat of seats) {
    if (winners.length === 0) {
      winners = [seat];
      continue;
    }
    const cmp = compare(get(seat), get(winners[0] as number));
    if (cmp > 0) winners = [seat];
    else if (cmp === 0) winners.push(seat);
  }
  return winners;
}

// Splits `amount` among `winners`; odd chips go to the earliest seat from
// the button.
function awardSide(
  amount: number,
  winners: readonly number[],
  potIndex: number,
  orderFromButton: (seats: readonly number[]) => number[],
): Award[] {
  if (winners.length === 0) return [];
  const share = Math.floor(amount / winners.length);
  let remainder = amount - share * winners.length;
  const out: Award[] = [];
  for (const seat of orderFromButton(winners)) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    out.push({ seat, potIndex, amount: share + extra });
  }
  return out;
}

// Resolves a showdown: evaluates hands, splits each pot (high-only, low-only,
// or hi/lo split), and produces awards plus reveals.
export function resolveShowdown(
  variant: Variant,
  players: readonly ShowdownPlayer[],
  community: readonly Card[],
  pots: readonly SidePot[],
  orderFromButton: (seats: readonly number[]) => number[],
): { awards: Award[]; reveals: Reveal[] } {
  if (variant.ranking === 'badugi') {
    throw new Error('badugi showdown is not implemented yet');
  }

  const live = players.filter((p) => !p.folded);
  const hasHigh = variant.ranking === 'high';
  const lowSystem: LowSystem | null =
    variant.ranking === 'a5-low'
      ? 'a5-low'
      : variant.ranking === '27-low'
        ? '27-low'
        : hasHigh && variant.split
          ? 'a5-low'
          : null;
  // The 8-or-better qualifier applies only to the low half of a hi/lo split.
  const lowNeedsQualifier = hasHigh && variant.split !== undefined;

  const evalOpts = {
    wild: variant.wild,
    shortDeck: variant.shortDeckRanking,
  };
  const high = new Map<number, HandValue>();
  const low = new Map<number, LowHand>();
  for (const p of live) {
    if (hasHigh) {
      high.set(
        p.seat,
        bestSelected(p.hole, community, variant.selection, evalOpts),
      );
    }
    if (lowSystem) {
      low.set(
        p.seat,
        bestLowSelected(p.hole, community, variant.selection, lowSystem, {
          wild: variant.wild,
        }),
      );
    }
  }

  const awards: Award[] = [];
  pots.forEach((pot, potIndex) => {
    const eligible = pot.eligibleSeats.filter((s) =>
      live.some((p) => p.seat === s),
    );
    if (eligible.length === 0) return;

    const highWinners = hasHigh
      ? bestSeats(
          eligible,
          (s) => high.get(s) as HandValue,
          (a, b) => compareHands(a, b, variant.wild),
        )
      : [];

    let lowWinners: number[] = [];
    if (lowSystem) {
      const lowEligible = lowNeedsQualifier
        ? eligible.filter((s) => qualifiesEightOrBetter(low.get(s) as LowHand))
        : eligible;
      if (lowEligible.length > 0) {
        lowWinners = bestSeats(
          lowEligible,
          (s) => low.get(s) as LowHand,
          compareLow,
        );
      }
    }

    if (hasHigh && lowSystem) {
      if (lowWinners.length === 0) {
        // No qualifying low — the high hand scoops the pot.
        awards.push(
          ...awardSide(pot.amount, highWinners, potIndex, orderFromButton),
        );
      } else {
        const lowHalf = Math.floor(pot.amount / 2);
        const highHalf = pot.amount - lowHalf; // high gets the odd chip
        awards.push(
          ...awardSide(highHalf, highWinners, potIndex, orderFromButton),
        );
        awards.push(
          ...awardSide(lowHalf, lowWinners, potIndex, orderFromButton),
        );
      }
    } else if (hasHigh) {
      awards.push(
        ...awardSide(pot.amount, highWinners, potIndex, orderFromButton),
      );
    } else {
      awards.push(
        ...awardSide(pot.amount, lowWinners, potIndex, orderFromButton),
      );
    }
  });

  const reveals: Reveal[] =
    live.length > 1
      ? live.map((p) => ({
          seat: p.seat,
          hole: p.hole,
          handRank: hasHigh
            ? describeHand(high.get(p.seat) as HandValue)
            : describeLow(low.get(p.seat) as LowHand),
        }))
      : [];

  return { awards, reveals };
}
