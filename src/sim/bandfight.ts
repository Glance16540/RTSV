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
// A band can come against an army, too (`ambushSeason`). An army that stands at a band's place or beside it and is
// clearly the weaker (the band has AMBUSH.odds of its strength), or is seeing a convoy along the road and is no
// stronger than the band, may be fallen on. An army resting after a storming, or alone in a strange land, counts
// for less than it is when a band weighs it, and fights at that if it is fallen on (bandmarch.ts). A computer people's army fights it at once by its own means; the
// player's is a battle put to the player, to enter or to leave to the army, and one that cannot be called off.
//
// The marauders are not fought this way: they hold a land, and are fought by marching into it (bandhorde.ts).
import { peoplesArmy, sideName } from './naming';
import type { Army, BattleConfig, Campaign } from './campaign';
import { reach, weatherAt } from './campaignbase';
import { BIOMES, COMPANIES, ageOf, armySize, armyStrength, biomeOf, heroFor, virtueOf } from './campaignbase';
import { CIV_IDS, TECHS } from './data';
import { reckonArmies, MEN } from './armytown';
import { creditArmy } from './warhouse';
import { raisedInBattle } from './dynasty';
import { HeroSpec, MAX_RANK } from './hero';
import { Band, breakBand, chance, note } from './threats';
import { exposedHow, exposure, marchOf, marched } from './bandmarch';

declare module './campaign' {
  interface Pending {
    /** The battle is against this band and not against the land or whoever holds it: it takes no land (bandfight.ts). */
    band?: number;
    /** The band came against the army, not the army against the band: it cannot be called off. */
    ambush?: boolean;
  }
}

