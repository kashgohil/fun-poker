import { test, expect } from 'bun:test';
import { cardId } from '../src/cards/card';
import { validateVariant } from '../src/descriptor/validate';
import { texasHoldem } from '../src/descriptor/presets/holdem';
import { omaha } from '../src/descriptor/presets/omaha';
import { crazyPineapple } from '../src/descriptor/presets/crazy-pineapple';
import { homeGame } from '../src/descriptor/presets/home-game';
import type { BetAction, LegalBet } from '../src/betting/round';
import {
  type HandSetup,
  applyDiscard,
  applyPlayerAction,
  createHand,
} from '../src/machine/reducer';
import type { HandEvent, HandState } from '../src/machine/state';
import type { Variant } from '../src/descriptor/variant';

function setup(variant: Variant, stacks: number[]): HandSetup {
  return {
    variant,
    handId: 'h1',
    smallBlind: 10,
    bigBlind: 20,
    buttonSeat: 0,
    seed: 4242,
    players: stacks.map((stack, seat) => ({ seat, userId: `u${seat}`, stack })),
  };
}

const checkOrCall = (_seat: number, legal: LegalBet[]): BetAction =>
  legal.some((o) => o.kind === 'check') ? { kind: 'check' } : { kind: 'call' };

// Drives a hand to completion, handling both bet and discard requests.
function playOut(variant: Variant, stacks: number[]) {
  let { state, events } = createHand(setup(variant, stacks));
  const allEvents: HandEvent[] = [...events];
  while (state.phase === 'running') {
    const req = [...events]
      .reverse()
      .find(
        (e) => e.type === 'action-requested' || e.type === 'discard-requested',
      );
    if (!req) throw new Error('hand running but no input requested');

    if (req.type === 'discard-requested') {
      const player = state.players.find((p) => p.seat === req.seat);
      if (!player) throw new Error('discard seat missing');
      const ids = player.hole.slice(0, req.count).map(cardId);
      ({ state, events } = applyDiscard(state, req.seat, ids));
    } else if (req.type === 'action-requested') {
      ({ state, events } = applyPlayerAction(
        state,
        req.seat,
        checkOrCall(req.seat, req.legalActions),
      ));
    }
    allEvents.push(...events);
  }
  return { state, allEvents };
}

function conserved(state: HandState): boolean {
  const total = state.players.reduce((s, p) => s + p.stack, 0);
  const starting = state.players.reduce((s, p) => s + p.startingStack, 0);
  return total === starting;
}

test('every preset passes descriptor validation', () => {
  for (const variant of [texasHoldem, omaha, crazyPineapple, homeGame]) {
    expect(validateVariant(variant)).toEqual([]);
  }
});

test('Omaha: a full hand plays out and conserves chips', () => {
  const { state } = playOut(omaha, [1000, 1000, 1000]);
  expect(state.phase).toBe('complete');
  expect(state.community).toHaveLength(5);
  expect(conserved(state)).toBe(true);
  // Each player was dealt four hole cards.
  for (const p of state.players) expect(p.hole).toHaveLength(4);
});

test('Crazy Pineapple: the discard stage runs and trims hands to two cards', () => {
  const { state, allEvents } = playOut(crazyPineapple, [1000, 1000, 1000]);
  expect(state.phase).toBe('complete');
  expect(conserved(state)).toBe(true);

  // All three players were asked to discard exactly one card.
  const discards = allEvents.filter((e) => e.type === 'discard-taken');
  expect(discards).toHaveLength(3);

  // Non-folded players end the hand with 2 hole cards (started with 3).
  for (const p of state.players) {
    if (p.status !== 'folded') expect(p.hole).toHaveLength(2);
  }
});

test('the two-deck joker home game plays a full hand and conserves chips', () => {
  const { state } = playOut(homeGame, [1000, 1000, 1000]);
  expect(state.phase).toBe('complete');
  expect(conserved(state)).toBe(true);
});

test('discarding the wrong card or count is rejected', () => {
  let { state, events } = createHand(setup(crazyPineapple, [1000, 1000, 1000]));
  // Advance betting/flop until a discard is requested.
  while (state.phase === 'running') {
    const req = [...events]
      .reverse()
      .find(
        (e) => e.type === 'action-requested' || e.type === 'discard-requested',
      );
    if (req?.type === 'discard-requested') break;
    if (req?.type !== 'action-requested') throw new Error('unexpected');
    ({ state, events } = applyPlayerAction(
      state,
      req.seat,
      checkOrCall(req.seat, req.legalActions),
    ));
  }
  const req = [...events].reverse().find((e) => e.type === 'discard-requested');
  if (req?.type !== 'discard-requested') throw new Error('no discard request');

  // Discarding two cards when one is required.
  const player = state.players.find((p) => p.seat === req.seat);
  if (!player) throw new Error('missing');
  const twoIds = player.hole.slice(0, 2).map(cardId);
  expect(() => applyDiscard(state, req.seat, twoIds)).toThrow();
  // Discarding a card not in hand.
  expect(() => applyDiscard(state, req.seat, ['Ah#9'])).toThrow();
});
