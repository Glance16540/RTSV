// The Monastery or Convent (docs/DESIGN.md, "Buildings and research that answer the systems": faith). The Righteous
// town's great house, as the Work Camp is the Decadent one's.
//
// Only a town that keeps the faith (Devout or better: BuildingDef `needs: 'holy'`) has one, on the map as in the
// town. It stands on the town's record (townworks.ts), raised from the map or built in the town; in the town it
// takes up to six villagers as monks and nuns, who count as clergy as a church's do (game.ts), a Convent where
// the women are the more. On the map, while it stands:
//   - the town is drawn toward the holy way by RISE a season, as long as nothing bars it (drift.ts);
//   - its people are the better cared for (MONASTERY.care): the drifted come back the sooner;
//   - it takes in the sick and the bereaved: sickness and grief weigh on the town's drift as with the church's
//     tending at half strength, whether or not that is decreed (drift.ts).
// A rival nation raises one in its most faithful town that keeps the faith and has none, when it can spare the
// stores there (rule.ts).
import type { Campaign } from './campaign';
import { standsAt } from './studies';

export const MONASTERY = {
  /** A season's draw toward the holy way, the care it adds, and how strongly it tends the sick and bereaved (as a decree's strength). */
  rise: 2, care: 0.2, tend: 0.5,
};

/** Is a Monastery or Convent standing in this town? */
export const monasteryAt = (c: Campaign, tid: number): boolean => standsAt(c, tid, 'monastery');
/** What it does for the town's drift this season: nothing where none stands. */
export const monasteryCare = (c: Campaign, tid: number): { rise: number; care: number; tend: number } =>
  monasteryAt(c, tid) ? { rise: MONASTERY.rise, care: MONASTERY.care, tend: MONASTERY.tend } : { rise: 0, care: 0, tend: 0 };
