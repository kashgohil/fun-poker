import { type Card, cardId } from '../cards/card';
import type { Variant } from '../descriptor/variant';
import { buildDeck } from '../cards/deck';
import { mulberry32, shuffle } from '../cards/shuffle';
import {
  type BetAction,
  type BettingConfig,
  type BettingRound,
  applyAction,
  legalActions,
  openBettingRound,
  roundClosed,
  uncalledBet,
} from '../betting/round';
import { buildPots } from '../betting/pots';
import { resolveShowdown } from './showdown';
import type { HandEvent, HandPlayer, HandState, StepResult } from './state';

export type HandSetup = {
  variant: Variant;
  handId: string;
  smallBlind: number;
  bigBlind: number;
  buttonSeat: number;
  seed: number; // recorded in the event log so replays reuse it
  players: ReadonlyArray<{ seat: number; userId: string; stack: number }>;
};

// --- seat geometry ----------------------------------------------------------

function blindIndices(
  n: number,
  buttonIndex: number,
): { sb: number; bb: number } {
  if (n === 2) {
    // Heads-up: the button posts the small blind.
    return { sb: buttonIndex, bb: (buttonIndex + 1) % n };
  }
  return { sb: (buttonIndex + 1) % n, bb: (buttonIndex + 2) % n };
}

function preflopFirstToAct(n: number, buttonIndex: number): number {
  // Heads-up: the small blind (button) acts first. Otherwise UTG, left of BB.
  return n === 2 ? buttonIndex : (buttonIndex + 3) % n;
}

// Orders seats by clockwise distance from the button — used for the odd chip.
function orderFromButton(state: HandState, seats: readonly number[]): number[] {
  const n = state.players.length;
  const distance = (seat: number): number => {
    const idx = state.players.findIndex((p) => p.seat === seat);
    return (((idx - state.buttonIndex - 1) % n) + n) % n;
  };
  return [...seats].sort((a, b) => distance(a) - distance(b));
}

// --- helpers ----------------------------------------------------------------

function bettingConfig(state: HandState): BettingConfig {
  return {
    structure: state.variant.betting,
    bigBlind: state.bigBlind,
    street: state.street,
    priorPot: state.pot,
  };
}

function streetName(communityCount: number): string {
  if (communityCount === 3) return 'flop';
  if (communityCount === 4) return 'turn';
  if (communityCount === 5) return 'river';
  return 'community';
}

function blindCommitted(state: HandState, seat: number): number {
  if (seat === state.blinds.sb.seat) return state.blinds.sb.amount;
  if (seat === state.blinds.bb.seat) return state.blinds.bb.amount;
  return 0;
}

function openRound(state: HandState): BettingRound {
  const n = state.players.length;
  const isPreflop = state.street === 0;
  return openBettingRound({
    players: state.players.map((p) => ({
      seat: p.seat,
      stack: p.stack,
      committed: isPreflop ? blindCommitted(state, p.seat) : 0,
      status: p.status,
    })),
    firstToAct: isPreflop
      ? preflopFirstToAct(n, state.buttonIndex)
      : (state.buttonIndex + 1) % n,
    currentBet: isPreflop ? state.bigBlind : 0,
    lastRaiseSize: state.bigBlind,
  });
}

function take(deck: Card[], n: number): { taken: Card[]; rest: Card[] } {
  return { taken: deck.slice(0, n), rest: deck.slice(n) };
}

function dealHole(state: HandState, count: number): StepResult {
  let deck = state.deck;
  const events: HandEvent[] = [];
  const players = state.players.map((p) => {
    const { taken, rest } = take(deck, count);
    deck = rest;
    events.push({ type: 'hole-cards-dealt', seat: p.seat, cards: taken });
    return { ...p, hole: [...p.hole, ...taken] };
  });
  return { state: { ...state, players, deck }, events };
}

function dealCommunity(state: HandState, count: number): StepResult {
  let deck = state.deck;
  if (state.variant.burnCards) deck = deck.slice(1);
  const { taken, rest } = take(deck, count);
  const community = [...state.community, ...taken];
  return {
    state: { ...state, deck: rest, community },
    events: [
      { type: 'street-dealt', street: streetName(community.length), cards: taken },
    ],
  };
}

