// A visit: from the campaign map the player enters a town of their own, with no enemy there, and plays a stretch
// of its season in real time. What is built stays built, as it does after a siege. docs/DESIGN.md, "A visit".
//
// What a visit loads: the land's standing town (buildings, damage, what was never finished), its worked ground,
// the weather over it, the nation's age and creed, the soldiers of the army stationed there, and the town's own
// people and stores as township.ts keeps them (its men, women and old, the children on its records, its notable
// women by name). What it saves: the standing town, the worked ground, half the town's change of creed, any map
// building (farm, barracks...) raised that has a place on the land, and the town's people and stores as the
// visit leaves them, as a siege does: everyone born there, less the dead and the taken.
import { furloughOf, homeOnLeave } from './furloughmap';
import { keepQueued } from './queueddrill';
import { BUILDINGS } from './data';
import type { Ground, Standing } from './game';
import type { BattleConfig, Campaign } from './campaign';
import { Census, cleanCensus, folkOf, musterFolk, settleFolk } from './township';
import { bornOnVisit } from './seasonfolk';
import { shiftVirtue } from './townfaith';
import { weatherAt } from './campaignbase';
import { BATTLE_VIRTUE, BIOMES, COMPANIES, SITES, SITE_BUILDING, ageOf, armyAt, biomeOf, heroFor, homeCorner, onSea, slots } from './campaignbase';
import { faithAt } from './townfaith';
import { settleStores } from './stores';
import { sideName } from './naming';
import { Orders, keepOrders } from './governor';
import type { Sky } from './campaign';
import { driftBack, withDrift } from './driftintown';
import { companyOf } from './townmuster';
import { studiedHome, studiesOf } from './studies';
import { menMustered, reckonArmies } from './armytown';
import type { Army } from './campaign';

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
  /** The town's people and stores as the player left them (`Game.census()`). */
  folk?: Partial<Census>;
  /** Who of the town was drifted to the tavern and the mine as the player left (driftintown.ts). */
  drifted?: { tavern?: number; mines?: number };
  /** What the town was set to as the player left (`Game.orders()`): it carries on with them (governor.ts). */
  orders?: Partial<Orders>;
  /** Who of the player's bore arms as they left, by company (`visitArms`): the army's soldiers, and townsmen trained there. */
  arms?: VisitArms;
  /** The town's men who went home from the army there and were home as the player left (`homeNow`, furlough.ts). */
  leave?: unknown;
  /** The studies researched in the town (`learnedIn(player.techs)`): they come home to the nation (studies.ts). */
  studies?: string[];
}

/** Soldiers in a visit by the company they belong to: those of the army brought in, and townsmen trained there. */
export interface VisitArms { army: Record<string, number>; trained: Record<string, number> }
/**
 * Count who bears arms as a visit ends. A soldier the army brought in has no span of life of his own (lifespan 0);
 * a townsman trained there keeps his (muster.ts), and is still counted among the town's men by its census.
 */
export function visitArms(units: { owner: number; type: string; dead?: boolean; lifespan: number }[], owner: number): VisitArms {
  const out: VisitArms = { army: {}, trained: {} };
  for (const u of units) {
    if (u.owner !== owner || u.dead) continue;
    const kind = companyOf(u.type);
    if (!kind) continue;
    const into = u.lifespan > 0 ? out.trained : out.army;
    into[kind] = (into[kind] ?? 0) + 1;
  }
  return out;
}
const cleanCount = (x: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (COMPANIES[k] && Number.isFinite(v) && Number(v) > 0) out[k] = Math.min(200, Math.floor(Number(v)));
  return out;
};

/**
 * The town's soldiers go home to the map. Companies of the army stationed there that were lost in the visit are
 * lost on the map (armytown.ts counts their men: some dead, the rest home hurt); townsmen trained there make up new
 * companies, a company for every two of a kind, that join the army there or form one, and the men of each are taken
 * onto its roll from the town as any company raised is (armytown.ts, warhouse.ts).
 */