export const FIGHT = {
  /** How much better or worse than its strength either side may be on the day, unwatched. */
  day: 0.15,
  /** The share of its companies an army loses beating a band its equal, and when it is beaten. */
  cost: 0.25, rout: 0.4,
  /** The chance a leader riding with an army routed by a band, with nobody watching, is among the fallen. */
  leaderFalls: 0.1,
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
/** Whose army, at the head of a sentence: "Your army", "The Arameans' army", "The English army" (naming.ts). */
const whoseArmy = (c: Campaign, a: Army): string => cap(peoplesArmy(c, a.owner));
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
export function fightByMeans(c: Campaign, a: Army, b: Band, out: string[], ambush = false): boolean {
  const day = (salt: number): number => 1 - FIGHT.day + 2 * FIGHT.day * chance(c, b.id * 97 + a.id, salt);
  const mine = armyStrength(a, c) * day(61) * (ambush ? exposure(c, a) : 1), theirs = b.strength * day(67), at = c.territories[b.at].name;
  a.moved = true;
  if (!ambush) marched(c, b.id, 'met', mine >= theirs); // an army went out against a band on its way in from the far wilds (bandmarch.ts)
  if (mine >= theirs) {
    const lost = lose(a, Math.round(armySize(a) * FIGHT.cost * Math.min(1, theirs / mine)));
    note(c, out, 'broken', b, b.at, `${ambush ? `${cap(b.name)} fell on ${peoplesArmy(c, a.owner)} at ${at} and were broken` : `${whoseArmy(c, a)} has broken ${b.name} at ${at}`}${lost ? `, at the cost of ${lost === 1 ? 'a company' : `${lost} companies`}` : ''}.`, [a.owner, ...b.held.map((h) => h.owner)]);
    const felled = b.strength * MEN.company;
    breakBand(c, b, out, a);
    a.vet = Math.min(3, a.vet + 1);
    creditArmy(c, a.id, felled); // counted to the houses of its men (warhouse.ts)
    leaderAfter(c, a, true, out, { band: b.name });
    reckonArmies(c);
    return true;
  }
  const lost = lose(a, Math.max(1, Math.round(armySize(a) * FIGHT.rout)));
  b.strength = Math.max(1, b.strength - Math.max(1, Math.round(mine * FIGHT.bled)));
  note(c, out, 'beaten', b, b.at, `${ambush ? `${cap(b.name)} fell on ${peoplesArmy(c, a.owner)} at ${at} and routed it` : `${whoseArmy(c, a)} went against ${b.name} at ${at} and was beaten off`}${lost ? `, ${ambush ? 'with the loss of' : 'losing'} ${lost === 1 ? 'a company' : `${lost} companies`}` : ''}.`, [a.owner]);
  leaderAfter(c, a, false, out, { band: b.name, fell: a.hero && chance(c, b.id * 131 + a.id, 71) < FIGHT.leaderFalls });
  reckonArmies(c);
  return false;
}

/** How the leader came out of a fight with a band, if they rode with the army. `fell`, `heroRank`, `acclaimed`, `survivors`: as a battle fought in person hands them back (campaign.ts's finishBattle). */
export interface LeaderAfter { fell?: boolean; heroRank?: number; acclaimed?: Partial<HeroSpec>; survivors?: Record<string, number>; band?: string }
/**
 * The leader rode with the army against a band, at the usual risk: fallen, they are dead and the people's
 * standing in war is a rank the less (or, if the army raised one of its own on the field, that one leads now);
 * come through a fight won, they are the more seasoned for it.
 */
function leaderAfter(c: Campaign, a: Army, won: boolean, out: string[], after: LeaderAfter): void {
  if (!a.hero) return;
  const fac = c.factions[a.owner], hero = heroFor(c, a.owner), rank = fac.heroRank ?? 0, alive = after.survivors;
  if (after.acclaimed && alive && (alive[after.acclaimed.fights ?? ''] ?? alive.warlord) > 0) { raisedInBattle(c, a.owner, after.acclaimed, after.heroRank ?? 0); return; }
  if (after.fell || (alive && !hero.fights && !(alive[hero.calling] > 0))) {
    a.hero = false;
    fac.heroAlive = false;
    fac.heroRank = Math.max(0, rank - 1);
    out.push(`${hero.name} fell in the fight with ${after.band ?? 'the band'}.`);
    return;
  }
  if (after.heroRank != null && Number.isFinite(after.heroRank)) fac.heroRank = Math.max(0, Math.min(MAX_RANK, Math.round(after.heroRank)));
  else if (won) fac.heroRank = Math.min(MAX_RANK, rank + 1);
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
  // The leader fights beside the army they ride with (docs/DESIGN.md has him with his army), and may fall there;
  // an army without them fights alone.
  const hero = heroFor(c, a.owner);
  if (!a.hero) delete hero.fights;
  // A band is the same people every time, and never the player's own.
  const civ = CIV_IDS.filter((id) => id !== c.factions[a.owner].civ)[(t.seed + b.id) % (CIV_IDS.length - 1)];
  const sky = weatherAt(c, p.to);
  return {
    ...(sky ? { weather: sky } : {}),
    climate: BIOMES[biomeOf(c, p.to)].climate,
    seed: t.seed * 31 + b.id, size: 56, level: 0, humanAttacks: true, field: true, sea: false,
    title: p.ambush ? `${cap(b.name)} fall on your army at ${t.name}` : `The fight with ${b.name} at ${t.name}`,
    setups: [
      { name: sideName(c, a.owner), color: c.factions[a.owner].color, isAI: false, team: 0, civ: c.factions[a.owner].civ, hero, ...(a.hero ? {} : { leaderAway: true }), virtue: virtueOf(c, a.owner), bonus: { units: mine, res: 30 * p.aStr, age: ageOf(c, a.owner), armed: true, buildings: [], atk: a.vet } },
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
export function settleBandFight(c: Campaign, how: 'auto' | 'attacker' | 'defender', survivors?: Record<string, number>, lead: LeaderAfter = {}): boolean {
  const p = c.pending;
  if (!p || p.band === undefined) return false;
  c.pending = null;
  const b = bandOf(c, p.band), a = c.armies.find((x) => x.id === p.armyId);
  if (!b || !a) return false;
  const out: string[] = [];
  let won: boolean;
  if (how === 'auto') won = fightByMeans(c, a, b, out, !!p.ambush);
  else {
    a.moved = true;
    won = how === 'attacker';
    if (!p.ambush) marched(c, b.id, 'met', won);
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
      note(c, out, 'broken', b, b.at, `${p.ambush ? `${cap(b.name)} fell on your army at ${at} and were broken` : `${whoseArmy(c, a)} has broken ${b.name} at ${at}`}${lost > 0 ? `, at the cost of ${lost === 1 ? 'a company' : `${lost} companies`}` : ''}.`, [a.owner, ...b.held.map((h) => h.owner)]);
      const felled = b.strength * MEN.company;
      breakBand(c, b, out, a);
      a.vet = Math.min(3, a.vet + 1);
      creditArmy(c, a.id, felled); // counted to the houses of its men (warhouse.ts)
    } else {
      const lost = lose(a, Math.max(1, Math.round(before * FIGHT.rout)));
      b.strength = Math.max(1, b.strength - 1);
      note(c, out, 'beaten', b, b.at, `${p.ambush ? `${cap(b.name)} fell on your army at ${at} and routed it` : `${whoseArmy(c, a)} went against ${b.name} at ${at} and was routed`}${lost ? `, losing ${lost === 1 ? 'a company' : `${lost} companies`}` : ''}.`, [a.owner]);
    }
    leaderAfter(c, a, won, out, { ...lead, survivors, band: b.name });
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
    // Not this season, unless it holds their own, or it is on the march and has come beside their land: then they go out
    // to meet it. A band from the far wilds must have been seen first (bandmarch.ts): nobody rides out against a camp
    // nobody knows of.
    const coming = b.bound !== undefined && (!b.afar || marchOf(c, b.id)?.seen !== undefined);
    const idle = !coming && (c.turn - b.since < FIGHT.grace || chance(c, b.id, 89) >= FIGHT.keen);
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

export const AMBUSH = {
  /** A band falls on an army only if it has at least this many times the army's strength. */
  odds: 1.25,
  /** An army seeing a convoy along the road is worth falling on at even strength. */
  escort: 1,
  /** The chance, in a season, that a band with such an army within its reach does fall on it. */
  dare: 0.35,
};

/** Is this army seeing a convoy of its people's along the road: standing on the road of one that is on its way? */
export const escorting = (c: Campaign, a: Army): boolean => ((c as { convoys?: { owner: number; road: number[] }[] }).convoys ?? []).some((x) => x.owner === a.owner && x.road.includes(a.at));

/** The armies a band could fall on now, the weakest first: those at its place or beside it that it outweighs enough. */
export function prey(c: Campaign, b: Band): Army[] {
  const near = new Set(placeOf(b).flatMap((id) => [id, ...c.territories[id].adj]));
  return c.armies.filter((a) => near.has(a.at) && c.factions[a.owner]?.alive && b.strength >= armyStrength(a, c) * exposure(c, a) * (escorting(c, a) ? AMBUSH.escort : AMBUSH.odds)) // tired after a storming, or alone, it counts for less (bandmarch.ts)
    .sort((x, y) => armyStrength(x, c) - armyStrength(y, c) || x.id - y.id);
}

/**
 * One season of bands coming against armies. A computer people's army fights at once by its own means; the
 * player's becomes the pending battle (one at a time), which the player enters or leaves to the army.
 * Returns how many armies were fallen on.
 */
export function ambushSeason(c: Campaign, out: string[]): number {
  let n = 0;
  for (const b of [...(c.bands ?? [])]) {
    if (b.kind === 'marauders') continue;
    const a = prey(c, b)[0];
    if (!a || chance(c, b.id, 101) >= AMBUSH.dare) continue;
    if (c.factions[a.owner].isAI) {
      fightByMeans(c, a, b, out, true);
      a.moved = false; // it happened in the turning of the season
      n++;
    } else if (!c.pending && !c.demand) {
      const to = placeOf(b).find((id) => id === a.at || c.territories[a.at].adj.includes(id)) ?? b.at;
      c.pending = { armyId: a.id, from: a.at, to, attacker: a.owner, defender: -1, aStr: armyStrength(a, c), dStr: b.strength, mode: 'field', band: b.id, ambush: true };
      note(c, out, 'ambush', b, a.at, `${cap(b.name)} have fallen on your army at ${c.territories[a.at].name}${escorting(c, a) ? ', which was seeing a convoy along the road' : exposedHow(c, a) ? `, ${exposedHow(c, a)}` : ''}!`, [a.owner]);
      n++;
    }
  }
  return n;
}
