// Who is a neighbour to reckon with (docs/TUNING.md, pace; found by the threats session building the rim, rim.ts).
//
// A rival keeps its armies by where its frontier is: an army "at the front" goes on with the war and one behind the
// lines holds a threatened town or, standing idle long enough, is sent home (rivalrule.ts); a border town is where it
// builds for war; and an army deep in its own country walks to the nearest border (campaign.ts aiStep). All of them
// asked the same thing of a neighbouring land, "is it not ours?", and so a land with nobody on it counted as a
// frontier: an empty land waiting for settlers, a wild land of snow or sand that can never be held. A town beside one
// was a border town for ever and the army in it never stood down, never counted as behind the lines, and the walk to
// the border ended there, facing nobody.
// Read at 384 campaigns in each course, asking instead "could anybody come from it, or could it be taken?" left 4.4%
// and 4.9% of campaigns undecided after 200 seasons where 7.0% and 8.3% were, with sieges, men under arms and risings
// where they were.
// So: a land is a neighbour to reckon with for a people when it is not theirs and is neither empty (founding.ts
// nobodyThere) nor wilderness (wilds.ts). One question, asked in one place.
import type { Campaign } from './campaign';
import { nobodyThere } from './founding';
import { wilderness } from './wilds';

/** Is this land one the people `f` must reckon with: another's, or a tribe's or a band's, with somebody on it? */
export const reckoned = (c: Campaign, f: number, tid: number): boolean => {
  const t = c.territories[tid];
  return !!t && t.owner !== f && !nobodyThere(c, tid) && !wilderness(c, tid);
};

/** Does this land of a people's lie on a frontier: is any land beside it one to reckon with? */
export const onFrontier = (c: Campaign, f: number, tid: number): boolean => !!c.territories[tid]?.adj.some((n) => reckoned(c, f, n));
