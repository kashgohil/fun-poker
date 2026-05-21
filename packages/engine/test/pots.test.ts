import { test, expect } from 'bun:test';
import {
  type Contribution,
  buildPots,
  potsTotal,
} from '../src/betting/pots';

function contrib(
  rows: [seat: number, contributed: number, folded?: boolean][],
): Contribution[] {
  return rows.map(([seat, contributed, folded]) => ({
    seat,
    contributed,
    folded: folded ?? false,
  }));
}

test('an even contribution forms a single pot', () => {
  const pots = buildPots(contrib([[0, 100], [1, 100], [2, 100]]));
  expect(pots).toHaveLength(1);
  expect(pots[0]?.amount).toBe(300);
  expect(pots[0]?.eligibleSeats.sort()).toEqual([0, 1, 2]);
});

test('a short all-in creates a side pot', () => {
  // p2 is all-in for 100; p0 and p1 contest 300 each.
  const pots = buildPots(contrib([[0, 300], [1, 300], [2, 100]]));
  expect(pots).toHaveLength(2);
  expect(pots[0]).toEqual({ amount: 300, eligibleSeats: [0, 1, 2] }); // main
  expect(pots[1]).toEqual({ amount: 400, eligibleSeats: [0, 1] }); // side
  expect(potsTotal(pots)).toBe(700);
});

test('multiple all-ins create a stack of side pots', () => {
  const pots = buildPots(contrib([[0, 100], [1, 200], [2, 300]]));
  expect(pots).toHaveLength(3);
  expect(pots[0]).toEqual({ amount: 300, eligibleSeats: [0, 1, 2] });
  expect(pots[1]).toEqual({ amount: 200, eligibleSeats: [1, 2] });
  expect(pots[2]).toEqual({ amount: 100, eligibleSeats: [2] });
  expect(potsTotal(pots)).toBe(600);
});

test('a folded player funds the pot but cannot win it', () => {
  const pots = buildPots(contrib([[0, 300, true], [1, 300], [2, 300]]));
  expect(pots).toHaveLength(1);
  expect(pots[0]?.amount).toBe(900); // folded chips still counted
  expect(pots[0]?.eligibleSeats.sort()).toEqual([1, 2]);
});

test('layers with identical eligibility are merged', () => {
  // p0 folded after putting in 100; p1 and p2 each contest 200.
  const pots = buildPots(contrib([[0, 100, true], [1, 200], [2, 200]]));
  expect(pots).toHaveLength(1);
  expect(pots[0]).toEqual({ amount: 500, eligibleSeats: [1, 2] });
});

test('chip conservation: pots always total the contributions', () => {
  const rows = contrib([[0, 175], [1, 420], [2, 420, true], [3, 90]]);
  const total = rows.reduce((s, c) => s + c.contributed, 0);
  expect(potsTotal(buildPots(rows))).toBe(total);
});
