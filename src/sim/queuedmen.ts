/**
 * The very men who were in a town's training queues (docs/DESIGN.md, "A town left to itself").
 *
 * When the player leaves a town, what it was training is written down with its orders (governor.ts: `Orders.train`,
 * the kinds of soldier) and the town goes on raising a company a season of those kinds (townmuster.ts). But the
 * men who stood in the queues as the player left were named people of the town, each called in to be made a
 * soldier and already paid for (muster.ts); on the map they were forgotten, and whoever was youngest marched
 * instead. Here they are kept:
 *
 *   - `queuedOf` reads them off the field as the player leaves: each man called to a building to be trained, by
 *     his name, his house, his age in seasons and what he was being made into;
 *   - `keepQueued` writes them with the town's orders (`Orders.men`), after the governor has kept the rest;
 *   - `drillQueued`, the season after, makes each of them the man of a company of his own kind (a clubman a
 *     company of infantry, a rider of cavalry): that same man is taken off the town's record at the age he has
 *     reached, goes onto the army's roll, and is on his own house's record as away with it (armytown.ts,
 *     warhouse.ts). His training was paid for in the town, so his company costs the town no more. He joins the
 *     army standing there, or forms one.
 *
 * A man who is no longer in the town when his turn comes (he died, was carried off, or left) raises nobody: he is
 * struck from the list and the log says so. A town with no yard for his kind, another people's army in it, or a
 * full army keeps him waiting. Once the queued men are out, the town goes on by its last orders as before
 * (`drillWithQueued` is the season's one call: the men first, and the ordinary drill for towns that sent none).
 *
 * This file is the field's side of it (who is in the queues), which the battle reads and which knows nothing of
 * the map; queueddrill.ts is the map's side (keeping them with the orders, and sending them out).
 */
import type { Game } from './game';
import { SEASONS_A_YEAR, yearsOf } from './ageing';

/** A man who stood in a training queue as the player left his town. */
export interface QueuedMan {
  /** What he was being made into (a unit of the battle: clubman, slinger, rider...). */
  as: string;
  name: string; family?: string;
  /** His age in seasons as the player left, as the town's record keeps ages. */
  seasons: number;
}
/** The most men a town's orders remember. */
export const QUEUED_MOST = 12;

/** The men called to be trained in a side's buildings, as they stand now: each still a villager, walking in or inside. */
export function queuedOf(g: Game, owner: number): QueuedMan[] {
  const out: QueuedMan[] = [];
  for (const b of g.buildings) {
    if (b.owner !== owner || b.dead) continue;
    for (const q of b.queue) {
      if (q.kind !== 'unit' || !q.who) continue;
      const v = g.entities.get(q.who);
      if (!v || v.kind !== 'unit' || v.dead || v.type !== 'villager' || v.gender !== 'm') continue;
      out.push({ as: q.id, name: v.name, ...(v.family ? { family: v.family } : {}), seasons: Math.round(yearsOf(v.age, v.lifespan) * SEASONS_A_YEAR) });
    }
  }
  return out.slice(0, QUEUED_MOST);
}
