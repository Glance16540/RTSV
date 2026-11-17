// The colour each people wears on the world map and in the panel (docs/PLAYTEST.md, finding 8). Every people has its
// own (CIV_COLOR); where two in one world would wear colours too alike to tell apart, the later one takes the first
// of the spare colours that is clear of every colour already worn. Plain data, no DOM.

/** Colours to give a people whose own is too like one already in the world: each reads on parchment and on the map. */
export const SPARE_COLOURS = [0x1f8a8a, 0xd07a1a, 0x7a3a9a, 0xe8c840, 0xc0507a, 0x3a3a3a, 0x8a2a4a, 0x5a6a2a, 0x2f5fb0, 0x6a4a2a, 0x40c0a0, 0xa0a0a0];

/** How far apart two colours look: 0 for the same, about 765 for black and white ("redmean" weighting of RGB). */
export function colourDistance(a: number, b: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const rm = (ar + br) / 2, dr = ar - br, dg = ag - bg, db = ab - bb;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** Below this two colours are taken for one on the map. */
export const TOO_ALIKE = 130;

/** The colours of the peoples of one world, in their order: each its own, unless that is too like one before it. */
export function distinctColours(own: number[]): number[] {
  const out: number[] = [];
  for (const c of own) {
    const clear = (x: number): boolean => out.every((o) => colourDistance(o, x) >= TOO_ALIKE);
    out.push(clear(c) ? c : SPARE_COLOURS.find(clear) ?? c);
  }
  return out;
}
