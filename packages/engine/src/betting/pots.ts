// Each player's total contribution to the hand, and whether they folded.
export type Contribution = {
  seat: number;
  contributed: number; // total across all streets
  folded: boolean;
};

export type SidePot = {
  amount: number;
  eligibleSeats: number[]; // seats that can win this pot (non-folded)
};

function sameEligibility(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((s) => set.has(s));
}

// Merges consecutive pots with identical eligibility into one.
function mergePots(pots: SidePot[]): SidePot[] {
  const merged: SidePot[] = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (last && sameEligibility(last.eligibleSeats, pot.eligibleSeats)) {
      last.amount += pot.amount;
    } else {
      merged.push({ ...pot, eligibleSeats: [...pot.eligibleSeats] });
    }
  }
  return merged;
}

// Builds the main pot and any side pots from total hand contributions.
// Folded players' chips still fund the pots but cannot be won back by them.
export function buildPots(contributions: readonly Contribution[]): SidePot[] {
  const levels = [
    ...new Set(
      contributions.map((c) => c.contributed).filter((v) => v > 0),
    ),
  ].sort((a, b) => a - b);

  const pots: SidePot[] = [];
  let prev = 0;
  for (const level of levels) {
    const layer = level - prev;
    const contributors = contributions.filter((c) => c.contributed >= level);
    const amount = layer * contributors.length;
    if (amount > 0) {
      pots.push({
        amount,
        eligibleSeats: contributors
          .filter((c) => !c.folded)
          .map((c) => c.seat),
      });
    }
    prev = level;
  }
  return mergePots(pots);
}

// Total chips across all pots — used to assert chip conservation.
export function potsTotal(pots: readonly SidePot[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}
