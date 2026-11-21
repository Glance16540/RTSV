// A killer's suspect seized on the field (docs/CLOSING.md: "a killer's suspects can be questioned there but not accused
// or seized"). The map side of fieldaccuse.ts: what the field hands back as seized is settled here by the map's own
// rule for an accusation (intrigue.ts), as the town would see it:
//   - the guilty one: they confess, and are held for the leader's judgement (`Intrigue.held`), as a thief taken is; the
//     killing stops. The judgement is the map's (intrigue.ts choose: hang or banish), given on the land's panel, face to
//     face (encounter.ts), or at the town's Hall of Judgement where one stands (hallcases.ts). Left unjudged past the
//     town's patience, the town hangs them itself, as it does one left alone;
//   - an innocent: seized before the whole town and let go once three swear where they were. They are spoken of no
//     longer; the town and their household remember it (aftermath.ts `rememberSeized`, a resentful mark), and the
//     town's standing dips (SEIZED.wrong), half what an innocent hanged costs. Nobody is hanged on the field.
// What comes back from the field is not believed blindly: only one still spoken of, in a killing still open and
// nobody held yet, is taken. Every one of them is grown: no child is ever suspected, seized or named.
import type { Campaign } from './campaign';
import { shiftVirtue } from './townfaith';
import { rememberSeized } from './aftermath';
import { fullName, note } from './intriguebase';
import type { Intrigue } from './intriguebase';

export const SEIZED = {
  /** What seizing an innocent costs the town's standing: half an innocent hanged (intrigue.ts INTRIGUE.killer.virtue.wrong). */
  wrong: -4,
};

const they = (g: 'm' | 'f'): string => (g === 'f' ? 'she' : 'he');

/** Can this one of a killing's suspects be seized now? Still spoken of, the killing open, and nobody held. */
export const seizable = (it: Intrigue, i: number): boolean =>
  it.kind === 'killer' && !it.ended && it.held === undefined && Number.isInteger(i) && i >= 0 && i < it.people.length && !it.cleared.includes(i);

/** One of the suspects is seized in the town. Returns 'held' (the guilty one), 'wronged' (an innocent), or null if it cannot be. */
export function seizeSuspect(c: Campaign, it: Intrigue, i: number): 'held' | 'wronged' | null {
  if (!seizable(it, i)) return null;
  const p = it.people[i], where = c.territories[it.at]?.name ?? 'the town';
  if (i === it.culprit) {
    it.held = i; it.caught = c.turn; it.watch = false;
    note(c, it, 'good', `Seized by your soldiers in ${where}, ${fullName(p)} the ${p.trade} confessed to the ${it.victims.length === 1 ? 'death' : `${it.victims.length} deaths`}. ${they(p.gender)[0].toUpperCase() + they(p.gender).slice(1)} is held for your judgement.`, p);
    return 'held';
  }
  it.cleared.push(i);
  it.clues.push({ turn: c.turn, text: `${fullName(p)} was seized in ${where} and let go when three swore where ${they(p.gender)} was that night.`, clears: [i] });
  rememberSeized(c, it, p);
  shiftVirtue(c, it.owner, SEIZED.wrong, { at: it.at });
  note(c, it, 'bad', `Your soldiers seized ${fullName(p)} the ${p.trade} in ${where} for the killings, before the whole town, and ${they(p.gender)} had done nothing: three swore where ${they(p.gender)} was that night, and ${they(p.gender)} was let go. The ${p.family || fullName(p)} household will not forget it.`, p);
  if (it.owner === 0) (c.chronicle ??= []).push({ turn: c.turn, text: `${fullName(p)} of ${where} was seized for killings ${they(p.gender)} did not do, and let go.` });
  return 'wronged';
}
