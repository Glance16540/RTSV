// A band's strike on a town of the player's is a battle the player may enter (docs/DESIGN.md: no auto-resolve; a
// town defends itself, and the player may be there).
//
// A band's strike on a town is a clash on the map (raidclash.ts), and until now nobody could be there. When a band
// is about to strike a town of the player's, the strike waits on the player as a nation's attack does: a pending
// battle (`Pending.raid`), to be fought in person or left to the town.
//   - Left to the town, it is the strike as it always was (threats.ts `strike`). The season waits with the strike
//     (bandseason.ts `seasonWaits`) and is taken up where it stopped, so the strike falls in the same place in it.
//   - Fought in person, the field is the town as it stands (campaign.ts `battleConfig` lays the town, its own men
//     turned out and any army standing there, as against a nation) with the band's companies come against it
//     (`raidBattle`: raidclash.ts's own count of them, foot and bows), and nobody else: no army from next door.
//   - What it came to is written back by the strike's own rule (`settleRaid`). Won, the town held. Lost, the band is
//     in: the town is taken where breaking it cost the band little of its men (raidclash.ts's own line), raided
//     where they had to fight for it, and never taken where its Fortress is held or its people are already in a
//     band's hands. Captives, spoils, the band's losses and the people's standing then follow the fight as they do
//     on the map; the army standing there keeps the companies that lived.
//
// What the field cannot yet tell the map is left to the map's own fight of the same day: the men of the town who
// died, how hard its works were pressed, and (where the field does not say who of the band was left) what the fight
// cost the band. The town's houses, stores and ground are not read back from the field; a raid changes them only
// by the strike's rule.
//
// Only a strike on a town waits: a strike on a road is still an escort or nothing.
import type { BattleConfig, Campaign } from './campaign';
import { COMPANIES, ageOf, armyAt, heroFor } from './campaignbase';
import { CIV_IDS, TECHS } from './data';
import { CLASH } from './mapbattle';
import { RAID } from './raidclash';
import type { RaidFight } from './raidclash';
import { BANDS, breakBand, defenceOf, note, strike } from './threats';
import type { Band, Defence, Raid } from './threats';
import { marched } from './bandmarch';
import { leaderAt } from './court';
import { raisedInBattle } from './dynasty';
import { HeroSpec, MAX_RANK } from './hero';

declare module './campaign' {
  interface Pending {
    /** The battle is this band's strike on the town (raidfought.ts): no nation attacks, and no land changes hands. */
    raid?: number;
  }
}

export const STAND = {
  /** Seed of colour for a band on the field (as bandfight.ts FIGHT.color). */
  color: 0x4a3a2a,
};

const cap = (name: string): string => name[0].toUpperCase() + name.slice(1);
const bandOf = (c: Campaign, id: number | undefined): Band | undefined => (id === undefined ? undefined : (c.bands ?? []).find((b) => b.id === id));
/** The band whose strike is waiting on the player, if one is. */
export const raidPending = (c: Campaign): Band | undefined => bandOf(c, c.pending?.raid);

/** Does this strike wait on the player? A town of the player's own, not a road, with nothing else waiting. */
export function waitsOnPlayer(c: Campaign, b: Band, tid: number): boolean {
  const owner = c.territories[tid]?.owner;
  return owner === 0 && !c.factions[0].isAI && c.factions[0].alive && b.kind !== 'highwaymen' && b.kind !== 'marauders' && !c.pending && !c.demand;
}

/** Put a strike to the player: the pending battle, and the word of it. The figures are the strike's own (the band's force of the day, the town's defence as the sum has it). */
export function offerRaid(c: Campaign, b: Band, tid: number, out: string[]): boolean {
  if (!waitsOnPlayer(c, b, tid)) return false;
  const force = Math.round(b.strength * 10) / 10;
  c.pending = { armyId: -1, from: b.at, to: tid, attacker: -1, defender: 0, aStr: force, dStr: defenceOf(c, tid).total, raid: b.id };
  out.push(`${BANDS[b.kind].icon} ${cap(b.name)} are coming against ${c.territories[tid].name}.`);
  return true;
}

/** The band's men as they come against a town: raidclash.ts's own count, bows in RAID.bows' share and the rest on foot, by company. */
export function raidCompanies(strength: number): Record<string, number> {
  const n = Math.max(1, Math.round(strength)), bows = Math.min(n - 1, Math.round(n * RAID.bows));
  return { infantry: n - bows, ...(bows ? { archers: bows } : {}) };
}
/** And as the soldiers who fight in person, by unit. */
export function raidUnits(strength: number): Record<string, number> {
  const units: Record<string, number> = {};
  for (const [type, n] of Object.entries(raidCompanies(strength))) for (const [u, k] of Object.entries(COMPANIES[type].units)) units[u] = (units[u] ?? 0) + k * n;
  return units;
}
const sum = (r: Record<string, number> | undefined): number => Object.values(r ?? {}).reduce((n, v) => n + (Number.isFinite(v) && v > 0 ? v : 0), 0);

/**
 * The pending strike as a battle in person: `laid` is the town's defence as battleConfig lays it against anyone (the
 * town, its men turned out, the army standing there). The other side is the band and nobody else.
 */
