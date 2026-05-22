// Seat layout math, shared so the table arrangement follows the same logic
// on web and mobile even though their aspect ratios differ.

export type SeatPosition = {
  x: number; // 0..1, fraction of the container width
  y: number; // 0..1, fraction of the container height
  angle: number; // degrees; 90 = bottom-centre, increasing clockwise
};

// Distributes `count` seats evenly around an ellipse. Seat 0 is the hero at
// bottom-centre; the rest follow clockwise. `aspect` (width / height) tilts
// the ellipse so seats hug the table edge in both portrait and landscape.
export function seatPositions(count: number, aspect = 1): SeatPosition[] {
  const n = Math.max(2, Math.min(Math.floor(count), 12));
  const rx = aspect >= 1 ? 0.44 : 0.4;
  const ry = aspect >= 1 ? 0.36 : 0.42;

  const positions: SeatPosition[] = [];
  for (let i = 0; i < n; i++) {
    const angle = 90 + (i * 360) / n; // seat 0 sits at the bottom
    const rad = (angle * Math.PI) / 180;
    positions.push({
      x: 0.5 + rx * Math.cos(rad),
      y: 0.5 + ry * Math.sin(rad),
      angle: angle % 360,
    });
  }
  return positions;
}
