// An army against a band (docs/DESIGN.md: no auto-resolve).
//
// When the player's army meets a band it is a battle the player can enter. The player orders it from the map
// (`attackBand`): the army must stand in the land where the band has its place, or in a land next to it. That
// opens a pending battle like any other, except that it is against no nation and takes no land (`Pending.band`),
// and `bandBattle` turns it into a field battle: the army's own companies against the band's men.
// Won, the band is broken, everyone it holds goes home, and the army is whoever lived. Lost, the army is routed
// and the band is the weaker for the fight.
//
// When nobody is there to see it, the army fights by its own means (`fightByMeans`): what it is on the map (its
// companies, its veterancy, its leader) against the band's strength, each a little better or worse on the day.
// That is how the computer's peoples fight bands, and what the player gets by leaving a fight to the army.
// The computer's peoples hunt the bands that sit in or beside their own lands, when they have the army for it.
//
// The marauders are not fought this way: they hold a land, and are fought by marching into it (bandhorde.ts).
import { sideName } from './naming';
import type { Army, BattleConfig, Campaign } from './campaign';
import { BIOMES, COMPANIES, ageOf, armySize, armyStrength, biomeOf, heroFor, reach, virtueOf, weatherAt } from './campaign';
import { CIV_IDS, TECHS } from './data';
import { reckonArmies } from './armytown';
import { Band, breakBand, chance, note } from './threats';

declare module './campaign' {
  interface Pending {
    /** The battle is against this band and not against the land or whoever holds it: it takes no land (bandfight.ts). */
    band?: number;
  }
}

export const FIGHT = {
  /** How much better or worse than its strength either side may be on the day, unwatched. */
  day: 0.15,
  /** The share of its companies an army loses beating a band its equal, and when it is beaten. */
  cost: 0.25, rout: 0.4,
  /** What a band loses when it beats an army off: this share of the army's strength, and never less than one. */
  bled: 0.3,
  /**
   * A computer people's army goes after a band when it is at least this many times its strength, the band has been
   * about for `grace` seasons, and then only in so many seasons out of a hundred: an army has other work.
   */
  hunt: 1.5, grace: 3, keen: 0.3,
  /** But a people whose own are held by a band goes after it at once, and at shorter odds. */
  theirs: 1.6,
  /** Of a band's strength, the share that fights as archers when the battle is fought out; the rest as infantry. */
  bows: 0.35,
  /** Seed of colour for a band on the field. */
  color: 0x4a3a2a,
};

const cap = (name: string): string => name[0].toUpperCase() + name.slice(1);
const whoseArmy = (c: Campaign, a: Army): string => (a.owner === 0 ? 'Your army' : `${c.factions[a.owner].name}'s army`);
const bandOf = (c: Campaign, id: number | undefined): Band | undefined => (c.bands ?? []).find((b) => b.id === id);
/** The lands from which a band's place can be reached to fight it. */
const placeOf = (b: Band): number[] => (b.to === undefined ? [b.at] : [b.at, b.to]);

function lose(a: Army, n: number): number {
  let lost = 0;
  for (; lost < n && armySize(a) > 1; lost++) {
    const type = Object.keys(a.units).sort((x, y) => a.units[y] - a.units[x] || (x < y ? -1 : 1))[0];
    if (--a.units[type] <= 0) delete a.units[type];
  }
  return lost;
}

/** Can this army be ordered against this band now? It must be its owner's to order, not yet marched, and at the band's place or next to it. */
export function canAttackBand(c: Campaign, armyId: number, bandId: number): boolean {
  const a = c.armies.find((x) => x.id === armyId), b = bandOf(c, bandId);
  if (!a || !b || b.kind === 'marauders' || a.moved || c.pending || c.demand) return false;
  return placeOf(b).some((id) => id === a.at || reach(c, a.at).includes(id));
}
/** The player's armies that could be sent against a band this turn. */
export const armiesFor = (c: Campaign, bandId: number, owner = 0): Army[] => c.armies.filter((a) => a.owner === owner && canAttackBand(c, a.id, bandId));

/**
 * Order an army against a band. For the player this opens a pending battle, to be entered or left to the army
 * (`resolvePending`); a computer people's army fights by its own means at once.
 */
