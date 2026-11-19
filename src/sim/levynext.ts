// Who would go from a town if a company were raised there now (docs/DESIGN.md, "A man at war is still of his house").
//
// On the map a town's men are counts, and a man is given his name and house only as he goes (warhouse.ts `enlist`: an
// unmarried son before a husband, a known woman's husband by his own name). So that the land's panel can say who a
// levy takes before it is raised, this asks that same rule of a copy of the town's record, as the town stands this
// season: the same men would go, unless something changes the town before the company is raised.
// Plain data: nothing on the campaign is changed.
import type { Campaign } from './campaign';
import { MEN, sparedMen } from './armytown';
import { enlist } from './warhouse';

/** The men a company raised in this town now would take from it, by name and house: as many as it can spare, at most a company's. */
export function nextLevy(c: Campaign, tid: number, n = MEN.company): { name: string; family: string; as: 'son' | 'husband' }[] {
  const t = c.territories[tid];
  if (!t?.folk) return [];
  const k = Math.min(n, sparedMen(c, tid));
  if (k <= 0) return [];
  const copy = { ...t, folk: structuredClone(t.folk) };
  copy.folk.men -= k; // as armytown.ts takes them off the count before they are put on a house's record
  delete copy.folk.ages;
  const cc = { ...c, territories: c.territories.map((x) => (x.id === tid ? copy : x)) } as Campaign;
  return enlist(cc, tid, k).map((m) => ({ name: m.name, family: m.family, as: m.as === 'husband' ? 'husband' : 'son' }));
}

/** The line for the land's panel: who a company raised here now would take. Empty where it would take nobody. */
export function levyLine(c: Campaign, tid: number): string {
  const men = nextLevy(c, tid);
  if (!men.length) return '';
  const named = men.slice(0, 3).map((m) => `${m.name} ${m.family}${m.as === 'husband' ? ' (a husband)' : ''}`);
  return `Would go: ${named.join(', ')}${men.length > 3 ? ` and ${men.length - 3} more` : ''}.`;
}
