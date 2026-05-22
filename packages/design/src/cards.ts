import { colors } from './colors';

// The visual spec for rendering a playing card. Both platforms draw cards
// from this same data, so a card looks identical on web and mobile even
// though the rendering code (SVG vs react-native-svg) differs.

export type SuitKey = 's' | 'h' | 'd' | 'c';

export const suits: Record<
  SuitKey,
  { symbol: string; name: string; color: string }
> = {
  s: { symbol: '♠', name: 'spades', color: colors.card.blackSuit },
  h: { symbol: '♥', name: 'hearts', color: colors.card.redSuit },
  d: { symbol: '♦', name: 'diamonds', color: colors.card.redSuit },
  c: { symbol: '♣', name: 'clubs', color: colors.card.blackSuit },
};

// Display label per rank ('T' shows as "10").
export const rankLabel: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
  '8': '8', '9': '9', T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A',
};

// Geometry, expressed as fractions so a card renders crisply at any size.
export const cardSpec = {
  aspectRatio: 0.71, // width / height — standard poker card proportions
  cornerInset: 0.09, // corner cluster offset, fraction of width
  cornerRankSize: 0.2, // fraction of card height
  cornerSuitSize: 0.15,
  centerSuitSize: 0.46,
  borderWidth: 0.02,
} as const;

// A joker is drawn distinctly — a gold star — since jokers are wild.
export const jokerSpec = {
  symbol: '★',
  label: 'JOKER',
  color: colors.accent.gold,
} as const;

// Standard casino chip denominations and their colors.
export const chipDenominations = [1, 5, 25, 100, 500, 1000, 5000] as const;

export const chipColor: Record<number, string> = {
  1: '#ececec',
  5: '#d23b36',
  25: '#2e8b4e',
  100: '#1c1c1c',
  500: '#7a3fa0',
  1000: '#d8af3a',
  5000: '#2b6cb0',
};

// Breaks a chip amount into denomination stacks, largest first — useful for
// rendering a player's bet or stack as physical chips.
export function chipBreakdown(amount: number): { denom: number; count: number }[] {
  const out: { denom: number; count: number }[] = [];
  let remaining = Math.max(0, Math.floor(amount));
  for (let i = chipDenominations.length - 1; i >= 0; i--) {
    const denom = chipDenominations[i] as number;
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      out.push({ denom, count });
      remaining -= count * denom;
    }
  }
  return out;
}
