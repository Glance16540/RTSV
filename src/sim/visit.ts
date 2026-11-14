// A visit: from the campaign map the player enters a town of their own, with no enemy there, and plays a stretch
// of its season in real time. What is built stays built, as it does after a siege. docs/DESIGN.md, "A visit".
//
// What a visit loads today: the land's standing town (buildings, damage, what was never finished), its worked
// ground, the weather over it, the nation's age and creed, and the soldiers of the army stationed there.
// What it saves today: the standing town, the worked ground, half the town's change of creed, and any map
// building (farm, barracks...) that was raised and has a place on the land. People and stores are not kept yet:
// `VisitRecord` is where they come in, and `VisitAfter` is where they go out, when towns keep them.
import { BUILDINGS } from './data';
import type { Ground, Standing } from './game';
import type { BattleConfig, Campaign } from './campaign';
import { BATTLE_VIRTUE, BIOMES, COMPANIES, SITES, SITE_BUILDING, ageOf, armyAt, biomeOf, heroFor, homeCorner, onSea, shiftVirtue, slots, virtueOf, weatherAt } from './campaign';
import type { Sky } from './campaign';

declare module './campaign' {
  interface Campaign {
    /** The town the player has gone into and not yet come back from. */
    visit?: { to: number } | null;
  }
  interface Territory {
    /** The turn (season) this town was last visited: a town is visited once a season. */
    visited?: number;
  }
}

/** How long a visit lasts, in seconds of the town's own time. The player may leave sooner. */
export const VISIT_SECONDS = 600;
const MAX_TOWN = 240;

/** What a town brings into a visit beyond what the land itself records. Whoever keeps a town's people and stores passes them here. */
export interface VisitRecord {
  /** The buildings that stand, in place of the land's own record of them. */
  town?: Standing[];
  /** Stores on hand, added to what a town starts with: the same of each. */
  res?: number;
  /** Soldiers and villagers who are there, by unit type, in place of the army stationed on the land. */
  units?: Record<string, number>;
}

/** What comes back from a visit. Everything is by name, so that more can be carried home without changing who calls this. */
export interface VisitAfter {
  town?: Standing[];
  ground?: Ground;
  /** Where the town's creed stood when the player left. */
  virtue?: number;
  /** How long the player stayed, in seconds. */
  seconds?: number;
}

/** Why this town cannot be visited now, or '' if it can. */
export function visitBar(c: Campaign, tid: number): string {
  const t = c.territories[tid];
  if (!t || t.owner !== 0) return 'Only a town of your own can be visited.';
  if (t.horde) return 'Marauders hold this land.';
  if (c.phase !== 'player') return 'Not while others are moving.';
  if (c.pending) return 'There is a battle to settle first.';
  if (c.demand) return 'A demand is waiting for your answer.';
  if (t.visited === c.turn) return 'You have been here this season. Each town is visited once a season.';
  return '';
}
export const canVisit = (c: Campaign, tid: number): boolean => visitBar(c, tid) === '';

/** Go into the town: the campaign remembers where the player is until they come back. */
export function beginVisit(c: Campaign, tid: number): boolean {
  if (!canVisit(c, tid)) return false;
  c.visit = { to: tid };
  return true;
}

