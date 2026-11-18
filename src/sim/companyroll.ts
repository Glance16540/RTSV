// Each man of an army's roll is of a company (docs/DESIGN.md, "A man at war is still of his house": the men of the
// companies lost are the dead; what an army fells is counted to the men who stood, the owner's word, 18 November 2026).
//
// An army is so many companies of each kind (`Army.units`: infantry, archers, cavalry), and its roll is so many men of
// named houses of their towns (armytown.ts `Campaign.musters`, warhouse.ts `Serving`). Here each man of the roll is of
// a kind of company (`Serving.kind`), the army's companies shared out among its men by their kinds, those longest with
// it keeping theirs and every kind of each of its towns in the share that town has with it (`levelKinds`, asked again
// whenever it is needed, so armies that join or part need nothing more).
//
// A battle fought out on the map (mapbattle.ts) loses so many companies of each kind on each side. As it is counted,
// that is noted on the army's roll (`noteLost`). Then:
//   - the dead: the men of the companies lost are the ones who fall, of their kind, those last raised first
//     (armytown.ts reckonArmies asks `lostIn` for each town, warhouse.ts fell asks `lostRank` for each man), before
//     any lot;
//   - what the army felled is counted to the houses of the men of the companies that stood, each by the weight of
//     his company's kind (COMPANIES `str`: a horseman twice a footman), not to all its men by lot alike
//     (warhouse.ts creditArmy asks `standWeight`).
// A battle fought in person is not noted here: there the field itself says who went down (soldiernames.ts).
// Plain data: it reads the rolls and the houses' records as they stand, and writes only `Serving.kind` and the note.
import type { Campaign } from './campaign';
import { COMPANIES } from './campaignbase';
import type { Serving, WarHouse } from './warhouse';

declare module './warhouse' {
  interface Serving {
    /** The kind of company he stands in with his army (companyroll.ts). */
    kind?: string;
  }
}
declare module './armytown' {
  interface Muster {
    /** The companies of each kind this army lost in the battle on the map just counted, and the turn (companyroll.ts). */
    lostNow?: { turn: number; kinds: Record<string, number> };
  }
}

interface RollMan { tid: number; house: WarHouse; man: Serving }

const housesIn = (c: Campaign, tid: number): WarHouse[] => {
  const h = (c.territories[tid]?.folk as { houses?: unknown } | undefined)?.houses;
  return Array.isArray(h) ? (h as WarHouse[]) : [];
};
/** Every man of this army's roll, on his house's record, those longest with it first. */
function rollOf(c: Campaign, armyId: number): RollMan[] {
  const out: RollMan[] = [];
  for (const tid of Object.keys(c.musters?.[armyId]?.men ?? {}).map(Number)) {
    for (const house of housesIn(c, tid)) for (const man of house.away ?? []) if (man.army === armyId) out.push({ tid, house, man });
  }
  return out.sort((p, q) => p.man.since - q.man.since || p.house.family.localeCompare(q.house.family) || p.man.name.localeCompare(q.man.name));
}

/**
 * Share the army's companies out among the men of its roll by kind: as many men of each kind as its companies of that
 * kind take, each kind of every town in the share that town has with the army, those who have a kind keeping it.
 * Returns the roll, each man with his kind.
 */
