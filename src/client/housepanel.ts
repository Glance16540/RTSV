// What a house's panel says of those away at war (src/sim/household.ts): they are still of the house.
import type { Building, Game } from '../sim/game';
import { awayOf, warRenown } from '../sim/household';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');
const TIE = { husband: 'its man', wife: 'its woman', son: 'a son of the house' };

/** Who of this house is away serving, what they have won for it, and what their absence costs it. */
export function awayHtml(game: Game, b: Building): string {
  const away = awayOf(game, b), won = b.warKills ?? 0;
  if (!away.length && !won) return '';
  const lines = away.map((a) => `<div>⚔️ <b>${esc(a.unit.name || a.unit.def.name)}</b>, ${TIE[a.as]}, is away ${a.unit.gender === 'f' ? 'serving' : 'at war'} as ${/^[aeiou]/i.test(a.unit.def.name) ? 'an' : 'a'} ${esc(a.unit.def.name.toLowerCase())}${a.unit.kills ? ` · felled ${a.unit.kills}` : ''}</div>`).join('');
  const parted = away.some((a) => a.as !== 'son');
  return `<div class="house-away">${lines}${won ? `<div>🎖️ Won in war by this house: ${won} felled${warRenown(b) ? ` (renown +${warRenown(b)})` : ''}</div>` : ''}${parted ? '<div class="hint">Still of this house: the place is kept, but no child is begun until both are home.</div>' : ''}</div>`;
}
