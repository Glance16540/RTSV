// The Market's caravan on the field, as the info panel shows its cart (src/sim/fieldcaravan.ts): where it is bound and
// with how much, so that the mule train is not a nameless unit. Kept small: the rules are all in the sim.
import type { Game, Unit } from '../sim/game';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** A line under the caravan's cart, or ''. */
export function caravanLine(g: Game, u: Unit): string {
  const s = g.players[u.owner]?.caravan;
  if (!s || s.cart !== u.id) return '';
  return s.state === 'back'
    ? `<div class="good">🐪 The Market's caravan, on its way home from ${esc(s.to)} with ${s.gold} gold. Keep it from the enemy until it is in.</div>`
    : `<div class="hint">🐪 The Market's caravan, bound for ${esc(s.to)} to trade. It comes back by this road with ${s.gold} gold, if nobody catches it.</div>`;
}
