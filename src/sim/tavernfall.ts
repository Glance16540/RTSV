// The tavern as a town falls. As a town grows less moral its tavern keeps later hours and takes more gold; what is
// sold there beyond drink is never shown or said, only what follows from it: the lights, the hours, the dress of
// its women, the gold on its panel and the town's standing going down (which the maids already drag at).
import { isDecadent } from './creed';

export type TavernTier = 'plain' | 'worldly' | 'decadent';
/** Where a town's standing puts its tavern. */
export const tavernTier = (virtue: number): TavernTier => (isDecadent(virtue) ? 'decadent' : virtue <= -30 ? 'worldly' : 'plain');

/**
 * What each kind of house takes and when it shuts. `gold` multiplies what each of its women brings in; `shuts` is
 * the part of the day (0 dawn, 0.7 dusk, 1 the next dawn) after which the door is closed until morning.
 */
export const TAVERN: Record<TavernTier, { gold: number; shuts: number; hours: string; name: string }> = {
  plain: { gold: 1, shuts: 0.7, hours: 'Shuts at dusk', name: 'An honest house' },
  worldly: { gold: 1.4, shuts: 0.85, hours: 'Open late into the night', name: 'A house that keeps late hours' },
  decadent: { gold: 2, shuts: 2, hours: 'Never shuts', name: 'A house that never shuts' },
};

/** Whether the tavern is open at this time of day, and what each of its women brings in for it (a multiple of the usual). */
export function tavernTrade(virtue: number, dayT: number): { tier: TavernTier; open: boolean; gold: number } {
  const tier = tavernTier(virtue), open = dayT < TAVERN[tier].shuts;
  return { tier, open, gold: open ? TAVERN[tier].gold : 0 };
}
