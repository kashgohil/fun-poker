import * as v from 'valibot';
import {
  CardSchema,
  ChipsSchema,
  HandIdSchema,
  SeatIndexSchema,
  StreetSchema,
  UserIdSchema,
} from './primitives';
import {
  ActionKindSchema,
  HandStateSchema,
  LegalActionSchema,
  PotSchema,
  SeatStateSchema,
  TableSnapshotSchema,
} from './domain';

// Server -> Client messages.

export const TableSnapshotMsgSchema = v.object({
  type: v.literal('table-snapshot'),
  snapshot: TableSnapshotSchema,
});

export const PlayerJoinedSchema = v.object({
  type: v.literal('player-joined'),
  seat: SeatStateSchema,
});

export const PlayerLeftSchema = v.object({
  type: v.literal('player-left'),
  seat: SeatIndexSchema,
  userId: UserIdSchema,
});

export const HandStartedSchema = v.object({
  type: v.literal('hand-started'),
  handId: HandIdSchema,
  buttonSeat: SeatIndexSchema,
  activeSeats: v.array(SeatIndexSchema),
});

// Sent only to the seat receiving the cards.
export const HoleCardsDealtSchema = v.object({
  type: v.literal('hole-cards-dealt'),
  handId: HandIdSchema,
  cards: v.array(CardSchema),
});

export const BlindsPostedSchema = v.object({
  type: v.literal('blinds-posted'),
  smallBlind: v.object({ seat: SeatIndexSchema, amount: ChipsSchema }),
  bigBlind: v.object({ seat: SeatIndexSchema, amount: ChipsSchema }),
});

export const StreetDealtSchema = v.object({
  type: v.literal('street-dealt'),
  street: StreetSchema,
  cards: v.array(CardSchema), // flop=3, turn/river=1
});

export const ActionRequestSchema = v.object({
  type: v.literal('action-request'),
  seat: SeatIndexSchema,
  legalActions: v.array(LegalActionSchema),
  deadlineUnixMs: v.number(),
});

export const ActionTakenSchema = v.object({
  type: v.literal('action-taken'),
  seat: SeatIndexSchema,
  action: ActionKindSchema,
  amount: v.optional(ChipsSchema),
  stackAfter: ChipsSchema,
});

export const DiscardRequestSchema = v.object({
  type: v.literal('discard-request'),
  seat: SeatIndexSchema,
  count: v.pipe(v.number(), v.integer(), v.minValue(1)),
  deadlineUnixMs: v.number(),
});

export const DiscardTakenSchema = v.object({
  type: v.literal('discard-taken'),
  seat: SeatIndexSchema,
  count: v.pipe(v.number(), v.integer()),
});

export const PotUpdateSchema = v.object({
  type: v.literal('pot-update'),
  pots: v.array(PotSchema),
});

export const RevealSchema = v.object({
  seat: SeatIndexSchema,
  cards: v.array(CardSchema),
  handRank: v.string(), // e.g. "Full House, Kings full of Twos"
});
export type Reveal = v.InferOutput<typeof RevealSchema>;

export const AwardSchema = v.object({
  seat: SeatIndexSchema,
  amount: ChipsSchema,
  potIndex: v.number(),
});
export type Award = v.InferOutput<typeof AwardSchema>;

export const ShowdownSchema = v.object({
  type: v.literal('showdown'),
  reveals: v.array(RevealSchema),
});

// Awards live on hand-ended so they reach the client in every case —
// including fold-to-one, where no `showdown` is emitted.
export const HandEndedSchema = v.object({
  type: v.literal('hand-ended'),
  handId: HandIdSchema,
  awards: v.array(AwardSchema),
  // Stacks after the hand settled — so clients can show winnings.
  finalStacks: v.array(
    v.object({ seat: SeatIndexSchema, stack: ChipsSchema }),
  ),
});

export const HandStateUpdateSchema = v.object({
  type: v.literal('hand-state'),
  hand: HandStateSchema,
});

export const ChatReceivedSchema = v.object({
  type: v.literal('chat-received'),
  fromUserId: UserIdSchema,
  fromDisplayName: v.string(),
  text: v.string(),
  ts: v.number(),
});

export const PongSchema = v.object({
  type: v.literal('pong'),
  ts: v.number(),
});

export const ErrorMsgSchema = v.object({
  type: v.literal('error'),
  code: v.picklist([
    'invalid-message',
    'not-authenticated',
    'not-at-table',
    'seat-taken',
    'insufficient-funds',
    'not-your-turn',
    'illegal-action',
    'internal',
  ]),
  message: v.string(),
});

export const ServerMessageSchema = v.variant('type', [
  TableSnapshotMsgSchema,
  PlayerJoinedSchema,
  PlayerLeftSchema,
  HandStartedSchema,
  HoleCardsDealtSchema,
  BlindsPostedSchema,
  StreetDealtSchema,
  ActionRequestSchema,
  ActionTakenSchema,
  DiscardRequestSchema,
  DiscardTakenSchema,
  PotUpdateSchema,
  ShowdownSchema,
  HandEndedSchema,
  HandStateUpdateSchema,
  ChatReceivedSchema,
  PongSchema,
  ErrorMsgSchema,
]);
export type ServerMessage = v.InferOutput<typeof ServerMessageSchema>;
