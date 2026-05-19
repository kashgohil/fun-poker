import * as v from 'valibot';
import {
  ChipsSchema,
  SeatIndexSchema,
  TableIdSchema,
} from './primitives';

// Client -> Server messages.
// All discriminated by `type`. Server validates with valibot before acting.

export const JoinTableSchema = v.object({
  type: v.literal('join-table'),
  tableId: TableIdSchema,
  seat: v.optional(SeatIndexSchema),
  buyIn: ChipsSchema,
});

export const LeaveTableSchema = v.object({
  type: v.literal('leave-table'),
  tableId: TableIdSchema,
});

export const SitOutSchema = v.object({
  type: v.literal('sit-out'),
  tableId: TableIdSchema,
});

export const SitInSchema = v.object({
  type: v.literal('sit-in'),
  tableId: TableIdSchema,
});

export const FoldSchema = v.object({ type: v.literal('fold') });
export const CheckSchema = v.object({ type: v.literal('check') });
export const CallSchema = v.object({ type: v.literal('call') });
export const BetSchema = v.object({
  type: v.literal('bet'),
  amount: ChipsSchema,
});
export const RaiseSchema = v.object({
  type: v.literal('raise'),
  amount: ChipsSchema, // total bet (not increment)
});
export const AllInSchema = v.object({ type: v.literal('all-in') });

export const ChatSchema = v.object({
  type: v.literal('chat'),
  tableId: TableIdSchema,
  text: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
});

export const PingSchema = v.object({
  type: v.literal('ping'),
  ts: v.number(),
});

export const ClientMessageSchema = v.variant('type', [
  JoinTableSchema,
  LeaveTableSchema,
  SitOutSchema,
  SitInSchema,
  FoldSchema,
  CheckSchema,
  CallSchema,
  BetSchema,
  RaiseSchema,
  AllInSchema,
  ChatSchema,
  PingSchema,
]);
export type ClientMessage = v.InferOutput<typeof ClientMessageSchema>;
