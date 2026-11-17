// Which soldier is which man (docs/PLAYTEST.md 4.9; docs/DESIGN.md, "A man at war is still of his house").
//
// An army's men are on its roll, each of a town and a house (armytown.ts, warhouse.ts). On the field its companies
// stood as soldiers with no names, and when the battle was read back the map drew by lot which of the roll had
// fallen: the end card named one set of men ("Fell by name, of yours: Kell, Fenn") and the map another ("He was Marn
// Ironwood"); and a soldier acclaimed on the field took a name the roll did not have, so the man of a house was
// renamed after him.
//
// Here, as a battle is laid out, each company of an army is led by the men of its roll: the first soldiers of the
// company bear their names and houses (`nameSoldiers`, the rest of the company is their following, as on the map). As
// the battle is read back, the men whose soldiers went down are handed to the map (`downedOf`, then `noteDowned`), and
// whoever counts an army's losses takes them first (`downRank`): the town they are of, the house, the man. So the end
// card and the map name the same men, and a soldier who makes a name there makes it under his own.
//
// Plain data both ways; this module reads the houses' record but changes nothing on it.
import type { Campaign } from './campaign';
import { COMPANIES } from './campaignbase';
import type { Game, Unit } from './game';
import type { WarHouse } from './warhouse';

/** A man of an army's roll, as a battle is given him: the army, his town, his name and his house. */
export interface RollMan { army: number; town: number; name: string; family: string }
/** What a side's army brings to name its soldiers: its roll, and how many of a company's soldiers are men of it. */
export interface Roll { men: RollMan[]; perCompany: number; /** Soldiers in a company of each kind (campaignbase.ts COMPANIES). */ per: Record<string, number> }

declare module './game' {
  interface Unit {
    /** The man of the army's roll this soldier is (soldiernames.ts). */ roll?: RollMan;
    /** A soldier of the following of a man of the roll: his name and house (soldiernames.ts). */ follows?: string;
  }
  interface Player { /** The men of its armies' rolls who took the field as its soldiers (soldiernames.ts). */ roll?: RollMan[] }
}
declare module './campaign' {
  interface Campaign { /** The men whose soldiers went down in the battle just read back (soldiernames.ts). */ downed?: { turn: number; men: RollMan[] } }
}

/** Soldiers in a company of each kind of unit, as the field lays them (campaignbase.ts COMPANIES). */
export const companySoldiers = (): Record<string, number> => { const out: Record<string, number> = {}; for (const d of Object.values(COMPANIES)) for (const [u, n] of Object.entries(d.units)) out[u] = n; return out; };

const keyOf = (m: { name: string; family: string }): string => `${m.name}|${m.family}`;
const text = (v: unknown, n = 40): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, n) : '');

/** An army's roll as named men: its men of each town, by house, the longest away first. */
export function rollOf(c: Campaign, army: number): RollMan[] {
  const out: (RollMan & { since: number })[] = [];
  for (const t of c.territories) {
    const houses = (t.folk as { houses?: WarHouse[] } | undefined)?.houses;
    if (!Array.isArray(houses)) continue;
    for (const h of houses) for (const s of h.away ?? []) if (s.army === army && s.name) out.push({ army, town: t.id, name: s.name, family: h.family, since: s.since });
  }
  return out.sort((a, b) => a.since - b.since || a.town - b.town || a.family.localeCompare(b.family) || a.name.localeCompare(b.name)).map(({ since: _, ...m }) => m);
}

/** A roll made safe as it comes into a battle. */
function cleanRoll(x: unknown): Roll | null {
  const r = x as Partial<Roll> | null;
  if (!r || !Array.isArray(r.men)) return null;
  const men = r.men.slice(0, 400).filter((m) => m && Number.isInteger(m.army) && Number.isInteger(m.town) && text(m.name)).map((m) => ({ army: m.army, town: m.town, name: text(m.name), family: text(m.family) }));
  const per: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.per ?? {})) if (Number.isInteger(v) && v > 0) per[k] = Math.min(20, v);
  return { men, perCompany: Math.max(1, Math.min(10, Math.round(Number(r.perCompany) || 1))), per };
}

