// How many of a town's people stand on the field at once (docs/DESIGN.md: "a battle is the close view of one town";
// towns four times larger, the owner's bigger-towns work, led by the armies session).
//
// Drawing, not the rules, grows with the heads on a field: the playtest session counted about 38 draw calls and 30 to
// 35 thousand triangles a person, so that a siege with 70 townsfolk on the field is past a comfortable budget until
// figures are batched. So a battle or a visit takes at most FIELD_CAP of the town's grown people (men, women and the
// old: those who walk), about the heaviest fields of today's towns (the 99th of them has some 35 townsfolk on it).
// The rest stand on the town's record, untouched, and are joined back as it is written back. At four times the size
// it bites on nearly every town, so the held-back are the common case. One figure, for the owner to raise on a real
// machine or once figures are batched.
//
// Who goes, when the town is larger than the cap:
//   - always: the town's named (its notable mothers, and their husbands), its widowed, those at the tavern and the
//     mine (driftintown.ts), and the men who take up arms for it (`arms`, tribes.ts turnOut): the field cannot be
//     without them, and the systems that seat or judge them by name (widowtown.ts, township.ts settleFolk) find them;
//   - the old, in the share of the town they are;
//   - then couples, a man and a woman together, as many as the town has married (marriage.ts) and the field has room;
//   - then single people, a man and then a woman, the youngest first.
// Children are not on the field as people (they are records on their houses, nursery.ts) and cost nothing to draw:
// they all go, so the orphans' records (orphantown.ts) and births (seasonfolk.ts) see the whole town.
// The grown kept back are held on the record by their ages (`Folk.fieldHome`, saved with the campaign). The town's
// counts are not touched while the battle is fought; settleFolk writes back the field and then joins them, before
// anything else reads the town (the couples, marriage.ts `wedOf`; the drifted, driftintown.ts `driftBack`).
// Plain data: it takes and gives counts and ages, and imports nothing of township.ts or the battle.
import type { Ages } from './ageing';
import { OLD_SEASON } from './ageing';

declare module './township' {
  interface Folk {
    /** The grown held back from the field of the battle or visit now being fought, by age (fieldcap.ts). */
    fieldHome?: FieldHome;
  }
}

/** The most of a town's grown people (men, women, the old) on the field at once (the armies session's figure, from the playtest session's draw counts). */
export const FIELD_CAP = 40;

/** The grown of a town held back from the field, by age, as the battle or visit began. */
export interface FieldHome { m: number[]; f: number[] }

/** Those who must go to the field whatever the cap: men and women, counted by who they are. */
export interface FieldNeeds { men: number; women: number }

/** What a town's record knows that the split reads: its named, widowed, drifted, and how many are married. */
export interface FieldTown {
  named?: { gender: 'm' | 'f'; husband?: string }[];
  widowed?: { female: boolean }[];
  drifted?: { tavern?: number; mines?: number };
  wed?: number;
}

/** Those who must go: the named and their husbands, the widowed, the drifted, and the men who take up arms. */
export function needsOf(town: FieldTown, arms = 0): FieldNeeds {
  const named = town.named ?? [], widowed = town.widowed ?? [];
  const mothers = named.filter((n) => n.gender === 'f').length, husbands = named.filter((n) => n.gender === 'f' && n.husband).length + named.filter((n) => n.gender === 'm').length;
  const widows = widowed.filter((w) => w.female).length, widowers = widowed.length - widows;
  return {
    men: Math.max(Math.max(0, Math.round(arms)), husbands + widowers + Math.max(0, town.drifted?.mines ?? 0)),
    women: mothers + widows + Math.max(0, town.drifted?.tavern ?? 0),
  };
}

/**
 * Split a town's ages between the field and home. Nothing is held back (`home` undefined) where its grown are no more
 * than the cap. `wed`: its couples; `need`: those who must go.
 */
export function splitField(ages: Ages, wed: number, need: FieldNeeds, cap = FIELD_CAP): { field: Ages; home?: FieldHome } {
  const grown = ages.m.length + ages.f.length;
  if (grown <= cap) return { field: { m: [...ages.m], f: [...ages.f], k: [...ages.k] } };
  const young = (xs: number[]) => xs.filter((s) => s < OLD_SEASON).sort((a, b) => a - b);
  const old = (xs: number[]) => xs.filter((s) => s >= OLD_SEASON).sort((a, b) => a - b);
  const men = young(ages.m), women = young(ages.f), oldM = old(ages.m), oldF = old(ages.f);
  // The old in the share of the town they are, the men and women of them likewise.
  const elders = Math.round(((oldM.length + oldF.length) * cap) / grown);
  const em = Math.round((elders * oldM.length) / Math.max(1, oldM.length + oldF.length)), ef = elders - em;
  let m = Math.min(men.length, need.men), w = Math.min(women.length, need.women);
  const room = (): number => cap - elders - m - w;
  // Couples, as many as the town has married: first a wife or husband for those who had to go, then pairs.
  const pairs = Math.min(Math.max(0, wed), men.length, women.length);
  while (room() > 0 && w < Math.min(m, pairs)) w++;
  while (room() > 0 && m < Math.min(w, pairs)) m++;
  while (room() >= 2 && m < pairs && w < pairs) { m++; w++; }
  // Then single people, a man and then a woman.
  while (room() > 0 && (m < men.length || w < women.length)) {
    if (m < men.length) m++;
    if (room() > 0 && w < women.length) w++;
  }
  const field: Ages = { m: [...men.slice(0, m), ...oldM.slice(0, em)], f: [...women.slice(0, w), ...oldF.slice(0, ef)], k: [...ages.k] };
  const home: FieldHome = { m: [...men.slice(m), ...oldM.slice(em)], f: [...women.slice(w), ...oldF.slice(ef)] };
  return home.m.length + home.f.length ? { field, home } : { field };
}

/** The town's ages once the field is written back: the field's, and those kept at home. */
export const joinAges = (field: Ages, home: FieldHome): Ages => ({ m: [...field.m, ...home.m], f: [...field.f, ...home.f], k: [...field.k] });

/** How many men, women and old a held-back home is. */
export function homeCounts(home: FieldHome): { men: number; women: number; elders: number } {
  const men = home.m.filter((s) => s < OLD_SEASON).length, women = home.f.filter((s) => s < OLD_SEASON).length;
  return { men, women, elders: home.m.length + home.f.length - men - women };
}

/** Make safe a held-back home read from a saved campaign. */
export function cleanHome(x: unknown): FieldHome | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const list = (v: unknown): number[] => (Array.isArray(v) ? v.filter((s) => Number.isFinite(s) && s >= 0).map((s) => Math.round(Number(s))).slice(0, 2000) : []);
  const h = { m: list((x as FieldHome).m), f: list((x as FieldHome).f) };
  return h.m.length + h.f.length ? h : undefined;
}
