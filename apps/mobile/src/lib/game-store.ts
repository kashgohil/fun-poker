import { create } from 'zustand';
import type {
  Award,
  Card,
  LegalAction,
  Pot,
  Reveal,
  SeatState,
  ServerMessage,
  Street,
} from '@fun-poker/protocol';

// The local view of a table — built up from the server's broadcasts. Every
// field reflects messages received; nothing is invented client-side.
export type GameState = {
  tableId: string | null;
  seats: Record<number, SeatState>;
  handId: string | null;
  buttonSeat: number | null;
  street: Street | null;
  community: Card[];
  pots: Pot[];
  myHole: Card[];
  toActSeat: number | null;
  legalActions: LegalAction[];
  deadlineUnixMs: number | null;
  lastReveals: Reveal[];
  lastAwards: Award[];
  error: string | null;
  connected: boolean;
};

export const initialGameState: GameState = {
  tableId: null,
  seats: {},
  handId: null,
  buttonSeat: null,
  street: null,
  community: [],
  pots: [],
  myHole: [],
  toActSeat: null,
  legalActions: [],
  deadlineUnixMs: null,
  lastReveals: [],
  lastAwards: [],
  error: null,
  connected: false,
};

// Resets all per-hand state on the way into a fresh hand.
function resetHand(): Partial<GameState> {
  return {
    handId: null,
    street: null,
    community: [],
    pots: [],
    myHole: [],
    toActSeat: null,
    legalActions: [],
    deadlineUnixMs: null,
  };
}

function mapSeats(
  seats: Record<number, SeatState>,
  fn: (seat: SeatState) => SeatState,
): Record<number, SeatState> {
  const out: Record<number, SeatState> = {};
  for (const key of Object.keys(seats)) {
    const seat = seats[Number(key)] as SeatState;
    out[seat.seat] = fn(seat);
  }
  return out;
}

// Pure reducer: takes a server message and produces the next game state.
// Exported as a plain function so it can be unit-tested without React.
export function applyServerMessage(
  state: GameState,
  msg: ServerMessage,
): GameState {
  switch (msg.type) {
    case 'table-snapshot': {
      const seats: Record<number, SeatState> = {};
      for (const seat of msg.snapshot.seats) seats[seat.seat] = seat;
      return {
        ...state,
        ...resetHand(),
        tableId: msg.snapshot.tableId,
        seats,
        lastReveals: [],
        lastAwards: [],
      };
    }

    case 'player-joined':
      return {
        ...state,
        seats: { ...state.seats, [msg.seat.seat]: msg.seat },
      };

    case 'player-left': {
      const seats = { ...state.seats };
      delete seats[msg.seat];
      return { ...state, seats };
    }

    case 'hand-started': {
      const active = new Set(msg.activeSeats);
      const seats = mapSeats(state.seats, (seat) => ({
        ...seat,
        hasButton: seat.seat === msg.buttonSeat,
        currentBet: 0,
        status: active.has(seat.seat) ? 'active' : seat.status,
      }));
      return {
        ...state,
        seats,
        handId: msg.handId,
        buttonSeat: msg.buttonSeat,
        street: 'preflop',
        community: [],
        pots: [],
        myHole: [],
        lastReveals: [],
        lastAwards: [],
      };
    }

    case 'blinds-posted': {
      const apply = (
        seats: Record<number, SeatState>,
        info: { seat: number; amount: number },
      ): Record<number, SeatState> => {
        const seat = seats[info.seat];
        if (!seat) return seats;
        return {
          ...seats,
          [info.seat]: {
            ...seat,
            currentBet: seat.currentBet + info.amount,
            stack: Math.max(0, seat.stack - info.amount),
          },
        };
      };
      let seats = apply(state.seats, msg.smallBlind);
      seats = apply(seats, msg.bigBlind);
      return { ...state, seats };
    }

    case 'hole-cards-dealt':
      return { ...state, myHole: msg.cards };

    case 'street-dealt': {
      // A new street starts; per-street bets are now in the pot.
      const seats = mapSeats(state.seats, (s) => ({ ...s, currentBet: 0 }));
      return {
        ...state,
        seats,
        street: msg.street,
        community: [...state.community, ...msg.cards],
      };
    }

    case 'action-request':
      return {
        ...state,
        toActSeat: msg.seat,
        legalActions: msg.legalActions,
        deadlineUnixMs: msg.deadlineUnixMs,
      };

    case 'action-taken': {
      const seat = state.seats[msg.seat];
      if (!seat) return state;
      const paid = Math.max(0, seat.stack - msg.stackAfter);
      const next: SeatState = {
        ...seat,
        stack: msg.stackAfter,
        currentBet:
          msg.action === 'check' || msg.action === 'fold'
            ? seat.currentBet
            : seat.currentBet + paid,
        status:
          msg.action === 'fold'
            ? 'folded'
            : msg.action === 'all-in' || msg.stackAfter === 0
              ? 'all-in'
              : seat.status,
      };
      return {
        ...state,
        seats: { ...state.seats, [msg.seat]: next },
        toActSeat: null,
        legalActions: [],
      };
    }

    case 'pot-update': {
      // The street settled — committed bets moved into the pots.
      const seats = mapSeats(state.seats, (s) => ({ ...s, currentBet: 0 }));
      return { ...state, seats, pots: msg.pots };
    }

    case 'showdown':
      return { ...state, lastReveals: msg.reveals };

    case 'hand-ended': {
      // Apply the post-hand stacks, then clear per-hand state.
      const stackBySeat = new Map(
        msg.finalStacks.map((f) => [f.seat, f.stack]),
      );
      const seats = mapSeats(state.seats, (s) => {
        const finalStack = stackBySeat.get(s.seat);
        return finalStack === undefined
          ? s
          : { ...s, stack: finalStack, currentBet: 0 };
      });
      return {
        ...state,
        seats,
        ...resetHand(),
        lastAwards: msg.awards,
      };
    }

    case 'chat-received':
    case 'pong':
    case 'discard-taken':
    case 'discard-request':
    case 'hand-state':
      // MVP — no UI for these yet.
      return state;

    case 'error':
      return { ...state, error: msg.message };
  }
  // Exhaustiveness check — if a new ServerMessage variant is added, this
  // assignment fails at compile time until the switch handles it.
  const _exhaustive: never = msg;
  return _exhaustive;
}

// The React store wraps the reducer with zustand. Components select slices
// from it; the WebSocket layer calls `apply(msg)` on every server message.
type GameStore = GameState & {
  apply: (msg: ServerMessage) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
};

export const useGame = create<GameStore>((set) => ({
  ...initialGameState,
  apply: (msg) => set((s) => applyServerMessage(s, msg)),
  setConnected: (connected) => set({ connected }),
  reset: () => set({ ...initialGameState }),
}));
