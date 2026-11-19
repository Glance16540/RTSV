// Convoys on the campaign map (src/sim/convoys.ts): food, goods or people sent between a people's own towns, a season
// on the road. Drawn as the markets' caravans are (caravandraw.ts), a little train of pack mules under the people's
// colour, walking one way along its road from the town it left towards the town it is bound for while the season
// stands, and over again; a family moving or settlers going out are drawn the same.
import type { Campaign } from '../sim/campaign';
import type { Convoy } from '../sim/convoys';
import { Walker, caravanTrain } from './caravandraw';

/** A convoy on the road, ready to walk: its piece and its road, one way. */
export function convoyWalker(c: Campaign, x: Convoy): Walker {
  const pts = x.road.map((id) => [c.territories[id].x, c.territories[id].y] as [number, number]);
  return { g: caravanTrain(c.factions[x.owner]?.color ?? 0x806040, false), pts, ph: (x.id * 0.382) % 1, one: true };
}
/** Every convoy on the road, as walkers. */
export const convoyWalkers = (c: Campaign): Walker[] => (c.convoys ?? []).filter((x) => x.road.length > 1).map((x) => convoyWalker(c, x));
