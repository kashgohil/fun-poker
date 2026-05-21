import type { BettingStructure } from '../descriptor/variant';
import {
  maxBetTotal,
  minOpenBet,
  minRaiseTotal,
  streetBetSize,
} from './sizing';

export type PlayerBetStatus = 'active' | 'folded' | 'all-in';

export type PlayerBet = {
  seat: number;
  stack: number; // chips behind, not yet committed
  committed: number; // chips committed THIS street
  status: PlayerBetStatus;
  // Acted at least once since the last reopen of the action.
  hasActed: boolean;
  // Has the right to raise on their turn. A short all-in revokes this for
  // players who have already acted — they may only call.
  canRaise: boolean;
};

export type BettingRound = {
  players: PlayerBet[]; // seat order, only players dealt into the hand
  toAct: number | null; // index into players; null once the round is closed
  currentBet: number; // highest committed this street
  lastRaiseSize: number; // size of the last full raise increment
  raiseCount: number; // raises made this street (for the fixed-limit cap)
  aggressor: number | null; // index of the last full bettor/raiser
};

export type BettingConfig = {
  structure: BettingStructure;
  bigBlind: number;
  street: number; // 0-based betting-round index (for fixed-limit sizing)
  priorPot: number; // chips already in pots from earlier streets (for pot-limit)
};

export type BetAction =
  | { kind: 'fold' }
  | { kind: 'check' }
  | { kind: 'call' }
  | { kind: 'bet'; to: number } // `to` = target total committed this street
  | { kind: 'raise'; to: number }
  | { kind: 'all-in' };

export type LegalBet =
  | { kind: 'fold' }
  | { kind: 'check' }
  | { kind: 'call'; amount: number } // chips to add (may be an all-in call)
  | { kind: 'bet'; min: number; max: number } // target total commitment
  | { kind: 'raise'; min: number; max: number }
  | { kind: 'all-in'; amount: number }; // total commitment when shoving

export type OpenInput = {
  players: ReadonlyArray<{
    seat: number;
    stack: number;
    committed: number;
    status: PlayerBetStatus;
  }>;
  firstToAct: number; // index into players
  currentBet: number;
  lastRaiseSize: number;
};

// Opens a betting round. Blinds/antes are expected to be reflected already in
// each player's `committed` and `stack` by the caller.
export function openBettingRound(input: OpenInput): BettingRound {
  const players: PlayerBet[] = input.players.map((p) => ({
    seat: p.seat,
    stack: p.stack,
    committed: p.committed,
    status: p.status,
    hasActed: false,
    canRaise: true,
  }));
  const round: BettingRound = {
    players,
    toAct: null,
    currentBet: input.currentBet,
    lastRaiseSize: input.lastRaiseSize,
    raiseCount: 0,
    aggressor: null,
  };
  round.toAct = nextToAct(round, input.firstToAct - 1);
  return round;
}

export function roundClosed(round: BettingRound): boolean {
  return round.toAct === null;
}

// Finds the next index (circular, after `fromIndex`) that still owes action:
// an active player who has not acted, or has not matched the current bet.
function nextToAct(round: BettingRound, fromIndex: number): number | null {
  const n = round.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (((fromIndex + step) % n) + n) % n;
    const p = round.players[idx] as PlayerBet;
    if (
      p.status === 'active' &&
      (!p.hasActed || p.committed < round.currentBet)
    ) {
      return idx;
    }
  }
  return null;
}

function cloneRound(round: BettingRound): BettingRound {
  return { ...round, players: round.players.map((p) => ({ ...p })) };
}

// The smallest increment that counts as a "full" raise — only a full raise
// reopens the betting for players who have already acted.
function minIncrement(round: BettingRound, config: BettingConfig): number {
  const s = config.structure;
  if (s.kind === 'fixed-limit') return streetBetSize(config);
  if (s.kind === 'spread-limit') return s.min;
  return Math.max(round.lastRaiseSize, config.bigBlind);
}

// After a bet/raise, decide who still owes action.
//  - full raise: every other active player must act again and may re-raise.
//  - short all-in: players who already acted may only call; players who have
//    not yet acted keep full rights.
function reopen(round: BettingRound, aggressor: number, full: boolean): void {
  for (let j = 0; j < round.players.length; j++) {
    if (j === aggressor) continue;
    const p = round.players[j] as PlayerBet;
    if (p.status !== 'active') continue;
    if (full) {
      p.hasActed = false;
      p.canRaise = true;
    } else if (p.hasActed) {
      p.hasActed = false;
      p.canRaise = false;
    }
  }
}