// Closes the betting round: refunds any uncalled bet, then sweeps each
// player's street commitment into the pot.
function settleRound(state: HandState): StepResult {
  const round = state.betting;
  if (round === null) return { state, events: [] };

  const seatChips = new Map(round.players.map((p) => [p.seat, { ...p }]));
  const refund = uncalledBet(round);
  if (refund) {
    const rp = seatChips.get(refund.seat);
    if (rp) {
      rp.committed -= refund.amount;
      rp.stack += refund.amount;
    }
  }

  let pot = state.pot;
  const players = state.players.map((hp) => {
    const rp = seatChips.get(hp.seat);
    if (!rp) return hp;
    pot += rp.committed;
    return {
      ...hp,
      stack: rp.stack,
      status: rp.status,
      contributed: hp.contributed + rp.committed,
    };
  });

  const pots = buildPots(
    players.map((p) => ({
      seat: p.seat,
      contributed: p.contributed,
      folded: p.status === 'folded',
    })),
  );

  return {
    state: { ...state, players, pot, betting: null },
    events: [{ type: 'pot-updated', pot, pots }],
  };
}

// The whole pot goes to the last player standing — no showdown.
function finishByFold(state: HandState): StepResult {
  const winner = state.players.find((p) => p.status !== 'folded');
  if (!winner) throw new Error('finishByFold: no surviving player');
  const players = state.players.map((p) =>
    p.seat === winner.seat ? { ...p, stack: p.stack + state.pot } : { ...p },
  );
  return {
    state: { ...state, players, phase: 'complete' },
    events: [
      {
        type: 'hand-ended',
        handId: state.handId,
        awards: [{ seat: winner.seat, potIndex: 0, amount: state.pot }],
        finalStacks: players.map((p) => ({ seat: p.seat, stack: p.stack })),
      },
    ],
  };
}

// Evaluates hands, splits each pot (high / low / hi-lo), and ends the hand.
function doShowdown(state: HandState): StepResult {
  const pots = buildPots(
    state.players.map((p) => ({
      seat: p.seat,
      contributed: p.contributed,
      folded: p.status === 'folded',
    })),
  );

  const { awards, reveals } = resolveShowdown(
    state.variant,
    state.players.map((p) => ({
      seat: p.seat,
      hole: p.hole,
      folded: p.status === 'folded',
    })),
    state.community,
    pots,
    (seats) => orderFromButton(state, seats),
  );

  const players = state.players.map((p) => ({ ...p }));
  const bySeat = new Map(players.map((p) => [p.seat, p]));
  for (const award of awards) {
    const player = bySeat.get(award.seat);
    if (player) player.stack += award.amount;
  }

  const events: HandEvent[] = [];
  if (reveals.length > 0) events.push({ type: 'showdown', reveals });
  events.push({
    type: 'hand-ended',
    handId: state.handId,
    awards,
    finalStacks: players.map((p) => ({ seat: p.seat, stack: p.stack })),
  });

  return { state: { ...state, players, phase: 'complete' }, events };
}

function actionRequestedEvent(state: HandState): HandEvent {
  const round = state.betting as BettingRound;
  const player = round.players[round.toAct as number];
  return {
    type: 'action-requested',
    seat: (player as { seat: number }).seat,
    legalActions: legalActions(round, bettingConfig(state)),
  };
}

