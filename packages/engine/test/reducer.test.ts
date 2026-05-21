import { test, expect } from 'bun:test';
import { texasHoldem } from '../src/descriptor/presets/holdem';
import { cardId } from '../src/cards/card';
import type { BetAction, LegalBet } from '../src/betting/round';
import {
  type HandSetup,
  actorSeat,
  applyPlayerAction,
  createHand,
  validateAction,
} from '../src/machine/reducer';
import type { HandEvent, HandState, StepResult } from '../src/machine/state';

function setup(stacks: number[], over?: Partial<HandSetup>): HandSetup {
  return {
    variant: texasHoldem,
    handId: 'h1',
    smallBlind: 10,
    bigBlind: 20,
    buttonSeat: 0,
    seed: 12345,
    players: stacks.map((stack, seat) => ({ seat, userId: `u${seat}`, stack })),
    ...over,
  };
}

function totalStacks(state: HandState): number {
  return state.players.reduce((sum, p) => sum + p.stack, 0);
}

function startingTotal(state: HandState): number {
  return state.players.reduce((sum, p) => sum + p.startingStack, 0);
}

// Drives a hand to completion, choosing each action via `decide`.
function playOut(
  start: StepResult,
  decide: (seat: number, legal: LegalBet[]) => BetAction,
): HandState {
  let { state, events } = start;
  while (state.phase === 'running') {
    const req = [...events]
      .reverse()
      .find((e): e is Extract<HandEvent, { type: 'action-requested' }> =>
        e.type === 'action-requested',
      );
    if (!req) throw new Error('hand is running but no action was requested');
    const result = applyPlayerAction(state, req.seat, decide(req.seat, req.legalActions));
    state = result.state;
    events = result.events;
  }
  return state;
}

const checkOrCall = (_seat: number, legal: LegalBet[]): BetAction =>
  legal.some((o) => o.kind === 'check') ? { kind: 'check' } : { kind: 'call' };

const shove = (): BetAction => ({ kind: 'all-in' });

test('createHand deals, posts blinds, and requests the first action', () => {
  const { events } = createHand(setup([1000, 1000, 1000]));
  expect(events[0]?.type).toBe('hand-started');
  expect(events[1]?.type).toBe('blinds-posted');
  expect(events.filter((e) => e.type === 'hole-cards-dealt')).toHaveLength(3);
  expect(events[events.length - 1]?.type).toBe('action-requested');
});

test('a full checked-down hand conserves every chip', () => {
  const start = createHand(setup([1000, 1000, 1000]));
  const end = playOut(start, checkOrCall);
  expect(end.phase).toBe('complete');
  expect(totalStacks(end)).toBe(startingTotal(end));
  expect(totalStacks(end)).toBe(3000);
});

test('when everyone folds, the last player wins the pot', () => {
  let { state, events } = createHand(setup([1000, 1000, 1000]));
  // 3-handed, button seat 0 => UTG is seat 0, SB seat 1, BB seat 2.
  expect(actorSeat(state)).toBe(0);
  ({ state, events } = applyPlayerAction(state, 0, { kind: 'fold' }));
  ({ state, events } = applyPlayerAction(state, 1, { kind: 'fold' }));
  expect(state.phase).toBe('complete');
  const ended = events.find((e) => e.type === 'hand-ended');
  expect(ended?.type).toBe('hand-ended');
  if (ended?.type === 'hand-ended') {
    expect(ended.awards[0]?.seat).toBe(2); // BB scoops the blinds
  }
  expect(totalStacks(state)).toBe(3000);
});

test('an all-in hand runs the board out and reaches showdown', () => {
  const start = createHand(setup([1000, 1000]));
  const end = playOut(start, shove);
  expect(end.phase).toBe('complete');
  expect(end.community).toHaveLength(5); // board fully run out
  expect(totalStacks(end)).toBe(2000);
});

test('an all-in short stack produces a side pot it cannot win', () => {
  // seat 2 can only cover 200; seats 0 and 1 contest the rest.
  const start = createHand(setup([1000, 1000, 200]));
  let { state, events } = start;
  while (state.phase === 'running') {
    const req = [...events]
      .reverse()
      .find((e) => e.type === 'action-requested');
    if (req?.type !== 'action-requested') break;
    ({ state, events } = applyPlayerAction(state, req.seat, shove()));
  }
  expect(state.phase).toBe('complete');
  expect(totalStacks(state)).toBe(2200);

  const ended = events.find((e) => e.type === 'hand-ended');
  if (ended?.type === 'hand-ended') {
    const sidePotAwards = ended.awards.filter((a) => a.potIndex === 1);
    expect(sidePotAwards.length).toBeGreaterThan(0); // a side pot exists
    expect(sidePotAwards.every((a) => a.seat !== 2)).toBe(true); // seat 2 locked out
  }
});

test('heads-up: the button posts the small blind and acts first', () => {
  const { state } = createHand(setup([1000, 1000], { buttonSeat: 0 }));
  expect(state.blinds.sb.seat).toBe(0); // button posts SB heads-up
  expect(state.blinds.bb.seat).toBe(1);
  expect(actorSeat(state)).toBe(0); // SB acts first preflop
});

test('illegal actions are rejected', () => {
  const { state } = createHand(setup([1000, 1000, 1000]));
  // Wrong seat acting.
  expect(() => applyPlayerAction(state, 1, { kind: 'fold' })).toThrow();
  // Cannot check while facing the big blind.
  expect(validateAction(state, 0, { kind: 'check' })).not.toBeNull();
  expect(validateAction(state, 0, { kind: 'call' })).toBeNull();
});

test('the same seed deals the same cards — replay determinism', () => {
  const a = createHand(setup([1000, 1000, 1000], { seed: 999 }));
  const b = createHand(setup([1000, 1000, 1000], { seed: 999 }));
  const holeA = a.state.players.map((p) => p.hole.map(cardId).join(','));
  const holeB = b.state.players.map((p) => p.hole.map(cardId).join(','));
  expect(holeA).toEqual(holeB);
});
