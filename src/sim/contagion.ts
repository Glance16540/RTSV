// Plague that comes from outside a town.
//
// Until now a plague stayed inside the people it began in: it passed only between a people's own. Here it crosses:
//
//   Carried by an army. Once a second, anyone standing within CONTAGION.reach of a plagued stranger (friend or
//     foe, another people's) may catch it: CONTAGION.touch for an ordinary people, more for the worldly, less for
//     the devout, a third as readily for the Righteous. So an army sick with plague brings it into the town it attacks, and a
//     Prophet's plague can come home on the swords of those who close with its victims.
//   Off a ship. In the hold of a transport one sick passenger gives it to the rest far faster
//     (CONTAGION.hold a second each): a ship with plague aboard lands a sick company.
//   With trade. What is bought at a Market comes from somewhere else. Each purchase carries a CONTAGION.trade
//     chance, by the same measure of creed, of plague breaking out round the Market; never twice within three
//     minutes, like the tavern's.
//
// Decided without the game's dice, like the rest of the calamities.
import type { Building, Game, Player, Unit } from './game';
import { roll } from './calamity';

export const CONTAGION = {
  /** How near a plagued stranger must stand, in tiles, and the chance each second of catching it from them. */
  reach: 1.3, touch: 0.12,
  /** What is caught lasts this share of what the carrier has left, and never less than `least` seconds. */
  share: 0.8, least: 6,
  /** The chance each second of catching it from a fellow passenger aboard ship. */
  hold: 0.3,
  /** The chance that a purchase at a Market brings plague; how far round the Market it strikes; seconds it lasts. */
  trade: 0.01, market: 6, sick: 12,
  /** Seconds between one telling a people that plague has come among them from outside and the next. */
  told: 90,
};

const told = new WeakMap<Player, number>();
const live = (u: Unit): boolean => !u.dead && !u.def.naval && u.owner >= 0;

function warn(g: Game, to: number, text: string): void {
  const p = g.players[to];
  if (!p || p.neutral || to === g.wild) return;
  const last = told.get(p);
  if (last !== undefined && g.time - last < CONTAGION.told && g.time >= last) return;
  told.set(p, g.time);
  g.events.push({ t: 'msg', player: to, text });
}

/** How readily this people takes a plague: a third for the Righteous, 1 for an ordinary town, more for the worldly; never the wild. */
export const prone = (g: Game, owner: number): number => (owner === g.wild || !g.players[owner] || g.players[owner].neutral ? 0 : g.creed(owner).plague);

/** One second of plague passing between peoples, on land and in the holds of ships. Returns how many caught it. */
export function contagion(g: Game): number {
  const sick = g.units.filter((u) => live(u) && u.plagueT > 0);
  if (!sick.length) return 0;
  let caught = 0;
  for (const u of sick) {
    if (u.inside) {
      const ship = g.entities.get(u.inside);
      if (!ship || ship.kind !== 'unit' || !ship.cargo) continue;
      for (const id of ship.cargo) {
        const v = g.entities.get(id);
        if (!v || v.kind !== 'unit' || v === u || v.dead || v.plagueT > 0) continue;
        if (roll(g, u.id * 4099 + v.id) >= CONTAGION.hold * prone(g, v.owner)) continue;
        v.plagueT = Math.max(CONTAGION.least, u.plagueT * CONTAGION.share);
        caught++;
        warn(g, v.owner, '☠️ There is plague aboard your ship: everyone in the hold is taking it.');
      }
      continue;
    }
    for (const v of g.units) {
      if (v.owner === u.owner || v.plagueT > 0 || v.inside || !live(v)) continue;
      if (Math.abs(v.x - u.x) > CONTAGION.reach || Math.hypot(v.x - u.x, v.y - u.y) > CONTAGION.reach) continue;
      if (roll(g, u.id * 4099 + v.id) >= CONTAGION.touch * prone(g, v.owner)) continue;
      v.plagueT = Math.max(CONTAGION.least, u.plagueT * CONTAGION.share);
      caught++;
      const from = g.players[u.owner];
      warn(g, v.owner, `☠️ Plague has come among your people${from && !from.neutral && u.owner !== g.wild ? ` from ${from.name}'s` : ''}: keep the sick away from the town.`);
    }
  }
  return caught;
}

/** A purchase has just been made at this Market: it may have brought plague with it. Returns whether it did. */
export function boughtIn(g: Game, market: Building, force = false): boolean {
  const p = g.players[market.owner];
  const k = prone(g, market.owner);
  if (!p || k <= 0 || g.time - p.plagueAt < 180) return false;
  if (!force && roll(g, market.id * 613 + Math.floor(p.res.gold)) >= CONTAGION.trade * k) return false;
  let struck = 0;
  for (const u of g.units) {
    if (u.owner !== p.id || u.inside || !live(u) || Math.hypot(u.x - market.x, u.y - market.y) > CONTAGION.market) continue;
    u.plagueT = CONTAGION.sick * k;
    struck++;
  }
  if (!struck) return false;
  p.plagueAt = g.time;
  g.events.push({ t: 'plague', x: market.x, y: market.y });
  g.events.push({ t: 'msg', player: p.id, text: '☠️ Something came in with the goods: plague has broken out at the Market!' });
  return true;
}
