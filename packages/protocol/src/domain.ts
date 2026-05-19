import * as v from 'valibot';
import {
  CardSchema,
  ChipsSchema,
  HandIdSchema,
  SeatIndexSchema,
  StreetSchema,
  UserIdSchema,
} from './primitives.ts';

export const PlayerStatusSchema = v.picklist([
  'active',     // in the current hand
  'folded',
  'all-in',
  'sitting-out',
  'away',       // disconnected but seat reserved
]);
export type PlayerStatus = v.InferOutput<typeof PlayerStatusSchema>;

export const SeatStateSchema = v.object({
  seat: SeatIndexSchema,
  userId: UserIdSchema,
  displayName: v.string(),
  stack: ChipsSchema,
  status: PlayerStatusSchema,
  currentBet: ChipsSchema, // amount put in pot this street
  hasButton: v.boolean(),
});
export type SeatState = v.InferOutput<typeof SeatStateSchema>;

export const PotSchema = v.object({
  amount: ChipsSchema,
  eligibleSeats: v.array(SeatIndexSchema), // for side pots
});
export type Pot = v.InferOutput<typeof PotSchema>;

export const TableConfigSchema = v.object({
  smallBlind: ChipsSchema,
  bigBlind: ChipsSchema,
  minBuyIn: ChipsSchema,
  maxBuyIn: ChipsSchema,
  maxSeats: v.literal(12),
  actionTimeoutMs: v.pipe(v.number(), v.integer(), v.minValue(10000)),
});
export type TableConfig = v.InferOutput<typeof TableConfigSchema>;

export const HandStateSchema = v.object({
  handId: HandIdSchema,
  street: StreetSchema,
  communityCards: v.array(CardSchema), // 0, 3, 4, or 5 cards
  pots: v.array(PotSchema),
  currentBet: ChipsSchema,        // highest bet on this street
  minRaise: ChipsSchema,          // minimum legal raise increment
  toActSeat: v.nullable(SeatIndexSchema),
  actionDeadlineUnixMs: v.nullable(v.number()),
});
export type HandState = v.InferOutput<typeof HandStateSchema>;

export const TableSnapshotSchema = v.object({
  tableId: v.string(),
  config: TableConfigSchema,
  seats: v.array(SeatStateSchema), // sparse; only occupied seats
  hand: v.nullable(HandStateSchema), // null between hands
  // Hole cards only included for the receiving user; never broadcast.
  yourHoleCards: v.optional(v.array(CardSchema)),
});
export type TableSnapshot = v.InferOutput<typeof TableSnapshotSchema>;

export const ActionKindSchema = v.picklist([
  'fold', 'check', 'call', 'bet', 'raise', 'all-in',
]);
export type ActionKind = v.InferOutput<typeof ActionKindSchema>;

export const LegalActionSchema = v.variant('kind', [
  v.object({ kind: v.literal('fold') }),
  v.object({ kind: v.literal('check') }),
  v.object({ kind: v.literal('call'), amount: ChipsSchema }),
  v.object({
    kind: v.literal('bet'),
    min: ChipsSchema,
    max: ChipsSchema,
  }),
  v.object({
    kind: v.literal('raise'),
    min: ChipsSchema,
    max: ChipsSchema,
  }),
  v.object({ kind: v.literal('all-in'), amount: ChipsSchema }),
]);
export type LegalAction = v.InferOutput<typeof LegalActionSchema>;
