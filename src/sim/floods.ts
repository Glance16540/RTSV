// Flood, an act of God on the map (docs/DESIGN.md, "Acts of God": famine, plague, fire and the like; docs/CLOSING.md:
// "No flood").
//
// Where a river runs by a town (townwater.ts reads it off the map's country), the river may rise and go over its banks.
// Like the other acts of God (acts.ts) it comes at random and spares nobody, but by the town's own standing (`wrathAt`):
// a Righteous town has it about a third as often and as hard, a Decadent one more. Rain over the land makes it twice as
// likely; never under dust. A land already struck by another act this season is not flooded as well.
//   - The water spoils a share of the food in store (FLOOD.food, by the standing's measure), and lies on the fields: the
//     town's buildings on its record are found damaged (as fire leaves them, a little) by whoever next fights there.
//   - Struck hard, it carries away the land's farm (its Farmland on the record), to be raised again.
// Nobody drowns: the people take to high ground. The Egyptians' Flood Calendar (ownstudies.ts), which reads the river,
// halves what it takes. Plain data: the river is handed in (campaign.ts asks townwater.ts), so this imports no map.
import type { Campaign } from './campaign';
import { ACTS, wrathAt } from './acts';
import { weatherAt } from './campaignbase';
import { OWN, dykesKept, floodWise } from './ownstudies';
import { folkOf } from './township';

export const FLOOD = {
  /** The chance a season that a river land floods, at an ordinary town's standing. */
  chance: 0.02,
  /** This many times as likely under rain. */
  rain: 2,
  /** The share of the food in store it spoils, at an ordinary town's standing. */
  food: 0.3,
  /** How much the town's buildings on record are worn, as a share of their state. */
  worn: 0.15,
  /** The share of what it takes for a people that keeps the Flood Calendar. */
  wise: 0.5,
};

const RIVERS = new WeakMap<Campaign, Map<number, boolean>>();
/** Does a river run by this land? Read once a campaign through `look` (the map's country does not change), then kept. */
export function riverBy(c: Campaign, tid: number, look: () => boolean): boolean {
  let m = RIVERS.get(c);
  if (!m) RIVERS.set(c, (m = new Map()));
  let v = m.get(tid);
  if (v === undefined) m.set(tid, (v = look()));
  return v;
}

/** What a flood did, for whoever tells of it. */
export interface Flooded { at: number; owner: number; hard: boolean; food: number; farm: boolean }

const draw = (c: Campaign, tid: number, salt: number): number => {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 13, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(tid * 709 + salt + 7, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/** The flood falls on a town: what it spoils and carries away. `w` is the town's standing's measure (wrathAt). */
export function flood(c: Campaign, tid: number, w: number, hard: boolean): Flooded {
  const t = c.territories[tid], dykes = dykesKept(c, tid), k = (floodWise(c, tid) ? FLOOD.wise : 1) * (dykes ? OWN.dykes : 1); // the Flood Calendar, and the Egyptians' dykes (ownstudies.ts)
  const store = folkOf(c, tid).stores, food = Math.floor(store.food * Math.min(0.8, FLOOD.food * w * k));
  store.food -= food;
  if (t.town && !dykes) for (const b of t.town.b) b[3] = Math.max(0.1, Math.round((b[3] ?? 1) * (1 - Math.min(0.6, FLOOD.worn * w * k)) * 100) / 100);
  const farm = hard && !dykes && t.buildings.includes('farm');
  if (farm) t.buildings.splice(t.buildings.indexOf('farm'), 1);
  (c.events ??= []).push({ kind: 'flood', at: tid, turn: c.turn, until: c.turn });
  c.log.push(`The river has risen over its banks at ${t.name}${food ? `: ${food} food spoilt in store` : ''}${farm ? ', and the farmland is washed away' : ''}. Its people took to high ground, and nobody drowned.`);
  return { at: tid, owner: t.owner, hard, food, farm };
}

/**
 * A season of floods: every held land a river runs by (`river`) and no other act struck this season (`struck`) may flood.
 * Returns what flooded.
 */
export function floodSeason(c: Campaign, river: (tid: number) => boolean, struck: ReadonlySet<number> = new Set()): Flooded[] {
  const out: Flooded[] = [];
  if (c.turn < ACTS.from) return out;
  for (const t of c.territories) {
    if (t.owner < 0 || t.horde || !c.factions[t.owner]?.alive || struck.has(t.id) || !river(t.id)) continue;
    const sky = weatherAt(c, t.id);
    if (sky === 'dust') continue;
    const w = wrathAt(c, t.id);
    if (draw(c, t.id, 1) >= FLOOD.chance * w * (sky === 'rain' ? FLOOD.rain : 1)) continue;
    out.push(flood(c, t.id, w, draw(c, t.id, 2) < ACTS.hard * w * w));
  }
  return out;
}