/** The town as a real-time match with nobody to fight: the player alone, on the ground a siege there is fought over. */
export function visitConfig(c: Campaign, record: VisitRecord = {}): BattleConfig | null {
  const v = c.visit, t = v ? c.territories[v.to] : undefined;
  if (!v || !t || t.owner !== 0) return null;
  const army = armyAt(c, t.id);
  const units: Record<string, number> = {};
  if (record.units) Object.assign(units, record.units);
  else if (army && army.owner === 0) for (const [type, n] of Object.entries(army.units)) for (const [u, k] of Object.entries(COMPANIES[type].units)) units[u] = (units[u] ?? 0) + k * n;
  // The leader is in the town only when the army they march with is.
  const hero = heroFor(c, 0);
  if (!(army && army.owner === 0 && army.hero)) delete hero.fights;
  const fort = t.buildings.includes('fortress');
  const works = t.buildings.filter((b) => b !== 'fortress' && SITE_BUILDING[b]).map((b) => SITE_BUILDING[b]);
  const town = record.town ?? t.town?.b ?? [];
  return {
    ...(weatherAt(c, t.id) ? { weather: weatherAt(c, t.id) as Sky } : {}),
    climate: BIOMES[biomeOf(c, t.id)].climate,
    ...(t.ground ? { ground: t.ground } : {}),
    seed: t.seed, size: t.trait === 'coast' ? 96 : 72, level: 0, humanAttacks: false, field: false, sea: t.trait === 'coast',
    title: `A visit to ${t.name}`,
    setups: [{
      name: 'You', color: c.factions[0].color, isAI: false, team: 0, civ: c.factions[0].civ, start: homeCorner(t), hero, virtue: virtueOf(c, 0),
      bonus: {
        units, res: (record.res ?? 0) + (t.buildings.includes('farm') ? 150 : 0), age: Math.max(fort ? 1 : 0, ageOf(c, 0)), armed: true,
        buildings: [...(fort ? ['tower', 'tower'] : []), ...works], ...(town.length ? { town } : {}),
      },
    }],
  };
}

/** Come back from the town: what stands there is the land's town now, and the town has had its visit for the season. */
export function finishVisit(c: Campaign, after: VisitAfter = {}): boolean {
  const v = c.visit, land = v ? c.territories[v.to] : undefined;
  c.visit = null;
  if (!land || land.owner !== 0) return false;
  land.visited = c.turn;
  const { town, ground, virtue, seconds } = after;
  // How the town was kept goes home as it does from a battle: half of how far it moved.
  if (virtue !== undefined && Number.isFinite(virtue)) shiftVirtue(c, 0, (virtue - virtueOf(c, 0)) * BATTLE_VIRTUE);
  if (ground && Array.isArray(ground.gone) && Array.isArray(ground.left)) {
    land.ground = {
      gone: ground.gone.filter((k) => Number.isInteger(k) && k >= 0).slice(0, 20000),
      left: ground.left.filter((x) => Array.isArray(x) && Number.isInteger(x[0]) && x[1] > 0).slice(0, 20000),
    };
  }
  if (Array.isArray(town)) {
    const b = town.filter((x) => Array.isArray(x) && BUILDINGS[x[0]] && x[0] !== 'wonder' && Number.isInteger(x[1]) && Number.isInteger(x[2]))
      .map((x): Standing => {
        const health = typeof x[3] === 'number' && x[3] > 0 && x[3] < 1 ? x[3] : undefined;
        if (typeof x[4] === 'number' && x[4] >= 0 && x[4] < 1) return [x[0], x[1], x[2], health ?? 0.01, x[4]]; // never finished
        return health === undefined ? [x[0], x[1], x[2]] : [x[0], x[1], x[2], health];
      }).slice(0, MAX_TOWN);
    // An empty list would be a town with nothing standing: the land keeps what it had sooner than lose it to a bad report.
    if (b.length) land.town = { at: homeCorner(land), b };
    for (const [site, type] of Object.entries(SITE_BUILDING)) {
      if (site === 'fortress' || land.buildings.includes(site) || land.buildings.length >= slots(land)) continue;
      if (site === 'harbour' && !onSea(c, land.id)) continue;
      if (!b.some((x) => x[0] === type && x[4] === undefined)) continue; // a finished one
      land.buildings.push(site);
      c.log.push(`The ${SITES[site].name} you built on your visit stands in ${land.name}.`);
    }
  }
  const mins = Math.max(1, Math.round((seconds ?? VISIT_SECONDS) / 60));
  c.log.push(`You spent ${mins} minute${mins === 1 ? '' : 's'} of the season in ${land.name}.`);
  return true;
}
