// Children born in captivity, on the map (docs/DESIGN.md, "Captivity"; inside a battle this is captivity.ts).
//
// A woman held by a band may bear a child while she is held. What is done to a captive is told only by what
// follows from it: here, a number on the record of the group she is held in. The children are never set on the
// map, never drawn, never named, and nothing harms them.
//
// Whose they are goes by the keeper, as the design has it:
//   - Slavers, pirates, highwaymen and marauders keep their captives apart. A child born there is the mother's and
//     her people's: when she is got back the child comes home with her, onto her town's record at its own age, to
//     grow up there (threats.ts, bringHome). If she is held too long and lost, the child is lost with her.
//   - Raiders take people into themselves. A child born among them is the band's own: it is counted to the band
//     and does not come home.
// (A nation that leads people away holds them the same way, carriedoff.ts: a child born while its mother is so
// held is the taker's from birth, by the same rule as the raiders'.)
//
// One call a season (bandseason.ts). Chances are the bands' own run, so the rest of a campaign's luck is as it was.
import type { Campaign } from './campaign';
import type { Band, BandKind, Held } from './threats';

export const BORN = {
  /** Seasons a woman is held before a child may be born to her. */
  after: 2,
  /** The chance, each season after that, for each woman held who has not borne one there. */
  chance: 0.3,
};
/** The keepers who take people into themselves: a child born among them is theirs. */
export const TAKES_IN: BandKind[] = ['raiders'];

declare module './threats' {
  interface Band { /** Children born to its captives and kept as its own (bandborn.ts): a count, nothing more. */ born?: number }
}

function chance(c: Campaign, salt: number): number {
  let h = (Math.imul(c.seed ^ 0x3c6ef372, 0x9e3779b1) ^ Math.imul(c.turn + 0x165667b1, 0x85ebca6b) ^ Math.imul(salt + 0x27d4eb2f, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** Children born to a held group and still with their mothers: the seasons they were born in. */
export const kidsOf = (h: Held): number[] => h.kids ?? [];
/** Children born in captivity and with their mothers now, over the whole map; and those kept by the bands as their own. */
export const bornHeld = (c: Campaign): { withMothers: number; kept: number } =>
  (c.bands ?? []).reduce((s, b) => ({ withMothers: s.withMothers + b.held.reduce((n, h) => n + kidsOf(h).length, 0), kept: s.kept + (b.born ?? 0) }), { withMothers: 0, kept: 0 });

/** A season of births among those held. Returns how many were born. */
export function bornSeason(c: Campaign): number {
  let born = 0;
  for (const b of c.bands ?? []) {
    b.held.forEach((h: Held, i: number) => {
      if (c.turn - h.since < BORN.after) return;
      const had = h.bore ?? 0;
      for (let w = had; w < h.women.length; w++) {
        if (chance(c, b.id * 131 + h.from * 17 + i * 7 + w) >= BORN.chance) continue;
        h.bore = (h.bore ?? 0) + 1; born++;
        if (TAKES_IN.includes(b.kind)) (b as Band).born = (b.born ?? 0) + 1; // the band's own
        else (h.kids ??= []).push(c.turn); // hers, and her people's
      }
    });
  }
  return born;
}