// Drives the hand forward through non-interactive stages until it either
// completes or blocks waiting for a player action.
function advance(state: HandState): StepResult {
  let s = state;
  const events: HandEvent[] = [];

  while (s.phase === 'running') {
    // Everyone but one player has folded — the hand is over. While a betting
    // round is open, fold status lives on the round's player copies, not yet
    // synced back to HandState.players.
    const statuses = s.betting
      ? s.betting.players.map((p) => p.status)
      : s.players.map((p) => p.status);
    if (statuses.filter((st) => st !== 'folded').length <= 1) {
      if (s.betting !== null) {
        const settled = settleRound(s);
        s = settled.state;
        events.push(...settled.events);
      }
      const finished = finishByFold(s);
      s = finished.state;
      events.push(...finished.events);
      break;
    }

    if (s.betting !== null) {
      if (!roundClosed(s.betting)) {
        events.push(actionRequestedEvent(s));
        return { state: s, events };
      }
      const settled = settleRound(s);
      s = {
        ...settled.state,
        stageIndex: settled.state.stageIndex + 1,
        street: settled.state.street + 1,
      };
      events.push(...settled.events);
      continue;
    }

    if (s.discarding !== null) {
      if (s.discarding.pending.length > 0) {
        events.push({
          type: 'discard-requested',
          seat: s.discarding.pending[0] as number,
          count: s.discarding.count,
        });
        return { state: s, events };
      }
      s = { ...s, discarding: null, stageIndex: s.stageIndex + 1 };
      continue;
    }

    const stage = s.variant.stages[s.stageIndex];
    if (stage === undefined) {
      const finished = doShowdown(s);
      s = finished.state;
      events.push(...finished.events);
      break;
    }

    switch (stage.kind) {
      case 'deal-hole': {
        const r = dealHole(s, stage.count);
        s = { ...r.state, stageIndex: s.stageIndex + 1 };
        events.push(...r.events);
        break;
      }
      case 'deal-community': {
        const r = dealCommunity(s, stage.count);
        s = { ...r.state, stageIndex: s.stageIndex + 1 };
        events.push(...r.events);
        break;
      }
      case 'betting-round': {
        s = { ...s, betting: openRound(s) };
        break;
      }
      case 'showdown': {
        const finished = doShowdown(s);
        s = finished.state;
        events.push(...finished.events);
        break;
      }
      case 'discard': {
        const seats = orderFromButton(
          s,
          s.players.filter((p) => p.status !== 'folded').map((p) => p.seat),
        );
        s = { ...s, discarding: { count: stage.count, pending: seats } };
        break;
      }
      case 'draw':
        throw new Error(`stage '${stage.kind}' is not implemented yet`);
    }
  }

  return { state: s, events };
}

// --- public API -------------------------------------------------------------

// Creates a new hand: shuffles, posts blinds, and advances to the first
// action. The seed is the caller's responsibility to record for replay.
export function createHand(setup: HandSetup): StepResult {
  if (setup.players.length < 2) {
    throw new Error('a hand needs at least two players');
  }

  const ordered = [...setup.players].sort((a, b) => a.seat - b.seat);
  const buttonIndex = ordered.findIndex((p) => p.seat === setup.buttonSeat);
  if (buttonIndex < 0) throw new Error('buttonSeat is not seated');

  const players: HandPlayer[] = ordered.map((p) => ({
    seat: p.seat,
    userId: p.userId,
    startingStack: p.stack,
    stack: p.stack,
    hole: [],
    status: 'active',
    contributed: 0,
  }));

  const n = players.length;
  const { sb, bb } = blindIndices(n, buttonIndex);

  const postBlind = (index: number, amount: number): number => {
    const player = players[index] as HandPlayer;
    const paid = Math.min(amount, player.stack);
    player.stack -= paid;
    if (player.stack === 0) player.status = 'all-in';
    return paid;
  };
  const sbPaid = postBlind(sb, setup.smallBlind);
  const bbPaid = postBlind(bb, setup.bigBlind);

  const deck = shuffle(buildDeck(setup.variant.deck), mulberry32(setup.seed));

  const state: HandState = {
    variant: setup.variant,
    handId: setup.handId,
    smallBlind: setup.smallBlind,
    bigBlind: setup.bigBlind,
    players,
    buttonIndex,
    deck,
    community: [],
    stageIndex: 0,
    street: 0,
    pot: 0,
    betting: null,
    discarding: null,
    blinds: {
      sb: { seat: (players[sb] as HandPlayer).seat, amount: sbPaid },
      bb: { seat: (players[bb] as HandPlayer).seat, amount: bbPaid },
    },
    phase: 'running',
  };

  const events: HandEvent[] = [
    { type: 'hand-started', handId: state.handId, buttonSeat: setup.buttonSeat },
    { type: 'blinds-posted', sb: state.blinds.sb, bb: state.blinds.bb },
  ];
  const advanced = advance(state);
  return { state: advanced.state, events: [...events, ...advanced.events] };
}

