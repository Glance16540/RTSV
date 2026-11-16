/**
 * A dead town (docs/DESIGN.md, the owner's word: "it should be able to be taken over by any rivals or marauders
 * if it is a dead town"). A town with nobody in it, no grown person, no child, and no man away with its armies,
 * is still its people's, but it stands open: whoever marches on it has it for the asking, a rival nation or a
 * band of marauders. Who gets it comes from who comes for it. It does not go back to the wild by itself.
 *
 * - After `DEAD.open` seasons with nobody in it a town is open. With no army of its holder in it, it defends
 *   itself with next to nothing (`DEAD.defence`), whatever walls it has: there is nobody on them.
 * - A computer-led nation sends an army that can reach an open town of another's to take it (`seizeOpen`).
 * - Marauders holding the land beside an open town with no army in it walk in (`deadTowns`).
 * - A nation that takes one settles it: those who followed the army make their homes there (`DEAD.settlers`).
 * - The armies of a people with nobody left alive in any town break up: they were men of no town by then.
 * - So that no campaign sits for ever: an open town nobody has come for in `DEAD.found` seasons is found by a
 *   wandering band of marauders, wherever it lies.
 */
import type { Army, Campaign, Territory } from './campaign';
import { moveArmy, reach } from './campaign';
import { armyAt, atTruce } from './campaignbase';
import { awayFrom } from './armytown';
import { folkOf, headcount } from './township';

export const DEAD = {
  /** Seasons with nobody in it before a town stands open, and what it defends itself with then. */
  open: 2, defence: 0.5,
  /** Men and women who settle a dead town a nation has taken. */
  settlers: 2,
  /** Seasons an open town may wait before a wandering band finds it, and the strength of the camp they make of it. */
  found: 24, camp: 3,
};
const lives = (c: Campaign, t: Territory): boolean => headcount(folkOf(c, t.id)) + awayFrom(c, t.id) > 0;
const heldBy = (c: Campaign, t: Territory): boolean => t.owner >= 0 && !t.horde && !!c.factions[t.owner]?.alive;
const garrisoned = (c: Campaign, t: Territory): boolean => armyAt(c, t.id)?.owner === t.owner;

/** Does this town stand open? Its people's still, with nobody in it for long enough. */
export const isOpen = (c: Campaign, tid: number): boolean => {
  const t = c.territories[tid];
  return !!t && heldBy(c, t) && (c.emptied?.[tid] ?? 0) >= DEAD.open && !lives(c, t);
};
/** What an open town with no army in it defends itself with, or null for a town that is not open (or is garrisoned). */
export const openDefence = (c: Campaign, tid: number): number | null => (isOpen(c, tid) && !garrisoned(c, c.territories[tid]) ? DEAD.defence : null);

/** Marauders make a camp of a dead town: the land is theirs, and its people's no longer. */
function overrun(c: Campaign, t: Territory, how: string): void {
  const was = t.owner, mine = was === 0, name = mine ? 'your people' : `the ${c.factions[was].name}`;
  c.log.push(`${t.name} stood empty, and ${how}: it is lost to ${name}.`);
  (c.chronicle ??= []).push({ turn: c.turn, text: `${t.name} stood empty, with nobody left alive in it, and ${how}. It was lost to ${name}.` });
  (c.events ??= []).push({ kind: 'overrun', at: t.id, turn: c.turn, until: c.turn });
  t.owner = -1; t.horde = true; t.militia = DEAD.camp; if (t.capital === was) t.capital = -1;
  delete t.yoke; delete t.town; delete t.orders;
  c.armies = c.armies.filter((a) => !(a.at === t.id && a.owner === was));
  const id = (c.bandSeq = (c.bandSeq ?? 0) + 1);
  (c.bands ??= []).push({ id, kind: 'marauders', name: 'the marauders', at: t.id, strength: DEAD.camp, since: c.turn, held: [] });
}

/**
 * A season for the dead towns: how long each has stood empty is counted; a nation that has taken one settles it;
 * marauders beside an open, ungarrisoned one walk in; and one that nobody has come for in a long while is found
 * by a wandering band. Returns the lands the marauders took (campaign.ts then counts out a people with no town).
 */
export function deadTowns(c: Campaign): number[] {
  const out: number[] = [], seen = (c.emptied ??= {}), whose = (c.emptiedOf ??= {});
  // A people with nobody left alive anywhere has nobody to fight for: its armies, men of no town now, break up.
  const gone = (c.extinct ??= {});
  for (const x of c.factions) {
    const mine = c.territories.filter((t) => t.owner === x.id && !t.horde);
    if (!x.alive || !mine.length || mine.some((t) => lives(c, t))) { delete gone[x.id]; continue; }
    gone[x.id] = (gone[x.id] ?? 0) + 1;
    if (gone[x.id] < DEAD.open || !c.armies.some((a) => a.owner === x.id)) continue;
    c.armies = c.armies.filter((a) => a.owner !== x.id);
    c.log.push(`${x.id === 0 ? 'Your people are' : `The ${x.name} are`} no more: nobody is left alive in any town of theirs, and their last soldiers have gone their own ways.`);
    (c.chronicle ??= []).push({ turn: c.turn, text: `${x.id === 0 ? 'Your people' : `The ${x.name}`} died out. Their towns stood empty, and their last soldiers went their own ways.` });
  }
  for (const t of c.territories) {
    if (!heldBy(c, t)) { delete seen[t.id]; delete whose[t.id]; continue; }
    if (lives(c, t)) { delete seen[t.id]; delete whose[t.id]; continue; }
    // Taken by another nation while it stood open: those who followed the army settle it, and it lives again.
    if (whose[t.id] !== undefined && whose[t.id] !== t.owner && (seen[t.id] ?? 0) >= DEAD.open) {
      const f = folkOf(c, t.id);
      f.men += DEAD.settlers; f.women += DEAD.settlers; delete f.ages;
      c.log.push(`${t.owner === 0 ? 'Your people have' : `The ${c.factions[t.owner].name} have`} settled the empty town at ${t.name}: ${DEAD.settlers * 2} who followed the army make their homes there.`);
      delete seen[t.id]; delete whose[t.id];
      continue;
    }
    whose[t.id] = t.owner;
    seen[t.id] = (seen[t.id] ?? 0) + 1;
    if (seen[t.id] < DEAD.open || garrisoned(c, t)) continue;
    if (t.adj.some((n) => c.territories[n].horde)) { overrun(c, t, 'the marauders beside it walked in'); out.push(t.id); delete seen[t.id]; delete whose[t.id]; }
    else if (seen[t.id] >= DEAD.found) { overrun(c, t, 'a wandering band of marauders found it'); out.push(t.id); delete seen[t.id]; delete whose[t.id]; }
  }
  return out;
}

/**
 * A nation goes after the open towns it can reach: an army of its own that is free to march, beside an open town
 * of another people it has no truce with, marches on it. (With nobody on the walls the fight is a nominal one.)
 * Returns how many marched.
 */
export function seizeOpen(c: Campaign, f: number): number {
  let n = 0;
  for (const a of c.armies.filter((x: Army) => x.owner === f && !x.moved)) {
    if (c.pending) break;
    const prize = reach(c, a.at).find((id) => c.territories[id].owner !== f && c.territories[id].owner >= 0 && !atTruce(c, f, c.territories[id].owner) && openDefence(c, id) !== null);
    if (prize === undefined) continue;
    if (moveArmy(c, a.id, prize) !== 'invalid') n++;
  }
  return n;
}
