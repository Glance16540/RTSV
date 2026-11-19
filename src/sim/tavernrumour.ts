// Rumours heard in a Tavern (docs/systems-board, "Tavern": no rumours about rival towns).
//
// Now and then a Tavern in one of the player's towns hears a true line about a rival's town near it (within
// RUMOUR.reach lands): its larder bare, an army gathering, unrest, or plague. It reaches the player on the map with
// the season's news. The house matters: an honest one hears little, and only the gist; one that keeps late hours
// more; one that never shuts the most, and with the numbers in it (tavernfall.ts). At most one rumour a season.
//
// It is read from the rival's own state and changes nothing of it, and the chances are a run of their own (the
// campaign's seed, the turn and the town), so hearing a rumour moves nothing else in the campaign.
import type { Campaign } from './campaign';
import { faithAt } from './townfaith';
import { tavernTier } from './tavernfall';
import type { TavernTier } from './tavernfall';

export const RUMOUR = {
  /** The chance a season that a Tavern hears something, by the kind of house. */
  chance: { plain: 0.08, worldly: 0.16, decadent: 0.25 } as Record<TavernTier, number>,
  /** How far off a rival's town may be, in lands. */
  reach: 2,
  /** The companies an army must have to be talked of. */
  army: 4,
};

export type RumourKind = 'stores' | 'army' | 'unrest' | 'plague';
export interface Rumour { from: number; about: number; kind: RumourKind; text: string }

function chance(c: Campaign, salt: number): number {
  let h = (Math.imul(c.seed ^ 0x2545f491, 0x9e3779b1) ^ Math.imul(c.turn + 0x6a09e667, 0x85ebca6b) ^ Math.imul(salt + 0x3c6ef372, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Rival towns within reach of a town, nearest first. */
function rivalsNear(c: Campaign, tid: number): number[] {
  const seen = new Set([tid]), out: number[] = [];
  let ring = [tid];
  for (let step = 0; step < RUMOUR.reach; step++) {
    const next: number[] = [];
    for (const id of ring) for (const n of c.territories[id]?.adj ?? []) {
      if (seen.has(n)) continue;
      seen.add(n); next.push(n);
      const o = c.territories[n].owner;
      if (o > 0 && c.factions[o]?.alive) out.push(n);
    }
    ring = next;
  }
  return out;
}

/** What is true of a rival's town that a tavern might hear: each thing it could be told, with its words. */
export function truthsOf(c: Campaign, about: number, plain: boolean): { kind: RumourKind; text: string }[] {
  const t = c.territories[about], who = c.factions[t.owner]?.name ?? 'others', out: { kind: RumourKind; text: string }[] = [];
  const now = (kinds: string[]) => (c.events ?? []).some((e) => e.at === about && kinds.includes(e.kind) && e.until >= c.turn);
  if (now(['plague', 'fever'])) out.push({ kind: 'plague', text: `there is sickness in ${t.name}` });
  if (now(['unrest', 'revolt'])) out.push({ kind: 'unrest', text: `the people of ${t.name} are restless under the ${who}` });
  const f = t.folk; // as it stands: a town never yet counted has nothing to tell, and is not counted for it
  if (f && (f.hungry || f.drift?.hungry)) out.push({ kind: 'stores', text: plain ? `${t.name} is going short` : `the larders of ${t.name} are near bare, ${Math.round(f.stores.food)} food for ${f.men + f.women + f.children} mouths` });
  const near = new Set([about, ...t.adj]);
  const host = c.armies.filter((a) => a.owner === t.owner && near.has(a.at)), companies = host.reduce((n, a) => n + Object.values(a.units).reduce((s, v) => s + v, 0), 0);
  if (companies >= RUMOUR.army) out.push({ kind: 'army', text: plain ? `the ${who} are gathering men about ${t.name}` : `the ${who} have ${companies} companies about ${t.name}` });
  return out;
}

/** A season: each Tavern of the player's may hear a rumour; the first heard is told. Returns it, or null. */
export function rumourSeason(c: Campaign): Rumour | null {
  for (const t of c.territories) {
    if (t.owner !== 0 || !t.buildings.includes('tavern')) continue;
    const tier = tavernTier(faithAt(c, t.id));
    if (chance(c, t.id * 7 + 1) >= RUMOUR.chance[tier]) continue;
    const plain = tier === 'plain';
    const heard = rivalsNear(c, t.id).flatMap((about) => truthsOf(c, about, plain).map((x) => ({ ...x, about })));
    if (!heard.length) continue;
    const r = heard[Math.floor(chance(c, t.id * 13 + 5) * heard.length)];
    const text = `🍺 In the tavern at ${t.name} they say ${r.text}.`;
    c.log.push(text);
    return { from: t.id, about: r.about, kind: r.kind, text };
  }
  return null;
}