// The seat that must act next in betting, or null if none is pending.
export function actorSeat(state: HandState): number | null {
  if (state.betting === null || roundClosed(state.betting)) return null;
  const player = state.betting.players[state.betting.toAct as number];
  return player ? player.seat : null;
}

// What input the hand is waiting for, if any — a bet or a discard.
export function pending(
  state: HandState,
):
  | { kind: 'bet'; seat: number }
  | { kind: 'discard'; seat: number; count: number }
  | null {
  if (state.phase !== 'running') return null;
  if (state.discarding !== null && state.discarding.pending.length > 0) {
    return {
      kind: 'discard',
      seat: state.discarding.pending[0] as number,
      count: state.discarding.count,
    };
  }
  const seat = actorSeat(state);
  return seat === null ? null : { kind: 'bet', seat };
}

// Applies a player's discard choice and advances the hand. `cardIds` are the
// cardId() values of the cards to discard from that player's hand.
export function applyDiscard(
  state: HandState,
  seat: number,
  cardIds: readonly string[],
): StepResult {
  if (state.phase !== 'running') throw new Error('hand is not running');
  if (state.discarding === null || state.discarding.pending.length === 0) {
    throw new Error('no discard is awaiting');
  }
  if (seat !== state.discarding.pending[0]) {
    throw new Error('not this seat’s turn to discard');
  }
  if (cardIds.length !== state.discarding.count) {
    throw new Error(`must discard exactly ${state.discarding.count} card(s)`);
  }

  const player = state.players.find((p) => p.seat === seat);
  if (!player) throw new Error('seat is not in the hand');

  const discardSet = new Set(cardIds);
  if (discardSet.size !== cardIds.length) {
    throw new Error('the same card was listed twice');
  }
  const holeIds = new Set(player.hole.map(cardId));
  for (const id of cardIds) {
    if (!holeIds.has(id)) throw new Error('a discarded card is not in hand');
  }

  const players = state.players.map((p) =>
    p.seat === seat
      ? { ...p, hole: p.hole.filter((c) => !discardSet.has(cardId(c))) }
      : p,
  );
  const discarding = {
    ...state.discarding,
    pending: state.discarding.pending.slice(1),
  };

  const events: HandEvent[] = [
    { type: 'discard-taken', seat, count: cardIds.length },
  ];
  const advanced = advance({ ...state, players, discarding });
  return { state: advanced.state, events: [...events, ...advanced.events] };
}

// Validates an action without applying it; returns an error message or null.
export function validateAction(
  state: HandState,
  seat: number,
  action: BetAction,
): string | null {
  if (state.phase !== 'running') return 'hand is not running';
  if (state.betting === null || roundClosed(state.betting)) {
    return 'no betting round is awaiting action';
  }
  if (seat !== actorSeat(state)) return 'not this seat’s turn';

  const legal = legalActions(state.betting, bettingConfig(state));
  const match = legal.find((o) => o.kind === action.kind);
  if (!match) return `action '${action.kind}' is not legal here`;
  if (action.kind === 'bet' || action.kind === 'raise') {
    if (match.kind !== 'bet' && match.kind !== 'raise') return 'illegal amount';
    if (action.to < match.min || action.to > match.max) {
      return `amount ${action.to} is outside [${match.min}, ${match.max}]`;
    }
  }
  return null;
}

// Applies one player action and advances the hand. Throws on an illegal
// action — callers should pre-check with validateAction for graceful errors.
export function applyPlayerAction(
  state: HandState,
  seat: number,
  action: BetAction,
): StepResult {
  const error = validateAction(state, seat, action);
  if (error) throw new Error(error);

  const round = applyAction(
    state.betting as BettingRound,
    bettingConfig(state),
    action,
  );
  const events: HandEvent[] = [{ type: 'action-taken', seat, action }];
  const advanced = advance({ ...state, betting: round });
  return { state: advanced.state, events: [...events, ...advanced.events] };
}
