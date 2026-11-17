// The men the field saw fall are the map's dead (docs/PLAYTEST.md, "The new pieces together": the fallen by name).
//
// soldiernames.ts hands the map the men of the armies' rolls whose soldiers went down (`Campaign.downed`), and the
// map's count of an army's losses takes them first (armytown.ts reckonArmies, warhouse.ts fell). But that count is
// of companies: an army that won keeps at least its last company, a company's loss is shared out by town, and a share
// of its men come home hurt. So of three men the end card named, the map let one fall, sent one home hurt, and kept the
// third on the roll and in the army.
//
// Here, once the battle has been reckoned, any man the field saw fall who is still on his army's roll is taken off it
// as he is: he fell with the army, his house's loss like any other (warhouse.ts fell), counted for the season's report
// (ledger.ts), and his company, broken on the field, is struck from the army (one for every MEN.company men), though
// never its last. A man the reckoning already took, dead or home hurt, is left as it took him.
import type { Army, Campaign } from './campaign';
import { MEN } from './armytown';
import { tally } from './ledger';
import { fell } from './warhouse';

const sizeOf = (a: Army): number => Object.values(a.units).reduce((n, v) => n + v, 0);

/** Is this man still away with that army, on his house's record? */
function stillAway(c: Campaign, town: number, army: number, name: string, family: string): boolean {
  const houses = c.territories[town]?.folk?.houses;
  return !!houses?.some((h) => h.family === family && h.away?.some((s) => s.name === name && s.army === army));
}

/** Take off the rolls every man the field saw fall whom the reckoning left on them. Returns their names and houses. */
export function takeDowned(c: Campaign): string[] {
  const down = c.downed && c.downed.turn === c.turn ? c.downed.men : [];
  const out: string[] = [];
  const byArmy = new Map<number, number>();
  const byTown = new Map<string, { town: number; army: number; names: string[] }>();
  for (const m of down) {
    if (!stillAway(c, m.town, m.army, m.name, m.family)) continue; // the reckoning has him already
    const roll = c.musters?.[m.army];
    const ages = roll?.men[m.town];
    if (!roll || !ages?.length) continue;
    ages.splice(ages.indexOf(Math.max(...ages)), 1); // one man fewer on the roll (which of its ages is his is not kept)
    if (!ages.length) delete roll.men[m.town];
    const lost = fell(c, m.town, 1, 'fell with the army', m.army); // his house's loss: the man the field saw fall (soldiernames.ts downRank)
    for (const x of lost) {
      const k = `${m.town}:${m.army}`;
      (byTown.get(k) ?? byTown.set(k, { town: m.town, army: m.army, names: [] }).get(k)!).names.push(`${x.name} ${x.family}`);
      out.push(`${x.name} ${x.family}`);
    }
    byArmy.set(m.army, (byArmy.get(m.army) ?? 0) + 1);
  }
  for (const { town, names } of byTown.values()) {
    tally(c, town, 'fell', names.length); // for the season's report (ledger.ts)
    const t = c.territories[town];
    if (t?.owner === 0) c.log.push(`${names.length} more ${names.length === 1 ? 'man' : 'men'} of ${t.name} fell with the army, seen to fall on the field. ${names.length === 1 ? 'He was' : 'They were'} ${names.join(', ')}.`);
  }
  // Their companies were broken on the field: struck from the army, the largest kind first, never its last.
  for (const [id, men] of byArmy) {
    const a = c.armies.find((x) => x.id === id);
    if (!a) continue;
    for (let k = Math.ceil(men / Math.max(1, MEN.company)); k > 0 && sizeOf(a) > 1; k--) {
      const type = Object.keys(a.units).sort((x, y) => a.units[y] - a.units[x] || (x < y ? -1 : 1))[0];
      if (--a.units[type] <= 0) delete a.units[type];
    }
    const roll = c.musters?.[id];
    if (roll) roll.size = sizeOf(a);
  }
  return out;
}
