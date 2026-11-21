// The leader's call, as the land's panel offers it (src/sim/court.ts callArmies, src/sim/courtcall.ts): call every army
// (but a garrison its town needs), or name the armies to call, one by one; and the road's risk when the leader would
// travel alone where highwaymen sit. Kept small: the rules are all in the sim. Which armies are picked is the panel's
// own, until they are called.
import type { Campaign } from '../sim/campaign';
import { armySize } from '../sim/campaignbase';
import { callArmies, courtOf } from '../sim/court';
import { LEADER_ROAD, keepsGarrison, roadBand } from '../sim/courtcall';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** The armies picked to be called by name, by id. */
export const callPicks = new Set<number>();

/** The armies of the player's away from the leader, each to be picked, and the button that calls those picked. */
export function callByName(c: Campaign): string {
  const ct = courtOf(c, 0);
  if (!ct || ct.rally) return '';
  const away = c.armies.filter((a) => a.owner === 0 && a.at !== ct.at).sort((a, b) => a.at - b.at || a.id - b.id);
  for (const id of [...callPicks]) if (!away.some((a) => a.id === id)) callPicks.delete(id);
  if (!away.length) return '';
  const can = c.phase === 'player';
  const rows = away.map((a) => {
    const on = callPicks.has(a.id), n = armySize(a), keep = keepsGarrison(c, a);
    const title = keep ? 'The only garrison of a town that needs it: called by name, it comes all the same, and the town is left bare.' : 'Pick this army to call it by name.';
    return `<button data-act="callpick:${a.id}" class="call-pick${on ? ' on' : ''}" ${can ? '' : 'disabled'} title="${esc(title)}">${on ? '☑' : '☐'} The army in ${esc(c.territories[a.at]?.name ?? '?')} (${n} ${n === 1 ? 'company' : 'companies'})${keep ? ' ⚠️ garrison' : ''}</button>`;
  }).join('');
  const k = callPicks.size;
  return `<div class="hint">Or name the armies to call:</div>${rows}<button data-act="callnamed" ${can && k ? '' : 'disabled'} title="Only the armies picked march to the leader, a land nearer each turn, through your own country. A garrison picked comes all the same.">♛ Call ${k ? `these ${k === 1 ? 'one' : k}` : 'the armies picked'}</button>`;
}

/** The panel's buttons for the call: pick or unpick an army, or call those picked. Returns whether it was one of them. */
export function callAct(c: Campaign, kind: string, id: string): boolean {
  if (kind === 'callpick') { const n = Number(id); if (callPicks.has(n)) callPicks.delete(n); else callPicks.add(n); return true; }
  if (kind === 'callnamed') { if (callPicks.size) callArmies(c, 0, [...callPicks]); callPicks.clear(); return true; }
  return false;
}

/** A warning for the leader's road to this land, or '': highwaymen sit on it, and the leader travels alone. */
export function roadWarning(c: Campaign, from: number, to: number): string {
  const band = roadBand(c, from, to);
  if (!band) return '';
  const odds = Math.round(LEADER_ROAD.met * 10), hurt = Math.round(LEADER_ROAD.hurt * 100);
  return `<div class="warn">⚠️ ${esc(band.name[0].toUpperCase() + band.name.slice(1))} sit on the road from ${esc(c.territories[from]?.name ?? '')}. Travelling alone, the leader is set upon and turned back ${odds} times in 10, and wounded in one of every ${Math.round(100 / hurt)} of those.</div>`;
}
