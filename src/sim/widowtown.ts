// A widow known on the map is the same widow in the town (docs/DESIGN.md, "People persist": the Widows row).
//
// The map keeps the widowed of a town by name (widowhood.ts, `Folk.widowed`); a town in a battle or a visit keeps the
// widow or widower of each house (bereft.ts, `Building.bereft`). Between them:
//   - In: when the town is mustered (township.ts `musterFolk`), its widowed go with its people. As the battle or visit
//     begins (game.ts), each is found among the town's people by name (or, where nobody of that name is there, a
//     homeless villager of that sex takes it), is housed alone in their own house or a free one, and the house remembers
//     whom they lost. Settled as a couple before (household.ts `settleHomes`), a widow's husband is not with her.
//   - Out: the town's census (battlefolk.ts `censusOf`) carries the widow or widower of each house; as it is written back
//     (township.ts `settleFolk`), the map's widowed are those the town had: one married again there, or dead, is struck
//     off; one widowed there is kept from then on; one known before keeps the season they were widowed.
// Plain data both ways; it imports only bereft.ts (which imports only types), so the town, the map and the census may each call it.
import type { Building, Game, Unit } from './game';
import type { Widowed } from './widowhood';
import { bereftOf } from './bereft';

declare module './township' {
  interface PeopleIn {
    /** The town's widowed, by name, as the map knows them (widowtown.ts). */
    widowed?: Widowed[];
  }
  interface Census {
    /** The widow or widower of each house as the battle or visit ended (widowtown.ts). */
    widowed?: Widowed[];
  }
}

const text = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 40) : '');

/** Make safe a list of widowed handed in or back. */
export function cleanWidows(x: unknown): Widowed[] {
  if (!Array.isArray(x)) return [];
  return x.filter((w) => w && typeof w === 'object' && text(w.name)).slice(0, 40).map((w): Widowed => ({
    name: text(w.name), family: text(w.family), female: w.female !== false, of: text(w.of),
    since: Number.isFinite(w.since) ? Math.round(w.since) : -1, kids: Math.max(0, Math.min(4, Math.round(Number(w.kids) || 0))),
  }));
}

/** As a battle or visit begins: each of the town's widowed housed alone, the house remembering whom they lost. Returns how many. */
/** The sides of each battle whose widowed were seated from the map (so that, at its end, the map takes back what the town had). */
const seated = new WeakMap<Game, Set<number>>();

export function seatWidows(g: Game, owner: number, list: Widowed[]): number {
  let done = 0;
  if (list.length) { const s = seated.get(g) ?? new Set<number>(); s.add(owner); seated.set(g, s); }
  const folk = (): Unit[] => g.units.filter((u) => u.owner === owner && u.type === 'villager' && !u.dead && !u.growT);
  const names = new Set(list.map((w) => w.name));
  for (const w of list) {
    const sex = w.female ? 'f' : 'm';
    let who = folk().find((u) => u.gender === sex && u.name === w.name);
    if (!who) { who = folk().find((u) => u.gender === sex && !u.homeId && !names.has(u.name)); if (who) { who.name = w.name; if (w.family) who.family = w.family; } }
    if (!who) continue; // nobody of that sex left to be them: the map keeps them as they were
    let house = who.homeId ? g.entities.get(who.homeId) as Building | undefined : undefined;
    if (!house || house.kind !== 'building' || house.type !== 'house') house = g.buildings.find((b) => b.owner === owner && b.type === 'house' && b.complete && !b.dead && !b.residents.m && !b.residents.f);
    if (!house) continue;
    // Alone in it: whoever was settled with them is not their spouse.
    const other = sex === 'f' ? 'm' : 'f', mate = house.residents[other];
    if (mate) { const u = g.entities.get(mate); if (u && u.kind === 'unit') u.homeId = 0; house.residents[other] = 0; }
    house.residents[sex] = who.id; who.homeId = house.id;
    if (w.family && !house.family) house.family = w.family;
    house.bereft = { name: w.of || 'their spouse', as: w.female ? 'husband' : 'wife', at: g.time };
    done++;
  }
  return done;
}

/** As a battle or visit ends: the widow or widower of each house of the side's, for the census. */
/** Nothing (undefined) where the battle seated none of the map's and made none of its own: the map keeps its own then. */
export function widowsOut(g: Game, owner: number): Widowed[] | undefined {
  const out: Widowed[] = [];
  for (const b of g.buildings) {
    if (b.owner !== owner || b.type !== 'house' || b.dead) continue;
    const w = bereftOf(g, b);
    if (w) out.push({ name: w.who.name, family: w.who.family ?? b.family ?? '', female: w.who.gender === 'f', of: w.lost, since: -1, kids: Math.min(4, b.young?.length ?? 0) });
  }
  return out.length || seated.get(g)?.has(owner) ? out : undefined;
}

/** The map's widowed after a battle or visit: those the town had, keeping the season each known one was widowed. */
export function widowsBack(was: Widowed[] | undefined, town: Widowed[], turn: number): Widowed[] {
  const before = new Map((was ?? []).map((w) => [w.name, w]));
  return town.map((w) => ({ ...w, since: before.get(w.name)?.since ?? turn }));
}
