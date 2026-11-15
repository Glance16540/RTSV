// The roll of a people (the owner's "Your people" screen): who leads them and of what house, the heirs and their
// ages, every person the nation knows by name and where, the men away with the armies, those held captive and
// for how long yet, and those lost of late. Read only: it gathers what the rest of the game keeps, as plain data.
// Children are never listed as people, only counted, town by town (docs/DESIGN.md, "Children are never shown").
import type { Campaign } from './campaign';
import { heroFor } from './campaign';
import { HEIR_AGE, houseOf } from './dynasty';
import { RANK_NAMES } from './hero';
import { SEASONS_A_YEAR } from './ageing';
import { awayFrom } from './armytown';
import { foundFolk, living } from './township';
import type { Notable } from './township';
import { BANDS, seasonsLeft } from './threats';
import { houseName, peopleName } from './naming';
import { POST_NAMES } from './kin';
import type { Post } from './kin';
import type { Feeling } from './portrait';

/** Seasons back that the lost are listed for. */
export const RECENT = 8;

/** Someone the nation knows by name, and the town they belong to. */
export interface RollPerson { name: string; family?: string; gender: 'm' | 'f'; kind: Notable['kind']; deed: string; unit?: string; town: number; townName: string }
export interface RollTown { id: number; name: string; men: number; women: number; elders: number; children: number; away: number; notables: RollPerson[] }
export interface RollCaptives { band: string; kind: string; place: string; from: string; men: number; women: number; seasonsLeft: number; names: string[] }
export interface RollLost extends RollPerson { how: string; turn: number }
export interface Roll {
  people: string; house?: string;
  leader: { name: string; female: boolean; rank: string; alive: boolean; at?: string };
  heirs: { name: string; female: boolean; years: number; ofAge: boolean; parent?: string }[];
  /** The leader's husband or wife (kin.ts), with their age; `lost`: widowed, dead or taken, and when. */
  spouse?: { name: string; female: boolean; years: number; lost?: { turn: number; how: string; final?: boolean } };
  /** The inner circle (kin.ts). */
  circle: { post: Post; postName: string; name: string; female: boolean; family?: string; kind?: string; unit?: string; town: number; townName: string; loyalty: number; feeling: Feeling }[];
  towns: RollTown[];
  captives: RollCaptives[];
  lost: RollLost[];
  totals: { grown: number; children: number; away: number; held: number; known: number };
}

const person = (n: Notable, town: number, townName: string): RollPerson => ({
  name: n.name, gender: n.gender, kind: n.kind, deed: n.deed, town, townName, ...(n.family ? { family: n.family } : {}), ...(n.unit ? { unit: n.unit } : {}),
});

/** The roll of a people as it stands this season. */
export function rollOf(c: Campaign, f = 0): Roll {
  const fac = c.factions[f], hero = heroFor(c, f);
  // Where the leader is, as the court last had it (court.ts's courtOf would set the record straight: this only reads).
  const ridingWith = fac.heroAlive ? c.armies.find((x) => x.owner === f && x.hero) : undefined;
  const seatAt = ridingWith?.at ?? fac.court?.at ?? c.territories.find((t) => t.capital === f && t.owner === f)?.id;
  const at = fac.heroAlive && seatAt !== undefined && c.territories[seatAt] ? c.territories[seatAt].name : undefined;
  const heirs = (fac.house?.heirs ?? houseOf(c, f).heirs).map((h) => ({ name: h.name, female: h.female, years: Math.floor((c.turn - h.born) / SEASONS_A_YEAR), ofAge: c.turn - h.born >= HEIR_AGE, ...(h.parent ? { parent: h.parent } : {}) }));
  // The household as it stands on record (kin.ts makes it the first time a season turns): read, not made here.
  const kin = fac.kin, sp = kin?.spouse;
  const spouse = sp ? { name: sp.name, female: sp.female, years: Math.floor((c.turn - sp.born) / SEASONS_A_YEAR), ...(sp.lost ? { lost: { ...sp.lost } } : {}) } : undefined;
  const circle = (kin?.circle ?? []).map((x) => ({ post: x.post, postName: POST_NAMES[x.post], name: x.name, female: x.female, ...(x.family ? { family: x.family } : {}), ...(x.kind ? { kind: x.kind } : {}), ...(x.unit ? { unit: x.unit } : {}), town: x.town, townName: c.territories[x.town]?.name ?? '', loyalty: x.loyalty, feeling: x.feeling }));
  const towns: RollTown[] = [], lost: RollLost[] = [];
  for (const t of c.territories) {
    // A notable lost of late is listed with the people, wherever their town has gone since.
    if (t.folk) for (const n of t.folk.notables) if (n.lost && c.turn - n.lost.turn <= RECENT && (t.owner === f || n.lost.how.startsWith('carried off'))) lost.push({ ...person(n, t.id, t.name), how: n.lost.how, turn: n.lost.turn });
    if (t.owner !== f) continue;
    const k = t.folk ?? foundFolk(c, t.id); // a town nobody has asked after yet, as it would be founded: read, not written
    towns.push({ id: t.id, name: t.name, men: k.men, women: k.women, elders: k.elders, children: k.children, away: awayFrom(c, t.id), notables: living(k).map((n) => person(n, t.id, t.name)) });
  }
  towns.sort((a, b) => (c.territories[b.id].capital === f ? 1 : 0) - (c.territories[a.id].capital === f ? 1 : 0) || b.notables.length - a.notables.length || a.id - b.id);
  const captives: RollCaptives[] = [];
  for (const b of c.bands ?? []) for (const h of b.held) {
    if (h.owner !== f) continue;
    captives.push({ band: b.name, kind: BANDS[b.kind].name, place: c.territories[b.at]?.name ?? '', from: c.territories[h.from]?.name ?? '', men: h.men.length, women: h.women.length, seasonsLeft: seasonsLeft(c, h), names: [...(h.names ?? [])] });
  }
  lost.sort((a, b) => b.turn - a.turn);
  return {
    people: peopleName(c, f), ...(houseName(c, f) ? { house: houseName(c, f) } : {}),
    leader: { name: hero.name, female: !!hero.female, rank: RANK_NAMES[hero.rank ?? 0] ?? '', alive: fac.heroAlive, ...(at ? { at } : {}) },
    heirs, ...(spouse ? { spouse } : {}), circle, towns, captives, lost,
    totals: {
      grown: towns.reduce((n, t) => n + t.men + t.women + t.elders, 0), children: towns.reduce((n, t) => n + t.children, 0),
      away: towns.reduce((n, t) => n + t.away, 0), held: captives.reduce((n, x) => n + x.men + x.women, 0), known: towns.reduce((n, t) => n + t.notables.length, 0),
    },
  };
}
