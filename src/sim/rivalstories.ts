// Stories inside the story for rival rulers (docs/DESIGN.md, "Stories inside the story": only the player had them).
//
// The thief and the killer happen in a rival's towns by the same chances as in the player's (intrigue.ts), run by the
// same rules season by season, and end with the same outcomes on that people and town: gold stolen and got back, the
// dead struck from the record, an innocent hanged and remembered (aftermath.ts), the town's standing moved. What
// differs is who answers. The rival ruler judges by his own lights (`judge`), read off the town's creed:
//   - a thief taken: a holy town sets him to work it off, or pardons one who stole to eat or a soldier's widow; a
//     town in the middle sets the hungry to work and puts the greedy out; a worldly or decadent town hangs him;
//   - a killer: a ruler names the last one left spoken of; a decadent one does not wait for that, and hangs one of the
//     last two, who may not be the one;
//   - a watch is set where the town has the gold for some seasons of it.
// The player learns only what he could learn of: a story's end in a town that lies beside his own lands, or one of his
// ally's, is told in a line and kept in the chronicle (`heard`); the rest is the rival's own business.
//
// The threat, the suitor and the plot (courtstory.ts) come to a rival ruler's own house too, by the same chances drawn apart
// from the player's (courtBeginFor), and only other rival peoples are in them, never the player. He answers them by his
// lights too:
//   - a threat from another king: a holy ruler defies it, one in the middle buys him off if he can, a worldly or decadent
//     one sends the spouse over the border; defied, he keeps a guard about him if he can pay for it;
//   - a suitor for a grown daughter: he asks her first, gives her if she is willing, and otherwise declines with gifts
//     if he can, or sends the suitor off;
//   - a plot: informers if he can pay, gifts to the nobles while several are spoken of; the plotter found, a ruler of any
//     creed short of worldly pardons, a worldly or decadent one puts to death.
//
// One call a season (campaign.ts), after the player's own stories. Children are never in these stories, and never harmed.
import type { Campaign } from './campaign';
import { INTRIGUE, beginKiller, beginThief, choicesFor, choose, openIntrigues, strained, suspected } from './intrigue';
import type { Intrigue } from './intriguebase';
import { chance, ofTown } from './intriguebase';
import { courtBeginFor } from './courtstory';
import { folkOf, grown, TOWN_SCALE } from './township';
import { faithAt } from './townfaith';
import { creedOf } from './creed';
import { crimeEdge } from './townwatch';

export const RIVAL_STORIES = {
  /** Seasons of gold a town keeps for its watch before its ruler sets one. */
  watchSeasons: 4,
};

/** May a story begin in this town now: one at a time, and not too soon after the last (intrigue.ts's own rule). */
function free(c: Campaign, at: number): boolean {
  const t = c.territories[at];
  if (!t || t.owner < 0 || t.horde) return false;
  return !(c.intrigues ?? []).some((x) => ofTown(x) && x.at === at && (!x.ended || (!x.again && c.turn - x.ended.turn < INTRIGUE.rest)));
}

/** A season's chance of a story beginning in one town of each rival people, as for the player's (intrigue.ts). Returns those begun. */
export function rivalBegin(c: Campaign): Intrigue[] {
  const began: Intrigue[] = [];
  if (c.turn < INTRIGUE.from) return began;
  const T = INTRIGUE.thief, K = INTRIGUE.killer;
  for (const x of c.factions) {
    if (!x.alive || !x.isAI || openIntrigues(c, x.id).filter(ofTown).length >= INTRIGUE.open) continue;
    const towns = c.territories.filter((t) => t.owner === x.id && !t.horde && t.folk && free(c, t.id));
    if (!towns.length) continue;
    const salt = 900 + x.id * 17, hard = towns.filter((t) => strained(c, t.id)), from = hard.length && chance(c, salt) < 0.7 ? hard : towns;
    const t = from[Math.floor(chance(c, salt + 1) * from.length)], f = folkOf(c, t.id), k = strained(c, t.id);
    if (grown(f) >= K.grown * TOWN_SCALE && chance(c, salt + 2) < K.chance * (k ? K.strained : 1) * crimeEdge(c, x.id)) began.push(beginKiller(c, t.id));
    else if (f.stores.gold >= T.gold && grown(f) >= 4 * TOWN_SCALE && chance(c, salt + 3) < T.chance * (k ? T.strained : 1) * crimeEdge(c, x.id)) began.push(beginThief(c, t.id));
  }
  return began;
}

