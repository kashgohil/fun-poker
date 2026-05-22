import {
  type BetAction,
  type StepResult,
  texasHoldem,
  validateAction,
} from '@fun-poker/engine';
import { chipRepo } from '@fun-poker/db';
import type {
  Card,
  ClientMessage,
  SeatState,
  ServerMessage,
  TableSnapshot,
} from '@fun-poker/protocol';
import { Table } from './table';
import type { ChipService } from './chips';
import { type Outgoing, mapEvents } from './mapping';

// A transport handle the manager can push messages to.
export interface Connection {
  send(data: string): void;
}

const ACTION_TIMEOUT_MS = 30_000;

// Owns every table and connection, routes client messages, drives the engine,
// and moves chips between each player's persistent bank and the table.
export class GameManager {
  private readonly tables = new Map<string, Table>();
  private readonly connections = new Map<string, Connection>();
  private readonly userTable = new Map<string, string>();
  private readonly chips: ChipService;

  constructor(chips: ChipService = chipRepo) {
    this.chips = chips;
    this.tables.set(
      'main',
      new Table({
        id: 'main',
        variant: texasHoldem,
        smallBlind: 10,
        bigBlind: 20,
        maxSeats: 12,
      }),
    );
  }

  getTable(id: string): Table | undefined {
    return this.tables.get(id);
  }

  connect(userId: string, connection: Connection): void {
    this.connections.set(userId, connection);
  }

  disconnect(userId: string): void {
    this.connections.delete(userId);
    // Auto cash-out when safe: leave the table now if no hand is running,
    // otherwise the seat is cashed out once the current hand ends.
    void this.requestLeave(userId);
  }

