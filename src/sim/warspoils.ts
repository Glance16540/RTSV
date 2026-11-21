// What a man wins at war counts to his house's output (docs/DESIGN.md, "A man at war is still of his house": what he
// earns and wins in war counts to the house's output and renown as his work at home did; docs/CLOSING.md).
//
// A house's renown is kept three ways (notableweight.ts): the children it raised, the foes its men felled (warhouse.ts
// creditArmy, `war`), and what it carried in (`made`). Until now war counted only by foes felled. Now, besides:
//   - spoils: a town taken by an army in a battle nobody watched is looted of its stores (township.ts tollFolk); what was
//     taken is the army's spoils, and it is counted to the houses of its men, in the share of their men on its roll;
//   - deeds: a town taken, or an attack thrown back by the army standing in it, is a deed of every man of that army:
//     WAR_SPOILS.deed goods' worth to his house for each.
// Counted as goods carried in (`made`) on the house's record of its men away (`WarHouse.made`) and, where the house is one
// the nation knows, on its mother's record too, so that it raises her house's standing as her own work does. It is
// renown only: the goods are not paid into any store. Houses with no man on the army's roll get nothing.
import type { Campaign, Pending } from './campaign';
import { STORE_KINDS, folkOf } from './township';
import { levelArmies } from './warhouse';

declare module './warhouse' {
  interface WarHouse { /** Goods' worth its men have won at war, in spoils and deeds (warspoils.ts). */ made?: number }
}

export const WAR_SPOILS = {
  /** Goods' worth to his house of a man's share in a town taken, or an attack thrown back. */
  deed: 10,
};

const STORES = new WeakMap<Pending, number>();
const stored = (c: Campaign, tid: number): number => { const s = folkOf(c, tid).stores; return STORE_KINDS.reduce((n, k) => n + Math.max(0, s[k]), 0); };

/** Before a battle is settled: what the town held, so that what was looted from it can be told after. */
export const spoilsBefore = (c: Campaign, p: Pending): void => { if (c.territories[p.to]) STORES.set(p, stored(c, p.to)); };

/** Credit `goods` won at war to the houses of the men of this army, in the share of their men on its roll. Returns the goods credited. */
export function creditSpoils(c: Campaign, armyId: number, goods: number): number {
  const g = Math.max(0, Math.round(goods));
  if (!g) return 0;
  const houses: { tid: number; family: string; h: { made?: number }; men: number }[] = [];
  for (const tid of Object.keys(c.musters?.[armyId]?.men ?? {}).map(Number)) {
    const f = c.territories[tid]?.folk;
    if (!f || !Array.isArray(f.houses)) continue;
    levelArmies(c, tid);
    for (const h of f.houses) { const men = h.away.filter((s) => s.army === armyId).length; if (men) houses.push({ tid, family: h.family, h, men }); }
  }
  const all = houses.reduce((n, x) => n + x.men, 0);
  if (!all) return 0;
  let given = 0;
  for (const x of houses) {
    const share = Math.round((g * x.men) / all);
    if (!share) continue;
    x.h.made = (x.h.made ?? 0) + share;
    const wife = folkOf(c, x.tid).notables.find((n) => n.kind === 'mother' && !n.lost && n.family === x.family);
    if (wife) wife.made = (wife.made ?? 0) + share;
    given += share;
  }
  return given;
}

/** A town has been taken: its taker's army is credited the spoils looted from it and the deed of each of its men. */
export function spoilsTaken(c: Campaign, p: Pending, armyId: number | undefined): number {
  if (armyId === undefined) return 0;
  const before = STORES.get(p);
  STORES.delete(p);
  const looted = before === undefined ? 0 : Math.max(0, before - stored(c, p.to));
  const men = Object.values(c.musters?.[armyId]?.men ?? {}).reduce((n, l) => n + l.length, 0);
  return creditSpoils(c, armyId, looted + WAR_SPOILS.deed * men);
}

/** An attack has been thrown back by the army standing in the town: the deed of each of its men. */
export function spoilsHeld(c: Campaign, p: Pending, armyId: number | undefined): number {
  STORES.delete(p);
  if (armyId === undefined) return 0;
  const men = Object.values(c.musters?.[armyId]?.men ?? {}).reduce((n, l) => n + l.length, 0);
  return creditSpoils(c, armyId, WAR_SPOILS.deed * men);
}
