// The dead of plague on the map, by name where they are known (docs/DESIGN.md, "People persist" and "Notable people":
// the board's line "On the map plague kills by count, not by name: a notable woman of the town is never among its dead").
//
// Plague takes a share of a town's grown people a season (acts.ts `sicken`), the old first, then men and women in turn,
// by count. Each of those it takes is one of the town's people, and some of its people are known by name: a mother of a
// notable home, a veteran come home. So for each one dead, the lot asks whether it was a known person, as likely as the
// known are among the town's grown people at home; if so the one known longest is taken (old first, as the counts are),
// and is marked lost to plague. The town then mourns them and the nation weighs the loss (notableweight.ts), and its
// home grieves (mapgrief.ts). The counts are as they were: a known person was one of those counted.
// A veteran away with an army is not at home to sicken. Never a child: only the grown are known by name here.
import type { Campaign } from './campaign';
import type { Notable } from './township';
import { folkOf } from './township';

/** Who plague took: the words its lost are marked with. */
export const PLAGUE_HOW = 'died of plague';

const chronicle = (c: Campaign, line: string): void => { (c.chronicle ??= []).push({ turn: c.turn, text: line }); };
const draw = (c: Campaign, tid: number, salt: number): number => {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 7, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(tid * 977 + salt + 3, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/** The known people of a town at home and living, the one known longest first. */
export function knownAtHome(c: Campaign, tid: number): Notable[] {
  const f = folkOf(c, tid);
  const away = new Set((Array.isArray(f.houses) ? f.houses : []).flatMap((h) => (Array.isArray(h?.away) ? h.away : []).flatMap((s) => [s?.name, `${s?.name} ${h.family}`])));
  return f.notables.filter((n) => !n.lost && (n.kind === 'mother' || !away.has(n.name))).sort((a, b) => a.turn - b.turn);
}

/**
 * Plague has taken `dead` of a town's grown people this season, of `grown` it had: those of them who were known by name
 * are marked lost to it, told and set down in the chronicle. Returns them.
 */
export function plagueTakes(c: Campaign, tid: number, dead: number, grown: number): Notable[] {
  const known = knownAtHome(c, tid), out: Notable[] = [], t = c.territories[tid];
  let left = Math.max(0, grown);
  for (let i = 0; i < dead && known.length && left > 0; i++, left--) {
    if (draw(c, tid, i) >= known.length / left) continue;
    const n = known.shift()!;
    n.lost = { turn: c.turn, how: PLAGUE_HOW };
    out.push(n);
  }
  for (const n of out) {
    c.log.push(`${n.name} of ${t.name}, who ${n.deed}, has ${PLAGUE_HOW}.`);
    chronicle(c, `${n.name} of ${t.name}, who ${n.deed}, ${PLAGUE_HOW}.`);
  }
  return out;
}
