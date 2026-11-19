// A town's people go by different given names where the town can (docs/PLAYTEST.md, "The new pieces together":
// namesakes, two Neds and two Josses among thirty villagers, beside the soldiers Ned Oakes and Joss Ironwood).
//
// A villager's name is drawn by lot as they come onto the field (game.ts spawnUnit), and the records the map keeps
// then name some of them (the known by name, the households and their men, the army's roll). Here the lot draws a
// name nobody of that people's own already has, where one is left (sixty a sex, data.ts); and once a battle is laid out, any
// villager still under the name the lot gave them who shares it with another of their people is given one nobody has.
// A name from a record is never changed. Only given names: a family name is a house's.
import { givenNames } from './peoplenames';
import type { Game, Gender, Unit } from './game';

declare module './game' {
  interface Unit { /** The name the lot gave this villager, while the battle is being laid out (namesakes.ts). */ drawn?: string }
}

const poolOf = (g: Game, owner: number, gender: Gender | null | undefined): readonly string[] => givenNames(g.players[owner]?.civ, gender); // its own people's names (peoplenames.ts)

/** The name the lot falls on (`roll` in 0..1), or the next one along nobody of `used` has; the lot's own if all are taken. */
export function pickName(pool: readonly string[], roll: number, used: ReadonlySet<string>): string {
  const at = Math.floor(roll * pool.length);
  for (let k = 0; k < pool.length; k++) { const n = pool[(at + k) % pool.length]; if (!used.has(n)) return n; }
  return pool[at];
}

/** The given names this people's villagers of a sex go by now. */
export const namesIn = (g: Game, owner: number, gender: Gender | null | undefined): Set<string> =>
  new Set(g.units.filter((u) => u.owner === owner && !u.dead && u.type === 'villager' && u.gender === gender).map((u) => u.name));

/** Once a battle is laid out: villagers still under their lot's name who share it are given ones nobody has, where any are left. */
export function unlikeNames(g: Game, owner: number): number {
  let changed = 0;
  // A tribe's people have names of their own, already no two alike (tribenames.ts).
  for (const gender of (g.setups[owner]?.tribe ? [] : ['m', 'f']) as Gender[]) {
    const folk = g.units.filter((u) => u.owner === owner && !u.dead && u.type === 'villager' && u.gender === gender);
    const seen = new Map<string, Unit[]>();
    for (const u of folk) (seen.get(u.name) ?? seen.set(u.name, []).get(u.name)!).push(u);
    // Everyone's name, soldiers' too: a villager is not named after a man of the roll on the field.
    const used = new Set(g.units.filter((u) => u.owner === owner && !u.dead && (u.type !== 'villager' || u.gender === gender)).map((u) => u.name));
    const pool = poolOf(g, owner, gender);
    for (const [name, list] of seen) {
      // Those named by a record keep it; of those the lot named, the first keeps it unless a record holds it too.
      const recorded = list.some((u) => u.drawn !== u.name) || g.units.some((u) => u.owner === owner && !u.dead && u.type !== 'villager' && u.name === name);
      const drawn = list.filter((u) => u.drawn === u.name);
      for (const u of drawn.slice(recorded ? 0 : 1)) {
        const free = pool.find((n) => !used.has(n));
        if (!free) break;
        u.name = free; used.add(free); changed++;
      }
    }
  }
  for (const u of g.units) if (u.owner === owner) delete u.drawn;
  return changed;
}