export function raidBattle(c: Campaign, laid: BattleConfig): BattleConfig {
  const p = c.pending, b = raidPending(c);
  if (!p || !b) return laid;
  const t = c.territories[p.to], [mine, theirs] = laid.setups;
  // A band is the same people every time, and never the player's own (as bandfight.ts has it).
  const civ = CIV_IDS.filter((id) => id !== c.factions[0].civ)[(t.seed + b.id) % (CIV_IDS.length - 1)];
  return {
    ...laid, level: 0, title: `${cap(b.name)} come against ${t.name}`,
    setups: [
      mine,
      // The band where an attacker would stand, a step behind a nation in its arms.
      { name: cap(b.name), color: STAND.color, isAI: true, team: 1, civ, ...(theirs.start !== undefined ? { start: theirs.start } : {}), besieger: true, bonus: { units: raidUnits(b.strength), res: 30 * b.strength, age: Math.max(0, ageOf(c, 0) - 1), armed: true, buildings: [], atk: 0 } },
    ],
  };
}

/** What a battle in person hands back that a raid reads (campaign.ts's finishBattle and its bag). */
export interface RaidField { won: boolean; /** The player's units left, by kind. */ survivors?: Record<string, number>; /** The band's men still standing, by unit. */ foes?: Record<string, number>; fell?: boolean; heroRank?: number; acclaimed?: Partial<HeroSpec> }

/**
 * The map's own fight of a strike, rewritten by what the field came to (threats.ts `strike`'s `fought`).
 * `fielded`: the band's soldiers as they came; `garrison`: the companies of the army standing in the town.
 */
export function foughtAs(clashed: RaidFight, defence: Defence, strength: number, field: RaidField, garrison?: Record<string, number>): RaidFight {
  const fielded = sum(raidUnits(strength));
  const cost = field.foes ? Math.max(0, Math.min(1, 1 - sum(field.foes) / Math.max(1, fielded))) : clashed.cost;
  const lost = Math.round(strength * cost * RAID.rally);
  // The army there keeps the companies that lived (as campaign.ts counts a battle won): the rest are what it lost.
  let garrisonLost = clashed.garrisonLost;
  if (garrison && field.survivors) {
    garrisonLost = {};
    for (const [type, had] of Object.entries(garrison)) {
      const [unit, per] = Object.entries(COMPANIES[type].units)[0];
      let alive = 0;
      for (let u: string | undefined = unit; u; u = Object.values(TECHS).find((x) => x.upgrade?.[0] === u)?.upgrade![1]) alive += field.survivors[u] ?? 0; // in a later age the company fought with better weapons
      const gone = had - Math.min(had, Math.ceil(alive / per));
      if (gone > 0) garrisonLost[type] = gone;
    }
  }
  if (field.won) return { ...clashed, outcome: 'held', broke: 'attacker', cost, bandLost: Math.max(1, lost), garrisonLost };
  // The town broke. It stood as long as the map's fight has it where that broke too, and else the whole day.
  const rounds = clashed.broke === 'defender' ? clashed.rounds : CLASH.rounds;
  return { ...clashed, outcome: cost <= RAID.easilyOut && !defence.stronghold ? 'taken' : 'raided', broke: 'defender', rounds, cost, bandLost: lost, garrisonLost };
}

/**
 * Settle the pending strike. `auto`: left to the town, the strike falls as it always has. `attacker`: fought in person
 * and the band got in; `defender`: fought in person and the town held. Returns the strike's report, or null where
 * there was nothing left to settle (the band is gone, or the town is no longer the player's).
 */
export function settleRaid(c: Campaign, how: 'auto' | 'attacker' | 'defender', field: Omit<RaidField, 'won'> = {}): Raid | null {
  const p = c.pending;
  if (!p || p.raid === undefined) return null;
  c.pending = null;
  const b = bandOf(c, p.raid), tid = p.to;
  if (!b || c.territories[tid]?.owner !== 0) return null;
  const out: string[] = [];
  const army = armyAt(c, tid), garrison = army?.owner === 0 ? army : undefined;
  const led = !!garrison?.hero, sat = !garrison && leaderAt(c, 0, tid), strength = b.strength;
  const result: RaidField = { ...field, won: how === 'defender' };
  const raid = how === 'auto' ? strike(c, b, tid, out) : strike(c, b, tid, out, { fought: (clashed, defence) => foughtAs(clashed, defence, strength, result, garrison ? { ...garrison.units } : undefined) });
  if (raid.broken) { note(c, out, 'broken', b, b.at, `${cap(b.name)} are broken and scattered.`, [raid.owner]); breakBand(c, b, out); }
  if (c.seasonHeld) c.seasonHeld.struck.push(raid.band); else marched(c, raid.band, 'struck'); // in a season that waited on it, counted in its turn when the season is taken up (bandseason.ts)
  // The leader who stood there, with the army or with the townsfolk, at the usual risk (as campaign.ts's finishBattle has it).
  if (how !== 'auto' && (led || sat) && c.factions[0].heroAlive) {
    const fac = c.factions[0], hero = heroFor(c, 0), rank = fac.heroRank ?? 0, alive = field.survivors;
    if (field.acclaimed && led && alive && (alive[field.acclaimed.fights ?? ''] ?? alive.warlord) > 0) { raisedInBattle(c, 0, field.acclaimed, field.heroRank ?? 0); if (garrison) garrison.hero = true; }
    else if (field.fell) {
      if (garrison) garrison.hero = false;
      fac.heroAlive = false; fac.heroRank = Math.max(0, rank - 1);
      out.push(`${hero.name} fell defending ${c.territories[tid].name}.`);
    } else if (field.heroRank != null && Number.isFinite(field.heroRank)) fac.heroRank = Math.max(0, Math.min(MAX_RANK, Math.round(field.heroRank)));
  }
  c.log.push(...out);
  return raid;
}
