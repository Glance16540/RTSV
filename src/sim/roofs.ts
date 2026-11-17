/**
 * Every household under its roof, on the field (docs/DESIGN.md, "Towns persist"; docs/PLAYTEST.md 4.3).
 *
 * A town came to every battle and visit with its roofs empty and all its grown people standing homeless by the hall:
 * who lives where was kept for nobody but the houses the nation knows by name (household.ts settleHomes) and the
 * widowed (widowtown.ts). With the first lay a player's first sight of the capital was forty roofs and nobody under
 * them, no child could be begun in a visit, and a man home on leave had no door of his own to find (leavehome.ts).
 *
 * So as a sitting begins, after the notable homes and the widowed are seated, the rest of the town is seated too
 * (`seatRoofs`), in houses that stand empty:
 *
 *   1. the households the town's record has from the last sitting (`kept`), each in the house at its own place: the man
 *      and the woman of it by their own names, the one of the town's people nearest each one's age taking the name
 *      where nobody bears it;
 *   2. the wives of men away with the armies (`away`, from the map's houses, warhouse.ts): each alone under the roof
 *      of her husband's family, his place empty until he is home;
 *   3. then couples, as many as the map counts married (`wed`, marriage.ts) and there are roofs and people for, the
 *      eldest first; a house whose son is away with the armies bears that family's name, so that he is its son.
 *
 * As the sitting ends `roofsOf` says who lives where, by place, name and age, for the record (roofsmap.ts).
 * Nobody is made or lost here, nothing is random, and a town with no empty house is left as it was.
 */
import { SEASONS_A_YEAR, yearsOf } from './ageing';
import type { Building, Game, Unit } from './game';

/** One of a household: the name they go by, and their age in seasons. */
export interface Tenant { name: string; seasons: number }
/** A household under its roof: where the house stands, the family's name if it has one, and its man and woman. */
export interface Roof { at: [number, number]; family?: string; m?: Tenant; f?: Tenant }
/** What the map hands the field: the households kept, how many couples are married, and whose men are away. */
export interface RoofsIn { kept?: Roof[]; wed?: number; away?: { family: string; husband: boolean }[] }

const seasonsOf = (u: Unit): number => Math.round(yearsOf(u.age, u.lifespan) * SEASONS_A_YEAR);
const housesOf = (g: Game, owner: number): Building[] => g.buildings.filter((b) => b.owner === owner && b.type === 'house' && b.complete && !b.dead).sort((a, b) => a.id - b.id);
const empty = (h: Building): boolean => !h.residents.m && !h.residents.f;
/** The grown of a town with no house, who may be seated: not a captive, not a soldier home on leave (he finds his own door). */
const unhoused = (g: Game, owner: number, sex: 'm' | 'f'): Unit[] =>
  g.units.filter((u) => u.owner === owner && u.type === 'villager' && !u.dead && u.gender === sex && !u.growT && !u.homeId && !u.captive && !u.onLeave);
const nameOf = (g: Game, id: number): string => { const u = id ? g.entities.get(id) : undefined; return u && u.kind === 'unit' && !u.dead ? u.name : ''; };
/** A household goes from one house to another that stands empty, with its name and what the house has to its name. */
function moveHome(g: Game, from: Building, to: Building): void {
  for (const sex of ['m', 'f'] as const) {
    const u = from.residents[sex] ? g.entities.get(from.residents[sex]) : undefined;
    to.residents[sex] = from.residents[sex]; from.residents[sex] = 0;
    if (u && u.kind === 'unit') u.homeId = to.id;
  }
  to.family = from.family; from.family = '';
  to.children = from.children; from.children = 0;
  to.warKills = from.warKills; from.warKills = 0;
}
const seat = (h: Building, u: Unit): void => { h.residents[u.gender as 'm' | 'f'] = u.id; u.homeId = h.id; };

