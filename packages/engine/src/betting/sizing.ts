import type { BettingConfig, BettingRound, PlayerBet } from './round';

// Fixed-limit bet size for the current street: small bet early, big bet later.
// For non-fixed structures this is just the big blind (the minimum bet).
export function streetBetSize(config: BettingConfig): number {
  const s = config.structure;
  if (s.kind === 'fixed-limit') {
    return config.street >= s.bigBetFromStreet
      ? config.bigBlind * 2
      : config.bigBlind;
  }
  return config.bigBlind;
}

// Minimum total for an opening bet (when currentBet === 0).
export function minOpenBet(config: BettingConfig): number {
  const s = config.structure;
  if (s.kind === 'spread-limit') return s.min;
  return streetBetSize(config);
}

// Minimum total a raise must reach.
export function minRaiseTotal(
  round: BettingRound,
  config: BettingConfig,
): number {
  const s = config.structure;
  if (s.kind === 'fixed-limit') {
    return round.currentBet + streetBetSize(config);
  }
  if (s.kind === 'spread-limit') {
    return round.currentBet + s.min;
  }
  // No-limit / pot-limit: at least the previous full raise increment, and
  // never less than one big blind.
  return round.currentBet + Math.max(round.lastRaiseSize, config.bigBlind);
}

function streetCommitted(round: BettingRound): number {
  return round.players.reduce((sum, p) => sum + p.committed, 0);
}

// Maximum total commitment allowed for a bet or raise.
export function maxBetTotal(
  round: BettingRound,
  config: BettingConfig,
  player: PlayerBet,
): number {
  const allIn = player.committed + player.stack;
  const s = config.structure;
  switch (s.kind) {
    case 'no-limit':
      return allIn;
    case 'spread-limit':
      return Math.min(player.committed + s.max, allIn);
    case 'fixed-limit': {
      const fixed =
        round.currentBet === 0
          ? streetBetSize(config)
          : round.currentBet + streetBetSize(config);
      return Math.min(fixed, allIn);
    }
    case 'pot-limit': {
      // A pot-sized raise: call first, then raise by the size of the pot.
      const toCall = Math.max(0, round.currentBet - player.committed);
      const potAfterCall = config.priorPot + streetCommitted(round) + toCall;
      return Math.min(round.currentBet + potAfterCall, allIn);
    }
  }
}
