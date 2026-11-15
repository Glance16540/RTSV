// The marauders: the band that holds a land. This was a rule of its own in campaign.ts (`hordeTurn`); it is now
// one kind of band among the others (threats.ts), so there is one system of threats and not two.
//
// What is theirs alone: they hold the land they sit on (`Territory.horde`; their strength is their band's, and the
// land's old militia number is kept as its mirror), so they are fought by marching an army into it like any other land, and the land is the victor's.
// They appear in a tribe's land far from any capital, grow every season, and when strong may overrun the land
// next door, which becomes a camp of theirs too.
//
// What they now share with every band: their raids are strikes on a town that defends itself with what it has,
// with a report; the women they take are real people held with their ages, who come home, the older for it, when
// the camp falls, and are lost after the same four seasons. There is no other count of them: the old tally of
// "women carried off" on a land, and the supply it cost each turn, is gone. A town is the poorer for those it
// has lost by having fewer hands and fewer births, like any other loss.
//
// A land marked as the marauders' with no band on record (a campaign saved before this, or a land made so by hand)
// is taken up as one the first season it is seen.
import type { Campaign, Territory } from './campaign';
import { HORDE_MAX, HORDE_PRIZE, HORDE_SPREAD, HORDE_TURN } from './campaign';
import { Band, Raid, bringHome, chance, mark, note, reachOf, softest, strike } from './threats';

export const HORDE = {
  /** The chance marauders appear in a season when there are none, the chance a camp raids, and the chance a strong one overruns a neighbour. */
  appear: 0.45, raid: 0.45, overrun: 0.12,
  /** The militia a new camp has at the least, and what a land they overrun starts with at the least. */
  first: 4, spawn: 3,
  /** A camp grows by one every so many seasons, and no stronger than this (never past the old limit, HORDE_MAX). */
  grow: 2, max: 8,
  /** Camps there may be at once: one for every so many lands of the map, and never fewer than one. Past that they neither overrun nor are joined. */
  lands: 10,
};

/** How many camps of the marauders the map will bear. */
export const campsBorne = (c: Campaign): number => Math.max(1, Math.floor(c.territories.length / HORDE.lands));

const bandAt = (c: Campaign, tid: number): Band | undefined => (c.bands ?? []).find((b) => b.kind === 'marauders' && b.at === tid);
function raise(c: Campaign, t: Territory, name?: string): Band {
  const id = (c.bandSeq = (c.bandSeq ?? 0) + 1);
  const b: Band = { id, kind: 'marauders', name: name ?? 'the marauders', at: t.id, strength: t.militia, since: c.turn, held: [] };
  (c.bands ??= []).push(b);
  return b;
}

/** One season of the marauders. Returns the reports of their raids. */
export function hordeSeason(c: Campaign, out: string[]): Raid[] {
  const raids: Raid[] = [];
  // A land of theirs with no band on record is taken up as one.
  for (const t of c.territories) if (t.horde && !bandAt(c, t.id)) raise(c, t);
  // The old count of "women carried off" a land once carried (a supply short for each raid) is gone: those taken
  // are real people now, held by a band. A campaign saved with it loads, and the count is dropped here.
  for (const t of c.territories) delete (t as { taken?: number }).taken;
  // A camp that has fallen to someone, or is no longer theirs: those it held are free.
  for (const b of (c.bands ?? []).filter((x) => x.kind === 'marauders')) {
    const t = c.territories[b.at];
    if (t.horde && t.owner < 0) continue;
    const fell = t.horde && t.owner >= 0;
    t.horde = false;
    let home = 0;
    for (const h of b.held) home += bringHome(c, h);
    c.bands = (c.bands ?? []).filter((x) => x !== b);
    if (!fell) continue;
    const f = c.factions[t.owner];
    f.supplies += HORDE_PRIZE;
    mark(c, 'freed', t.id);
    note(c, out, 'broken', b, t.id, `${f.id === 0 ? 'You have' : `${f.name} have`} broken the marauders at ${t.name}${home ? ' and the women they took have come home' : ''}: ${HORDE_PRIZE} supplies.`, [t.owner, ...b.held.map((h) => h.owner)]);
  }
  const live = (c.bands ?? []).filter((b) => b.kind === 'marauders');
  if (!live.length) {
    if (c.turn < HORDE_TURN || chance(c, 0, 71) > HORDE.appear) return raids;
    const caps = c.territories.filter((t) => t.capital >= 0);
    const far = (t: Territory): number => Math.min(...caps.map((k) => Math.hypot(k.x - t.x, k.y - t.y)));
    const taken = new Set((c.bands ?? []).map((b) => b.at));
    const t = c.territories.filter((x) => x.owner < 0 && x.capital < 0 && !taken.has(x.id)).sort((a, b) => far(b) - far(a) || a.id - b.id)[0];
    if (!t) return raids;
    t.horde = true;
    t.militia = Math.max(t.militia, HORDE.first);
    const b = raise(c, t);
    (c.events ??= []).push({ kind: 'horde', at: t.id, turn: c.turn, until: c.turn + 1 });
    note(c, out, 'came', b, t.id, `Marauders have made camp at ${t.name}. They take women, and they grow.`, t.adj.map((n) => c.territories[n].owner));
    return raids;
  }
  live.forEach((b, i) => {
    const t = c.territories[b.at];
    const top = Math.min(HORDE_MAX, HORDE.max);
    // Their strength is the band's; the land's old number is kept as its mirror (tribes.ts).
    if (b.strength < top && (c.turn - b.since) % HORDE.grow === 0) b.strength++;
    t.militia = b.strength;
    // A raid on the softest town next door: it defends itself, like any town struck by a band.
    const m = softest(c, b, reachOf(c, b).filter((id) => id !== t.id));
    if (m && chance(c, b.id, 73 + i) < HORDE.raid) {
      const r = strike(c, b, m.id, out);
      // A camp that holds a land is not scattered by one beating: it is the weaker for it, and still there.
      if (b.strength <= 0) b.strength = 1;
      delete r.broken;
      b.strength = Math.max(1, Math.min(HORDE_MAX, HORDE.max, b.strength));
      t.militia = b.strength;
      if (r.outcome === 'taken') mark(c, 'taken', m.id);
      raids.push(r);
    }
    // Strong enough, they take a tribe's land next door for their own, while the map will bear another camp. (They
    // no longer throw a people out of its town: a town falls to those who fight for it, and its people are counted.)
    if (b.strength >= HORDE_SPREAD && (c.bands ?? []).filter((k) => k.kind === 'marauders').length < campsBorne(c) && chance(c, b.id, 79 + i) < HORDE.overrun) {
      const open = t.adj.map((n) => c.territories[n]).filter((x) => !x.horde && x.capital < 0 && x.owner < 0 && !(c.bands ?? []).some((k) => k.at === x.id));
      const next = open[Math.floor(chance(c, b.id, 83 + i) * open.length)];
      if (next) {
        const was = next.owner;
        next.owner = -1; next.horde = true; next.militia = Math.max(HORDE.spawn, Math.floor(b.strength / 2));
        b.strength -= 2; t.militia = b.strength;
        const k = raise(c, next);
        mark(c, 'overrun', next.id);
        note(c, out, 'overran', k, next.id, was >= 0 ? `The marauders have overrun ${next.name} and thrown out ${was === 0 ? 'your people' : c.factions[was].name}.` : `The marauders have overrun ${next.name}.`, [was, ...next.adj.map((n) => c.territories[n].owner)]);
      }
    }
  });
  return raids;
}
