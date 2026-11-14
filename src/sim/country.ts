/**
 * Country that matters on the campaign map, and the works that open a closed border.
 * The kind of country a land lies in (see `biomeOf`) changes what it yields, how hard it is to take and how an army
 * fares marching into it. A border closed by mountains or a river (see `Campaign.barriers`) can be opened for good
 * by the people who hold one side of it: a road over the pass, or a bridge.
 */
import type { Barrier, Biome, Campaign } from './campaign';
import { biomeOf } from './campaign';

/**
 * `supplies`: added to what the land yields each turn. `farm`: added again where Farmland stands.
 * `defence`: added to whatever defends it. `march`: the strength an army keeps when it attacks into it.
 */
export interface CountryDef { supplies: number; farm: number; defence: number; march: number; rule: string }
export const COUNTRY: Record<Biome, CountryDef> = {
  grass: { supplies: 0, farm: 1, defence: 0, march: 1, rule: 'Good ploughland: Farmland here yields 1 more.' },
  forest: { supplies: 0, farm: 0, defence: 1, march: 1, rule: 'Cover for those who know the woods: +1 defence.' },
  marsh: { supplies: 0, farm: 0, defence: 0, march: 0.85, rule: 'No road holds here: an army attacking into it fights at 85% strength.' },
  steppe: { supplies: 0, farm: 0, defence: 0, march: 1.1, rule: 'Open ground with nowhere to make a stand: an army attacking into it fights at 110% strength.' },
  desert: { supplies: -1, farm: 0, defence: 0, march: 0.9, rule: 'Thin living and a thirsty march: 1 supply less each turn outside a capital, and an army attacking into it fights at 90% strength.' },
  snow: { supplies: -1, farm: 0, defence: 1, march: 1, rule: 'A short summer and a hard approach: 1 supply less each turn outside a capital, +1 defence.' },
};
export const countryOf = (c: Campaign, tid: number): CountryDef => COUNTRY[biomeOf(c, tid)];
/** What the country adds to (or takes from) a land's yield each turn, with whatever is built on it. */
export const countryYield = (c: Campaign, tid: number): number => {
  const k = countryOf(c, tid), t = c.territories[tid];
  return (t.capital >= 0 ? Math.max(0, k.supplies) : k.supplies) + (t.buildings.includes('farm') ? k.farm : 0); // a capital is fed from all its country
};

/** The works that open a closed border. Open water is not among them: that is what a Harbour is for. */
export interface WorkDef { name: string; icon: string; cost: number; done: string }
export const WORKS: Record<'mountains' | 'river', WorkDef> = {
  river: { name: 'a bridge', icon: '🌉', cost: 5, done: 'bridged the river' },
  mountains: { name: 'a road over the pass', icon: '🛤️', cost: 8, done: 'cut a road over the pass' },
};
/** The closed border between two lands, if there is one. */
export const barrierBetween = (c: Campaign, a: number, b: number): Barrier | undefined =>
  (c.barriers ?? []).find((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
/** The work that would open the border between two lands, or nothing if it is not closed (or closed by the sea). */
export const workFor = (c: Campaign, a: number, b: number): WorkDef | undefined => {
  const w = barrierBetween(c, a, b);
  return w && w.kind !== 'water' ? WORKS[w.kind] : undefined;
};
/** Whether this people can open the border from a land of theirs to the land across it. */
export function canOpen(c: Campaign, f: number, from: number, to: number): boolean {
  const work = workFor(c, from, to);
  return !!work && c.territories[from]?.owner === f && c.factions[f].supplies >= work.cost;
}
/**
 * Open a closed border for good. The work is paid for by the people who hold `from`; once it stands, anyone may
 * march across it, either way. Returns false and changes nothing if it cannot be done.
 */
export function openBorder(c: Campaign, f: number, from: number, to: number): boolean {
  if (!canOpen(c, f, from, to)) return false;
  const w = barrierBetween(c, from, to)!, work = workFor(c, from, to)!;
  const A = c.territories[from], B = c.territories[to];
  c.factions[f].supplies -= work.cost;
  c.barriers = (c.barriers ?? []).filter((x) => x !== w);
  if (!A.adj.includes(to)) A.adj.push(to);
  if (!B.adj.includes(from)) B.adj.push(from);
  (c.works ??= []).push({ a: from, b: to, kind: w.kind, by: f });
  const who = f === 0 ? 'You' : `The ${c.factions[f].name}`;
  c.log.push(`${work.icon} ${who} ${work.done} between ${A.name} and ${B.name}.`);
  (c.chronicle ??= []).push({ turn: c.turn, text: `${who} ${work.done} between ${A.name} and ${B.name}, and the way has stood open since.` });
  return true;
}
/**
 * A rival with stores to spare opens one border in its time, from a land of its own to land that is not, the
 * cheapest first. A people with no way out on foot does it as soon as it can pay, however many it has built.
 * Returns whether anything was built.
 */
export function rivalOpens(c: Campaign, f: number, spare = 12): boolean {
  const own = new Set(c.territories.filter((t) => t.owner === f).map((t) => t.id));
  const shut = ![...own].some((id) => c.territories[id].adj.some((n) => !own.has(n)));
  if (!shut && (c.works ?? []).some((w) => w.by === f)) return false;
  const ways = (c.barriers ?? []).filter((w) => w.kind !== 'water' && own.has(w.a) !== own.has(w.b))
    .map((w) => (own.has(w.a) ? { from: w.a, to: w.b } : { from: w.b, to: w.a }))
    .filter((w) => c.factions[f].supplies >= WORKS[barrierBetween(c, w.from, w.to)!.kind as 'river'].cost + (shut ? 0 : spare))
    .sort((p, q) => WORKS[barrierBetween(c, p.from, p.to)!.kind as 'river'].cost - WORKS[barrierBetween(c, q.from, q.to)!.kind as 'river'].cost || p.from - q.from || p.to - q.to);
  return ways.length > 0 && openBorder(c, f, ways[0].from, ways[0].to);
}
