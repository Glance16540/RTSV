/**
 * A man home on leave comes home to his own door (docs/DESIGN.md, "A man at war is still of his house"; open item 6
 * of the audit, from the gathering session).
 *
 * furlough.ts makes a soldier of the town a villager again by his own name. He used to stand homeless on the field
 * until the player moved him into a house. Now he goes to a door:
 *
 *   - the house of his record: a house of his family's name. Where it has no man he is its man and walks home to
 *     take his place (the field's own `movein` order, so he is seen to go). Where the field seated another man in
 *     his place under his name while he was away (household.ts settleHomes does, for a notable home), that man
 *     gives the place up and has a name of his own again.
 *   - where his family's house has its man, or the map's record has him as a son of it (`onLeave.tie`), he is of
 *     that house as its son (`bornAt`), and lives under no roof of his own, as an unmarried son does (household.ts).
 *     A son never takes the place of the man of the house, though that man be away with the army too.
 *   - where his house is gone, or he is of no house the field knows: an empty house, the nearest, if there is one.
 *     Never a house with a woman alone in it: that would marry him to her.
 *
 * Returns the house he goes to, or null when the town has no door for him: he is homeless then, as before.
 * The field's side only, and nothing here is random but the stand-in's new name.
 */
import { NAMES_M } from './data';
import type { Building, Game, Unit } from './game';

const housesOf = (g: Game, owner: number): Building[] => g.buildings.filter((b) => b.owner === owner && b.type === 'house' && b.complete && !b.dead);
const near = (v: Unit) => (a: Building, b: Building): number => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y) || a.id - b.id;

/** The door a man home on leave goes to, and what he is to it: his own house's man, its son, or the man of an empty one. */
export function doorOf(g: Game, v: Unit): { house: Building; as: 'husband' | 'son' | 'new' } | null {
  const houses = housesOf(g, v.owner).sort(near(v));
  const own = v.family ? houses.filter((h) => h.family === v.family) : [];
  const standIn = (h: Building): boolean => { const m = g.entities.get(h.residents.m); return !!m && m.kind === 'unit' && m.id !== v.id && m.name === v.name; };
  // A son of the house (the map's record says which he is) never takes its man's place, though the man be away himself:
  // the woman under that roof is his mother, or his brother's wife.
  const son = v.onLeave?.tie === 'son';
  const mine = son ? undefined : own.find((h) => !h.residents.m) ?? own.find(standIn);
  if (mine) return { house: mine, as: 'husband' };
  if (own.length) return { house: own[0], as: 'son' };
  const empty = houses.find((h) => !h.residents.m && !h.residents.f);
  return empty ? { house: empty, as: 'new' } : null;
}

/** Send a man home on leave to his door. Returns the house, or null if the town has none for him. */
export function comeHome(g: Game, v: Unit): Building | null {
  if (v.dead || v.type !== 'villager' || v.gender !== 'm' || v.homeId) return null;
  const door = doorOf(g, v);
  if (!door) return null;
  const { house, as } = door;
  if (as === 'son') { v.bornAt = house.id; return house; }
  // Another man seated in his place under his name gives it up, and is himself again.
  const m = g.entities.get(house.residents.m);
  if (m && m.kind === 'unit' && m.id !== v.id) {
    house.residents.m = 0; m.homeId = 0;
    const others = NAMES_M.filter((n) => n !== v.name);
    m.name = others[Math.floor(g.rng() * others.length)]; m.family = '';
  }
  g.setOrder(v, { t: 'movein', id: house.id, then: null });
  return house;
}
