// The lie of the land on the march (docs/systems-board, "War": going uphill was no slower than going down).
//
// A unit marching up a slope goes slower by the grade, and one going down goes a little quicker. The grade is read
// toward the next point of its path: the rise in the land's height over the ground covered. It is modest: a hard
// climb takes off at most a third, and a run downhill adds at most a tenth. The ground's own cost, which every slope
// carries whichever way it is crossed (game.ts groundCost), still stands; this is what the way across it adds.
// Only on a map with relief: elsewhere the land is flat.

/** How a grade moves a march: a share slower for each unit of rise per tile up, quicker down, and the limits of each. */
export const SLOPE = { up: 0.6, down: 0.25, slowest: 0.67, fastest: 1.1 };

interface Land { relief: boolean; heightAt(x: number, y: number): number }

/** What a march from (x, y) toward (tx, ty) is worth for the slope: below 1 uphill, above it downhill, 1 on the flat. */
export function slopePace(g: Land, x: number, y: number, tx: number, ty: number): number {
  if (!g.relief) return 1;
  const d = Math.hypot(tx - x, ty - y);
  if (d < 1e-3) return 1;
  const grade = (g.heightAt(tx, ty) - g.heightAt(x, y)) / d;
  return grade >= 0 ? Math.max(SLOPE.slowest, 1 / (1 + SLOPE.up * grade)) : Math.min(SLOPE.fastest, 1 + SLOPE.down * -grade);
}
