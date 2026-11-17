// A veteran is of his own house (docs/DESIGN.md, "Armies belong to towns": "A veteran who comes home is one of its
// notable people"; "Notable people": "Their loss carries weight for the nation, not only for the town").
//
// The men of an army are each on the record of a house of their town, as away with it (warhouse.ts, `Folk.houses`).
// A soldier who made a name in a battle (the army's champion) is one of those men:
//   - he is the man of the army's roll who bears his name, if one does; else one of its men drawn by lot, who is
//     known by the veteran's name from then on (the roll had only a name for him, the battle has his deeds);
//   - he is a notable person of that man's town, of that man's house (`Notable.family`): his town is the one his house
//     is in, whichever town's men the army mostly is;
//   - should he fall with the army on the map (warhouse.ts `fell`, by lot), the town has lost a known person: his
//     record is marked lost, and the town grieves and drifts by his weight (notableweight.ts, drift.ts).
// An army with nobody on its roll (a campaign saved before the rolls) leaves the town to campaign.ts's older reckoning.
// Plain data: it reads and writes the town's record and imports nothing of warhouse.ts or armytown.ts.
import type { Campaign } from './campaign';
import type { Folk, Notable } from './township';

/** A man of a house away with an army, as warhouse.ts keeps him: only what is read here. */
interface Away { name: string; army?: number }
interface House { family: string; away?: Away[] }

const housesIn = (f: Folk | undefined): House[] => (f && Array.isArray((f as { houses?: unknown }).houses) ? (f as { houses: House[] }).houses : []);

const lot = (seed: number, a: number, b: number): number => {
  let h = (Math.imul(seed ^ 0x5bd1e995, 0x9e3779b1) ^ Math.imul(a + 0x27d4eb2f, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/**
 * The town and house a veteran of this army is of: the man of its roll who bears his name, else one drawn by lot
 * (who takes his name). Undefined where the army has nobody of this nation's towns on its roll.
 */
export function veteranHome(c: Campaign, owner: number, army: number, name: string): { town: number; family: string } | undefined {
  const men: { town: number; house: House; man: Away }[] = [];
  for (const t of c.territories) {
    if (t.owner !== owner || t.horde) continue;
    for (const house of housesIn(t.folk)) for (const man of house.away ?? []) if (man.army === army) men.push({ town: t.id, house, man });
  }
  if (!men.length) return undefined;
  const his = men.find((m) => m.man.name === name)
    ?? men.map((m, i) => ({ m, k: lot(c.seed, army * 131 + i, c.turn) })).sort((a, b) => a.k - b.k)[0].m;
  his.man.name = name;
  return { town: his.town, family: his.house.family };
}

/** Men of this town have fallen with an army: any of them who was a known veteran of it is lost, and weighs as such. */
export function veteransFell(c: Campaign, tid: number, fallen: readonly { name: string; family: string }[], how = 'fell with the army'): Notable[] {
  const f = c.territories[tid]?.folk, out: Notable[] = [];
  if (!f) return out;
  for (const m of fallen) {
    const n = f.notables.find((x) => x.kind === 'veteran' && !x.lost && x.name === m.name && (x.family === undefined || x.family === m.family) && (x.kills ?? 0) > 0);
    if (!n) continue;
    n.lost = { turn: c.turn, how };
    out.push(n);
    // Listed already as his house's loss (warhouse.ts, a house the nation knows): he is lost once, as the veteran he was.
    f.notables = f.notables.filter((x) => x === n || !(x.lost?.turn === c.turn && x.name === n.name && !x.kills));
    if (c.territories[tid].owner === 0) c.log.push(`${n.name} of ${c.territories[tid].name}, who ${n.deed}, ${how}.`);
  }
  return out;
}
