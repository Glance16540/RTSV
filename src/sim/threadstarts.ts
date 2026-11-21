// What happens to the player that begins a thread of tales (docs/CLOSING.md: "a world event, a land lost or a leader's
// fall starts none"). Each season it notices, from the campaign as it stands, what has befallen the player's people
// since the last season:
//   - a land lost: a land that was theirs now held by a rival people (the land, and who took it);
//   - a leader's fall: their house's line has a new ruler in it (the chief town);
//   - a plague: plague is marked in one of their towns;
//   - a royal marriage: their house has just been joined to a rival's (the chief town, and that people);
//   - a hungry winter: famine is marked in one of their towns in winter, or in the Long Winter, or a town of theirs
//     goes hungry then;
//   - a claimant's rising: towns of theirs have risen for a claimant to their throne (the seat).
// Each is kept as a thread waiting to begin (`c.threadSeeds`), and at the next telling, after any thread already
// under way, its first tale (worldtales.ts, `opens`) is put before the player about that land and people. Each kind
// begins once in a campaign; one not told within STARTS.wait seasons is let go, as is one whose land or people is gone.
// It reads the campaign and draws nothing by chance but the rival for a leader's fall, from the campaign's own luck.
import type { Campaign } from './campaign';
import { TALES } from './story';
import type { ThreadStart } from './story';
import { luck } from './campaignbase';
import { seasonOfTurn } from './seasonsky';

export const STARTS = {
  /** Seasons a thread may wait to begin before it is let go. */
  wait: 12,
  /** How many things noticed are remembered, so as not to be noticed twice. */
  seen: 40,
};

export interface ThreadSeed { kind: ThreadStart; land: number; rival: number; turn: number }

declare module './campaign' {
  interface Campaign {
    /** Threads the world has begun for the player, waiting for the next telling (threadstarts.ts). */
    threadSeeds?: ThreadSeed[];
    /** What the player's people had last season, to see what has changed (threadstarts.ts). */
    threadWatch?: { held: number[]; line: number; seen: string[] };
  }
}

/** The tale a kind of thread begins with. */
export const openerOf = (kind: ThreadStart) => TALES.find((x) => x.opens === kind);
const chief = (c: Campaign): number => (c.territories.find((t) => t.capital === 0 && t.owner === 0) ?? c.territories.find((t) => t.owner === 0))?.id ?? -1;

/** Notice what has befallen the player's people since last season. Called once a season. Returns what was begun. */
export function noteStarts(c: Campaign): ThreadSeed[] {
  const me = c.factions[0];
  if (!me?.alive) return [];
  const was = c.threadWatch, seeds = (c.threadSeeds ??= []), seen = [...(was?.seen ?? [])], out: ThreadSeed[] = [];
  const asked = c.asked ?? [];
  const add = (kind: ThreadStart, land: number, rival: number): void => {
    const opener = openerOf(kind);
    if (land < 0 || !opener || asked.includes(opener.id) || seeds.some((s) => s.kind === kind)) return;
    if (opener.needs === 'rival' && !(rival > 0 && c.factions[rival]?.alive)) return;
    const s = { kind, land, rival, turn: c.turn };
    seeds.push(s); out.push(s);
  };
  const fresh = (key: string): boolean => { if (seen.includes(key)) return false; seen.push(key); return true; };
  const line = me.house?.line ?? 1;
  const rivals = c.factions.filter((f) => f.alive && f.id > 0);
  if (was) {
    for (const id of was.held) { const o = c.territories[id]?.owner ?? -1; if (o > 0) add('landlost', id, o); }
    if (line > was.line) add('leaderfall', chief(c), rivals.length ? rivals[Math.floor(luck(c, 96) * rivals.length)].id : -1);
  }
  const winter = (turn: number): boolean => seasonOfTurn(turn) === 'winter' || c.world?.kind === 'winter';
  for (const e of c.events ?? []) {
    if (e.turn < c.turn - 1 || c.territories[e.at]?.owner !== 0) continue;
    if (e.kind === 'plague' && fresh(`plague:${e.at}:${e.turn}`)) add('plague', e.at, -1);
    if (e.kind === 'famine' && winter(e.turn) && fresh(`famine:${e.at}:${e.turn}`)) add('famine', e.at, -1);
  }
  if (winter(c.turn)) for (const t of c.territories) if (t.owner === 0 && t.folk?.hungry && fresh(`hungry:${t.id}:${c.turn}`)) add('famine', t.id, -1);
  for (const p of c.pacts ?? []) {
    if (p.kind !== 'marriage' || (p.a !== 0 && p.b !== 0) || p.since < c.turn - 1) continue;
    if (fresh(`wed:${p.a}:${p.b}:${p.since}`)) add('marriage', chief(c), p.a === 0 ? p.b : p.a);
  }
  for (const cl of c.claims ?? []) if (cl.owner === 0 && cl.towns?.length && !cl.ended && fresh(`rising:${cl.id}`)) add('rising', cl.towns[0], -1);
  // Let go of what has waited too long.
  for (let i = seeds.length - 1; i >= 0; i--) if (c.turn - seeds[i].turn > STARTS.wait) seeds.splice(i, 1);
  c.threadWatch = { held: c.territories.filter((t) => t.owner === 0).map((t) => t.id), line, seen: seen.slice(-STARTS.seen) };
  return out;
}

/**
 * At a telling: begin the oldest thread the world has begun that can still be told, putting its first tale before
 * the player about that land and people. Returns whether one was begun.
 */
export function startThread(c: Campaign): boolean {
  const seeds = c.threadSeeds ?? [];
  const asked = (c.asked ??= []);
  while (seeds.length) {
    const s = seeds.shift()!, opener = openerOf(s.kind);
    if (!opener || asked.includes(opener.id)) continue;
    if (opener.needs === 'rival' && !c.factions[s.rival]?.alive) continue;
    // A plague or a hungry winter is told of a town still the player's; a land lost, of the land; a rising, of its seat.
    if ((s.kind === 'plague' || s.kind === 'famine') && c.territories[s.land]?.owner !== 0) continue;
    asked.push(opener.id);
    c.lastTale = opener.id;
    c.tale = { id: opener.id, land: s.land, rival: s.rival, tribe: -1 };
    c.log.push(`${opener.title}: a matter is brought before you.`);
    return true;
  }
  return false;
}
