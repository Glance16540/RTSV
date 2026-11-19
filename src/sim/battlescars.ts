// What a battle settled on the map leaves on a town, and the works left half-built (docs/systems-board, "Campaign":
// a battle nobody watched wore no ground, and a work left half-built when a battle or a visit ended stood so for ever).
//
// A town fought for on the map, with nobody watching, carries the marks into the next battle or visit there:
//   - its walls, gates and towers are beaten down by the share of the town's defence the fight took (Outcome works);
//   - a share of its houses is scorched: more where the town was taken, fewer where it held, and fewer the shorter
//     the fight. Which houses, and how badly, is drawn by the seed.
// A battle fought in person writes back its own damage (township.ts); this is only for one settled on the map. The
// marks are mended as every town's are, a tenth of a building a season (campaign.ts mendTowns), by whoever holds it.
//
// A work left half-built (a Standing with `built`) is finished on the map by the town's governor, a quarter of it
// a season, out of the town's own stores at the work's own price: wood, stone, gold, food. A town that has not the
// stores for the next quarter leaves it standing as it is, and the land panel says so (`unfinishedWords`).
import type { Campaign, Pending, Territory } from './campaign';
import type { Outcome } from './mapbattle';
import type { Standing } from './game';
import { BUILDINGS } from './data';
import { folkOf } from './township';
import { chance } from './intriguebase';

export const SCARS = {
  /** The share of a town's houses scorched when it is taken, and when it holds (times how long the fight went, up to three rounds). */
  taken: 0.4, held: 0.15,
  /** How much of a scorched house is left standing, at the worst and at the least. */
  worst: 0.3, least: 0.7,
  /** The least a work beaten down is left at. */
  floor: 0.1,
  /** The share of a half-built work its governor finishes in a season, when the stores allow. */
  step: 0.25,
};

const isWork = (type: string): boolean => type === 'tower' || type === 'fortress' || type === 'gate' || !!BUILDINGS[type]?.wall;
const round2 = (k: number): number => Math.round(k * 100) / 100;

/** The town on this land that a battle can mark: one laid where things stand, not one for counting only. */
const townOf = (t: Territory | undefined) => (t?.town && !t.town.coarse ? t.town : undefined);

/**
 * Mark a town with a battle settled on the map. Returns how many of its buildings were marked.
 * Called once the battle is settled, after the town has changed hands if it did (the taker's walls are already down).
 */
export function scarTown(c: Campaign, p: Pending, out: Outcome): number {
  const t = c.territories[p.to], town = townOf(t);
  if (!town) return 0;
  let marked = 0;
  const hit = (b: Standing, left: number): void => {
    const now = b[3] ?? 1, to = round2(Math.max(SCARS.floor, Math.min(now, left)));
    if (to < now) { b[3] = to; marked++; }
  };
  // The works are beaten down by the share the fight took.
  const works = Math.max(0, Math.min(1, out.d.works ?? 0));
  if (works > 0) for (const b of town.b) if (b[4] === undefined && isWork(b[0])) hit(b, (b[3] ?? 1) * (1 - works));
  // A share of the houses is scorched.
  const houses = town.b.filter((b) => b[0] === 'house' && b[4] === undefined);
  const share = out.attackerWon ? SCARS.taken : SCARS.held * Math.min(1, out.rounds / 3);
  const n = Math.round(houses.length * share);
  const order = houses.map((b, i) => ({ b, k: chance(c, p.to * 977 + i * 31 + 5) })).sort((a, z) => a.k - z.k);
  for (let i = 0; i < n; i++) hit(order[i].b, SCARS.worst + (SCARS.least - SCARS.worst) * chance(c, p.to * 613 + i * 17 + 11));
  return marked;
}

/** What the next quarter of a half-built work costs, in the town's stores. */
export function nextStep(type: string): Partial<Record<'food' | 'wood' | 'gold' | 'stone', number>> {
  const cost = BUILDINGS[type]?.cost ?? {};
  const out: Partial<Record<'food' | 'wood' | 'gold' | 'stone', number>> = {};
  for (const k of ['food', 'wood', 'gold', 'stone'] as const) if (cost[k]) out[k] = Math.ceil(cost[k]! * SCARS.step);
  return out;
}

/** A season of the governors' building: in each town held by a people, the first half-built work goes on a quarter, if its stores allow. */
export function finishWorks(c: Campaign): number {
  let done = 0;
  for (const t of c.territories) {
    const town = townOf(t);
    if (!town || t.owner < 0 || t.horde) continue;
    const b = town.b.find((x) => x[4] !== undefined);
    if (!b) continue;
    const need = nextStep(b[0]), stores = folkOf(c, t.id).stores;
    if (Object.entries(need).some(([k, n]) => (stores[k as keyof typeof stores] ?? 0) < (n ?? 0))) continue; // it waits for the stores
    for (const [k, n] of Object.entries(need)) stores[k as keyof typeof stores] -= n ?? 0;
    const built = round2((b[4] ?? 0) + SCARS.step);
    if (built >= 1) { b.length = 4; if (b[3] === undefined) b.length = 3; done++; } else b[4] = built;
  }
  return done;
}

/** The marks on a town and its half-built works, for the land panel and the map. */
export function scarsOf(c: Campaign, tid: number): { damaged: number; houses: number; works: number; share: number; unfinished: Standing[] } {
  const town = townOf(c.territories[tid]);
  if (!town) return { damaged: 0, houses: 0, works: 0, share: 0, unfinished: [] };
  const standing = town.b.filter((b) => b[4] === undefined), damaged = standing.filter((b) => b[3] !== undefined);
  const lost = damaged.reduce((n, b) => n + (1 - (b[3] ?? 1)), 0);
  return {
    damaged: damaged.length, houses: damaged.filter((b) => b[0] === 'house').length, works: damaged.filter((b) => isWork(b[0])).length,
    share: standing.length ? round2(lost / standing.length) : 0, unfinished: town.b.filter((b) => b[4] !== undefined),
  };
}

/** The land panel's words on a town's half-built works: how far the first is, and whether its governor can go on with it. */
export function unfinishedWords(c: Campaign, tid: number): string {
  const t = c.territories[tid], left = scarsOf(c, tid).unfinished;
  if (!left.length || t.owner < 0) return '';
  const b = left[0], name = BUILDINGS[b[0]]?.name ?? b[0], need = nextStep(b[0]), stores = folkOf(c, tid).stores;
  const short = Object.entries(need).filter(([k, n]) => (stores[k as keyof typeof stores] ?? 0) < (n ?? 0)).map(([k, n]) => `${n} ${k}`);
  const more = left.length > 1 ? ` (and ${left.length - 1} more after it)` : '';
  return short.length
    ? `🏗️ A ${name} stands half-built (${Math.round((b[4] ?? 0) * 100)}%)${more}. Its governor goes on with it when the town has ${short.join(' and ')} in store.`
    : `🏗️ A ${name} stands half-built (${Math.round((b[4] ?? 0) * 100)}%)${more}. Its governor finishes a quarter of it each season out of the town's stores.`;
}