export function legalActions(
  round: BettingRound,
  config: BettingConfig,
): LegalBet[] {
  if (round.toAct === null) return [];
  const p = round.players[round.toAct] as PlayerBet;
  const toCall = round.currentBet - p.committed;
  const allInTotal = p.committed + p.stack;
  const options: LegalBet[] = [{ kind: 'fold' }];

  if (toCall <= 0) {
    options.push({ kind: 'check' });
  } else {
    options.push({ kind: 'call', amount: Math.min(toCall, p.stack) });
  }

  if (round.currentBet === 0) {
    // Opening bet — only offered if a full minimum bet is affordable.
    const min = minOpenBet(config);
    const max = maxBetTotal(round, config, p);
    if (p.canRaise && p.stack > 0 && allInTotal >= min && max >= min) {
      options.push({ kind: 'bet', min, max });
    }
  } else {
    const flCapReached =
      config.structure.kind === 'fixed-limit' &&
      round.raiseCount >= config.structure.raiseCap;
    const min = minRaiseTotal(round, config);
    const max = maxBetTotal(round, config, p);
    if (
      p.canRaise &&
      !flCapReached &&
      p.stack > toCall &&
      allInTotal >= min &&
      max >= min
    ) {
      options.push({ kind: 'raise', min, max });
    }
  }

  if (p.stack > 0) {
    options.push({ kind: 'all-in', amount: allInTotal });
  }
  return options;
}

function applyBetOrRaise(
  round: BettingRound,
  config: BettingConfig,
  player: PlayerBet,
  index: number,
  to: number,
): void {
  const isRaise = round.currentBet > 0;
  const opt = legalActions(round, config).find(
    (o) => o.kind === (isRaise ? 'raise' : 'bet'),
  );
  if (opt?.kind !== 'bet' && opt?.kind !== 'raise') {
    throw new Error(`${isRaise ? 'raise' : 'bet'} is not legal here`);
  }
  if (to < opt.min || to > opt.max) {
    throw new Error(`bet/raise to ${to} is outside [${opt.min}, ${opt.max}]`);
  }

  const increment = to - round.currentBet;
  player.stack -= to - player.committed;
  player.committed = to;
  player.hasActed = true;
  if (player.stack === 0) player.status = 'all-in';

  round.currentBet = to;
  round.lastRaiseSize = increment;
  round.aggressor = index;
  if (isRaise) round.raiseCount += 1;
  reopen(round, index, true); // a voluntary bet/raise is always a full raise
}

function applyAllIn(
  round: BettingRound,
  config: BettingConfig,
  player: PlayerBet,
  index: number,
): void {
  const total = player.committed + player.stack;
  const previousBet = round.currentBet;
  player.committed = total;
  player.stack = 0;
  player.status = 'all-in';
  player.hasActed = true;

  if (total > previousBet) {
    const increment = total - previousBet;
    const isFull = increment >= minIncrement(round, config);
    round.currentBet = total;
    round.aggressor = index;
    if (previousBet > 0) round.raiseCount += 1;
    if (isFull) {
      round.lastRaiseSize = increment;
      reopen(round, index, true);
    } else {
      // Short all-in: raises the bet but does not reopen for prior actors.
      reopen(round, index, false);
    }
  }
  // total <= previousBet: an all-in call (or all-in for less) — no reopen.
}

// Applies one action and returns the next round state. Pure: the input round
// is not mutated. Throws on an illegal action.
export function applyAction(
  round: BettingRound,
  config: BettingConfig,
  action: BetAction,
): BettingRound {
  if (round.toAct === null) throw new Error('betting round is closed');
  const next = cloneRound(round);
  const index = next.toAct as number;
  const p = next.players[index] as PlayerBet;

  switch (action.kind) {
    case 'fold':
      p.status = 'folded';
      p.hasActed = true;
      break;
    case 'check':
      if (p.committed !== next.currentBet) {
        throw new Error('cannot check while facing a bet');
      }
      p.hasActed = true;
      break;
    case 'call': {
      const toCall = next.currentBet - p.committed;
      if (toCall <= 0) throw new Error('nothing to call');
      const pay = Math.min(toCall, p.stack);
      p.committed += pay;
      p.stack -= pay;
      p.hasActed = true;
      if (p.stack === 0) p.status = 'all-in';
      break;
    }
    case 'bet':
    case 'raise':
      applyBetOrRaise(next, config, p, index, action.to);
      break;
    case 'all-in':
      if (p.stack === 0) throw new Error('player has no chips to go all-in');
      applyAllIn(next, config, p, index);
      break;
  }

  next.toAct = nextToAct(next, index);
  return next;
}

// The single uncalled portion at the top of the betting — returned to the
// bettor when the round closes (a bet nobody matched is never in the pot).
export function uncalledBet(
  round: BettingRound,
): { seat: number; amount: number } | null {
  const sorted = [...round.players].sort((a, b) => b.committed - a.committed);
  const top = sorted[0];
  if (top === undefined) return null;
  const second = sorted[1]?.committed ?? 0;
  const excess = top.committed - second;
  return excess > 0 ? { seat: top.seat, amount: excess } : null;
}
