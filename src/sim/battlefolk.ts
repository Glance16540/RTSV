// A town's people in a battle (docs/PORTING.md: out of the battle hub). How a town's own people are set down on
// the field at the ages its record has them, how its children are set on its roofs' records, and the count of a
// side's town that a battle hands back to the campaign. The bridge between the town's record on the map
// (township.ts, ageing.ts) and the people of a battle. Moved out of game.ts as it stood, with nothing changed.
//
// game.ts calls `peopled` and `cradled` as a battle is laid out, and `Game.census` is `censusOf`.
import { Ages, GROWN_SEASON, LAST_SEASON, OLD_SEASON, SEASONS_A_YEAR, ageFor, childSeasons, cleanAges, leftFor, yearsOf } from './ageing';
import { widowsOut } from './widowtown';
import { orphansOut } from './orphantown';
import { ELDER_AT, GROW_TIME, RES_TYPES } from './data';
import type { Game, Gender, Unit } from './game';
import { homeRecord } from './household';
import { homeMade } from './notableweight';
import { Census, MAX_KIND, PeopleIn } from './township';

/** A town's own people take the field in place of four founders: its men, its women and its old, the notable among them by name. */
export function peopled(g: Game, owner: number, people: PeopleIn, st: { x: number; y: number }, dir: number): void {
  const count = (v: unknown): number => Math.max(0, Math.min(MAX_KIND, Math.round(Number(v) || 0)));
  const men = count(people.men), women = count(people.women), elders = count(people.elders);
  const named = (people.named ?? []).slice(0, 40);
  let k = 0;
  const one = (gender: Gender, old: boolean, seasons?: number): Unit => {
    const u = g.spawnUnit('villager', owner, st.x - 3.5 + (k % 8), st.y + (3.5 + Math.floor(k / 8)) * dir, gender);
    k++;
    // At the age the town's record has them (ageing.ts); with no record, the old in the last third of their lives
    // and the rest spread through the years before it.
    u.age = seasons !== undefined ? ageFor(seasons / SEASONS_A_YEAR, u.lifespan)
      : Math.max(1, u.lifespan * (old ? ELDER_AT + g.rng() * (0.95 - ELDER_AT) : g.rng() * ELDER_AT * 0.9));
    return u;
  };
  const folk: Unit[] = [];
  const ages = cleanAges(people.ages);
  if (ages && ages.m.length + ages.f.length === men + women + elders) {
    for (let j = 0; j < Math.max(ages.m.length, ages.f.length); j++) {
      if (j < ages.m.length) folk.push(one('m', false, ages.m[j]));
      if (j < ages.f.length) folk.push(one('f', false, ages.f[j]));
    }
  } else {
    for (let j = 0; j < Math.max(men, women); j++) { if (j < men) folk.push(one('m', false)); if (j < women) folk.push(one('f', false)); }
    for (let j = 0; j < elders; j++) folk.push(one(j % 2 ? 'm' : 'f', true));
  }
  // Those the nation knows by name are among them, with what they are known for.
  for (const n of named) {
    const u = folk.find((x) => x.gender === n.gender && !x.story?.length && !(x.kids ?? 0) && !named.some((m) => m !== n && m.name === x.name)) ?? null;
    if (!u || typeof n.name !== 'string' || !n.name) continue;
    u.name = n.name.slice(0, 40);
    if (typeof n.family === 'string' && n.family) u.family = n.family.slice(0, 40);
    u.kids = Math.max(0, Math.round(Number(n.kids) || 0));
  }
}

/** A town's children are set down on the record of one of its roofs, each some way toward being grown. */
export function cradled(g: Game, owner: number, children: number, ages?: number[]): void {
  const roofs = g.buildings.filter((b) => b.owner === owner && !b.dead && b.complete && (b.type === 'house' || b.type === 'towncenter')).sort((a, b) => Number(b.type === 'house') - Number(a.type === 'house') || a.id - b.id);
  if (!roofs.length) return;
  const n = Math.max(0, Math.min(MAX_KIND, Math.round(Number(children) || 0)));
  const at = ages && ages.length === n ? ages : null;
  for (let j = 0; j < n; j++) { const c = g.bear(roofs[j % roofs.length]); c.left = at ? leftFor(at[j], GROW_TIME) : GROW_TIME * (0.1 + g.rng() * 0.9); }
}

/**
 * A count of a side's town as it stands (township.ts): its men and women of working age (those trained to arms
 * out of the town among them), its old, the children on
 * its houses' records, its stores, those of its people held captive, and the women who have raised children, by name.
 */
export function censusOf(g: Game, owner: number): Census {
  const p = g.players[owner], out: Census = { men: 0, women: 0, elders: 0, children: p?.wards?.length ?? 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, taken: 0, named: [] };
  if (!p) return out;
  // Everyone's age as the town's record keeps it, in seasons (ageing.ts).
  const ages: Ages = { m: [], f: [], k: (p.wards ?? []).map((c) => childSeasons(c.left, GROW_TIME)) };
  out.ages = ages;
  for (const r of RES_TYPES) out.stores[r] = Math.max(0, Math.floor(p.res[r]));
  for (const u of g.units) {
    if (u.captive && u.captive.from === owner) out.taken!++;
    if (u.owner !== owner || u.dead) continue;
    // A townsman in arms is still one of the town's people (muster.ts): he keeps the span of his life, which an
    // army brought to the battle, a beast or the leader does not have. A woman serving keeps her gender; a man does not.
    const armed = u.type !== 'villager' && u.lifespan > 0;
    if (!armed && (u.type !== 'villager' || !u.gender)) continue;
    const woman = u.gender === 'f';
    if (u.age >= u.lifespan * ELDER_AT) out.elders++; else if (woman) out.women++; else out.men++;
    const seasons = Math.round(yearsOf(u.age, u.lifespan) * SEASONS_A_YEAR), old = u.age >= u.lifespan * ELDER_AT;
    (woman ? ages.f : ages.m).push(old ? Math.max(OLD_SEASON, Math.min(LAST_SEASON, seasons)) : Math.max(GROWN_SEASON, Math.min(OLD_SEASON - 1, seasons)));
    if (u.gender === 'f' && u.type === 'villager') { const home = { ...homeRecord(g, u), ...homeMade(g, u) }; if ((u.kids ?? 0) > 0 || home.war || home.made) out.named!.push({ name: u.name, gender: 'f', kids: u.kids ?? 0, ...(u.family ? { family: u.family } : {}), ...home }); }
  }
  { const w = widowsOut(g, owner); if (w) out.widowed = w; } // the widow or widower of each house (widowtown.ts)
  { const o = orphansOut(g, owner); if (o) out.orphans = o; } // the children taken in (orphantown.ts)
  for (const b of g.buildings) {
    if (b.dead) continue;
    if (b.owner === owner) { out.children += b.young?.length ?? 0; for (const c of b.young ?? []) ages.k.push(childSeasons(c.left, GROW_TIME)); }
    for (const c of b.captives ?? []) if (c.from === owner) out.taken!++;
  }
  out.named = out.named!.sort((a, b) => (b.kids ?? 0) - (a.kids ?? 0) || a.name.localeCompare(b.name)).slice(0, 12);
  return out;
}
/** A town's children as the campaign sent them, set down at the ages its record has them. */
export const cradledOf = (g: Game, owner: number, people: PeopleIn): void => cradled(g, owner, people.children, cleanAges(people.ages)?.k);
