import { test, expect } from 'bun:test';
import { seatPositions } from '../src/layout';
import { chipBreakdown } from '../src/cards';

test('seatPositions returns one position per seat', () => {
  expect(seatPositions(6).length).toBe(6);
  expect(seatPositions(2).length).toBe(2);
  expect(seatPositions(9).length).toBe(9);
});

test('seat 0 is the hero at bottom-centre', () => {
  const [hero] = seatPositions(6);
  expect(hero?.x).toBeCloseTo(0.5, 5);
  expect(hero?.y).toBeGreaterThan(0.5); // lower half of the table
  expect(hero?.angle).toBe(90);
});

test('every seat lands inside the container', () => {
  for (const seat of seatPositions(9, 0.5)) {
    expect(seat.x).toBeGreaterThanOrEqual(0);
    expect(seat.x).toBeLessThanOrEqual(1);
    expect(seat.y).toBeGreaterThanOrEqual(0);
    expect(seat.y).toBeLessThanOrEqual(1);
  }
});

test('seat count is clamped to a sane range', () => {
  expect(seatPositions(1).length).toBe(2);
  expect(seatPositions(99).length).toBe(12);
});

test('chipBreakdown splits an amount into denomination stacks', () => {
  expect(chipBreakdown(1675)).toEqual([
    { denom: 1000, count: 1 },
    { denom: 500, count: 1 },
    { denom: 100, count: 1 },
    { denom: 25, count: 3 },
  ]);
  expect(chipBreakdown(0)).toEqual([]);
});