function armsHome(c: Campaign, tid: number, arms: VisitArms, before: Record<string, number> | undefined): void {
  const army = cleanCount(arms.army), trained = cleanCount(arms.trained), t = c.territories[tid];
  let a: Army | undefined = armyAt(c, tid);
  if (a && a.owner !== 0) return;
  if (a && before) {
    const units: Record<string, number> = {};
    for (const [kind, had] of Object.entries(before)) {
      const per = Object.values(COMPANIES[kind]?.units ?? {})[0] ?? 2;
      const left = Math.min(had, Math.ceil((army[kind] ?? 0) / per));
      if (left > 0) units[kind] = left;
    }
    const lost = Object.values(before).reduce((n, k) => n + k, 0) - Object.values(units).reduce((n, k) => n + k, 0);
    if (lost > 0) {
      // The leader's army keeps a company about them; any other army that lost every man is gone.
      if (!Object.keys(units).length && a.hero) units[Object.keys(before)[0]] = 1;
      if (Object.keys(units).length) a.units = units; else { c.armies.splice(c.armies.indexOf(a), 1); a = undefined; }
      c.log.push(`${lost} ${lost === 1 ? 'company' : 'companies'} of the army in ${t.name} ${lost === 1 ? 'was' : 'were'} lost while you were there.`);
      reckonArmies(c);
    }
  }
  for (const [kind, n] of Object.entries(trained)) {
    const per = Object.values(COMPANIES[kind].units)[0] ?? 2;
    for (let k = 0; k < Math.floor(n / per); k++) {
      const fresh = !a;
      if (!a) { a = { id: c.nextArmy++, owner: 0, at: tid, units: {}, hero: false, vet: c.factions[0].civ === 'japan' ? 1 : 0, moved: true }; c.armies.push(a); }
      a.units[kind] = (a.units[kind] ?? 0) + 1;
      if (!menMustered(c, a, tid, { gone: true })) { // nobody to go after all: no company. (They were trained in person: the quarter a people sends is not asked of them.)
        a.units[kind]--; if (!a.units[kind]) delete a.units[kind];
        if (fresh) { c.armies.splice(c.armies.indexOf(a), 1); delete c.musters?.[a.id]; a = undefined; }
        break;
      }
      c.log.push(`The ${COMPANIES[kind].name.toLowerCase()} you trained in ${t.name} ${fresh ? 'form an army there' : 'join the army there'}.`);
    }
  }
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
  settleStores(c); // the town is visited with what is in its stores now
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
  const town = record.town ?? (t.town?.coarse ? undefined : t.town?.b) ?? [];
  return {
    ...(weatherAt(c, t.id) ? { weather: weatherAt(c, t.id) as Sky } : {}),
    climate: BIOMES[biomeOf(c, t.id)].climate,
    ...(t.ground ? { ground: t.ground } : {}),
    seed: t.seed, size: t.trait === 'coast' ? 96 : 72, level: 0, humanAttacks: false, field: false, sea: t.trait === 'coast',
    title: `A visit to ${t.name}`,
    setups: [{
      name: sideName(c, 0), color: c.factions[0].color, isAI: false, team: 0, civ: c.factions[0].civ, start: homeCorner(t), hero, virtue: faithAt(c, t.id),
      bonus: {
        units, res: (record.res ?? 0) + (t.buildings.includes('farm') ? 150 : 0), age: Math.max(fort ? 1 : 0, ageOf(c, 0)), armed: true,
        buildings: [...(fort ? ['tower', 'tower', 'fortress'] : []), ...works], ...(town.length ? { town } : {}), ...(!record.town && t.town?.coarse ? { coarse: t.town.b } : {}), // a first visit: the town as big as its record (firstlay.ts)
        // The town's own people and stores (township.ts), in place of four founders and the usual stock.
        ...withDrift(c, t.id, musterFolk(c, t.id)),
        studies: studiesOf(c, 0), // the nation's studies are known in its towns (studies.ts)
        ...(furloughOf(c, t.id) ? { furlough: furloughOf(c, t.id) } : {}), // its own men with the army there may go home while the player is in the town (furlough.ts)
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
  // The town is as the visit left it: everyone born there, less the dead and the taken.
  const census = cleanCensus(after.folk);
  const before = folkOf(c, land.id).children;
  homeOnLeave(c, land.id, after.leave); // men of the town who went home from the army while the player was there: before its soldiers are counted back
  const had = armyAt(c, land.id)?.owner === 0 ? { ...armyAt(c, land.id)!.units } : undefined;
  if (census) settleFolk(c, land.id, census);
  if (census) bornOnVisit(c, land.id, folkOf(c, land.id).children - before);
  if (census) driftBack(c, land.id, after.drifted);
  keepOrders(c, land.id, after.orders);
  keepQueued(c, land.id, after.orders?.men); // and the men who stood in its queues, to come out as themselves (queuedmen.ts)
  if (after.arms) armsHome(c, land.id, after.arms, had); // its soldiers go home to the map: the army's losses, and companies trained there
  if (after.studies) studiedHome(c, 0, after.studies); // what was learned there is the nation's (studies.ts)
  settleStores(c); // what the town gathered or spent in the visit is its nation's gain or loss (stores.ts)
  // How the town was kept goes home as it does from a battle: half of how far it moved.
  // It is this town that was kept so, and this town that is moved (townfaith.ts).
  if (virtue !== undefined && Number.isFinite(virtue)) shiftVirtue(c, 0, (virtue - faithAt(c, land.id)) * BATTLE_VIRTUE, { at: land.id });
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
