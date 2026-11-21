// A claimant to the throne and the lord behind them, as the hall's panel tells them (src/sim/claimantfigures.ts): named,
// with faces, beside the figures that stand before the hall's door (hallguests.ts). Kept small: the rules are in the sim.
import type { Building, Game } from '../sim/game';
import { nationOf, notablePortrait } from '../sim/portrait';
import { portraitHtml } from './portrait';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** The line on a hall's panel for those standing there for a claim, or ''. */
export function claimLine(g: Game, b: Building): string {
  if (b.type !== 'towncenter') return '';
  const figs = g.players[b.owner]?.claimFigures ?? [];
  if (!figs.length) return '';
  const nation = nationOf(g.players[b.owner]?.civ);
  const face = (name: string, female: boolean) => portraitHtml(notablePortrait(nation, { name, gender: female ? 'f' : 'm', kind: 'person' }, {}), '', 'sm');
  const claimant = figs.find((f) => f.role === 'claimant'), lord = figs.find((f) => f.role === 'lord');
  const rows = figs.map((f) => `<div class="likeness-row story-person">${face(f.name, f.female)}<span><b>${esc(f.name)}</b> <small>${f.role === 'claimant' ? 'who has a claim to your throne' : `who raised ${claimant ? (claimant.female ? 'her' : 'him') : 'the claimant'} to it`}</small></span></div>`).join('');
  const words = claimant ? `${esc(claimant.name)}, who has a claim to your throne, is in the town${lord ? `, with ${esc(lord.name)}, who raised ${claimant.female ? 'her' : 'him'}` : ''}. They stand at the hall.`
    : `${esc(lord!.name)}, who raised the claimant who leads this town, stands at its hall.`;
  return `<div class="warn">👑 ${words}</div>${rows}`;
}
