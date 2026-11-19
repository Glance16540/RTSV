// Notable people: the few a nation knows by name. Nothing here decides who they are; it reads what the rules
// already mark (a leader, a soldier's kills, a house's renown) and says so in one place, for the figure's mark,
// the panel, the records and the town's list. How they are kept between seasons is another module's work: it can
// take `notables()` as it stands, or add its own to `extra` below.
import type { Building, Game, Unit } from './game';
import { CHAMPION_KILLS, canLead, rankForKills } from './champion';
import { RANK_NAMES } from './hero';

export interface Notable {
  /** The unit, where they are on the map. */
  id: number;
  name: string;
  kind: 'leader' | 'veteran' | 'matron';
  /** 1 to 3: how brightly they are marked. */
  rank: number;
  /** What they are known for, in a few words. */
  known: string;
}

/** Others' lists of the notable (those remembered from earlier seasons, say), added to a town's own. */
export const extra: ((g: Game, owner: number) => Notable[])[] = [];

const full = (u: Unit): string => (u.name || u.def.name) + (u.family ? ' ' + u.family : '');
const houseOf = (g: Game, u: Unit): Building | null => {
  const h = g.entities.get(u.homeId);
  return h && h.kind === 'building' && !h.dead ? h : null;
};

/** What this person is known for, or null for the ordinary run of people. */
export function notableOf(g: Game, u: Unit): Notable | null {
  if (u.dead) return null;
  if (u.hero) return { id: u.id, name: full(u), kind: 'leader', rank: 3, known: `${RANK_NAMES[u.hero.rank] ?? 'Leader'}, who leads this people` };
  const kills = u.kills ?? 0;
  if (g.isMilitary(u) && canLead(u.def.cls) && !u.merc && kills >= CHAMPION_KILLS) {
    const rank = Math.max(1, Math.min(3, rankForKills(kills)));
    return { id: u.id, name: full(u), kind: 'veteran', rank, known: `${u.def.name} who has felled ${kills}` };
  }
  if (u.type === 'villager' && u.gender === 'f') {
    const h = houseOf(g, u), renown = h && h.residents.f === u.id ? g.renown(h) : 0;
    if (h && renown > 0) return { id: u.id, name: full(u), kind: 'matron', rank: renown, known: `Mother of the ${h.family ? `${h.family} house` : 'house'}, which has raised ${h.children} ${h.children === 1 ? 'child' : 'children'}` };
  }
  return null;
}

/** A town's notable people, the best known first. */
export function notables(g: Game, owner: number): Notable[] {
  const own = g.units.filter((u) => u.owner === owner).map((u) => notableOf(g, u)).filter((n): n is Notable => !!n);
  const order = { leader: 0, veteran: 1, matron: 2 };
  return [...own, ...extra.flatMap((f) => f(g, owner))].sort((a, b) => order[a.kind] - order[b.kind] || b.rank - a.rank || a.id - b.id);
}
