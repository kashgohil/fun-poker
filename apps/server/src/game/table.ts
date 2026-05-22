import {
  type BetAction,
  type Card,
  type HandState,
  type StepResult,
  type Variant,
  applyDiscard,
  applyPlayerAction,
  cardId,
  createHand,
} from '@fun-poker/engine';

export type TableSeat = { userId: string; stack: number };

export type TableOptions = {
  id: string;
  variant: Variant;
  smallBlind: number;
  bigBlind: number;
  maxSeats: number;
};

// A single poker table: tracks seated players and drives the engine for the
// hand currently in progress.
export class Table {
  readonly id: string;
  readonly variant: Variant;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly maxSeats: number;
  readonly seats = new Map<number, TableSeat>();
  // Seats whose player asked to leave mid-hand — cashed out once it ends.
  readonly pendingLeave = new Set<number>();
  buttonSeat: number | null = null;
  hand: HandState | null = null;
  private handCounter = 0;

  constructor(opts: TableOptions) {
    this.id = opts.id;
    this.variant = opts.variant;
    this.smallBlind = opts.smallBlind;
    this.bigBlind = opts.bigBlind;
    this.maxSeats = opts.maxSeats;
  }

  get minBuyIn(): number {
    return this.bigBlind * 20;
  }

  get maxBuyIn(): number {
    return this.bigBlind * 200;
  }

  seatOf(userId: string): number | undefined {
    for (const [seat, s] of this.seats) {
      if (s.userId === userId) return seat;
    }
    return undefined;
  }

  // Seats a player; returns the assigned seat index.
  seatPlayer(userId: string, buyIn: number, preferred?: number): number {
    if (this.seatOf(userId) !== undefined) {
      throw new Error('player is already seated');
    }
    let seat = preferred;
    if (seat === undefined || this.seats.has(seat)) {
      seat = undefined;
      for (let i = 0; i < this.maxSeats; i++) {
        if (!this.seats.has(i)) {
          seat = i;
          break;
        }
      }
    }
    if (seat === undefined) throw new Error('table is full');
    this.seats.set(seat, { userId, stack: buyIn });
    return seat;
  }

  removePlayer(userId: string): void {
    const seat = this.seatOf(userId);
    if (seat !== undefined) {
      this.seats.delete(seat);
      this.pendingLeave.delete(seat);
    }
  }

  // Seats that hold a player with chips — eligible to be dealt into a hand.
  private eligibleSeats(): number[] {
    return [...this.seats.entries()]
      .filter(([, s]) => s.stack > 0)
      .map(([seat]) => seat)
      .sort((a, b) => a - b);
  }

  canStartHand(): boolean {
    return this.hand === null && this.eligibleSeats().length >= 2;
  }

  private nextButton(eligible: number[]): number {
    if (this.buttonSeat === null) return eligible[0] as number;
    const after = eligible.filter((s) => s > (this.buttonSeat as number));
    return after[0] ?? (eligible[0] as number);
  }

  startHand(seed: number): StepResult {
    const eligible = this.eligibleSeats();
    if (eligible.length < 2) throw new Error('not enough players to start');
    const button = this.nextButton(eligible);
    this.buttonSeat = button;
    this.handCounter += 1;

    const result = createHand({
      variant: this.variant,
      handId: `${this.id}#${this.handCounter}`,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      buttonSeat: button,
      seed,
      players: eligible.map((seat) => ({
        seat,
        userId: (this.seats.get(seat) as TableSeat).userId,
        stack: (this.seats.get(seat) as TableSeat).stack,
      })),
    });
    this.hand = result.state;
    return result;
  }

  applyBet(userId: string, action: BetAction): StepResult {
    if (this.hand === null) throw new Error('no hand in progress');
    const seat = this.seatOf(userId);
    if (seat === undefined) throw new Error('player is not at this table');
    const result = applyPlayerAction(this.hand, seat, action);
    this.hand = result.state;
    return result;
  }

  applyDiscardChoice(userId: string, cards: readonly Card[]): StepResult {
    if (this.hand === null) throw new Error('no hand in progress');
    const seat = this.seatOf(userId);
    if (seat === undefined) throw new Error('player is not at this table');
    const result = applyDiscard(this.hand, seat, cards.map(cardId));
    this.hand = result.state;
    return result;
  }

  // After a hand completes, writes final stacks back to the seats.
  settleHand(): void {
    if (this.hand === null || this.hand.phase !== 'complete') return;
    for (const p of this.hand.players) {
      const seat = this.seats.get(p.seat);
      if (seat) seat.stack = p.stack;
    }
    this.hand = null;
  }
}
