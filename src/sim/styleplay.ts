/**
 * The computer plays to its people's rule (docs/DESIGN.md play styles; data.ts `STYLES`, `STYLE_RULES`).
 *
 * Every play style has a rule nobody else has, and the battle's computer player (ai.ts) used to play every people
 * alike: a farmer's fields were only for food, a trader kept one market, the Faithful's wounded stood where they
 * were hurt. Here each rule shapes what its people build and do, as plain answers ai.ts asks for:
 *
 *   - `styleWork`: a building the people's rule makes worth raising now, ahead of the common order of building.
 *     Traders raise a market as soon as they may, and then up to the three that earn (`caravanMarkets`). The
 *     Faithful raise their church (the Temple) as soon as their Range stands, ahead of the stable, the smith and
 *     the market. (Before the Range it cost them the game: in 36 computer games against the six other styles
 *     they won none and lost seven, with half the bowmen at fifteen minutes, where without it they won six and
 *     lost three.) Builders, whose works mend themselves, raise more towers than others do (`STYLE_PLAY.towers`).
 *   - `roomWork`: what to raise when the town is short of room. A farmer's farm makes room for a villager
 *     (`farmPop`, up to `farmPopMax`), and feeds one besides, so farmers raise a farm where others raise a house,
 *     while a farm still adds room and they have houses enough for their couples.
 *   - `studyReserve`: what is kept back in the stores when a technology is bought. Every technology makes a
 *     scholar's villagers gather faster (`lore`), so scholars keep nothing back and learn as soon as they can pay.
 *   - `fallBack`: soldiers the rule tells to leave the fight, and where to. The Faithful's hurt go to their
 *     nearest church, where they are healed (`sanctuary`), and come back whole. A warrior people's veterans strike
 *     harder for every foe felled (`veteran`), so a veteran badly hurt is sent home rather than spent.
 *
 *   - `fightStyle`: how the rule shapes the war itself. Builders sit out a siege: while the town has been struck
 *     lately and its works are still hurt, they do not march, for their walls are mending behind them. Scholars
 *     time an attack to an age: they do not march while the next age is being reached, and with an age in hand
 *     over their nearest foe they march without waiting to outweigh him. Warriors field fewer and better men:
 *     a smaller army (`STYLE_FIGHT.warriors`), and none of yesterday's soldiers in it.
 *
 * Raiders already play to theirs (ai.ts `raiding`, `slaving`). Nothing here gives an order: ai.ts does, by these.
 */
import type { Building, Game, Unit } from './game';
import { BUILDINGS, STYLE_RULES } from './data';

export const STYLE_PLAY = {
  /** Builders: towers kept, where the common order keeps two. */
  towers: 4,
  /** Traders: villagers a town has before it raises a second and a third market. */
  marketHands: 12,
  /** Farmers: a farm is raised for room only while the town has this many houses for each ten villagers. */
  houses: 3,
  /** The Faithful: a soldier under this share of his health goes to the church, and stays until he is over `whole`. */
  hurt: 0.5, whole: 0.9,
  /** And only if a church stands within this many tiles of him. */
  reach: 45,
  /** Warriors: a soldier with this many kills is a veteran, and under this share of his health he is sent home. */
  kills: 2, spent: 0.35,
};

/** What ai.ts has counted already when it asks. */
export interface StyleTown { villagers: number; age: number; peace: boolean; count: (type: string) => number }

const can = (g: Game, pid: number, type: string): boolean => !!BUILDINGS[type] && g.ageFor(pid, BUILDINGS[type]) <= g.players[pid].age && !g.creedBar(pid, BUILDINGS[type]) && g.canAfford(g.players[pid], BUILDINGS[type].cost);