/**
 * The army's soldiers, as they are laid on the field (`byKind`: each kind of the army's units as the campaign names it,
 * and its soldiers in the order laid), are given the names of its men: the first `perCompany` soldiers of each company,
 * a man each, in the roll's order, until the roll is used up. The leader is not one of them.
 */
export function nameSoldiers(g: Game, owner: number, byKind: ReadonlyMap<string, Unit[]>, roll: unknown): number {
  const r = cleanRoll(roll);
  if (!r || !r.men.length || !g.players[owner]) return 0;
  let next = 0, named = 0;
  for (const [kind, all] of byKind) {
    const list = all.filter((u) => !u.hero && !u.dead), per = Math.max(1, r.per[kind] ?? 1);
    for (let i = 0; i < list.length && next < r.men.length; i += per) {
      const lead: string[] = [];
      for (let j = 0; j < Math.min(r.perCompany, per) && i + j < list.length && next < r.men.length; j++) {
        const u = list[i + j], m = r.men[next++];
        u.name = m.name; u.family = m.family; u.roll = m;
        (g.players[owner].roll ??= []).push(m);
        lead.push(keyOf(m));
        named++;
      }
      for (let j = lead.length; j < per && i + j < list.length; j++) list[i + j].follows = lead[0]; // the rest of the company is his following
    }
  }
  return named;
}

/**
 * The men of the rolls whose soldiers went down on this field, every side's, for the map to count: those who took the
 * field and are not on it now by their name and house (a man gone home on leave is on it, as himself: furlough.ts).
 */
export function downedOf(g: Game): RollMan[] {
  const out: RollMan[] = [];
  g.players.forEach((p, owner) => {
    if (!p.roll?.length) return;
    const here = standing(g, owner);
    for (const m of p.roll) if (!here.has(keyOf(m))) out.push({ ...m });
  });
  return out;
}

/** The names and houses of a side's people on the field now. */
const standing = (g: Game, owner: number): Set<string> => new Set(g.units.filter((u) => u.owner === owner && !u.dead).map((u) => keyOf(u)));

/**
 * What of a side's army is left, by kind of soldier, for the map to count its companies (campaign.ts finishBattle): a
 * company whose man went down is broken, and his following is not counted with what stands.
 */
export function survivorsOf(g: Game, owner: number): Record<string, number> {
  const here = standing(g, owner), out: Record<string, number> = {};
  for (const u of g.units) if (u.owner === owner && !u.dead && !(u.follows && !here.has(u.follows))) out[u.type] = (out[u.type] ?? 0) + 1;
  return out;
}

/** The map is told who went down on the field just read back. Kept for this season only. */
export function noteDowned(c: Campaign, men: unknown): void {
  if (!Array.isArray(men)) { delete c.downed; return; }
  const ok = men.slice(0, 400).filter((m) => m && Number.isInteger(m.army) && Number.isInteger(m.town) && text(m.name)).map((m) => ({ army: m.army as number, town: m.town as number, name: text(m.name), family: text(m.family) }));
  if (ok.length) c.downed = { turn: c.turn, men: ok }; else delete c.downed;
}

const downNow = (c: Campaign): RollMan[] => (c.downed && c.downed.turn === c.turn ? c.downed.men : []);
/** How many of this town's men with this army went down on the field just fought (armytown.ts takes them first). */
export const downIn = (c: Campaign, army: number | undefined, town: number): number => downNow(c).filter((m) => (army === undefined || m.army === army) && m.town === town).length;
/** 0 for a man who went down on the field just fought, 1 for anyone else: whoever counts the losses takes the 0s first (warhouse.ts). */
export const downRank = (c: Campaign, army: number | undefined, family: string, name: string): number =>
  downNow(c).some((m) => (army === undefined || m.army === army) && m.family === family && m.name === name) ? 0 : 1;
