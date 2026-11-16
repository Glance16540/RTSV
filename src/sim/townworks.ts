// Buildings raised on the map (docs/DESIGN.md, "Buildings and research that answer the systems").
//
// The map's own sites (farm, barracks, church...) have their places on a land (campaignbase.ts SITES). A building
// that answers a system (a Hall of Judgement, a Granary, a Well...) is the town's instead: it stands on the town's
// record (`Territory.town.b`), as a house does, and is what a visit or a siege there loads. Any building marked
// `onMap` in BUILDINGS can be raised from the map: it is begun on the town's record at a free plot, paid out of the
// town's own stores, and the governor takes it further each season until it is finished (governor.ts), as he does
// a house. In the town itself it is built as any building is. Each session that adds such buildings marks them
// `onMap` in its own data.ts entries; nothing here lists them.
import type { Campaign } from './campaign';
import { BUILDINGS } from './data';
import { STORE_KINDS, folkOf, grown } from './township';
import { plotFor } from './governor';
import { ageOf } from './campaignbase';
import { standsAt } from './studies';
import { layTown } from './rivalrule';

/** The buildings that can be raised on the map. */
export const mapWorks = (): string[] => Object.values(BUILDINGS).filter((b) => b.onMap).map((b) => b.id);
/** Is one begun (or standing) on the town's record? */
export const begunAt = (c: Campaign, tid: number, type: string): boolean => !!c.territories[tid]?.town?.b?.some((x) => x[0] === type);
export { standsAt };

/** Why this building cannot be raised in this town now, or '' if it can. `check` adds a building's own rule (a size, a creed...). */
export function raiseBar(c: Campaign, f: number, tid: number, type: string, check?: (c: Campaign, tid: number) => string): string {
  const b = BUILDINGS[type], t = c.territories[tid];
  if (!b?.onMap) return 'It cannot be raised from the map.';
  if (!t || t.owner !== f || t.horde) return 'Only in a town of your own.';
  if (!t.town?.b?.length) layTown(c, tid); // a town not yet on record is laid down coarsely first, as the season would (rivalrule.ts)
  if (!t.town?.b?.length) return 'The town has no buildings on record to raise it beside.';
  if (begunAt(c, tid, type)) return `There is a ${b.name} there already.`;
  if (ageOf(c, f) < b.age) return 'It needs the nation in a later age.';
  if (b.townAt && grown(folkOf(c, tid)) < b.townAt) return `Only in a town of ${b.townAt} grown people or more.`;
  const own = check?.(c, tid);
  if (own) return own;
  const s = folkOf(c, tid).stores;
  if (STORE_KINDS.some((k) => (b.cost[k] ?? 0) > s[k])) return `It costs ${STORE_KINDS.filter((k) => b.cost[k]).map((k) => `${b.cost[k]} ${k}`).join(', ')} from the town's own stores.`;
  if (!plotFor(t, type)) return 'There is no room for it in the town.';
  return '';
}

/** Begin a building on the town's record, paid from its stores; the governor finishes it. Returns '' when begun, or why not. */
export function raiseWork(c: Campaign, f: number, tid: number, type: string, check?: (c: Campaign, tid: number) => string): string {
  const bar = raiseBar(c, f, tid, type, check);
  if (bar) return bar;
  const t = c.territories[tid], s = folkOf(c, tid).stores, b = BUILDINGS[type], at = plotFor(t, type)!;
  for (const k of STORE_KINDS) s[k] -= b.cost[k] ?? 0;
  t.town!.b.push([type, at.cx, at.cy, 0.01, 0]);
  if (f === 0) c.log.push(`A ${b.name} is begun at ${t.name}, out of the town's own stores; its governor will see it finished.`);
  return '';
}

/** Does any town of the nation have one standing? */
export const nationHas = (c: Campaign, f: number, type: string): boolean => c.territories.some((t) => t.owner === f && !t.horde && standsAt(c, t.id, type));
