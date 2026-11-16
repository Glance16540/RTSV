/**
 * Faith is a town's (docs/DESIGN.md). Each town stands at its own place between piety and decadence
 * (`Territory.virtue`, -100 to 100, the scale a town has in battle), and towns of one nation may stand apart.
 * A nation's standing is its towns' taken together: `Faction.virtue` is kept as the mean of them, so everything
 * that reads a nation's standing goes on working and is now reading its towns.
 *
 * The nation's standing is the mean of its towns', by the owner's word ("use the average"). On a scale that ends
 * at 100 a total would make ten mildly pious towns a Righteous nation, and a nation would change creed by taking land.
 *
 * Every season each town is also drawn some way toward its nation's standing (`PULL`).
 *
 * What moves a town: its own Church or Tavern and a holy place on its land, each season; how it was ruled in a
 * battle or visit fought there in person; a raid it held off or was broken by. What moves every town of a nation
 * at once: a tale answered, a comet. A town taken keeps its own standing under its new holder.
 */
import type { Campaign } from './campaign';
import { placeAt } from './campaign';
import { CHURCH_VIRTUE, TAVERN_VIRTUE } from './campaignbase';
import { PLACES } from './story';

const clamp = (v: number): number => Math.max(-100, Math.min(100, Math.round(v)));
const owned = (c: Campaign, f: number) => c.territories.filter((t) => t.owner === f);

/** Where a town stands. One that has never been asked after stands where its nation does; a tribe's town in the middle. */
export const faithAt = (c: Campaign, tid: number): number => {
  const t = c.territories[tid];
  return !t ? 0 : t.virtue ?? (t.owner >= 0 ? c.factions[t.owner]?.virtue ?? 0 : 0);
};
/** A nation's standing: the mean of its towns'. A nation with no town left keeps the standing it had. */
export function nationVirtue(c: Campaign, f: number): number {
  const mine = owned(c, f);
  return mine.length ? clamp(mine.reduce((n, t) => n + faithAt(c, t.id), 0) / mine.length) : c.factions[f]?.virtue ?? 0;
}
/**
 * Write every town's standing down where it has not been (so that a town changing hands keeps its own), and set
 * each nation's standing from its towns. Safe to call at any time, any number of times.
 * Anything that still sets a nation's figure directly is honoured: where `Faction.virtue` is not what this module
 * last left there (`Faction.faith`), every town of that nation is moved by the difference first.
 */
export function settleFaith(c: Campaign): void {
  for (const t of c.territories) if (t.virtue === undefined) t.virtue = clamp(t.owner >= 0 ? c.factions[t.owner]?.faith ?? c.factions[t.owner]?.virtue ?? 0 : 0);
  for (const x of c.factions) {
    const mine = owned(c, x.id);
    if (!mine.length) continue;
    const set = x.virtue ?? 0;
    if (x.faith !== undefined && set !== x.faith) for (const t of mine) t.virtue = clamp((t.virtue ?? 0) + set - x.faith);
    x.virtue = x.faith = nationVirtue(c, x.id);
  }
}
const synced = (c: Campaign, f: number): void => { const x = c.factions[f]; if (x && owned(c, f).length) x.virtue = x.faith = nationVirtue(c, f); };
/** Move one town along the scale. Returns where it now stands. */
export function swayTown(c: Campaign, tid: number, by: number): number {
  settleFaith(c);
  const t = c.territories[tid];
  if (!t || !Number.isFinite(by)) return faithAt(c, tid);
  t.virtue = clamp((t.virtue ?? 0) + by);
  if (t.owner >= 0) synced(c, t.owner);
  return t.virtue;
}
/** Move every town of a nation by the same step: something that befell the whole people. */
export function swayNation(c: Campaign, f: number, by: number): void {
  settleFaith(c);
  if (!Number.isFinite(by)) return;
  const mine = owned(c, f);
  for (const t of mine) t.virtue = clamp((t.virtue ?? 0) + by);
  if (mine.length) synced(c, f);
  else if (c.factions[f]) c.factions[f].virtue = clamp((c.factions[f].virtue ?? 0) + by);
}
/** What moves a town in a season of its own accord: its Church, its Tavern, and a holy place on its land. */
export function townDrift(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0) return 0;
  const place = placeAt(c, tid);
  return (t.buildings.includes('church') ? CHURCH_VIRTUE : 0) - (t.buildings.includes('tavern') ? TAVERN_VIRTUE : 0) + (place ? PLACES[place.kind].virtue ?? 0 : 0);
}
/** A season of faith: every held town moves by its own drift. `shift` does the moving, so the map can say when a nation's creed turns. */
export function seasonOfFaith(c: Campaign, shift: (f: number, by: number, at: number) => void): void {
  settleFaith(c);
  for (const t of c.territories) { const by = t.owner >= 0 && c.factions[t.owner].alive ? townDrift(c, t.id) : 0; if (by) shift(t.owner, by, t.id); }
  pullTogether(c);
}
/**
 * The pull: every season each town is drawn `PULL` of the way toward where its nation stands, so a Church or a
 * Tavern can hold a town apart only so far (where what it adds each season equals what the pull takes back:
 * a Tavern's 3 a season against a pull of 0.10 leaves it about 25 to 30 from the nation's standing, a Church's 2 about 20). All towns move from where they stood as
 * the season began, so the nation's own standing is not moved by it, beyond a point of rounding.
 */
export const PULL = 0.10;
export function pullTogether(c: Campaign): void {
  settleFaith(c);
  for (const x of c.factions) {
    const mine = owned(c, x.id);
    if (mine.length < 2) continue;
    const mean = mine.reduce((n, t) => n + (t.virtue ?? 0), 0) / mine.length;
    for (const t of mine) t.virtue = clamp((t.virtue ?? 0) + Math.round((mean - (t.virtue ?? 0)) * PULL));
    synced(c, x.id);
  }
}
/** How far the towns of one nation stand apart: the lowest, the highest, and the gap between them. */
export function faithSpread(c: Campaign, f: number): { low: number; high: number; spread: number; towns: number } {
  const all = owned(c, f).map((t) => faithAt(c, t.id));
  if (!all.length) return { low: 0, high: 0, spread: 0, towns: 0 };
  const low = Math.min(...all), high = Math.max(...all);
  return { low, high, spread: high - low, towns: all.length };
}