/** A building this people's rule makes worth raising now, ahead of the common order: or null. */
export function styleWork(g: Game, pid: number, s: StyleTown): string | null {
  const style = g.style(pid);
  if (style === 'faithful') return s.count('temple') === 0 && s.count('range') > 0 && can(g, pid, 'temple') ? 'temple' : null; // not before its archers: see the header
  if (style === 'trader') return s.count('market') < STYLE_RULES.caravanMarkets && (s.count('market') === 0 || s.villagers >= STYLE_PLAY.marketHands) && can(g, pid, 'market') ? 'market' : null;
  if (style === 'builder') return !s.peace && s.count('tower') >= 2 && s.count('tower') < STYLE_PLAY.towers && can(g, pid, 'tower') ? 'tower' : null;
  return null;
}

/** What to raise when the town is short of room: a farm for a farmer whose farms still make room, else a house. */
export function roomWork(g: Game, pid: number, s: StyleTown): 'farm' | 'house' {
  if (g.style(pid) !== 'farmer') return 'house';
  const farms = s.count('farm');
  if (farms * STYLE_RULES.farmPop >= STYLE_RULES.farmPopMax) return 'house';
  return s.count('house') * 10 >= s.villagers * STYLE_PLAY.houses && can(g, pid, 'farm') ? 'farm' : 'house';
}

/** What is kept back in the stores when a technology is bought: scholars keep nothing back. */
export const studyReserve = (g: Game, pid: number): { food: number; wood: number } => (g.style(pid) === 'scholar' ? { food: 0, wood: 0 } : { food: 150, wood: 100 });

/** Soldiers this people's rule tells to leave the fight, and where each party goes. */
export function fallBack(g: Game, pid: number, army: Unit[], mine: Building[], home: { x: number; y: number }): { ids: number[]; x: number; y: number }[] {
  const style = g.style(pid), P = STYLE_PLAY;
  const share = (u: Unit): number => u.hp / Math.max(1, u.maxHp);
  if (style === 'faithful') {
    const churches = mine.filter((b) => b.type === 'temple' && b.complete);
    const by = new Map<Building, number[]>();
    for (const u of army) {
      if (u.dead || u.inside || u.def.atk <= 0) continue;
      const near = churches.map((b) => ({ b, d: Math.hypot(u.x - b.x, u.y - b.y) })).sort((a, b) => a.d - b.d)[0];
      if (!near || near.d > P.reach) continue;
      const resting = near.d <= STYLE_RULES.sanctuary;
      if (share(u) < (resting ? P.whole : P.hurt)) by.set(near.b, [...(by.get(near.b) ?? []), u.id]); // once there he stays until he is whole
    }
    return [...by].map(([b, ids]) => ({ ids, x: b.x, y: b.y }));
  }
  if (style === 'warrior') {
    const ids = army.filter((u) => !u.dead && !u.inside && u.def.atk > 0 && (u.kills ?? 0) >= P.kills && share(u) < P.spent).map((u) => u.id);
    return ids.length ? [{ ids, x: home.x, y: home.y }] : [];
  }
  return [];
}

export const STYLE_FIGHT = {
  /** Builders: seconds after the town was last struck in which they stay behind their walls, while any work of theirs is under this share of its health. */
  siege: 120, hurt: 0.8,
  /** Warriors: their army beside another people's of the same age. */
  warriors: 0.8,
};
/** How a people's rule shapes its war: its army's size beside the common one, whether it holds back now, whether it marches without waiting to outweigh its foe, and whether it raises only the arms of its own age. */
export interface FightStyle { army: number; hold: boolean; eager: boolean; newest: boolean }
export function fightStyle(g: Game, pid: number, mine: Building[], foe: number): FightStyle {
  const style = g.style(pid), p = g.players[pid], F = STYLE_FIGHT, plain: FightStyle = { army: 1, hold: false, eager: false, newest: false };
  if (style === 'builder') {
    const struck = !!p.lastAttacked && g.time - p.lastAttacked.t < F.siege;
    return { ...plain, hold: struck && mine.some((b) => b.complete && !b.dead && !b.def.wall && b.hp < b.maxHp * F.hurt) };
  }
  if (style === 'scholar') return { ...plain, hold: p.agingUp, eager: foe >= 0 && !!g.players[foe] && p.age > g.players[foe].age };
  if (style === 'warrior') return { ...plain, army: F.warriors, newest: true };
  return plain;
}