export function levelKinds(c: Campaign, armyId: number): RollMan[] {
  const a = c.armies.find((x) => x.id === armyId), roll = rollOf(c, armyId);
  if (!a || !roll.length) return roll;
  const kinds = Object.keys(a.units).filter((k) => a.units[k] > 0).sort();
  const companies = kinds.reduce((n, k) => n + a.units[k], 0);
  if (!companies) return roll;
  // How many men stand in each kind: its share of the companies, the whole roll shared out.
  const want: Record<string, number> = {};
  let given = 0;
  for (const k of kinds) { want[k] = Math.floor((roll.length * a.units[k]) / companies); given += want[k]; }
  for (const k of [...kinds].sort((p, q) => a.units[q] - a.units[p] || p.localeCompare(q))) { if (given >= roll.length) break; want[k]++; given++; }
  const loose: RollMan[] = [];
  // Each kind's men are taken across the army's towns in the share each town has with it: the roll is laid out with
  // the towns interleaved, each town's men spread evenly through it, those longest with the army first. Shared out
  // longest-first alone, a kind was mostly of the town that raised it, and a company lost took nearly all its dead
  // from that one town (at 384 campaigns the rivals then won 108 and 113 against 99 and 90).
  const count: Record<number, number> = {}, seen: Record<number, number> = {};
  for (const r of roll) count[r.tid] = (count[r.tid] ?? 0) + 1;
  const spread = roll.map((r) => { const k = (seen[r.tid] = (seen[r.tid] ?? 0) + 1); return { r, at: (k - 0.5) / count[r.tid] }; })
    .sort((p, q) => p.at - q.at || p.r.tid - q.r.tid).map((x) => x.r);
  for (const r of spread) {
    if (r.man.kind && (want[r.man.kind] ?? 0) > 0) want[r.man.kind]--;
    else loose.push(r);
  }
  // Those without a kind take one in turn, so each kind is of every town in its share.
  let turn = 0;
  for (const r of loose) {
    let k: string | undefined;
    for (let j = 0; j < kinds.length && !k; j++) { const x = kinds[(turn + j) % kinds.length]; if (want[x] > 0) k = x; }
    turn++;
    if (k) { r.man.kind = k; want[k]--; } else delete r.man.kind;
  }
  return roll;
}

/** A battle on the map has been fought: note what companies of each kind this army lost in it. */
export function noteLost(c: Campaign, armyId: number | undefined, lost: Record<string, number> | undefined): void {
  const m = armyId === undefined ? undefined : c.musters?.[armyId];
  if (!m) return;
  const kinds: Record<string, number> = {};
  for (const [k, n] of Object.entries(lost ?? {})) if (n > 0) kinds[k] = Math.round(n);
  if (Object.keys(kinds).length) { levelKinds(c, armyId!); m.lostNow = { turn: c.turn, kinds }; } else delete m.lostNow;
}

/**
 * The men of the companies this army lost in the battle on the map just counted: of each kind lost, those last raised.
 * The kinds are as they were shared out when the loss was noted, before the companies were struck off the army: they
 * are not shared out again here.
 */
function lostMen(c: Campaign, armyId: number | undefined): RollMan[] {
  const m = armyId === undefined ? undefined : c.musters?.[armyId], note = m?.lostNow;
  if (!m || !note || note.turn !== c.turn) return [];
  const roll = rollOf(c, armyId!), per = Math.max(1, Math.round(roll.length / Math.max(1, m.size))); // men a company, as the roll stood before
  const out: RollMan[] = [];
  for (const [k, n] of Object.entries(note.kinds)) {
    const of = roll.filter((r) => r.man.kind === k).sort((p, q) => q.man.since - p.man.since || p.house.family.localeCompare(q.house.family) || p.man.name.localeCompare(q.man.name));
    out.push(...of.slice(0, n * per));
  }
  return out;
}

/** How many men of this town are of the companies the army lost on the map just now (armytown.ts takes these first). */
export const lostIn = (c: Campaign, armyId: number, tid: number): number => lostMen(c, armyId).filter((r) => r.tid === tid).length;
/** 0 for a man of a company the army lost on the map just now, 1 for anyone else (warhouse.ts fell takes the 0s first). */
export const lostRank = (c: Campaign, armyId: number | undefined, family: string, name: string): number =>
  lostMen(c, armyId).some((r) => r.house.family === family && r.man.name === name) ? 0 : 1;
/**
 * How much of what this army felled falls to this man: nothing to a man of a company it lost on the map just now, the
 * weight of his company's kind to one who stood (1 where his kind is not known). The kinds are shared out first.
 */
export function standWeight(c: Campaign, armyId: number, man: Serving, family: string): number {
  if (lostRank(c, armyId, family, man.name) === 0) return 0;
  return man.kind ? COMPANIES[man.kind]?.str ?? 1 : 1;
}
