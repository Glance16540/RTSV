// A man's record at war goes with him from battle to battle (docs/DESIGN.md, "People persist"; "A man at war is still
// of his house").
//
// The men of an army's roll are each on a house's record as away with it (warhouse.ts `Serving`), and a battle fought
// in person gives each his soldier by name (soldiernames.ts). What a soldier did there (the foes he felled, the
// wounds he took) was the field's alone and was gone when it ended. Now each man away keeps a short record on his
// house's record (`Serving.record`):
//   - battles he has come through, foes he has felled and the battles he came out of wounded, in all;
//   - the last RECORD.last of them, each as a few numbers (the season, the land, felled, wounded, and whether it was
//     fought in person or out on the map), so it stays small however long he serves.
// As a battle is laid out his soldier is given his record (`seatRecords`, after soldiernames.ts names him) and his
// panel shows it (`recordLines`). As the battle fought in person is read back, every named soldier still on the field
// adds it (`recordsOut` on the field, `recordsBack` on the map). A battle fought out on the map adds one to every man
// of both armies' rolls still on it after its dead are struck off (`foughtOnMap`): the map does not say who felled
// whom, so it counts the battle and no kills (what an army fells there is the houses' renown, warhouse.ts creditArmy).
// A man who falls takes his record with him; one who comes home is a townsman again, and his record ends with his
// service.
// Plain data: the field side reads units, the map side the houses' record; nothing here imports either side's hub.
import type { Campaign, Pending } from './campaign';
import type { Game, Unit } from './game';
import type { WarHouse } from './warhouse';

/** A man's record at war: in all, and the last few battles as [turn, land, felled, wounded 0/1, fought on the map 0/1]. */
export interface WarRecord { battles: number; kills: number; wounds: number; last?: [number, number, number, number, number][]; /** The lands of `last` by name, given only as he is handed to a battle (`recordFor`): the field knows no map. */ at?: string[] }

declare module './warhouse' {
  interface Serving { /** His record at war while he serves (warrecord.ts). */ record?: WarRecord }
}
declare module './soldiernames' {
  interface RollMan { /** His record at war, as the map hands the roll to a battle (warrecord.ts). */ record?: WarRecord }
}
declare module './game' {
  interface Unit { /** The record at war of the man of the roll this soldier is, as he came to this battle (warrecord.ts). */ record?: WarRecord }
}
declare module './campaign' {
  interface BattleAfter { /** What each named soldier still on the field did in it (warrecord.ts `recordsOut`). */ records?: unknown }
}

export const RECORD = {
  /** Battles kept one by one; the rest are only in the totals. */
  last: 5,
};

const whole = (v: unknown, most: number): number => Math.max(0, Math.min(most, Math.round(Number(v) || 0)));
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, 40) : '');

/** A record made safe, whatever a saved game or a battle handed in. Undefined where there is nothing to it. */
export function cleanRecord(x: unknown): WarRecord | undefined {
  const r = x as Partial<WarRecord> | undefined;
  if (!r || typeof r !== 'object') return undefined;
  const battles = whole(r.battles, 9999), kills = whole(r.kills, 99999), wounds = whole(r.wounds, 9999);
  const last = (Array.isArray(r.last) ? r.last : []).filter((e) => Array.isArray(e) && e.length === 5 && e.every((n) => Number.isFinite(n)))
    .slice(-RECORD.last).map((e): [number, number, number, number, number] => [whole(e[0], 1e6), whole(e[1], 1e4), whole(e[2], 9999), e[3] ? 1 : 0, e[4] ? 1 : 0]);
  if (!battles && !kills && !wounds && !last.length) return undefined;
  const at = Array.isArray(r.at) && r.at.length === last.length ? r.at.map(text) : undefined;
  return { battles, kills, wounds, ...(last.length ? { last } : {}), ...(at ? { at } : {}) };
}

/** Add a battle to a man's record. */
function add(s: { record?: WarRecord }, turn: number, land: number, kills: number, wounded: boolean, onMap: boolean): void {
  const r = (s.record = cleanRecord(s.record) ?? { battles: 0, kills: 0, wounds: 0 });
  delete r.at; // names are given only to a battle
  r.battles++; r.kills += kills; if (wounded) r.wounds++;
  r.last = [...(r.last ?? []), [turn, land, kills, wounded ? 1 : 0, onMap ? 1 : 0] as [number, number, number, number, number]].slice(-RECORD.last);
}

const housesIn = (c: Campaign, tid: number): WarHouse[] => {
  const h = (c.territories[tid]?.folk as { houses?: unknown } | undefined)?.houses;
  return Array.isArray(h) ? (h as WarHouse[]) : [];
};