/** What a rival ruler does about one of his stories now, by his own lights: a choice, or null to let it run. */
export function judge(c: Campaign, it: Intrigue): string | null {
  if (it.ended || it.owner <= 0) return null;
  const can = choicesFor(c, it), has = (id: string): boolean => can.some((x) => x.id === id && !x.bar);
  const creed = creedOf(faithAt(c, it.at)).id, holy = creed === 'zealous' || creed === 'devout', worldly = creed === 'worldly' || creed === 'decadent';
  if (it.kind === 'rival') {
    if (it.stage === 1) return holy ? 'defy' : worldly ? 'yield' : has('buy') ? 'buy' : 'defy';
    return it.stage === 2 && has('watch') ? 'watch' : null;
  }
  if (it.kind === 'suitor') return !it.asked ? 'ask' : it.willing ? 'give' : has('decline') ? 'decline' : 'spurn';
  if (it.kind === 'plot') {
    if (it.found) return worldly ? 'death' : 'pardon';
    if (has('watch')) return 'watch';
    const spoken = (it.nobles ?? []).length - it.cleared.length;
    return spoken > 2 && !it.sweetened && has('gifts') ? 'gifts' : null;
  }
  if (it.kind === 'thief' && it.caught !== undefined && it.thief) {
    const why = it.why ?? 'greed', need = why === 'hunger' || why === 'widow';
    if (creed === 'zealous' || creed === 'devout') return need ? 'pardon' : 'work';
    if (creed === 'temperate') return need ? 'work' : 'banish';
    return 'hang';
  }
  if (it.kind === 'killer') {
    const left = suspected(it);
    if (left.length === 1 && has(`accuse:${left[0]}`)) return `accuse:${left[0]}`;
    if (creed === 'decadent' && left.length === 2) { const i = left[Math.floor(chance(c, it.id * 97 + 3) * 2)]; if (has(`accuse:${i}`)) return `accuse:${i}`; }
  }
  if (has('watch') && folkOf(c, it.at).stores.gold >= INTRIGUE.thief.cost * RIVAL_STORIES.watchSeasons) return 'watch';
  return null;
}

/** Could the player learn of a story in this town: it lies beside his own lands, or it is his ally's? */
export function heard(c: Campaign, it: Intrigue): boolean {
  const t = c.territories[it.at];
  if (!t || it.owner <= 0) return false;
  return it.owner === c.ally || t.adj.some((n) => c.territories[n]?.owner === 0);
}

/**
 * A season of the rivals' stories: each ruler answers his own (`judge`), new ones begin, and the player is told of those
 * that ended where he could learn of them. Returns the stories begun.
 */
export function rivalStoriesSeason(c: Campaign): Intrigue[] {
  for (const it of [...(c.intrigues ?? [])]) {
    const pick = judge(c, it);
    if (pick) choose(c, it.id, pick);
  }
  for (const it of c.intrigues ?? []) {
    if (it.owner <= 0 || !it.ended || it.ended.turn !== c.turn || !heard(c, it)) continue;
    const people = c.factions[it.owner]?.name ?? 'a rival people', line = `Word comes from ${c.territories[it.at].name}, of the ${people}: ${it.ended.text}`;
    c.log.push(line);
    (c.chronicle ??= []).push({ turn: c.turn, text: line });
  }
  const began = rivalBegin(c);
  for (const x of c.factions) if (x.alive && x.isAI) began.push(...courtBeginFor(c, x.id)); // a rival ruler's own house
  return began;
}
