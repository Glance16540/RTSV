// Shared set-up for the tests of the rule, law, nobles and faith studies.
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { folkOf } from '../src/sim/township';
import { layTown } from '../src/sim/rivalrule';

/** A campaign in the Bronze Age with the player's capital on record and stocked, and its id. */
export function ruleWorld(seed = 5): { c: Campaign; tid: number } {
  const c = newCampaign(seed, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  for (const x of c.factions) x.age = 2;
  const f = folkOf(c, tid);
  f.men = 8; f.women = 8; f.elders = 0; delete f.ages; delete f.hungry;
  f.stores = { food: 3000, wood: 3000, gold: 3000, stone: 3000 };
  layTown(c, tid);
  return { c, tid };
}
/** The nation has learned a study. */
export const knowing = (c: Campaign, f: number, id: string): void => { (c.factions[f].studies ??= []).push(id); };
