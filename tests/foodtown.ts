// A town for the food and health works' tests (granary, mill, well, infirmary, foodworks): a land of the player's
// beside the capital, its map sites as given and the works standing finished on its record (townworks.ts).
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { layTown } from '../src/sim/rivalrule';
import { begunAt } from '../src/sim/townworks';
import { folkOf } from '../src/sim/township';

export const WORKS = ['granary', 'mill', 'well', 'infirmary'];

/** Stand a building finished on a town's record. */
export function stand(c: Campaign, tid: number, type: string): void {
  if (!c.territories[tid].town?.b?.length) layTown(c, tid);
  c.territories[tid].town!.b.push([type, 1, 1]);
}
/** Is one begun or standing on the town's record? */
export const begun = (c: Campaign, tid: number, type: string): boolean => begunAt(c, tid, type);

/** `buildings`: map sites and works together; the works are stood on the town's record, the rest are the land's sites. */
export function town(buildings: string[], opts: { people?: number; food?: number; goods?: number } = {}) {
  const c = newCampaign(7, 1, 1, 'hearth');
  c.fronts = [];
  const home = c.territories.find((t) => t.capital === 0)!;
  const t = c.territories.find((x) => x.owner < 0 && home.adj.includes(x.id))!;
  t.owner = 0; t.buildings = buildings.filter((b) => !WORKS.includes(b));
  const f = folkOf(c, t.id), people = opts.people ?? 30;
  f.men = Math.round(people * 0.35); f.women = Math.round(people * 0.35); f.elders = Math.min(2, people - f.men - f.women); f.children = Math.max(0, people - f.men - f.women - f.elders);
  delete f.ages; delete f.drift; delete f.hungry; delete f.grief;
  delete t.town;
  layTown(c, t.id); // a roof for every couple, so the governor's first want is not a house
  for (const b of buildings.filter((x) => WORKS.includes(x))) stand(c, t.id, b);
  const goods = opts.goods ?? 900;
  f.stores = { food: opts.food ?? 2000, wood: goods, gold: goods, stone: goods };
  return { c, t, f };
}
