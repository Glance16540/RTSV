// What a town can raise and learn from the map, on the land's panel: a button for each building that can be raised
// on its record (src/sim/townworks.ts) and for each study taught at a building standing there (src/sim/studies.ts).
import type { Campaign } from '../sim/campaign';
import { BUILDINGS, TECHS } from '../sim/data';
import { STORE_KINDS } from '../sim/township';
import { begunAt, mapWorks, raiseBar } from '../sim/townworks';
import { allStudies, hasStudy, standsAt, studyBar, teacherOf } from '../sim/studies';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const costText = (cost: Partial<Record<string, number>>): string => STORE_KINDS.filter((k) => cost[k]).map((k) => `${cost[k]} ${k}`).join(', ');

/** A price in the town's stores, short enough for a button: 60 wood · 40 stone. */
const priceText = (cost: Partial<Record<string, number>>): string => STORE_KINDS.filter((k) => cost[k]).map((k) => `${cost[k]} ${k}`).join(' · ');

/**
 * The buildings a town can raise on its record, for one of the player's towns. `checks` gives a building's own rule
 * where it has one (the session that adds it passes it in, so this file lists none).
 */
export function raisePanel(c: Campaign, tid: number, checks: Record<string, (c: Campaign, tid: number) => string> = {}): string {
  let html = '';
  for (const type of mapWorks()) {
    if (begunAt(c, tid, type)) continue;
    const b = BUILDINGS[type], bar = raiseBar(c, 0, tid, type, checks[type]);
    html += `<button data-act="work:${type}" ${bar || c.phase !== 'player' ? 'disabled' : ''} title="${esc(bar || `${b.desc} ${costText(b.cost)}, from the town's own stores; its governor finishes it.`)}">${b.icon} Raise ${esc(b.name)} <small>${priceText(b.cost)}</small></button>`;
  }
  return html;
}

/** The studies taught at a building standing in the town. */
export function studyPanel(c: Campaign, tid: number): string {
  let html = '';
  for (const t of allStudies()) {
    const teacher = teacherOf(t.id);
    if (hasStudy(c, 0, t.id) || !teacher || !standsAt(c, tid, teacher) || (t.civ && t.civ !== c.factions[0].civ)) continue; // another people's own study is not offered (ownstudies.ts)
    const bar = studyBar(c, 0, t.id, tid);
    html += `<button data-act="study:${t.id}" ${bar || c.phase !== 'player' ? 'disabled' : ''} title="${esc(bar || `${t.desc} ${costText(t.cost)}, from this town first.`)}">${t.icon} Study ${esc(TECHS[t.id].name)} <small>${priceText(t.cost)}</small></button>`;
  }
  return html;
}

/** Both, as one list (for anything that still wants them together). */
export const worksPanel = (c: Campaign, tid: number, checks: Record<string, (c: Campaign, tid: number) => string> = {}): string => raisePanel(c, tid, checks) + studyPanel(c, tid);
