// A known person carried off by a nation is marked by name (docs/DESIGN.md, "Notable people": their loss carries weight;
// docs/CLOSING.md: "A notable carried off by a nation is not marked as carried off").
//
// A worldly or decadent nation that takes a town leads away a share of its grown women and men by count (carriedoff.ts
// townFell). Some of the town's people are known by name: a mother of a notable home, a veteran come home. So for each
// one led away, the lot asks whether it was a known person of that sex at home, as likely as the known are among the
// town's grown of that sex; if so the one known most lately is taken (the youngest are led away first, as the counts
// are), and she is marked carried off by name: on the town's record (`lost`, so the town mourns her, notableweight.ts)
// and among the names of those held (`Held.names`), so that if they are got back she is known again and her loss is
// lifted (threats.ts bringHome). The counts are as they were: a known person was one of those counted. A veteran away
// with an army is not at home to be taken. No child is ever taken.
import type { Campaign } from './campaign';
import type { Carried } from './carriedoff';
import type { Notable } from './township';
import { folkOf } from './township';
import { knownAtHome } from './plaguenamed';

const draw = (c: Campaign, id: number, salt: number): number => {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 11, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(id * 613 + salt + 5, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/**
 * A town's people have just been led away (`x`, its counts already struck from the town): those of them who were known by
 * name are marked carried off and listed with the held. `by` names the taker, for the words. Returns them.
 */
export function carriedNamed(c: Campaign, x: Carried, by: string): Notable[] {
  const tid = x.held.from, f = folkOf(c, tid), out: Notable[] = [];
  for (const [sex, taken, left] of [['f', x.held.women.length, f.women], ['m', x.held.men.length, f.men]] as const) {
    const known = knownAtHome(c, tid).filter((n) => n.gender === sex).reverse(); // the one known most lately first
    let pool = left + taken;
    for (let i = 0; i < taken && known.length && pool > 0; i++, pool--) {
      if (draw(c, x.id, i * 2 + (sex === 'f' ? 0 : 1)) >= known.length / pool) continue;
      const n = known.shift()!;
      n.lost = { turn: c.turn, how: `carried off by ${by}` };
      (x.held.names ??= []).push(n.name);
      out.push(n);
    }
  }
  if (out.length && x.held.owner === 0) {
    const t = c.territories[tid];
    for (const n of out) {
      c.log.push(`${n.name} of ${t.name}, who ${n.deed}, was among those led away by ${by}.`);
      (c.chronicle ??= []).push({ turn: c.turn, text: `${n.name} of ${t.name}, who ${n.deed}, was carried off by ${by} when the town fell.` });
    }
  }
  return out;
}
