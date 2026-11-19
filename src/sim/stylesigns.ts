// Signs of a play style's rule at work on the field (docs/systems-board, "Play styles": nothing on the battlefield
// showed a style's rule acting but a soldier's panel).
//
// Where a style's rule acts, the field is told, as a plain event (`{ t: 'style' }`), so the client can show a small
// sign there (renderer.ts: a mark rising off the spot):
//   - Builders: a building mending itself in peace (a mason's mark);
//   - the Faithful: one of their people healed or cured at their house of faith (a candle's glow);
//   - Traders: a market earning its gold (a coin);
//   - Farmers: a farm finished, which makes room for one more villager while the room lasts (a family);
//   - Scholars: a study learned, which quickens their villagers' gathering (a scroll);
//   - Warriors: a soldier's kill that makes him strike harder, up to the rule's cap (crossed swords);
//   - Raiders: a villager carried off who joins the band (an axe).
// Each sign is kept to one in a while for the same spot, so a mending wall or a crowd being healed does not shower
// the screen. Nothing here changes a rule: it only tells of one acting.
import type { StyleId } from './data';

/** The event a sign is told by. */
export interface StyleSign { t: 'style'; player: number; style: StyleId; x: number; y: number }

/** How often, in seconds of the field, the same spot may show the same style's sign again. */
export const SIGN_EVERY: Record<StyleId, number> = { builder: 4, faithful: 5, trader: 0, farmer: 0, scholar: 0, warrior: 0, raider: 0 };

interface Field { time: number; events: unknown[] }
/** When each spot last showed a sign: kept beside the field, not in it, so nothing of it is saved with the game. */
const shown = new WeakMap<object, Map<string, number>>();

/** Tell the field a style's rule has acted here: `key` names the spot (a building or a person) for the wait between signs. */
export function styleSign(g: Field, player: number, style: StyleId, x: number, y: number, key: number | string = ''): void {
  const every = SIGN_EVERY[style];
  if (every > 0) {
    let at = shown.get(g);
    if (!at) shown.set(g, (at = new Map()));
    const k = `${style}:${key}`, last = at.get(k);
    if (last !== undefined && g.time - last < every) return;
    at.set(k, g.time);
  }
  g.events.push({ t: 'style', player, style, x, y } satisfies StyleSign);
}

/** The sign each style shows, and what it says to anyone who asks. */
export const STYLE_SIGN: Record<StyleId, { icon: string; says: string }> = {
  builder: { icon: '🧱', says: 'mending in peace' },
  faithful: { icon: '🕯️', says: 'healed at the house of faith' },
  trader: { icon: '🪙', says: 'the market earns' },
  farmer: { icon: '👪', says: 'room for one more' },
  scholar: { icon: '📜', says: 'learning quickens the work' },
  warrior: { icon: '⚔️', says: 'strikes harder for it' },
  raider: { icon: '🪓', says: 'carried off to join the band' },
};
