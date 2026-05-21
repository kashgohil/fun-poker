import type { Card } from '../cards/card';
import type { Variant } from '../descriptor/variant';
import type { BetAction, BettingRound, LegalBet } from '../betting/round';
import type { SidePot } from '../betting/pots';

export type SeatStatus = 'active' | 'folded' | 'all-in';

export type HandPlayer = {
  seat: number;
  userId: string;
  startingStack: number; // for chip-conservation checks
  stack: number; // chips behind (authoritative when no betting round is open)
  hole: Card[];
  status: SeatStatus;
  contributed: number; // total swept into the pot this hand
};

export type HandPhase = 'running' | 'complete';

export type Blind = { seat: number; amount: number };

// An in-progress discard stage (e.g. Crazy Pineapple): each listed seat must
// still discard `count` cards from their hand, in order.
export type DiscardPhase = {
  count: number;
  pending: number[];
};

export type HandState = {
  variant: Variant;
  handId: string;
  smallBlind: number;
  bigBlind: number;
  players: HandPlayer[]; // seat order
  buttonIndex: number; // index into players
  deck: Card[]; // remaining undealt cards
  community: Card[];
  stageIndex: number; // position in variant.stages
  street: number; // betting-round counter (0 = preflop)
  pot: number; // chips swept from settled streets
  betting: BettingRound | null; // open betting round, if any
  discarding: DiscardPhase | null; // open discard stage, if any
  blinds: { sb: Blind; bb: Blind };
  phase: HandPhase;
};

export type Award = { seat: number; potIndex: number; amount: number };
export type Reveal = { seat: number; hole: Card[]; handRank: string };

export type HandEvent =
  | { type: 'hand-started'; handId: string; buttonSeat: number }
  | { type: 'blinds-posted'; sb: Blind; bb: Blind }
  | { type: 'hole-cards-dealt'; seat: number; cards: Card[] }
  | { type: 'street-dealt'; street: string; cards: Card[] }
  | { type: 'action-requested'; seat: number; legalActions: LegalBet[] }
  | { type: 'action-taken'; seat: number; action: BetAction }
  | { type: 'discard-requested'; seat: number; count: number }
  | { type: 'discard-taken'; seat: number; count: number }
  | { type: 'pot-updated'; pot: number; pots: SidePot[] }
  | { type: 'showdown'; reveals: Reveal[] }
  | {
      type: 'hand-ended';
      handId: string;
      awards: Award[];
      finalStacks: { seat: number; stack: number }[];
    };

export type StepResult = { state: HandState; events: HandEvent[] };
