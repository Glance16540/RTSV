/**
 * A man at war is still of his house (docs/DESIGN.md).
 * When training takes a husband out of his house (muster.ts), the house keeps his place: nobody else is moved in,
 * and he is struck from it only when he dies or is taken. A son with no house of his own stays on the record of the
 * house he was born in. What a man wins in war (the foes he fells) is counted to that house and raises its renown
 * as children raised do. His absence is felt: he works no field, and the house begins no child while he is away.
 * The same holds for a woman of the house who goes to serve as a healer.
 *
 * Decided here, and open to the owner's word:
 * - A house that falls while he is away: its record falls with it. He keeps his family's name, belongs to no
 *   house until he is home, and what he wins meanwhile is counted to no house.
 * - An unmarried son: he is of the house he was born in while it stands, and his kills count to it. He never
 *   lived there as its man, so when he comes home he is unhoused as he was, and may found a house of his own.
 */
import type { Building, Game, Unit } from './game';

/** Foes a house's people must fell in war for one rank of renown (as many as make a soldier's name). */
export const WAR_RENOWN = 3;
export type Tie = 'husband' | 'wife' | 'son';
export interface Away { unit: Unit; as: Tie }

/** One of the town's own people under arms or serving: a soldier who was a villager (he keeps the span of his life). */
export const serving = (u: Unit): boolean => u.type !== 'villager' && u.lifespan > 0 && !u.dead;
const houseAt = (g: Game, id: number, owner: number): Building | null => {
  const b = id ? g.entities.get(id) : undefined;
  return b && b.kind === 'building' && b.type === 'house' && !b.dead && b.owner === owner ? b : null;
};
/** The house a person away serving belongs to, and how: the house whose man (or woman) they are, or failing that the one they were born in. */
export function houseOfServing(g: Game, u: Unit): { house: Building; as: Tie } | null {
  if (!serving(u)) return null;
  const home = houseAt(g, u.homeId, u.owner);
  if (home && home.residents.m === u.id) return { house: home, as: 'husband' };
  if (home && home.residents.f === u.id) return { house: home, as: 'wife' };
  const born = u.homeId ? null : houseAt(g, u.bornAt, u.owner);
  return born && u.gender !== 'f' ? { house: born, as: 'son' } : null;
}
/** Those of a house who are away serving: its man or woman, and the sons born under its roof. */
export function awayOf(g: Game, house: Building): Away[] {
  const out: Away[] = [];
  for (const u of g.units) { const h = u.owner === house.owner ? houseOfServing(g, u) : null; if (h && h.house === house) out.push({ unit: u, as: h.as }); }
  return out.sort((a, b) => Number(a.as === 'son') - Number(b.as === 'son') || a.unit.id - b.unit.id);
}
/** Is the man or the woman of this house away serving? It begins no child until both are home. */
export const coupleParted = (g: Game, house: Building): boolean =>
  [house.residents.m, house.residents.f].some((id) => { const u = id ? g.entities.get(id) : undefined; return !!u && u.kind === 'unit' && serving(u); });

/**
 * Training has turned a villager into a soldier. The villager he was is gone from the map, which emptied his place
 * in his house: it is given back to him as he now is. The roof he was born under goes with him too.
 */
export function leaveForWar(g: Game, was: Unit, now: Unit): void {
  now.bornAt = was.bornAt;
  const home = houseAt(g, was.homeId, was.owner), side = was.gender === 'f' ? 'f' : 'm';
  if (!home || home.residents[side]) return; // he had no house, or his place has already been given away
  home.residents[side] = now.id;
  now.homeId = home.id;
}
/** A soldier of the town has felled a foe: it is counted to his house, if he has one. */
export function creditKill(g: Game, killer: Unit): void {
  const h = houseOfServing(g, killer);
  if (h) h.house.warKills = (h.house.warKills ?? 0) + 1;
}
/** The renown a house has by what its people have won in war: a rank for every few foes felled. */
export const warRenown = (house: { warKills?: number }): number => Math.floor(Math.max(0, house.warKills ?? 0) / WAR_RENOWN);

/** A house the nation knows, as a town's record keeps it between seasons: its woman by name, her man, and what its people have won. */
export interface HomeRecord { name: string; family?: string; kids?: number; husband?: string; war?: number }
/** What a town's record should keep of the house this woman is the woman of. */
export function homeRecord(g: Game, woman: Unit): { husband?: string; war?: number } {
  const home = houseAt(g, woman.homeId, woman.owner);
  if (!home || home.residents.f !== woman.id) return {};
  const man = home.residents.m ? g.entities.get(home.residents.m) : undefined;
  return { ...(man && man.kind === 'unit' && !man.dead && man.name ? { husband: man.name } : {}), ...(home.warKills ? { war: home.warKills } : {}) };
}
/**
 * A town turns out for a battle or a visit: the houses the nation knows are as the record left them. Each named
 * woman is back under a roof of the town with her man (by his own name) beside her, the children she has raised
 * and what her house has won to its name. Returns how many houses were settled so.
 */
export function settleHomes(g: Game, owner: number, homes: HomeRecord[]): number {
  let done = 0;
  const free = g.buildings.filter((b) => b.owner === owner && b.type === 'house' && b.complete && !b.dead && !b.residents.m && !b.residents.f).sort((a, b) => a.id - b.id);
  const folk = g.units.filter((u) => u.owner === owner && u.type === 'villager' && !u.dead);
  const taken = new Set(homes.map((h) => h.name).concat(homes.map((h) => h.husband ?? '')));
  for (const h of homes) {
    const her = folk.find((u) => u.gender === 'f' && u.name === h.name && !u.homeId);
    if (!her) continue;
    let him: Unit | undefined;
    if (h.husband) {
      him = folk.find((u) => u.gender === 'm' && u.name === h.husband && !u.homeId) ?? folk.find((u) => u.gender === 'm' && !u.homeId && !taken.has(u.name) && !(u.kids ?? 0));
      if (him) { him.name = h.husband.slice(0, 40); if (h.family) him.family = h.family.slice(0, 40); taken.add(him.name); }
    }
    const house = free.shift();
    if (!house) continue; // the town has no roof for them: they are known by name all the same
    house.residents.f = her.id; her.homeId = house.id;
    if (him) { house.residents.m = him.id; him.homeId = house.id; }
    house.family = (h.family ?? her.family ?? '').slice(0, 40);
    house.children = Math.max(0, Math.round(Number(h.kids) || 0));
    house.warKills = Math.max(0, Math.round(Number(h.war) || 0));
    done++;
  }
  return done;
}
