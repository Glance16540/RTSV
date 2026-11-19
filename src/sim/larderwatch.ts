// Warning before a town's granary empties (the board audit: the player was told only once a town had gone hungry).
// The larder's own reckoning (larder.ts): what a town eats each season against what its land put in at the last
// harvest (harvest.ts notes it here), with the food on the road to it (convoys.ts) counted as come in by next season.
// Where that leaves the store falling, the seasons until it is bare are its food over what it falls by; a town that will
// go hungry within LARDER_WARN.seasons is warned of on the season's card and on its land's panel. A town already hungry is
// told of by the larder itself. A guess, as any reckoning ahead is: a harvest that fails or a band that robs the convoy
// is not foreseen. Plain data; it changes nothing but the note of the harvest.
import type { Campaign } from './campaign';
import { folkOf } from './township';
import { needOf } from './larder';

declare module './township' {
  interface Folk {
    /** The food the land put into the town at the last harvest, and the turn of it (larderwatch.ts). */
    reaped?: { turn: number; food: number };
  }
}

export const LARDER_WARN = {
  /** A town that will go hungry within this many seasons is warned of. */
  seasons: 2,
};

/** The harvest put `food` into this town this season (harvest.ts): added to what it has put in already this turn. */
export function noteReaped(c: Campaign, tid: number, food: number): void {
  const f = folkOf(c, tid), was = f.reaped?.turn === c.turn ? f.reaped.food : 0;
  f.reaped = { turn: c.turn, food: was + Math.max(0, Math.round(food)) };
}

/** Food on the road to this town, to come in by next season. */
export const foodComing = (c: Campaign, tid: number): number => (c.convoys ?? []).filter((x) => x.to === tid && !x.movers).reduce((n, x) => n + Math.max(0, x.cargo.food ?? 0), 0);

/**
 * How the town's larder stands ahead: the food it holds, what it eats and reaps a season, and the seasons until it cannot
 * eat in full (null while its harvest feeds it). Seasons counts from next: 1 is the coming season's eating.
 */
export function larderOutlook(c: Campaign, tid: number): { food: number; eats: number; reaps: number; coming: number; seasons: number | null } {
  const f = folkOf(c, tid), eats = needOf(c, tid), reaps = f.reaped?.food ?? 0, coming = foodComing(c, tid), food = Math.max(0, f.stores.food);
  const fall = eats - reaps;
  if (fall <= 0 || eats <= 0) return { food, eats, reaps, coming, seasons: null };
  // Before each season's eating the store has what it held, the harvests since and the convoys come in: hungry at the
  // first season k where that is short of a season's eating, food + coming + k * reaps < k * eats.
  return { food, eats, reaps, coming, seasons: Math.floor((food + coming) / fall) + 1 };
}

/** The player's (or a people's) towns whose granary will be empty within LARDER_WARN.seasons, and are not hungry yet. */
export function emptyingTowns(c: Campaign, owner = 0): { at: number; name: string; seasons: number; eats: number; reaps: number }[] {
  const out: { at: number; name: string; seasons: number; eats: number; reaps: number }[] = [];
  for (const t of c.territories) {
    if (t.owner !== owner || t.horde || (t.folk?.hungry ?? 0) > 0) continue;
    const o = larderOutlook(c, t.id);
    if (o.seasons !== null && o.seasons <= LARDER_WARN.seasons) out.push({ at: t.id, name: t.name, seasons: o.seasons, eats: o.eats, reaps: o.reaps });
  }
  return out;
}

/** The warning in words, for the season's card and a land's panel. */
export function emptyingText(x: { name: string; seasons: number; eats: number; reaps: number }): string {
  const when = x.seasons <= 1 ? 'next season' : `in ${x.seasons} seasons`;
  return `The granary at ${x.name} will be empty ${when}: it eats ${x.eats} food a season and its land brought in ${x.reaps}. Send food by road, or buy grain by decree.`;
}
