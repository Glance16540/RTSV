// The stories inside the story, in a battle for the player's own town (docs/CLOSING.md: "they come onto the field only
// in a visit, not in a battle"). A battle fought in person for a town of the player's, held against an attacker (no
// battle in the open, no town of another's the player attacks), brings onto the field what a visit there would, as far
// as a battle makes sense of it:
//   - a thief (fieldstory.ts): the robbed houses are marked, and a soldier who stands by one long enough takes the thief;
//   - a killer (fieldstory.ts, fieldaccuse.ts): those spoken of walk the town by name; one may be questioned, and one
//     accused and seized by a soldier beside them;
//   - a plot, where the court is kept (courtfield.ts): the great spoken of are in the town, and a soldier set to watch
//     one may show an innocent true.
// Left out, because a battle makes no sense of them: a rival ruler's envoy and a suitor waiting at the hall. Nobody comes
// courting or bearing a rival's demand through a siege; their answers wait for the map or a visit. (The town's Hall of
// Judgement already sits in a battle, hallcases.ts, and hears a killer seized there.)
// What came of it comes home only if the player held the town: a town that fell takes its stories with it (intrigue.ts).
// It is written back by the map's own rules, believing nothing unchecked (storyvisit.ts, courtvisit.ts). Children are
// never in it: they are no units on the field, and no story names one.
import type { Campaign, Pending } from './campaign';
import { storyForVisit, storyFromVisit } from './storyvisit';
import { courtForVisit, courtFromVisit } from './courtvisit';
import type { FieldStory } from './fieldstory';
import type { FieldCourt } from './courtfield';

declare module './campaign' {
  interface BattleAfter {
    /** What came of a story afoot in the town, as a visit hands it back (`storyOut`, fieldstory.ts; battlestory.ts). */
    story?: unknown;
    /** And of a plot, where the court is kept (`courtOut`, courtfield.ts; battlestory.ts). */
    court?: unknown;
  }
}

/** The kinds of the leader's house's stories that come into a battle: only a plot (see above). */
export const BATTLE_COURT: FieldCourt['kind'][] = ['plot'];

/** Is this a battle for a town of the player's, held against an attacker, fought in person? */
export const ownTownBattle = (c: Campaign, p: Pick<Pending, 'attacker' | 'defender' | 'to' | 'mode'>): boolean =>
  p.defender === 0 && p.attacker !== 0 && p.mode !== 'field' && c.territories[p.to]?.owner === 0;

/** The stories the battle's field takes, as a visit's set-up has them: none for any other battle. */
export function storiesForBattle(c: Campaign, p: Pick<Pending, 'attacker' | 'defender' | 'to' | 'mode'>): { story?: FieldStory; court?: FieldCourt } {
  if (!ownTownBattle(c, p)) return {};
  const story = storyForVisit(c, p.to);
  const all = courtForVisit(c, p.to), kept = all ? [all, ...(all.also ?? [])].filter((x) => BATTLE_COURT.includes(x.kind)).map(({ also: _, ...x }) => x) : [];
  const court = kept.length ? (kept.length > 1 ? { ...kept[0], also: kept.slice(1) } : kept[0]) : undefined;
  return { ...(story ? { story } : {}), ...(court ? { court } : {}) };
}

/** What came of them in the battle, written back if the player held the town. Returns whether anything changed. */
export function storiesFromBattle(c: Campaign, p: Pick<Pending, 'attacker' | 'defender' | 'to' | 'mode'>, held: boolean, after: { story?: unknown; court?: unknown } | undefined): boolean {
  if (!held || !after || p.defender !== 0 || p.mode === 'field' || c.territories[p.to]?.owner !== 0) return false;
  const a = storyFromVisit(c, p.to, after.story);
  const b = courtFromVisit(c, p.to, after.court);
  return a || b;
}
