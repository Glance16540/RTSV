// The Noble's Manor (docs/DESIGN.md, "Buildings and research that answer the systems": rule and law).
//
// A lord's own house in a large town: it stands on the town's record (townworks.ts), raised from the map or built in
// the town, and only in a town of NOBLES.lordAt grown people or more, which is a town with a lord (nobles.ts). While it
// stands, the town's lord grows the more content season by season, but he has the more say: every decree moves his
// mood twice as far, pleasing or angering (nobles.ts reads both). A rival nation raises one in its largest town that
// has none, when it can spare the stores there (rule.ts).
import type { Campaign } from './campaign';
import { standsAt } from './studies';
import { BUILDINGS } from './data';
import { TOWN_SCALE } from './township';

export const MANOR = {
  /** How much the town's lord's mood rises a season, and how much further every decree moves it. */
  content: 3, say: 2,
};

/** Is a Noble's Manor standing in this town? */
export const manorAt = (c: Campaign, tid: number): boolean => standsAt(c, tid, 'manor');
/**
 * Grown people a town on the map needs for a manor: its BUILDINGS entry's \`townAt\` at the towns of today, TOWN_SCALE
 * times it in bigger towns (a town with a lord, as nobles.ts has it). In a battle or a visit the field counts its own
 * villagers against \`townAt\` itself (game.ts), the field holding at most FIELD_CAP of the town's grown (fieldcap.ts).
 */
export const manorNeeds = (): number => (BUILDINGS.manor?.townAt ?? 12) * TOWN_SCALE;
/** How far a decree moves this town's lord's mood, beside anyone else's: MANOR.say with a manor standing. */
export const lordSay = (c: Campaign, tid: number): number => (manorAt(c, tid) ? MANOR.say : 1);
/** How much the town's lord's mood rises a season of its own accord: MANOR.content with a manor standing. */
export const lordContent = (c: Campaign, tid: number): number => (manorAt(c, tid) ? MANOR.content : 0);