export function attackBand(c: Campaign, armyId: number, bandId: number): 'battle' | 'fought' | 'invalid' {
  if (!canAttackBand(c, armyId, bandId)) return 'invalid';
  const a = c.armies.find((x) => x.id === armyId)!, b = bandOf(c, bandId)!;
  if (c.factions[a.owner]?.isAI) { const out: string[] = []; fightByMeans(c, a, b, out); c.log.push(...out); return 'fought'; }
  const to = placeOf(b).find((id) => id === a.at || reach(c, a.at).includes(id))!;
  c.pending = { armyId, from: a.at, to, attacker: a.owner, defender: -1, aStr: armyStrength(a, c), dStr: b.strength, mode: 'field', band: b.id };
  return 'battle';
}

/** An army and a band fight with nobody watching: each by what it is, a little better or worse on the day. Returns whether the band was broken. */
export function fightByMeans(c: Campaign, a: Army, b: Band, out: string[]): boolean {
  const day = (salt: number): number => 1 - FIGHT.day + 2 * FIGHT.day * chance(c, b.id * 97 + a.id, salt);
  const mine = armyStrength(a, c) * day(61), theirs = b.strength * day(67), at = c.territories[b.at].name;
  a.moved = true;
  if (mine >= theirs) {
    const lost = lose(a, Math.round(armySize(a) * FIGHT.cost * Math.min(1, theirs / mine)));
    note(c, out, 'broken', b, b.at, `${whoseArmy(c, a)} has broken ${b.name} at ${at}${lost ? `, at the cost of ${lost === 1 ? 'a company' : `${lost} companies`}` : ''}.`, [a.owner, ...b.held.map((h) => h.owner)]);
    breakBand(c, b, out, a);
    a.vet = Math.min(3, a.vet + 1);
    reckonArmies(c);
    return true;
  }
  const lost = lose(a, Math.max(1, Math.round(armySize(a) * FIGHT.rout)));
  b.strength = Math.max(1, b.strength - Math.max(1, Math.round(mine * FIGHT.bled)));
  note(c, out, 'beaten', b, b.at, `${whoseArmy(c, a)} went against ${b.name} at ${at} and was beaten off${lost ? `, losing ${lost === 1 ? 'a company' : `${lost} companies`}` : ''}.`, [a.owner]);
  reckonArmies(c);
  return false;
}

/** The pending battle with a band as a real-time match: the army's own companies against the band's men, on open ground. */
export function bandBattle(c: Campaign): BattleConfig | null {
  const p = c.pending, b = bandOf(c, p?.band), a = c.armies.find((x) => x.id === p?.armyId);
  if (!p || !b || !a) return null;
  const t = c.territories[p.to];
  const mine: Record<string, number> = {}, theirs: Record<string, number> = {};
  const add = (into: Record<string, number>, type: string, n: number): void => { for (const [u, k] of Object.entries(COMPANIES[type].units)) into[u] = (into[u] ?? 0) + k * n; };
  for (const [type, n] of Object.entries(a.units)) add(mine, type, n);
  const bows = Math.floor(b.strength * FIGHT.bows);
  add(theirs, 'archers', bows); add(theirs, 'infantry', Math.max(1, b.strength - bows));
  // The leader keeps to the camp while the army clears a band: nobody's fate but the army's rides on it.
  const hero = heroFor(c, a.owner);
  delete hero.fights;
  // A band is the same people every time, and never the player's own.
  const civ = CIV_IDS.filter((id) => id !== c.factions[a.owner].civ)[(t.seed + b.id) % (CIV_IDS.length - 1)];
  const sky = weatherAt(c, p.to);
  return {
    ...(sky ? { weather: sky } : {}),
    climate: BIOMES[biomeOf(c, p.to)].climate,
    seed: t.seed * 31 + b.id, size: 56, level: 0, humanAttacks: true, field: true, sea: false,
    title: `The fight with ${b.name} at ${t.name}`,
    setups: [
      { name: sideName(c, a.owner), color: c.factions[a.owner].color, isAI: false, team: 0, civ: c.factions[a.owner].civ, hero, leaderAway: true, virtue: virtueOf(c, a.owner), bonus: { units: mine, res: 30 * p.aStr, age: ageOf(c, a.owner), armed: true, buildings: [], atk: a.vet } },
      // A band is a step behind a nation in its arms.
      { name: cap(b.name), color: FIGHT.color, isAI: true, team: 1, civ, bonus: { units: theirs, res: 30 * b.strength, age: Math.max(0, ageOf(c, a.owner) - 1), armed: true, buildings: [], atk: 0 } },
    ],
  };
}

