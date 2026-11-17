// The governor's standing orders on the land's panel: a line saying them in words, and "Give the governor orders",
// which opens the four orders, each with its choices told in words. The rules are in src/sim/townorders.ts.
import type { Campaign } from '../sim/campaign';
import { BUILDINGS } from '../sim/data';
import { SITES } from '../sim/campaignbase';
import { FOCI, FOCUS, KEEP_WORDS, LEAVE_WORDS, NEVER_CHOICES, standingOf, standingText } from '../sim/townorders';
import type { Focus, KeepLevel, Leave } from '../sim/townorders';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
/** A building's name, whether it stands on the land (SITES) or on the town's record (BUILDINGS). */
export const workName = (type: string): string => (SITES as Record<string, { name: string }>)[type]?.name ?? BUILDINGS[type]?.name ?? type;

/** The orders in words, and the button that opens them, for one of the player's towns. */
export function standingPanel(c: Campaign, tid: number): string {
  const t = c.territories[tid];
  if (!t || t.owner !== 0) return '';
  return `<div class="hint">${esc(standingText(t, workName))}</div><button data-act="standing:${tid}" ${c.phase !== 'player' ? 'disabled' : ''}>🏛️ Give the governor orders</button>`;
}

/** One choice in a dialog: its label, a line saying what it does, and the order it gives. */
export interface Choice { label: string; says: string; order: Parameters<typeof import('../sim/townorders').setStanding>[2] }
/** The four orders, as the dialog's rows: each a label saying where it stands now, and its choices. */
export function standingRows(c: Campaign, tid: number): { label: string; choices: Choice[] }[] {
  const s = standingOf(c.territories[tid]);
  const never = s.never ?? [];
  return [
    { label: `Put first: ${s.first ? FOCUS[s.first].name : 'his own sense'}`, choices: [
      { label: 'His own sense', says: 'Bread when short, a roof for couples, a wall after a raid: nothing put first.', order: { first: null } },
      ...FOCI.map((f: Focus): Choice => ({ label: FOCUS[f].name, says: `${FOCUS[f].says[0].toUpperCase()}${FOCUS[f].says.slice(1)}.`, order: { first: f } })),
    ] },
    { label: `Not to build: ${never.length ? never.map(workName).join(', ') : 'nothing barred'}`, choices: [
      { label: 'Nothing barred', says: 'He may raise whatever the town wants.', order: { never: [] } },
      ...NEVER_CHOICES.map((type): Choice => ({ label: `${never.includes(type) ? 'Allow' : 'Never build'} ${workName(type)}`, says: never.includes(type) ? 'He may raise it again when the town wants it.' : 'He will not raise it, whatever the town wants.', order: { never: never.includes(type) ? never.filter((x) => x !== type) : [...never, type] } })),
    ] },
    { label: `Keep in store: ${(s.keep ?? 'usual') === 'usual' ? 'the usual stock' : s.keep}`, choices: (['little', 'usual', 'much'] as KeepLevel[]).map((k): Choice => ({ label: k === 'usual' ? 'The usual' : k[0].toUpperCase() + k.slice(1), says: `${KEEP_WORDS[k][0].toUpperCase()}${KEEP_WORDS[k].slice(1)}.`, order: { keep: k } })) },
    { label: `Its people leaving: ${LEAVE_WORDS[s.leave ?? 'both']}`, choices: (['both', 'families', 'settlers', 'none'] as Leave[]).map((l): Choice => ({ label: l === 'both' ? 'Families and settlers' : l === 'families' ? 'Families only' : l === 'settlers' ? 'Settlers only' : 'Nobody', says: `${LEAVE_WORDS[l][0].toUpperCase()}${LEAVE_WORDS[l].slice(1)}.`, order: { leave: l } })) },
  ];
}
