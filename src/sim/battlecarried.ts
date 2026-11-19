// Those carried off in a battle fought in person are held on the map, as those carried off from a town taken on the
// map are (docs/DESIGN.md, "Captivity"; "People persist"; carriedoff.ts).
//
// As a siege fought in person is written back (campaign.ts, the `housed` hook), the town's people still held by
// those who seized them (carriedout.ts, by name) are not simply gone:
//   - they are held in a land of the people that attacked the town, the land its army came from if that is still
//     theirs, else another town of theirs: a record of the same kind carriedoff.ts keeps (`Carried`), with their names
//     and houses (`Held.who`), so that whoever takes that land in the next CARRY.seasons sets them free, and after
//     that they are the taker's people. A child borne to one of them in the camp is the taker's own from its birth,
//     on the holding town's record. Children are records only, as ever: none is named or shown;
//   - a known person of the town among them (a mother of many) is marked carried off, not killed or carried off, so
//     that she is known again if she comes home (threats.ts bringHome);
//   - the player is told in the season's report who was led away and where, and the chronicle keeps it.
// Those the wild's marauders held, those of a tribe's town, and those whose takers have no town to hold them in are
// gone, as before.
//
// When they come home (carriedoff.ts free), each goes back under their own house's roof on the town's record if
// that roof is there and has room for them (carriedhome.ts).
//
// It also mends one thing: a nation that carries people off (carriedoff.ts townFell) leads a share of a town it
// takes away as the town changes hands, before a battle fought in person writes the town's people back from the
// field, which counted them all again. Those led away are struck off the count the battle wrote (`retake`).
import type { Campaign, Pending } from './campaign';
import { agesOf, countFrom } from './ageing';
import type { Carried } from './carriedoff';
import { CARRY } from './carriedoff';
import type { CarriedOne } from './carriedout';
import type { Held } from './threats';
import { mark } from './threats';
import { folkOf } from './township';


const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, 40) : '');
const MAX = 400;

/** Those carried off, as handed back from the field, made safe. */
export function cleanCarried(x: unknown): CarriedOne[] {
  if (!Array.isArray(x)) return [];
  const out: CarriedOne[] = [];
  for (const o of x as CarriedOne[]) {
    const name = text(o?.name), seasons = Math.round(Number(o?.seasons));
    if (!name || !Number.isFinite(seasons)) continue;
    const family = text(o.family), young = Math.max(0, Math.min(20, Math.round(Number(o.young) || 0)));
    out.push({ name, ...(family ? { family } : {}), gender: o.gender === 'm' ? 'm' : 'f', seasons: Math.max(0, Math.min(400, seasons)), ...(young ? { young } : {}), ...(o.wild === true ? { wild: true } : {}) });
    if (out.length >= MAX) break;
  }
  return out;
}

const count = (k: number, one: string, many: string): string => `${k} ${k === 1 ? one : many}`;
const whom = (c: Campaign, f: number): string => (f === 0 ? 'your people' : `the ${c.factions[f]?.name ?? 'others'}`);
const listed = (names: string[]): string => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** Take out of a list of ages the one nearest each of `gone`; returns those found. */
function strike(list: number[], gone: number[]): number[] {
  const found: number[] = [];
  for (const s of gone) {
    if (!list.length) break;
    let at = 0;
    for (let i = 1; i < list.length; i++) if (Math.abs(list[i] - s) < Math.abs(list[at] - s)) at = i;
    found.push(list.splice(at, 1)[0]);
  }
  return found;
}

/** Those a nation led away from this town as it fell (carriedoff.ts) are struck off the count the battle wrote back. */
export function retake(c: Campaign, tid: number, by: number): number {
  const f = folkOf(c, tid), ages = agesOf(c, tid, f);
  let k = 0;
  for (const x of c.carried ?? []) {
    if (x.held.from !== tid || x.held.since !== c.turn || x.by !== by || x.held.who) continue;
    x.held.men = strike(ages.m, x.held.men); x.held.women = strike(ages.f, x.held.women);
    k += x.held.men.length + x.held.women.length;
  }
  if (k) countFrom(f, ages);
  c.carried = (c.carried ?? []).filter((x) => x.held.men.length + x.held.women.length > 0);
  return k;
}

/**
 * A siege fought in person has been written back: the town's people still held by those who seized them are held
 * in a land of the people that attacked. Returns the record, or nothing.
 */
export function battleCarried(c: Campaign, p: Pending, raw: unknown): Carried | null {
  const tid = p.to, by = p.attacker, from = p.defender;
  if (by >= 0) retake(c, tid, by);
  const all = cleanCarried(raw).filter((x) => !x.wild);
  if (!all.length || by < 0 || from < 0 || !c.factions[by]?.alive) return null;
  const hold = p.from !== undefined && c.territories[p.from]?.owner === by && p.from !== tid ? p.from : c.territories.find((t) => t.owner === by && t.id !== tid && !t.horde)?.id;
  if (hold === undefined) return null;
  const who = [...all.filter((x) => x.gender === 'f'), ...all.filter((x) => x.gender === 'm')].map((x) => ({ name: x.name, ...(x.family ? { family: x.family } : {}), gender: x.gender, seasons: x.seasons }));
  const held: Held = { from: tid, owner: from, women: who.filter((x) => x.gender === 'f').map((x) => x.seasons), men: who.filter((x) => x.gender === 'm').map((x) => x.seasons), since: c.turn, names: who.map((x) => x.name), who };
  const x: Carried = { id: (c.carriedSeq = (c.carriedSeq ?? 0) + 1), by, at: hold, held };
  (c.carried ??= []).push(x);
  // Children borne to them in the camp are the taker's own, on the holding town's record from their birth.
  const young = all.reduce((n, o) => n + (o.young ?? 0), 0);
  if (young) { const f = folkOf(c, hold), ages = agesOf(c, hold, f); for (let i = 0; i < young; i++) ages.k.push(0); countFrom(f, ages); }
  // A known person among them was carried off, not killed: she is known again if she comes home.
  const town = c.territories[tid], f = folkOf(c, tid);
  for (const n of f.notables) if (n.lost?.turn === c.turn && held.names!.includes(n.name)) n.lost = { turn: c.turn, how: `carried off by ${whom(c, by)}` };
  mark(c, 'carried', tid);
  if (from === 0 || by === 0) {
    const k = who.length, shown = who.slice(0, 4).map((w) => `${w.name}${w.family ? ` of the ${w.family} house` : ''}`);
    const names = k <= 4 ? listed(shown) : `${shown.join(', ')} and ${count(k - 4, 'other', 'others')}`;
    c.log.push(`${count(k, 'person', 'people')} of ${town.name} ${k === 1 ? 'was' : 'were'} led away from the battle by ${whom(c, by)} to ${c.territories[hold].name}: ${names}. In ${count(CARRY.seasons, 'season', 'seasons')} they will be ${by === 0 ? 'yours' : 'theirs'} for good${from === 0 ? `: take ${c.territories[hold].name} before then and they come home` : ''}.`);
    if (from === 0) (c.chronicle ??= []).push({ turn: c.turn, text: `${listed(who.slice(0, 3).map((w) => w.name))}${k > 3 ? ` and ${count(k - 3, 'other', 'others')}` : ''} of ${town.name} ${k === 1 ? 'was' : 'were'} led away by ${whom(c, by)} from the battle for the town.` });
  }
  return x;
}
