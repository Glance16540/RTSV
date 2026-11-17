// Settlers found a new town (docs/DESIGN.md, "Settlers found new towns": "a people may send settlers, two couples and
// their children, from one of its towns to an empty land beside its own, where they found a small new town of that
// people without a war").
//
// What an empty land is: nobody holds it (no nation, no tribe), the marauders are not camped on it and no band has its
// place there, nobody lives there and it has no warriors. A land that has never been looked into is not known to be
// empty: its people are made up the first time they are (township.ts), so only a land on record with nobody in it is.
// What founding is: the settlers' convoy (convoys.ts, sent by migration.ts) comes in to an empty land and claims it.
// The land is the people's from then on, with nobody but the settlers and what they carried; its town is laid on the
// record next season as any town of a living people is (rivalrule.ts layTowns: a hall and a roof for every couple).
// If the land is no longer empty when they arrive, they go to their people's chief town as any convoy does.
//
// It reads and writes only the land and its town, so that convoys.ts can ask it without a ring of imports.
import type { Campaign } from './campaign';
import { headcount } from './township';
import { wilderness } from './wilds';

declare module './campaign' {
  interface Territory {
    /** Settlers of its people founded this town: from which town, and when (founding.ts). */
    foundedBy?: { from: number; turn: number };
  }
}

/** How far settlers go: lands with nobody on them they may cross beyond their people's own, the land they found on counted. */
export const FOUNDING = { reach: 3 };

/**
 * Is there nobody on this land to rule: unheld, not the marauders', nobody living there, no warriors? Such a land is
 * settled, not conquered: no army takes it (campaign.ts moveArmy), though a band on it is fought as a band.
 */
export function nobodyThere(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  if (!t || t.owner >= 0 || t.horde || (t.militia ?? 0) > 0) return false;
  return !!t.folk && headcount(t.folk) === 0;
}

/** Is this land empty, for settlers: nobody there to rule, and no band has its place on it or its road through it? */
export function emptyLand(c: Campaign, tid: number): boolean {
  return nobodyThere(c, tid) && !(c.bands ?? []).some((b) => b.at === tid || b.to === tid);
}

/** May settlers found a town here: an empty land that is not true wilderness (wilds.ts: a wild land of snow or desert)? */
export function settleable(c: Campaign, tid: number): boolean {
  return emptyLand(c, tid) && !wilderness(c, tid);
}

/**
 * What a land with nobody on it is, in words, for its panel: true wilderness, or an empty land settlers may found a town
 * on. Null for a land somebody lives on or holds.
 */
export function emptyWords(c: Campaign, tid: number): { name: string; icon: string; desc: string } | null {
  if (!nobodyThere(c, tid)) return null;
  const band = (c.bands ?? []).find((b) => b.at === tid);
  const bandLine = band ? ` ${band.name[0].toUpperCase()}${band.name.slice(1)} have their place here: send an army against the band, not the land.` : '';
  if (wilderness(c, tid)) return { name: 'Wilderness', icon: '🏔️', desc: `Nobody lives here. It cannot be settled or taken, and bands may rise here and march on the towns.${bandLine}` };
  return { name: 'Empty land', icon: '🏡', desc: `Nobody lives here, so there is nothing for an army to take: settlers may found a town here.${bandLine || (emptyLand(c, tid) ? '' : ' A band\'s road runs through it.')}` };
}

/**
 * The way settlers of this people would go to a land: the land of their own they leave it from (`gate`), and the lands
 * they cross from there, the land itself last (`through`), each a season on the way. Only over lands with nobody on them
 * (true wilderness among them), never through a tribe's, a nation's or a camp's; at most FOUNDING.reach of them. The
 * shortest, or null if there is none.
 */
export function wayOut(c: Campaign, f: number, to: number, most = FOUNDING.reach): { gate: number; through: number[] } | null {
  const back = new Map<number, number>([[to, -1]]);
  let edge = [to];
  for (let d = 1; d <= most && edge.length; d++) {
    const next: number[] = [];
    for (const at of edge) for (const n of [...c.territories[at].adj].sort((a, b) => a - b)) {
      if (back.has(n)) continue;
      if (c.territories[n].owner === f && !c.territories[n].horde) {
        const through: number[] = [];
        for (let x = at; x >= 0; x = back.get(x)!) through.push(x);
        return { gate: n, through };
      }
      if (d < most && nobodyThere(c, n)) { back.set(n, at); next.push(n); }
    }
    edge = next;
  }
  return null;
}

/** Settlers of a people come in to an empty land: it is theirs, with nobody in it yet but them. Returns whether it was. */
export function claimLand(c: Campaign, tid: number, f: number, o: { from?: number } = {}): boolean {
  if (!settleable(c, tid) || !c.factions[f]?.alive) return false;
  const t = c.territories[tid];
  t.owner = f; t.militia = 0; t.buildings = [];
  delete t.yoke; delete t.town; delete t.orders;
  t.folk = { men: 0, women: 0, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] };
  if (o.from !== undefined) t.foundedBy = { from: o.from, turn: c.turn };
  (c.events ??= []).push({ kind: 'founded', at: tid, turn: c.turn, until: c.turn });
  if (f === 0) c.log.push(`🏡 Settlers from ${o.from !== undefined ? c.territories[o.from].name : 'your people'} have founded ${t.name}: it is a town of yours now.`);
  (c.chronicle ??= []).push({ turn: c.turn, text: `${f === 0 ? 'Your people' : `The ${c.factions[f].name}`} founded a new town at ${t.name}: settlers came and made it theirs, without a war.` });
  return true;
}
