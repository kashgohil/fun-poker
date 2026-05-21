import type { HandValue } from './hand';
import type { WildRule } from '../descriptor/variant';

// Compares two resolved hands.
//   > 0  => a is stronger
//   < 0  => b is stronger
//   = 0  => exact tie (chop)
export function compareHands(
  a: HandValue,
  b: HandValue,
  wild?: WildRule,
): number {
  if (a.strength !== b.strength) return a.strength - b.strength;

  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }

  // Equal in value: optional house rule — a hand using fewer wild cards wins.
  if (wild?.naturalBeatsWild && a.wildsUsed !== b.wildsUsed) {
    return b.wildsUsed - a.wildsUsed;
  }

  return 0;
}