/**
 * Settle the pending battle with a band. `auto`: nobody watched, and the army fought by its own means.
 * `attacker` / `defender`: it was fought out and the army won or lost; `survivors` (its units left, by kind) say
 * who of a winning army lived. Returns whether the band was broken.
 */
export function settleBandFight(c: Campaign, how: 'auto' | 'attacker' | 'defender', survivors?: Record<string, number>): boolean {
  const p = c.pending;
  if (!p || p.band === undefined) return false;
  c.pending = null;
  const b = bandOf(c, p.band), a = c.armies.find((x) => x.id === p.armyId);
  if (!b || !a) return false;
  const out: string[] = [];
  let won: boolean;
  if (how === 'auto') won = fightByMeans(c, a, b, out);
  else {
    a.moved = true;
    won = how === 'attacker';
    const at = c.territories[b.at].name, before = armySize(a);
    if (won) {
      if (survivors) {
        const units: Record<string, number> = {};
        for (const [type, had] of Object.entries(a.units)) {
          const [unit, per] = Object.entries(COMPANIES[type].units)[0];
          // In a later age the company fought with better weapons: count those too.
          let alive = 0;
          for (let u: string | undefined = unit; u; u = Object.values(TECHS).find((x) => x.upgrade?.[0] === u)?.upgrade![1]) alive += survivors[u] ?? 0;
          const left = Math.min(had, Math.ceil(alive / per));
          if (left > 0) units[type] = left;
        }
        // An army is never wiped out by a battle it won: its last company limps home.
        if (!Object.keys(units).length) units[Object.keys(a.units)[0] ?? 'infantry'] = 1;
        a.units = units;
      }
      const lost = before - armySize(a);
      note(c, out, 'broken', b, b.at, `${whoseArmy(c, a)} has broken ${b.name} at ${at}${lost > 0 ? `, at the cost of ${lost === 1 ? 'a company' : `${lost} companies`}` : ''}.`, [a.owner, ...b.held.map((h) => h.owner)]);
      breakBand(c, b, out, a);
      a.vet = Math.min(3, a.vet + 1);
    } else {
      const lost = lose(a, Math.max(1, Math.round(before * FIGHT.rout)));
      b.strength = Math.max(1, b.strength - 1);
      note(c, out, 'beaten', b, b.at, `${whoseArmy(c, a)} went against ${b.name} at ${at} and was routed${lost ? `, losing ${lost === 1 ? 'a company' : `${lost} companies`}` : ''}.`, [a.owner]);
    }
    reckonArmies(c);
  }
  c.log.push(...out);
  return won;
}

/** The computer's peoples hunt the bands that sit in their lands or beside them, when they have the army for it. */
export function huntBands(c: Campaign, out: string[]): number {
  let fights = 0;
  for (const b of [...(c.bands ?? [])]) {
    if (b.kind === 'marauders') continue;
    const wronged = new Set(b.held.map((h) => h.owner));
    const idle = c.turn - b.since < FIGHT.grace || chance(c, b.id, 89) >= FIGHT.keen; // not this season, unless it holds their own
    const near = new Set(placeOf(b).flatMap((id) => [id, ...c.territories[id].adj]));
    // Whose business it is: a people that holds the band's place or a land next to it.
    const owners = new Set([...near].map((id) => c.territories[id].owner).filter((f) => f > 0 && c.factions[f]?.alive && c.factions[f].isAI));
    const hunters = c.armies.filter((a) => owners.has(a.owner) && near.has(a.at) && c.territories[a.at].owner === a.owner && (wronged.has(a.owner) ? armyStrength(a, c) >= b.strength * FIGHT.theirs : !idle && armyStrength(a, c) >= b.strength * FIGHT.hunt))
      .sort((x, y) => armyStrength(y, c) - armyStrength(x, c) || x.id - y.id);
    if (!hunters.length) continue;
    fightByMeans(c, hunters[0], b, out);
    hunters[0].moved = false; // it was done in the turning of the season, and is theirs to order again
    fights++;
  }
  return fights;
}
