import {
  type BetAction,
  type StepResult,
  texasHoldem,
  validateAction,
} from '@fun-poker/engine';
import type {
  Card,
  ClientMessage,
  SeatState,
  ServerMessage,
  TableSnapshot,
} from '@fun-poker/protocol';
import { Table } from './table';
import { type Outgoing, mapEvents } from './mapping';

// A transport handle the manager can push messages to.
export interface Connection {
  send(data: string): void;
}

const ACTION_TIMEOUT_MS = 30_000;

// Owns every table and connection, routes client messages, and drives the
// engine — the server-side game loop.
export class GameManager {
  private readonly tables = new Map<string, Table>();
  private readonly connections = new Map<string, Connection>();
  private readonly userTable = new Map<string, string>();

  constructor() {
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
    // MVP: drop the socket only. The seat is kept; reconnection and
    // turn-timeout handling are follow-up work.
    this.connections.delete(userId);
  }

  handle(userId: string, msg: ClientMessage): void {
    switch (msg.type) {
      case 'join-table':
        this.join(userId, msg.tableId, msg.buyIn, msg.seat);
        break;
      case 'leave-table':
        this.leave(userId, msg.tableId);
        break;
      case 'fold':
      case 'check':
      case 'call':
      case 'all-in':
        this.bet(userId, { kind: msg.type });
        break;
      case 'bet':
        this.bet(userId, { kind: 'bet', to: msg.amount });
        break;
      case 'raise':
        this.bet(userId, { kind: 'raise', to: msg.amount });
        break;
      case 'discard':
        this.discard(userId, msg.cards);
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

  // --- message handlers -----------------------------------------------------

  private join(
    userId: string,
    tableId: string,
    buyIn: number,
    seat?: number,
  ): void {
    const table = this.tables.get(tableId);
    if (!table) {
      this.error(userId, 'not-at-table', `no table '${tableId}'`);
      return;
    }
    let assigned: number;
    try {
      assigned = table.seatPlayer(userId, buyIn, seat);
    } catch (err) {
      this.error(userId, 'seat-taken', String(err));
      return;
    }
    this.userTable.set(userId, tableId);

    this.send(userId, { type: 'table-snapshot', snapshot: snapshotOf(table) });
    this.broadcast(table, {
      type: 'player-joined',
      seat: seatStateOf(table, assigned),
    });
    this.maybeStartHand(table);
  }

  private leave(userId: string, tableId: string): void {
    const table = this.tables.get(tableId);
    if (!table) return;
    const seat = table.seatOf(userId);
    table.removePlayer(userId);
    this.userTable.delete(userId);
    if (seat !== undefined) {
      this.broadcast(table, { type: 'player-left', seat, userId });
    }
  }

  private bet(userId: string, action: BetAction): void {
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
      this.dispatch(table, table.applyBet(userId, action));
    } catch (err) {
      this.error(userId, 'illegal-action', String(err));
    }
  }

  private discard(userId: string, cards: readonly Card[]): void {
    const table = this.tableOf(userId);
    if (!table || table.hand === null) {
      this.error(userId, 'not-at-table', 'no hand is in progress');
      return;
    }
    try {
      this.dispatch(table, table.applyDiscardChoice(userId, cards));
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

  private maybeStartHand(table: Table): void {
    if (!table.canStartHand()) return;
    const seed = (Math.random() * 0x7fffffff) | 0;
    this.dispatch(table, table.startHand(seed));
  }

  private dispatch(table: Table, result: StepResult): void {
    for (const out of mapEvents(
      result.events,
      result.state,
      table,
      ACTION_TIMEOUT_MS,
    )) {
      this.route(table, out);
    }
    if (result.state.phase === 'complete') {
      table.settleHand();
      this.maybeStartHand(table); // begin the next hand
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
      minBuyIn: table.bigBlind * 20,
      maxBuyIn: table.bigBlind * 200,
      maxSeats: 12,
      actionTimeoutMs: ACTION_TIMEOUT_MS,
    },
    seats: [...table.seats.keys()].map((seat) => seatStateOf(table, seat)),
    hand: null,
  };
}
