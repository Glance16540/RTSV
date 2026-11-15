// Towns eat their food on the map (docs/DESIGN.md, "Stores").
//
// Each season every held town's people eat from its food store: a grown man or woman EAT.grown, one of the old
// EAT.old, a child EAT.child. Who eats there is who is there: men away with an army are off the town's record
// already (armytown.ts), and those who have drifted from their work (drift.ts: the men at the mines and the women
// at the tavern, as the town's record counts them) eat where they work.
//
// A town that cannot eat in full eats what there is and goes hungry: its granary is empty, which drift.ts reads as
// strain. A town hungry STARVE_AFTER seasons running begins to lose people from the record, STARVE_SHARE of its
// grown a season (one at least), the old first, then men and women in turn. Never a child: children are fed first
// and are records on their houses.
//
// Food does not keep for ever: what a town holds beyond KEEP_SEASONS of its own eating loses ROT of that excess each
// season, so a town is not a granary of years. Never below FOOD_KEEP, the food in a town's working stock (stores.ts):
// a small town can keep that much, or it could never hold its working stock at all.
//
// What fills a larder is the land's harvest (harvest.ts), which is mostly food where there is farmland: a farmed
// town of about twenty is fed by its own fields, a town with none is not, and lives on convoys (convoys.ts) or on
// food a ruler sends by decree (decrees.ts). The local tribes' towns are not counted: nobody keeps their stores.
//
// Decided by a run of chances of its own, so the rest of a campaign's luck is left as it was.
import type { Campaign } from './campaign';
import { folkOf, grown } from './township';

declare module './township' {
  interface Folk {
    /** Seasons running the town has gone hungry (larder.ts). */
    hungry?: number;
    /** Food that spoiled in the town last season (larder.ts). */
    rotted?: number;
  }
}

/** Food a season: a grown man or woman, one of the old, a child. */
export const EAT = { grown: 16, old: 12, child: 8 };
/** Seasons hungry in a row before people begin to die of it, and the share of the grown who die each season after. */
export const STARVE_AFTER = 2;
export const STARVE_SHARE = 0.1;
/** Food keeps: a town's food beyond KEEP_SEASONS of its own eating loses ROT of the excess each season. */
export const KEEP_SEASONS = 2;
export const ROT = 0.2;
/** Food never spoils below this: the food share of a town's working stock (stores.ts KEEP, at a supply's food share). */
export const FOOD_KEEP = 240;

/** What one town did this season: food needed and eaten, how long it has been hungry, and who died of it. */
export interface Meal { at: number; owner: number; need: number; ate: number; hungry: number; dead: number; rotted: number }

const hash = (c: Campaign, a: number, salt: number): number => {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 11, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(a * 271 + salt + 13, 0xc2b2ae35) ^ 0x1b873593;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/** Who eats in a town this season: those on its record, less those who have drifted to the mines or the tavern. */
export function mouths(c: Campaign, tid: number): { men: number; women: number; elders: number; children: number } {
  // Who has drifted is kept on the town's record (drift.ts): they eat where they work.
  const f = folkOf(c, tid), mines = Math.min(f.men, f.drifted?.mines ?? 0), tavern = Math.min(f.women, f.drifted?.tavern ?? 0);
  return { men: f.men - mines, women: f.women - tavern, elders: f.elders, children: f.children };
}
/** The food a town needs this season. */
export function needOf(c: Campaign, tid: number): number {
  const m = mouths(c, tid);
  return (m.men + m.women) * EAT.grown + m.elders * EAT.old + m.children * EAT.child;
}

/** A season of hunger's dead in a town: the old first, then men and women in turn. Never a child. Returns how many. */
function starve(c: Campaign, tid: number): number {
  const f = folkOf(c, tid), now = grown(f);
  let n = Math.min(now, Math.max(1, Math.round(now * STARVE_SHARE))), dead = 0, man = hash(c, tid, 7) < 0.5;
  while (n-- > 0) {
    if (f.elders > 0) f.elders--;
    else if ((man && f.men > 0) || f.women <= 0) { if (f.men <= 0) break; f.men--; man = false; }
    else { f.women--; man = true; }
    dead++;
  }
  return dead; // the ages on the record follow the counts the next time they are read (ageing.ts)
}

/** One town eats for a season. */
export function eatTown(c: Campaign, tid: number): Meal {
  const t = c.territories[tid], f = folkOf(c, tid), need = needOf(c, tid), ate = Math.min(need, Math.max(0, f.stores.food));
  f.stores.food -= ate;
  const short = ate < need;
  f.hungry = short ? (f.hungry ?? 0) + 1 : 0;
  const dead = short && f.hungry > STARVE_AFTER ? starve(c, tid) : 0;
  if (!f.hungry) delete f.hungry;
  // Grain does not keep for ever: what is beyond a couple of seasons' eating spoils, a share a season.
  const rotted = Math.floor(Math.max(0, f.stores.food - Math.max(KEEP_SEASONS * need, FOOD_KEEP)) * ROT);
  f.stores.food -= rotted;
  if (rotted) f.rotted = rotted; else delete f.rotted;
  return { at: tid, owner: t.owner, need, ate, hungry: f.hungry ?? 0, dead, rotted };
}

/**
 * A season of eating in every held town. Called once a turn, after the harvest is in and before births. Returns
 * what each town did; the player's hungry towns and every death of hunger are written in the log.
 */
export function larderSeason(c: Campaign): Meal[] {
  const out: Meal[] = [];
  for (const t of c.territories) {
    if (t.owner < 0 || t.horde || !c.factions[t.owner]?.alive) continue;
    const m = eatTown(c, t.id);
    out.push(m);
    const whose = t.owner === 0 ? 'your people' : `the ${c.factions[t.owner].name}`;
    if (m.dead) {
      c.log.push(`Hunger has killed ${m.dead} of ${whose} at ${t.name}, after ${m.hungry} seasons without enough to eat.`);
      const f = folkOf(c, t.id);
      if (f.men + f.women + f.elders === 0) (c.chronicle ??= []).push({ turn: c.turn, text: `${t.name} starved: the last of its grown people died of hunger, and only its children were left.` });
    } else if (m.hungry === 1 && t.owner === 0) c.log.push(`The granary at ${t.name} is empty: its people go hungry. Send food by road or by decree.`);
  }
  return out;
}
