// A random number generator: a function returning a float in [0, 1).
// Passed in explicitly so the engine stays pure and deterministic — the
// caller decides whether to seed for replay or use a CSPRNG for live play.
export type RNG = () => number;

// mulberry32: a small, fast, deterministic PRNG. Same seed => same sequence.
export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle. Returns a new array; does not mutate the input.
export function shuffle<T>(items: readonly T[], rng: RNG): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