/** Seat a town's households as a sitting begins. Returns how many were seated of each kind. */
export function seatRoofs(g: Game, owner: number, r: RoofsIn | undefined): { kept: number; wives: number; couples: number } {
  const out = { kept: 0, wives: 0, couples: 0 };
  if (!r || typeof r !== 'object') return out;
  // 1. The households of the last sitting, each where it lived.
  for (const roof of Array.isArray(r.kept) ? r.kept : []) {
    const h = housesOf(g, owner).find((x) => x.cx === roof?.at?.[0] && x.cy === roof?.at?.[1]);
    if (!h || !empty(h)) continue;
    // A home the nation knows was seated before this, in the first house free (household.ts): it goes back to its own.
    const at = housesOf(g, owner).find((x) => x !== h && !!roof.f && nameOf(g, x.residents.f) === roof.f.name && (roof.m ? nameOf(g, x.residents.m) === roof.m.name : !x.residents.m));
    if (at) { moveHome(g, at, h); out.kept++; continue; }
    let any = false;
    for (const sex of ['m', 'f'] as const) {
      const t = roof[sex];
      if (!t || typeof t.name !== 'string' || !t.name) continue;
      // One the nation knows by that name, already under another roof (a widow alone, a notable without her man): left there.
      if (g.units.some((u) => u.owner === owner && u.type === 'villager' && !u.dead && u.gender === sex && u.name === t.name && !!u.homeId && (!!u.story?.length || (u.kids ?? 0) > 0))) continue;
      const free = unhoused(g, owner, sex);
      const who = free.find((u) => u.name === t.name)
        ?? free.filter((u) => !u.story?.length && !(u.kids ?? 0)).sort((a, b) => Math.abs(seasonsOf(a) - t.seasons) - Math.abs(seasonsOf(b) - t.seasons) || a.id - b.id)[0];
      if (!who) continue;
      who.name = t.name.slice(0, 40);
      if (sex === 'm' && roof.family) who.family = roof.family.slice(0, 40);
      seat(h, who); any = true;
    }
    if (any) { if (roof.family) h.family = roof.family.slice(0, 40); out.kept++; }
  }
  const named = (): Set<string> => new Set(housesOf(g, owner).map((h) => h.family).filter(Boolean));
  const eldest = (sex: 'm' | 'f'): Unit[] => unhoused(g, owner, sex).sort((a, b) => seasonsOf(b) - seasonsOf(a) || a.id - b.id);
  const away = (Array.isArray(r.away) ? r.away : []).filter((a) => a && typeof a.family === 'string' && a.family);
  // 2. The wife of a man away with the armies, alone under his family's roof.
  for (const a of away) {
    if (!a.husband || named().has(a.family)) continue;
    const h = housesOf(g, owner).find(empty), her = eldest('f')[0];
    if (!h || !her) break;
    seat(h, her); h.family = a.family.slice(0, 40); out.wives++;
  }
  // 3. Couples, as many as the town has married; the house of a son away bears his family's name.
  const sons = [...new Set(away.filter((a) => !a.husband).map((a) => a.family))];
  let left = Math.max(0, Math.round(Number(r.wed) || 0)) - housesOf(g, owner).filter((h) => h.residents.m && h.residents.f).length;
  while (left > 0) {
    const h = housesOf(g, owner).find(empty), him = eldest('m')[0], her = eldest('f')[0];
    if (!h || !him || !her) break;
    seat(h, him); seat(h, her);
    const family = sons.find((f) => !named().has(f));
    if (family) { h.family = family.slice(0, 40); him.family = h.family; }
    out.couples++; left--;
  }
  return out;
}

/** Who lives under each roof of a side as things stand, for the town's record. */
export function roofsOf(g: Game, owner: number): Roof[] {
  const tenant = (id: number): Tenant | undefined => { const u = id ? g.entities.get(id) : undefined; return u && u.kind === 'unit' && !u.dead && u.name ? { name: u.name, seasons: seasonsOf(u) } : undefined; };
  const out: Roof[] = [];
  for (const h of housesOf(g, owner)) {
    const m = tenant(h.residents.m), f = tenant(h.residents.f);
    if (m || f) out.push({ at: [h.cx, h.cy], ...(h.family ? { family: h.family } : {}), ...(m ? { m } : {}), ...(f ? { f } : {}) });
  }
  return out;
}