  async handle(userId: string, msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case 'join-table':
        await this.join(userId, msg.tableId, msg.buyIn, msg.seat);
        break;
      case 'leave-table':
        await this.requestLeave(userId);
        break;
      case 'fold':
      case 'check':
      case 'call':
      case 'all-in':
        await this.bet(userId, { kind: msg.type });
        break;
      case 'bet':
        await this.bet(userId, { kind: 'bet', to: msg.amount });
        break;
      case 'raise':
        await this.bet(userId, { kind: 'raise', to: msg.amount });
        break;
      case 'discard':
        await this.discard(userId, msg.cards);
        break;
      case 'chat':
        this.chat(userId, msg.tableId, msg.text);
        break;
      case 'ping':
        this.send(userId, { type: 'pong', ts: msg.ts });
        break;
      case 'sit-out':
      case 'sit-in':
        break; // MVP: not yet supported
    }
  }

  // Returns every table stack to its owner's bank — call on graceful shutdown
  // so a restart never strands chips. Any hand in progress is voided; players
  // get back the stack they had when that hand began.
  async shutdown(): Promise<void> {
    for (const table of this.tables.values()) {
      for (const [, seat] of [...table.seats]) {
        if (seat.stack > 0) {
          try {
            await this.chips.adjust(
              seat.userId,
              seat.stack,
              `shutdown-cashout:${table.id}`,
            );
          } catch {
            // Best effort — nothing more we can do during shutdown.
          }
        }
      }
      table.seats.clear();
      table.pendingLeave.clear();
      table.hand = null;
    }
  }

  // --- message handlers -----------------------------------------------------

  private async join(
    userId: string,
    tableId: string,
    buyIn: number,
    seat?: number,
  ): Promise<void> {
    const table = this.tables.get(tableId);
    if (!table) {
      this.error(userId, 'not-at-table', `no table '${tableId}'`);
      return;
    }
    if (table.seatOf(userId) !== undefined) {
      this.error(userId, 'seat-taken', 'you are already seated here');
      return;
    }
    if (buyIn < table.minBuyIn || buyIn > table.maxBuyIn) {
      this.error(
        userId,
        'illegal-action',
        `buy-in must be between ${table.minBuyIn} and ${table.maxBuyIn}`,
      );
      return;
    }

    await this.chips.ensureWallet(userId);
    const balance = await this.chips.getBalance(userId);
    if (balance < buyIn) {
      this.error(
        userId,
        'insufficient-funds',
        `balance ${balance} is below the buy-in ${buyIn}`,
      );
      return;
    }

    // Seat first (in-memory, reversible), then debit the bank. If the debit
    // fails, undo the seating so the player is never seated for free.
    let assigned: number;
    try {
      assigned = table.seatPlayer(userId, buyIn, seat);
    } catch (err) {
      this.error(userId, 'seat-taken', String(err));
      return;
    }
    try {
      await this.chips.adjust(userId, -buyIn, `buy-in:${tableId}`);
    } catch (err) {
      table.removePlayer(userId);
      this.error(userId, 'insufficient-funds', String(err));
      return;
    }

    this.userTable.set(userId, tableId);
    this.send(userId, { type: 'table-snapshot', snapshot: snapshotOf(table) });
    this.broadcast(table, {
      type: 'player-joined',
      seat: seatStateOf(table, assigned),
    });
    await this.maybeStartHand(table);
  }

  // Leaves the table, returning the player's stack to their bank. If they are
  // in the current hand, the cash-out is deferred until the hand ends.
  private async requestLeave(userId: string): Promise<void> {
    const table = this.tableOf(userId);
    if (!table) return;
    const seat = table.seatOf(userId);
    if (seat === undefined) return;

    const inHand =
      table.hand !== null &&
      table.hand.players.some((p) => p.seat === seat);
    if (inHand) {
      table.pendingLeave.add(seat);
      return;
    }
    await this.cashOutAndRemove(table, seat, userId);
  }

  private async cashOutAndRemove(
    table: Table,
    seat: number,
    userId: string,
  ): Promise<void> {
    const stack = table.seats.get(seat)?.stack ?? 0;
    table.removePlayer(userId);
    this.userTable.delete(userId);
    this.broadcast(table, { type: 'player-left', seat, userId });
    if (stack > 0) {
      try {
        await this.chips.adjust(userId, stack, `cash-out:${table.id}`);
      } catch {
        // A deposit cannot fail the balance check; ignore transient errors.
      }
    }
  }

  private async bet(userId: string, action: BetAction): Promise<void> {
    const table = this.tableOf(userId);
    if (!table || table.hand === null) {
      this.error(userId, 'not-at-table', 'no hand is in progress');
      return;
    }
    const seat = table.seatOf(userId);
    if (seat === undefined) {
      this.error(userId, 'not-at-table', 'you are not seated here');
      return;
    }
    const invalid = validateAction(table.hand, seat, action);
    if (invalid) {
      this.error(userId, 'illegal-action', invalid);
      return;
    }
    try {
      await this.dispatch(table, table.applyBet(userId, action));
    } catch (err) {
      this.error(userId, 'illegal-action', String(err));
    }
  }

  private async discard(
    userId: string,
    cards: readonly Card[],
  ): Promise<void> {
    const table = this.tableOf(userId);
    if (!table || table.hand === null) {
      this.error(userId, 'not-at-table', 'no hand is in progress');
      return;
    }
    try {
      await this.dispatch(table, table.applyDiscardChoice(userId, cards));
    } catch (err) {
      this.error(userId, 'illegal-action', String(err));
    }
  }

  private chat(userId: string, tableId: string, text: string): void {
    const table = this.tables.get(tableId);
    if (!table) return;
    this.broadcast(table, {
      type: 'chat-received',
      fromUserId: userId,
      fromDisplayName: userId,
      text,
      ts: Date.now(),
    });
  }

  // --- engine driving -------------------------------------------------------

  private async maybeStartHand(table: Table): Promise<void> {
    if (!table.canStartHand()) return;
    const seed = (Math.random() * 0x7fffffff) | 0;
    await this.dispatch(table, table.startHand(seed));
  }

  private async dispatch(table: Table, result: StepResult): Promise<void> {
    for (const out of mapEvents(
      result.events,
      result.state,
      table,
      ACTION_TIMEOUT_MS,
    )) {
      this.route(table, out);
    }
    if (result.state.phase === 'complete') {
      table.settleHand(); // syncs final stacks back onto the seats
      await this.processPendingLeaves(table);
      await this.maybeStartHand(table); // begin the next hand
    }
  }

  // Cashes out any seat whose player asked to leave during the hand.
  private async processPendingLeaves(table: Table): Promise<void> {
    for (const seat of [...table.pendingLeave]) {
      const userId = table.seats.get(seat)?.userId;
      if (userId) await this.cashOutAndRemove(table, seat, userId);
      else table.pendingLeave.delete(seat);
    }
  }

  // --- transport ------------------------------------------------------------

  private tableOf(userId: string): Table | undefined {
    const id = this.userTable.get(userId);
    return id ? this.tables.get(id) : undefined;
  }

  private route(table: Table, out: Outgoing): void {
    if (out.target === 'all') this.broadcast(table, out.message);
    else this.send(out.target, out.message);
  }

  private broadcast(table: Table, message: ServerMessage): void {
    for (const [, seat] of table.seats) this.send(seat.userId, message);
  }

  private send(userId: string, message: ServerMessage): void {
    this.connections.get(userId)?.send(JSON.stringify(message));
  }

  private error(
    userId: string,
    code: Extract<ServerMessage, { type: 'error' }>['code'],
    message: string,
  ): void {
    this.send(userId, { type: 'error', code, message });
  }
}

// --- snapshot builders ------------------------------------------------------

function seatStateOf(table: Table, seat: number): SeatState {
  const s = table.seats.get(seat);
  return {
    seat,
    userId: s?.userId ?? '',
    displayName: s?.userId ?? '',
    stack: s?.stack ?? 0,
    status: 'active',
    currentBet: 0,
    hasButton: table.buttonSeat === seat,
  };
}

function snapshotOf(table: Table): TableSnapshot {
  return {
    tableId: table.id,
    config: {
      smallBlind: table.smallBlind,
      bigBlind: table.bigBlind,
      minBuyIn: table.minBuyIn,
      maxBuyIn: table.maxBuyIn,
      maxSeats: 12,
      actionTimeoutMs: ACTION_TIMEOUT_MS,
    },
    seats: [...table.seats.keys()].map((seat) => seatStateOf(table, seat)),
    hand: null,
  };
}
