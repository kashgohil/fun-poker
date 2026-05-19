import * as v from 'valibot';

export const SuitSchema = v.picklist(['s', 'h', 'd', 'c']);
export type Suit = v.InferOutput<typeof SuitSchema>;

export const RankSchema = v.picklist([
  '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A',
]);
export type Rank = v.InferOutput<typeof RankSchema>;

export const CardSchema = v.object({
  rank: RankSchema,
  suit: SuitSchema,
});
export type Card = v.InferOutput<typeof CardSchema>;

export const ChipsSchema = v.pipe(v.number(), v.integer(), v.minValue(0));
export type Chips = v.InferOutput<typeof ChipsSchema>;

export const SeatIndexSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(8),
);
export type SeatIndex = v.InferOutput<typeof SeatIndexSchema>;

export const TableIdSchema = v.pipe(v.string(), v.minLength(1));
export type TableId = v.InferOutput<typeof TableIdSchema>;

export const UserIdSchema = v.pipe(v.string(), v.minLength(1));
export type UserId = v.InferOutput<typeof UserIdSchema>;

export const HandIdSchema = v.pipe(v.string(), v.minLength(1));
export type HandId = v.InferOutput<typeof HandIdSchema>;

export const StreetSchema = v.picklist([
  'preflop', 'flop', 'turn', 'river', 'showdown',
]);
export type Street = v.InferOutput<typeof StreetSchema>;
