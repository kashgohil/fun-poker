import type { HandEvent, HandState } from '@fun-poker/engine';
import type {
  Card,
  LegalAction,
  ServerMessage,
  Street,
} from '@fun-poker/protocol';
import type { Table } from './table';

// A server message plus its routing: 'all' broadcasts to the table, otherwise
// it is a private message for one userId (used for hole cards).
export type Outgoing = { target: 'all' | string; message: ServerMessage };

// Current chips behind a seat — read from the open betting round if there is
// one (where the live values live), otherwise from the hand state.
function stackOf(state: HandState, seat: number): number {
  if (state.betting) {
    const bp = state.betting.players.find((p) => p.seat === seat);
    if (bp) return bp.stack;
  }
  return state.players.find((p) => p.seat === seat)?.stack ?? 0;
}

// Translates engine hand events into protocol server messages.
export function mapEvents(
  events: readonly HandEvent[],
  state: HandState,
  table: Table,
  actionTimeoutMs: number,
): Outgoing[] {
  const out: Outgoing[] = [];

  for (const ev of events) {
    switch (ev.type) {
      case 'hand-started':
        out.push({
          target: 'all',
          message: {
            type: 'hand-started',
            handId: ev.handId,
            buttonSeat: ev.buttonSeat,
            activeSeats: state.players.map((p) => p.seat),
          },
        });
        break;

      case 'blinds-posted':
        out.push({
          target: 'all',
          message: {
            type: 'blinds-posted',
            smallBlind: ev.sb,
            bigBlind: ev.bb,
          },
        });
        break;

      case 'hole-cards-dealt': {
        const userId = table.seats.get(ev.seat)?.userId;
        if (userId) {
          out.push({
            target: userId,
            message: {
              type: 'hole-cards-dealt',
              handId: state.handId,
              cards: ev.cards as Card[],
            },
          });
        }
        break;
      }

      case 'street-dealt':
        out.push({
          target: 'all',
          message: {
            type: 'street-dealt',
            street: ev.street as Street,
            cards: ev.cards as Card[],
          },
        });
        break;

      case 'action-requested':
        out.push({
          target: 'all',
          message: {
            type: 'action-request',
            seat: ev.seat,
            legalActions: ev.legalActions as LegalAction[],
            deadlineUnixMs: Date.now() + actionTimeoutMs,
          },
        });
        break;

      case 'action-taken':
        out.push({
          target: 'all',
          message: {
            type: 'action-taken',
            seat: ev.seat,
            action: ev.action.kind,
            amount: 'to' in ev.action ? ev.action.to : undefined,
            stackAfter: stackOf(state, ev.seat),
          },
        });
        break;

      case 'discard-requested':
        out.push({
          target: 'all',
          message: {
            type: 'discard-request',
            seat: ev.seat,
            count: ev.count,
            deadlineUnixMs: Date.now() + actionTimeoutMs,
          },
        });
        break;

      case 'discard-taken':
        out.push({
          target: 'all',
          message: { type: 'discard-taken', seat: ev.seat, count: ev.count },
        });
        break;

      case 'pot-updated':
        out.push({
          target: 'all',
          message: { type: 'pot-update', pots: ev.pots },
        });
        break;

      case 'showdown':
        out.push({
          target: 'all',
          message: {
            type: 'showdown',
            reveals: ev.reveals.map((r) => ({
              seat: r.seat,
              cards: r.hole as Card[],
              handRank: r.handRank,
            })),
          },
        });
        break;

      case 'hand-ended':
        out.push({
          target: 'all',
          message: {
            type: 'hand-ended',
            handId: ev.handId,
            awards: ev.awards,
            finalStacks: ev.finalStacks,
          },
        });
        break;
    }
  }
  return out;
}
