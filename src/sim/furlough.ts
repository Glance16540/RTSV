/**
 * A soldier home inside one sitting (docs/DESIGN.md, "A man at war is still of his house").
 *
 * An army that stands in a town is partly that town's own men: each on the army's roll and on his house's record
 * as away (armytown.ts, warhouse.ts). In a battle for the town or a visit to it they were on the field only as
 * soldiers of the army, with no name; a man could not go home until the whole army was sent home from the map.
 * Here he can, while the player is there:
 *
 *   - `goHome`: a soldier of the army is one of the town's men away with it (the next on the list the map handed
 *     in, `Player.furlough`). He lays down his arms and is a villager of the town again, by his own name, of his
 *     own house and at his own age; the rest of his company (a company is a man of the town and his following)
 *     leave the field with him. He goes to his own door (leavehome.ts).
 *   - `rejoin`: a man home on leave takes up arms again: he is gone from the town's people and his company
 *     stands on the field as it did.
 *   - `homeNow`: who is home on leave as the sitting ends, for the map to write down (furloughmap.ts takes each
 *     off the army's roll and his house's record of the away, and the army is a company the fewer).
 *
 * This is the field's side and knows nothing of the map. Nothing here kills anybody: those who leave the field
 * are noted (`Game.leftField`) so that whoever counts the fallen does not count them.
 */
import type { Game, Unit } from './game';
import { SEASONS_A_YEAR, ageFor, yearsOf } from './ageing';
import { comeHome } from './leavehome';

/** A man of the town away with the army that stands in it. */
export interface AwayMan { name: string; family?: string; /** His age in seasons, as the army's roll keeps it. */ seasons: number }
/** What the map hands a side: its town's men with the army there, and how many soldiers of each kind make a company. */
export interface Furlough { men: AwayMan[]; per: Record<string, number> }
/** A man home on leave at the end of a sitting: who he is, and what his company was. */
export interface HomeMan extends AwayMan { as: string }

declare module './game' {
  interface Player { /** The town's own men with the army here who have not gone home (furlough.ts). */ furlough?: Furlough }
  interface Unit { /** A villager who is a soldier home on leave: what his company was, and how many soldiers it had on the field. */ onLeave?: { as: string; n: number } }
  interface Game { /** Units that left the field alive (a soldier gone home, a man gone back to his company): not fallen. */ leftField?: number[] }
}

const seasonsOf = (u: Unit): number => Math.round(yearsOf(u.age, u.lifespan) * SEASONS_A_YEAR);
/** Is this a soldier the army brought in, of a kind that makes up a company? (A townsman trained here has his own span of life, and is the town's already.) */
const ofArmy = (g: Game, u: Unit, owner: number): boolean => u.owner === owner && !u.dead && !u.hero && u.lifespan <= 0 && !u.inside && !!g.players[owner]?.furlough?.per[u.type];
const quit = (g: Game, u: Unit): void => { (g.leftField ??= []).push(u.id); u.enlisted = true; g.perish(u); };

/** May this soldier go home now? He is of the army, a man of the town is still with it, and the rest of his company is on the field. */
export function mayGoHome(g: Game, u: Unit): boolean {
  const f = g.players[u.owner]?.furlough;
  if (!f || !f.men.length || !ofArmy(g, u, u.owner)) return false;
  return g.units.filter((x) => x.type === u.type && ofArmy(g, x, u.owner)).length >= f.per[u.type];
}
/** Soldiers go home: each is the next of the town's men with the army, and his company leaves the field with him. Returns how many men went home. */
export function goHome(g: Game, owner: number, ids: number[]): number {
  const p = g.players[owner], f = p?.furlough;
  if (!f) return 0;
  let n = 0;
  for (const id of ids) {
    const u = g.entities.get(id);
    if (!u || u.kind !== 'unit' || u.dead || !mayGoHome(g, u)) continue;
    const per = f.per[u.type], man = f.men.shift()!;
    // The rest of his company: the nearest soldiers of his kind.
    const rest = g.units.filter((x) => x.id !== u.id && x.type === u.type && ofArmy(g, x, owner)).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y) || a.id - b.id).slice(0, per - 1);
    const { x, y, type } = u;
    for (const s of [u, ...rest]) quit(g, s);
    const v = g.spawnUnit('villager', owner, x, y, 'm');
    v.name = man.name; v.family = man.family ?? v.family;
    v.age = ageFor(man.seasons / SEASONS_A_YEAR, v.lifespan);
    v.onLeave = { as: type, n: per };
    comeHome(g, v); // to his own door, or an empty one (leavehome.ts)
    g.msg(owner, `${man.name}${man.family ? ` ${man.family}` : ''} has laid down his arms and gone home.`);
    n++;
  }
  return n;
}
/** May this villager take up arms again? He is a soldier home on leave. */
export const mayRejoin = (g: Game, u: Unit): boolean => !!u.onLeave && u.type === 'villager' && !u.dead && !u.inside && !u.captive && !!g.players[u.owner]?.furlough;
/** Men home on leave take up arms again: each is with the army once more, and his company stands on the field. Returns how many rejoined. */
export function rejoin(g: Game, owner: number, ids: number[]): number {
  const f = g.players[owner]?.furlough;
  if (!f) return 0;
  let n = 0;
  for (const id of ids) {
    const v = g.entities.get(id);
    if (!v || v.kind !== 'unit' || v.owner !== owner || !mayRejoin(g, v)) continue;
    const { as, n: per } = v.onLeave!, { x, y } = v;
    f.men.push({ name: v.name, ...(v.family ? { family: v.family } : {}), seasons: seasonsOf(v) });
    g.msg(owner, `${v.name}${v.family ? ` ${v.family}` : ''} has taken up his arms again.`);
    quit(g, v);
    for (let i = 0; i < per; i++) g.spawnUnit(as, owner, x + (i % 2) * 0.6, y + Math.floor(i / 2) * 0.6);
    n++;
  }
  return n;
}
/** Who is home on leave as things stand: for the map, when the sitting ends. */
export function homeNow(g: Game, owner: number): HomeMan[] {
  return g.units.filter((u) => u.owner === owner && !u.dead && u.type === 'villager' && !!u.onLeave)
    .map((u) => ({ name: u.name, ...(u.family ? { family: u.family } : {}), seasons: seasonsOf(u), as: u.onLeave!.as }));
}