// ---- On the field ----

/**
 * As the battle is laid out, once soldiernames.ts has named the soldiers: each named soldier of this side is given his
 * record from the army's roll as the map handed it in (`roll.men[i].record`).
 */
export function seatRecords(g: Game, owner: number, roll: unknown): number {
  const men = (roll as { men?: unknown[] } | undefined)?.men;
  if (!Array.isArray(men)) return 0;
  const by = new Map<string, WarRecord>();
  for (const m of men.slice(0, 400) as { name?: unknown; family?: unknown; army?: unknown; record?: unknown }[]) {
    const r = cleanRecord(m?.record);
    if (r) by.set(`${Number(m.army)}|${text(m.name)}|${text(m.family)}`, r);
  }
  let k = 0;
  for (const u of g.units) {
    if (u.owner !== owner || u.dead || !u.roll) continue;
    const r = by.get(`${u.roll.army}|${u.roll.name}|${u.roll.family}`);
    if (r) { u.record = r; k++; }
  }
  return k;
}

/** One named soldier's battle, handed back to the map. */
export interface FieldDeed { army: number; town: number; name: string; family: string; kills: number; wounded: boolean }

/** As the battle ends: what every named soldier still on the field did in it, every side's. */
export function recordsOut(g: Game): FieldDeed[] {
  const out: FieldDeed[] = [];
  for (const u of g.units) {
    if (u.dead || !u.roll || g.players[u.owner]?.neutral) continue;
    out.push({ army: u.roll.army, town: u.roll.town, name: u.roll.name, family: u.roll.family, kills: whole(u.kills, 9999), wounded: u.hp < u.maxHp });
  }
  return out;
}

/** The lines a soldier's own panel shows of his record at war, as he came to this battle. Empty where he has none. */
export function recordLines(u: Unit, landName: (id: number) => string = () => 'a battle'): string[] {
  const r = u.record;
  if (!r) return [];
  const times = (n: number): string => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const out = [`Came through ${r.battles} ${r.battles === 1 ? 'battle' : 'battles'} before this one: ${r.kills} felled${r.wounds ? `, wounded ${times(r.wounds)}` : ''}.`];
  const last = r.last ?? [];
  for (let i = last.length - 1; i >= 0; i--) {
    const [turn, land, kills, wounded, onMap] = last[i];
    out.push(`Year ${Math.floor(turn / 4) + 1}, ${r.at?.[i] || landName(land)}${onMap ? ' (fought out on the map)' : ''}${onMap ? '' : `: ${kills ? `felled ${kills}` : 'felled none'}`}${wounded ? ', wounded' : ''}`);
  }
  return out;
}

// ---- On the map ----

/** A man's record as he is handed to a battle on the army's roll: with the lands of his last battles by name. */
export function recordFor(c: Campaign, rec: WarRecord | undefined): WarRecord | undefined {
  const r = cleanRecord(rec);
  if (!r) return undefined;
  return r.last?.length ? { ...r, at: r.last.map((e) => text(c.territories[e[1]]?.name)) } : r;
}

/** The men of an army's roll on their houses' record, with their towns. */
function servingIn(c: Campaign, army: number): { tid: number; family: string; s: WarHouse['away'][number] }[] {
  const out: { tid: number; family: string; s: WarHouse['away'][number] }[] = [];
  for (const t of c.territories) for (const h of housesIn(c, t.id)) for (const s of h.away ?? []) if (s.army === army) out.push({ tid: t.id, family: h.family, s });
  return out;
}

/** A battle fought in person has been read back: each named soldier who stood to the end adds it to his record. */
export function recordsBack(c: Campaign, p: Pending, raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  let k = 0;
  for (const d of raw.slice(0, 400) as Partial<FieldDeed>[]) {
    if (!d || !Number.isInteger(d.army) || !Number.isInteger(d.town)) continue;
    const name = text(d.name), family = text(d.family);
    const s = housesIn(c, d.town!).find((h) => h.family === family)?.away.find((x) => x.name === name && x.army === d.army);
    if (!s) continue;
    add(s, c.turn, p.to, whole(d.kills, 9999), d.wounded === true, false);
    k++;
  }
  return k;
}

/** A battle fought out on the map has been settled and its dead struck off: every man of both rolls still on them has come through it. */
export function foughtOnMap(c: Campaign, p: Pending, armies: (number | undefined)[]): number {
  let k = 0;
  for (const id of new Set(armies.filter((a): a is number => a !== undefined))) for (const m of servingIn(c, id)) { add(m.s, c.turn, p.to, 0, false, true); k++; }
  return k;
}
