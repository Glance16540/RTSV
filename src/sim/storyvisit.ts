// A story afoot in a town, carried into a visit there and back (docs/DESIGN.md, "Stories inside the story"). The map side
// of fieldstory.ts: `storyForVisit` hands the visit the player's thief or killer in the town, and `storyFromVisit` writes
// what came of it on the field back to the story on the map:
//   - a thief taken by a guard at a robbed house stands before the leader for judgement, as one the watch has taken;
//   - those of a killer's suspects questioned and cleared are spoken of no longer, with a clue saying why;
//   - one of them seized by a soldier is settled by the map's rule for an accusation (killerseized.ts): the guilty held for
//     judgement, an innocent let go with the town's grudge.
// The guilty one is never cleared. What comes back from the field is not believed blindly. Children are never in it.
import type { Campaign } from './campaign';
import { catchThief, intrigueAt } from './intrigue';
import { fullName, note } from './intriguebase';
import type { FieldStory, FieldStoryOut } from './fieldstory';
import { seizeSuspect } from './killerseized';

/** The player's open thief or killer in this town, as the field takes it, or undefined. */
export function storyForVisit(c: Campaign, tid: number): FieldStory | undefined {
  const it = intrigueAt(c, tid);
  if (!it || it.owner !== 0 || (it.kind !== 'thief' && it.kind !== 'killer')) return undefined;
  if (it.kind === 'thief' && it.caught !== undefined) return undefined; // taken already: nothing more for the field
  if (it.kind === 'killer' && it.held !== undefined) return undefined; // seized and held: judged on the map, or at the Hall
  return {
    id: it.id, kind: it.kind, culprit: it.culprit, cleared: [...it.cleared], robbed: [...it.robbed],
    people: it.people.map((p) => ({ name: p.name, family: p.family, gender: p.gender, trade: p.trade })),
    ...(it.watch ? { watch: true } : {}),
  };
}

/** Write what came of the story on the field back to it on the map. Returns whether anything changed. */
export function storyFromVisit(c: Campaign, tid: number, out: unknown): boolean {
  if (!out || typeof out !== 'object') return false;
  const o = out as Partial<FieldStoryOut>, it = intrigueAt(c, tid);
  if (!it || it.owner !== 0 || it.id !== o.id) return false;
  if (it.kind === 'thief') {
    if (o.caught !== true || it.caught !== undefined) return false;
    catchThief(c, it);
    return true;
  }
  if (it.kind !== 'killer') return false;
  let any = false;
  if (typeof o.seized === 'number' && seizeSuspect(c, it, o.seized)) any = true; // seized by a soldier (killerseized.ts)
  if (!Array.isArray(o.cleared) || it.held !== undefined || it.ended) return any;
  for (const i of o.cleared) {
    if (!Number.isInteger(i) || i < 0 || i >= it.people.length || i === it.culprit || it.cleared.includes(i)) continue;
    it.cleared.push(i);
    const text = `Questioned by you in ${c.territories[tid].name}, ${fullName(it.people[i])} answered for that night, and others swore to it.`;
    it.clues.push({ turn: c.turn, text, clears: [i] });
    note(c, it, 'good', `${fullName(it.people[i])} is spoken of no longer: ${text}`, it.people[i]);
    any = true;
  }
  return any;
}
