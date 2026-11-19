// The health of a campaign (docs/TUNING.md): many computer-played campaigns, and every figure that page asks for
// measured against its band. The measuring stick only: it changes no rate and no rule.
//
//   HEALTH=1 npx vitest run scripts/health.test.ts
//   HEALTH=1 CAMPAIGNS=48 SEASONS=200 PLAYER=computer VISITS=2 OUT=docs/health-report.md npx vitest run scripts/health.test.ts
//   npm run health(the baseline: 96 campaigns, 24 visits; about 31 minutes)
//
//   CAMPAIGNS  how many campaigns (seeds FIRST..FIRST+n-1, fixed so runs compare). Default 24.
//   FIRST  the first seed. Default 1. FIRST=385 CAMPAIGNS=384 reads a second set of seeds beside the first 384,
//  to tell a real shift from the luck of one set.
//   SEASONSthe longest a campaign is played. Default 200.
//   PLAYER 'computer' (the player's turns are played as a rival's, campaign.ts `playForPlayer`) or 'passive'.
//   SIEGES how many real-time sieges the computer fights on both sides (the rival against a capital). Default 8.
//   MINUTEShow long each may run before the town is counted as having held. Default 20.
//   STORIES'answer': the computer-played player answers the stories inside the story by a plain policy
//  (src/sim/storypolicy.ts); left out, it answers none of them.
//   CRIME  'roads': the roads' telling alone. '1': every campaign is told three times more for the Crime rows, once with a finished Watch House in every
//  town of the player's from the start, and once with Town Watch learnt from the start besides, and once
//  with an Inn in every such town and Escorts and Paved Roads learnt
//   VISITS how many of the campaigns are played again with every town of the player's visited each season for
//  twenty years (slow: a visit is ten minutes of a real battle). Default 0, and that figure is not measured.
//  The player begins with one town, so a campaign gives one pair at most: the figure swings 30 to 40 points
//  at 8, and reads steadily from 24 (18 pairs or so). `npm run health` is the baseline: 96 campaigns and 24 visits.
//   OUTwhere the report is written. Default docs/health-report.md.
//   POOL   a sparse row (the claimant risings) judged over this run and the runs named, by their <OUT>.sparse.json (other seeds,
//  the same course): marked "pooled". SPARSE=768: plays the campaigns past CAMPAIGNS for the sparse rows alone (slow).
//
// Every campaign is played twice from the same seed: as the rules stand, the player giving the decrees a sensible
// ruler would ('ruled'), and with nobody giving decrees ('no decrees'). Every figure is read from the first, but
// the decrees' own. Skipped unless HEALTH is set.
import { NAMED } from '../src/sim/veteranhome';
import { sensibleAnswers } from '../src/sim/storypolicy';
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import type { Campaign } from '../src/sim/campaign';
import { AGE_COST, advanceAge, ageCost, ageOf, answerDemand, siteCost, slots, armyAt, armyStrength, battleConfig, battleWatchers, continueAI, endTurn, moveArmy, newCampaign, playForPlayer, resolvePending } from '../src/sim/campaign';
import { armiesFor, attackBand } from '../src/sim/bandfight';
import { SEASONS_A_YEAR } from '../src/sim/ageing';
import { BUILDINGS, CIV_IDS } from '../src/sim/data';
import { GOVERN } from '../src/sim/governor';
import { STORE_KINDS } from '../src/sim/township';
import { folkOf, grown } from '../src/sim/township';
import { ledgerSince } from '../src/sim/ledger';
import { needOf } from '../src/sim/larder';
import { faithSpread } from '../src/sim/townfaith';
import { awayFrom, menOf } from '../src/sim/armytown';
import { driftOf, townStanding } from '../src/sim/drift';
import { sensibleDecrees } from '../src/sim/decrees';
import { THREATS } from '../src/sim/threats';
import { VISIT_SECONDS, beginVisit, finishVisit, visitArms, visitConfig } from '../src/sim/visit';
import { driftedIn } from '../src/sim/driftintown';
import { learnedIn } from '../src/sim/studies';
import { nationHas, standsAt } from '../src/sim/townworks';
import { hasStudy } from '../src/sim/studies';
import { plotFor } from '../src/sim/governor';
import { layTown } from '../src/sim/rivalrule';
import { hasFortress } from '../src/sim/fortress';
import { RAID, raidForeseen } from '../src/sim/raidclash';
import type { March } from '../src/sim/bandmarch';
import { settleStores } from '../src/sim/stores';
import { UNREST, ownFounded, unrestWeights } from '../src/sim/unrest';
import { ofTown } from '../src/sim/intriguebase';
import { creedOf } from '../src/sim/creed';
import { faithAt } from '../src/sim/townfaith';
import { goldOf } from '../src/sim/grain';
import { isAngry, noblesOf } from '../src/sim/nobles';
import { ACTS } from '../src/sim/nobleacts';
import { awaiting } from '../src/sim/encounter';

const CAMPAIGNS = +(process.env.CAMPAIGNS ?? 24);
const FIRST = Math.max(1, Math.floor(+(process.env.FIRST ?? 1)) || 1);
const SEASONS = +(process.env.SEASONS ?? 200);
const PLAYER = process.env.PLAYER === 'passive' ? 'passive' : 'computer';
const VISITS = +(process.env.VISITS ?? 0);
/** 'answer': the computer-played player answers the stories inside the story by a plain policy (src/sim/storypolicy.ts); otherwise it answers none. */
/** '1': the campaigns are told three times more for the Crime rows: the player's towns given a Watch House from the start; Town Watch besides; and an Inn in each with Escorts and Paved Roads learnt. */
const CRIME = !!process.env.CRIME;
const STORIES = process.env.STORIES === 'answer' ? 'answer' : 'ignore';
const OUT = process.env.OUT ?? 'docs/health-report.md';
/**
 * Sparse rows (a handful of events in hundreds of campaigns: the claimant risings) swing from one set of seeds to the next,
 * so they may be judged over more campaigns than the run plays. Each run writes its sparse counts beside the report
 * (`<OUT>.sparse.json`). POOL=file[,file] judges them over this run's campaigns and those of the runs named (of the same
 * course, other seeds); SPARSE=768 plays the campaigns past CAMPAIGNS for the sparse rows alone (slow: as long again as
 * the run for every 384 more). A row judged so says "pooled". Neither changes a band; the default run is as it was.
 */
const POOL = (process.env.POOL ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const SPARSE = Math.max(0, Math.floor(+(process.env.SPARSE ?? 0)) || 0);
interface SparseCounts { course: string; player: string; first: number; campaigns: number; claimants: { risen: number; noble: number } }
const sparseCounts: SparseCounts = { course: '', player: '', first: 0, campaigns: 0, claimants: { risen: 0, noble: 0 } };
/** This run's claimant risings with those of the runs pooled (POOL) and the sparse campaigns played (`extra`). */
function pooledClaims(mine: { risen: number; noble: number }, n: number, extra?: { risen: number; noble: number; n: number; first: number }): { risen: number; noble: number; n: number; from: string[] } {
  const out = { risen: mine.risen, noble: mine.noble, n, from: [] as string[] };
  for (const f of POOL) {
    const x = JSON.parse(readFileSync(f, 'utf8')) as SparseCounts;
    if (x.course !== STORIES || x.player !== PLAYER || (x.first < FIRST + CAMPAIGNS && x.first + x.campaigns > FIRST)) continue; // another course, or the same seeds: not pooled
    out.risen += x.claimants.risen; out.noble += x.claimants.noble; out.n += x.campaigns; out.from.push(`seeds ${x.first} to ${x.first + x.campaigns - 1}`);
  }
  if (extra && extra.n) { out.risen += extra.risen; out.noble += extra.noble; out.n += extra.n; out.from.push(`seeds ${extra.first} to ${extra.first + extra.n - 1}`); }
  return out;
}
const SIEGES = +(process.env.SIEGES ?? 8);
const MINUTES = +(process.env.MINUTES ?? 20);
/** Sixty and seventy years old, in seasons (ageing.ts). */
const AT60 = 60 * SEASONS_A_YEAR, AT70 = 70 * SEASONS_A_YEAR;
/** Twenty years, in seasons. */
const YEARS20 = 80;
/** The Righteous town's great house, by whichever name it is built under. */
const GREAT_HOUSES = ['monastery', 'convent'];
/** Peace, for the stores figure: over the last PEACE_YEARS, a people fought for land in no more than PEACE_WAR_SEASONS seasons. */
const PEACE_YEARS = 10, PEACE_WAR_SEASONS = 8;
const CIVS = ['hearth', 'forge', 'greece', 'egypt', 'england', 'japan'];

// ---- Playing a campaign ----

/** A siege of a nation's town settled on the map: whether it had walls and its men (or an army) in it, and whether it held. */
interface Siege { walls: boolean; men: boolean; held: boolean }
/** Every siege settled on the map in the campaign being played, the rivals' among themselves included (campaign.ts `battleWatchers`). */
let watched: Siege[] = [];
battleWatchers.push((c, p, attackerWon) => {
  if (p.band !== undefined || p.mode === 'field' || p.defender < 0) return;
  const t = c.territories[p.to];
  const walls = t.buildings.includes('fortress') || !!t.town?.b.some(([type]) => type === 'tower' || !!BUILDINGS[type]?.wall);
  const men = (armyAt(c, p.to)?.owner === p.defender) || folkOf(c, p.to).men > 0;
  watched.push({ walls, men, held: !attackerWon });
});

/** Settle a battle waiting on the player, from the map. */
const settle = (c: Campaign): void => { resolvePending(c, 'auto'); };

/** The computer-played player sends an army against a band it can reach and is strong enough for (bandfight.ts), settled unwatched. */
function huntBands(c: Campaign): void {
  for (const b of c.bands ?? []) {
if (b.kind === 'marauders' || c.pending) continue;
const a = armiesFor(c, b.id, 0).find((x) => armyStrength(x, c) >= b.strength);
if (a && attackBand(c, a.id, b.id) === 'battle') settle(c);
  }
}

/**
 * The computer-played player puts by for its next age, as a sensible player does. Left to the rivals' own rule it
 * spends all it has every season and lived its first thirty seasons in the Stone Age (0 of 48 campaigns reached
 * the Bronze Age in that time), which skewed every row read from the player's side. Each season it sets aside
 * SAVE of the supplies it has in hand, until the price of the next age is put by; then it takes the age. What is
 * set aside is out of its towns' stores meanwhile (stores.ts settles the figure into the towns), so the rest of
 * its turn cannot spend it. SAVE=0 in the environment turns it off, to read the report as it was (the player's
 * first age then came at a median of season 17, and for one campaign in three not by season 20).
 */
const SAVE = process.env.SAVE === undefined ? 0.5 : +process.env.SAVE;
/**
 * How many ages it saves for so: the first only, unless SAVE_AGES says more; after that it takes an age by the
 * rivals' rule. Saving so for every age (SAVE_AGES=9) was measured at 192 and not kept: with half its supplies
 * always put by it kept too few men, lost about twenty more campaigns in each course, and its towns were raided
 * once in 2.8 years where the band is 3 to 5.
 */
const SAVE_AGES = process.env.SAVE_AGES === undefined ? 1 : +process.env.SAVE_AGES;
const PURSE = new WeakMap<Campaign, number>();
function putBy(c: Campaign): void {
  const f = c.factions[0];
  if (!SAVE || !f.alive || c.phase !== 'player') return;
  settleStores(c);
  let purse = PURSE.get(c) ?? 0;
  const cost = ageOf(c, 0) < Math.min(AGE_COST.length, SAVE_AGES) ? ageCost(c, 0) : 0;
  if (cost > 0) { const put = Math.min(Math.floor((f.supplies ?? 0) * SAVE), Math.max(0, cost - purse)); if (put > 0) { f.supplies -= put; settleStores(c); purse += put; } }
  if (purse > 0 && (cost === 0 || purse >= cost)) { f.supplies += purse; settleStores(c); purse = 0; if (cost > 0 && !advanceAge(c, 0)) { /* something else took it since: it is back in hand, and is put by again next season */ } }
  PURSE.set(c, purse);
}

/** One season: the player's turn (played or let be), then everyone else's. */
function season(c: Campaign, ruled: boolean): void {
  if (PLAYER === 'computer') {
if (STORIES === 'answer') sensibleAnswers(c, 0);
putBy(c);
huntBands(c);
for (let i = 0; i < 40 && c.phase === 'player'; i++) {
  playForPlayer(c);
  if (c.pending) settle(c); else break;
}
  }
  if (ruled) sensibleDecrees(c, 0, (tid) => driftOf(c, tid));
  endTurn(c);
  for (let i = 0; i < 200 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) settle(c); continueAI(c); }
  if (c.pending) settle(c);
}

/** A visit to one town, the computer keeping it for the player for the whole of it (as scripts/seasons.test.ts). */
function visit(c: Campaign, tid: number): void {
  if (!beginVisit(c, tid)) return;
  const cfg = visitConfig(c)!;
  const g = new Game(cfg.seed, cfg.setups.map((s) => ({ ...s, isAI: true })), cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  if (cfg.ground) g.wear(cfg.ground);
  g.fixedAge = true; g.bornOnly = true;
  const ai = new AIController(g, 0); ai.setLevel(1);
  for (let s = 0; s < VISIT_SECONDS && !g.players[0].defeated; s++) { for (let i = 0; i < 20; i++) g.step(); g.events.length = 0; ai.update(); }
  finishVisit(c, { town: g.standing(0), ground: g.ground(), virtue: g.players[0].virtue, seconds: g.time, orders: g.orders(0), folk: g.census(0), drifted: driftedIn(g, 0), arms: visitArms(g.units, 0), studies: learnedIn(g.players[0].techs) }); // as the client does: its last orders (governor.ts) and who has drifted (driftintown.ts)
}

const civOf = (seed: number): string => CIVS[seed % CIVS.length];
const held = (c: Campaign) => c.territories.filter((t) => t.owner >= 0 && !t.horde && c.factions[t.owner]?.alive);

// ---- What is watched, season by season ----

interface TownSeason { tribe: boolean; hungry: boolean; farmed: boolean; /** No farm, and its governor could raise one: a free place and the stores for it (governor.ts). */ canFarm: boolean; convoy: boolean; drifted: boolean; strained: 'hungry' | 'raided' | 'taken' | ''; oneSex: boolean }
/** What took a town's people in a season, by cause. */
interface Losses { war: number; raids: number; hunger: number; plague: number; age: number; levy: number; other: number; born: number; grew: number; oneSex: boolean; taken: boolean }
const CAUSES = ['war', 'raids', 'hunger', 'plague', 'age', 'levy', 'other'] as const;
type Cause = (typeof CAUSES)[number];
/** A town that died out: what took most of its people in the two years before, and what else was true of it then. */
interface DeadTown { cause: Cause; noBirths: boolean; oneSex: boolean; taken: boolean; side: 'tribe' | 'player' | 'rival' }
/** Seasons looked back over to say what emptied a town. */
const DEAD_WINDOW = 8;

interface Watch {
  decided: number; // the season the campaign was decided, or -1
  how: string; // who won it: 'player beaten', 'player', 'rival', or 'ruin' (nobody: ruin.ts)
  ages: number[]; // seasons a rival took to reach each next age
  growth: number[]; // all its people (grown and children) after 20 years over all at the start, for towns held by one people throughout
  grownGrowth: number[]; // the same, grown people alone
  townSeasons: TownSeason[];
  caravans?: Campaign['caravanTally']; // the markets' caravans (caravans.ts)
  innRoads?: Campaign['convoyTally']; // the player's convoys a band lay in wait for, with an Inn on the road and without (convoys.ts)
  roadCosts?: Campaign['roadCost'];
  roads?: Campaign['roadTally']; // meetings on the road, by their rule and by the clash (roadclash.ts)
  stories: number; storyYears: number; // stories inside the story begun for the player (intrigue.ts), and the years the player's nation lived
  townLives: number; diedOut: number; diedAfterAll: number;
  /** Every town that died out (tribes' too), with what emptied it: see `whyDead`. */
  dead: DeadTown[];
  /** People killed by plague in the first twenty years, every people and the tribes together (the season's ledger). */
  plagueDead: number;
  /** Households that moved between a people's towns in the first twenty years (migration.ts), the people with them, why they went, and settlers who founded a town. */
  moves: { households: number; people: number; settlers: number; why: Record<string, number> };
  hungerDead: Record<number, number>; // by people, over the first 20 years
  worstHunger: number; // the largest share of a town lost to hunger in one season
  storeSeasons: number[]; // each nation that had a stretch of peace: the median, over its seasons of peace, of the seasons of food it had in store
  peaceSeasons: number; // the nation-seasons they were read from
  faithGaps: number[]; // widest gap between two towns of one nation, each nation-season
  holyMoves: number[]; // a nation with churches, fed: its standing over 20 years
  lords20: { player: number; playerAngry: number; playerContent: number; rivals: number; rivalsAngry: number; rivalsContent: number; plots: number }; // at 20 years: lords, and the angry among them (nobles.ts)
  lordActs: { help: number; withhold: number; joined: number }; // the player's nobles acting in twenty years, from the log (nobleacts.ts)
  gold20: number[]; // at 20 years, the player's gold in all its towns, if the player is alive
  grain: { buys: number; food: number; gold: number }; // the player's grain bought abroad by decree in twenty years (grain.ts), from the log
  halls: { rivals: number; with: number }; // at 20 years: rival nations alive, and those with a Hall of Judgement standing (townworks.ts)
  houses: { holy: number; with: number }; // at 20 years: Righteous towns, and those with a Monastery or Convent standing
  raids: { outcome: string; /** An army of its people stood in the town; a strike on a road. */ army?: boolean; road?: boolean; /** What the band took of the town's stores, the people it carried off, and the rounds the fight ran. */ goods?: number; carried?: number; rounds?: number; /** Stage three, report only: what it would have come to with the town's men turned out as bands; the town's men; the share of its companies' weight it would have lost; the men it did lose. */ would?: string; men?: number; pressed?: number; killed?: number; /** The men who would have died of it by what the bands lost. */ dead?: number; /** Where it would have broken (and could be taken): what that cost the band, as a share of its weight. */ cost?: number }[]; raidTownYears: number;
  /** Every strike by a band on a held town: was it held off, what it cost in people, and whether the town kept a town watch (townwatch.ts) or had a Fortress (fortress.ts). */
  strikes: { held: boolean; lost: number; watch: boolean; fort: boolean; mine: boolean; /** What the sum made of it, and what a clash would have (raidclash.ts); not for a strike on the road. */ sum: string; clash: string; road: boolean; /** The sum's own line for a taking was crossed, whether or not the town could be taken again. */ low: boolean; /** The town's defence over the band's force, as the old lines read it. */ ratio: number }[];
  /** Unrest begun in a town (unrest.ts), with what weighed on it then; towns that rose and became free (freetown.ts), and what became of them. */
  stirs: { hungry: boolean; angry: boolean; sour: boolean; fresh: boolean; tavern: boolean; founded: boolean; mine: boolean }[];
  free: { rose: number; back: number; retaken: number; taken: number; still: number };
  /** The season the player took its first age, or -1. */
  firstAge: number;
  /** Marches in from the far wilds (bandwilds.ts), and how many bands of any kind came in the campaign. */
  marches: March[]; bandsCame: number;
  /** Claimants to the throne (claimants.ts): wives taken into a lord's house, children written down by parent, and what became of each. */
  claims: { wives: number; noble: number; band: number; home: number; grown: number; nofollowing: number; towns: number; putdown: number; swallowed: number; lapsed: number; crowned: number; standing: number; mine: number; mineGrown: number; mineGrownNoble: number; raised: number; mineRisen: number; mineRisenNoble: number; mineChild: number };
  /** Every thief and killer (intrigue.ts): the seasons it was at large, and how many of them a Watch House stood in the town. */
  crimes: { seasons: number; watched: number }[];
  /** The player's convoys that finished their road (convoys.ts, read from the log): whether the player had an Inn standing or sent Escorts that season, whether a band stopped it, and the stores it took. */
  convoys: { inn: boolean; escorts: boolean; stopped: boolean; took: number }[];
  /** Every spell of hunger in a held town: how many seasons running, and whether its people had Paved Roads when it began. */
  hungers: { seasons: number; paved: boolean; mine: boolean }[];
  /** The player's towns, season by season: how many town-seasons, how many of them hungry, and the grown people in them added up. */
  mine: { seasons: number; hungry: number; grown: number };
  captives: { near: boolean; back: boolean }[];
  taken: { garrison: boolean; rose: boolean }[];
  retaken: number; unsettled: number; // taken towns not counted: taken again by force within five years, or still followed when the run ended
  arms: { war: boolean; share: number }[];
  reached60: number[]; reached70: number[]; // by season: those who turned sixty, and seventy
  sieges: Siege[]; // settled on the map
  falling: number; // towns whose standing fell 10 or more over 20 years, held by one people throughout
  fallingTowns: number;
  met: number; // the first season a story waited on the player's word face to face (encounter.ts), or -1
  driftSeasons: { lost: number; ts: number }; // drift's toll summed season by season over every town held by the one people it began with, and the town-seasons (the decrees row's second reading)
  driftLost: number[]; // standing each such town lost to drift alone over the 20 years (drift.ts, `drift.lost`)
  named: { battle: number; wins: number; share: number[]; kills: number[]; mine: number }; // soldiers named on the map, by a battle fought out there or by two wins (veteranhome.ts, rivalrule.ts)
}

const CRIME_ROW = 'Seasons a thief or a killer is at large, with a Watch House in every town against as it is (read with CRIME=1)', CRIME_BAND = '10 to 30% fewer';
const INN_ROW = 'Of the player\'s convoys a band lay in wait for, stopped with an Inn on the road against without', INN_BAND = 'fewer with an Inn';
const WATCH_ROW = 'Raids on the player\'s towns held off, with Town Watch learnt against without (read with CRIME=1)', WATCH_BAND = '5 to 20 more in every 100';
/** For the forced comparison (CRIME=1): these buildings finished in every town the player holds, free, and these studies learnt. */
const FORCED = {
  house: { works: ['watchhouse'], studies: [] as string[] },
  watch: { works: ['watchhouse'], studies: ['townwatch'] },
  roads: { works: ['inn'], studies: ['escorts', 'pavedroads'] },
};
function give(c: Campaign, what: { works: string[]; studies: string[] }): void {
  const f = c.factions[0];
  for (const id of what.studies) if (!f.studies?.includes(id)) f.studies = [...(f.studies ?? []), id];
  for (const t of c.territories) for (const type of what.works) {
if (t.owner !== 0 || t.horde || standsAt(c, t.id, type)) continue;
if (!t.town?.b?.length) layTown(c, t.id);
if (!t.town?.b?.length) continue;
const i = t.town.b.findIndex((x) => x[0] === type);
if (i >= 0) { t.town.b[i] = [t.town.b[i][0], t.town.b[i][1], t.town.b[i][2]] as typeof t.town.b[number]; continue; }
const at = plotFor(t, type);
if (at) t.town.b.push([type, at.cx, at.cy] as typeof t.town.b[number]);
  }
}
function play(seed: number, ruled: boolean, seasons: number, forced: '' | keyof typeof FORCED = ''): Watch {
  const c = newCampaign(seed, 2, 1, civOf(seed));
  watched = [];
  if (!ruled) c.decreesOff = true;
  const w: Watch = { decided: -1, how: '', stories: 0, storyYears: 0, ages: [], growth: [], grownGrowth: [], townSeasons: [], townLives: 0, diedOut: 0, diedAfterAll: 0, dead: [], plagueDead: 0, moves: { households: 0, people: 0, settlers: 0, why: {} }, hungerDead: {}, worstHunger: 0, storeSeasons: [], peaceSeasons: 0, faithGaps: [], holyMoves: [], lords20: { player: 0, playerAngry: 0, playerContent: 0, rivals: 0, rivalsAngry: 0, rivalsContent: 0, plots: 0 }, lordActs: { help: 0, withhold: 0, joined: 0 }, gold20: [], grain: { buys: 0, food: 0, gold: 0 }, halls: { rivals: 0, with: 0 }, houses: { holy: 0, with: 0 }, raids: [], raidTownYears: 0, strikes: [], firstAge: -1, stirs: [], free: { rose: 0, back: 0, retaken: 0, taken: 0, still: 0 }, marches: [], bandsCame: 0, claims: { wives: 0, noble: 0, band: 0, home: 0, grown: 0, nofollowing: 0, towns: 0, putdown: 0, swallowed: 0, lapsed: 0, crowned: 0, standing: 0, mine: 0, mineGrown: 0, mineGrownNoble: 0, raised: 0, mineRisen: 0, mineRisenNoble: 0, mineChild: 0 }, crimes: [], convoys: [], hungers: [], mine: { seasons: 0, hungry: 0, grown: 0 }, captives: [], taken: [], retaken: 0, unsettled: 0, arms: [], reached60: [], reached70: [], sieges: [], falling: 0, fallingTowns: 0, driftSeasons: { lost: 0, ts: 0 }, met: -1, driftLost: [], named: { battle: 0, wins: 0, share: [], kills: [], mine: 0 } };
  const start = c.territories.map((t) => ({ owner: t.owner, grown: grown(folkOf(c, t.id)), all: grown(folkOf(c, t.id)) + folkOf(c, t.id).children, standing: townStanding(c, t.id) }));
  const steady = c.territories.map((t) => t.owner >= 0); // held by the one people since the start
  const lostTo = c.territories.map(() => 0); // standing each town has lost to drift alone (drift.ts)
  const virtue0 = c.factions.map((f) => f.virtue ?? 0);
  const churched = c.factions.map(() => 0), hungryOf = c.factions.map(() => 0), townSeasonsOf = c.factions.map(() => 0);
  const lastAge = c.factions.map((f) => ({ age: ageOf(c, f.id), at: 0 }));
  const war = c.factions.map(() => -99); // the last season each people fought for land
  const warSeasons = c.factions.map(() => new Set<number>()); // every season each people fought for land
  const fed = c.factions.map((): number[] => []); // a people's seasons of food in store, in each season of peace
  const strife = c.territories.map(() => ({ war: -99, famine: -99, plague: -99 })); // the last season of each at a town
  const alive = c.territories.map((t) => grown(folkOf(c, t.id)) + folkOf(c, t.id).children > 0);
  const convoyTo = new Set<number>();
  const groups = new Map<string, { near: boolean; since: number }>();
  const movesSeen = new WeakSet<object>(); // the moves already counted (migration.ts keeps the last few on `c.moves`)
  const takenAt = new Map<number, { since: number; owner: number; garrisoned: number; seen: number }>();
  let logAt = c.log.length;
  const hungrySpell = c.territories.map((): { seasons: number; paved: boolean; owner: number } | null => null); // the spell of hunger each town is in
  const freeWas = c.territories.map((): { from: number } | null => null);
  const atLarge = new Map<number, { seasons: number; watched: number }>(); // each thief and killer, by the story's id
  const losses: Losses[][] = [];
  const names = new Map(c.factions.map((f) => [f.name, f.id]));
  const seenNamed = new Set<string>(c.armies.filter((a) => a.champion).map((a) => `${a.id}|${a.champion!.name}`));
  for (let s = 1; s <= seasons; s++) {
if (forced) give(c, FORCED[forced]);
// Soldiers named on the map since last season, while the campaign is undecided (veteranhome.ts, rivalrule.ts).
if (c.phase !== 'over') for (const a of c.armies) {
  const ch = a.champion, key = ch ? `${a.id}|${ch.name}` : '';
  if (!ch || seenNamed.has(key)) continue;
  seenNamed.add(key);
  if (ch.named) { w.named.battle++; w.named.share.push(ch.kills / Math.max(1, ch.named.felled)); w.named.kills.push(ch.kills); } else w.named.wins++;
  if (a.owner === 0) w.named.mine++;
}
// Once a campaign is decided, the world is let go on turning until twenty years have passed, so that the
// twenty-year figures are read from every campaign; the campaign's figures are read from the decision.
if (c.phase === 'over') {
  if (w.decided < 0) { w.decided = c.turn; w.how = c.ended === 'ruin' ? 'ruin' : !c.factions[0].alive ? 'player beaten' : c.winner === 0 ? 'player' : 'rival'; }
  if (s > YEARS20) break;
  c.phase = 'player';
}
const owners = c.territories.map((t) => t.owner);
for (const x of c.convoys ?? []) convoyTo.add(x.to);
const counted = c.territories.map((t) => ({ grown: grown(folkOf(c, t.id)), away: awayFrom(c, t.id) })), seq = c.ledgerSeq ?? 0;
season(c, ruled);
const now = c.turn;
// Families that set out this season (migration.ts): each move is counted once, as it is first seen on the record.
for (const m of c.moves ?? []) {
  if (movesSeen.has(m) || s > YEARS20) continue;
  movesSeen.add(m);
  if (m.found) { w.moves.settlers++; continue; }
  w.moves.households++; w.moves.people += m.people; w.moves.why[m.why] = (w.moves.why[m.why] ?? 0) + 1;
}
// What took each town's people this season, by cause (the ledger, the raids, the levy); what is missing besides is `other`.
{
  const got = c.territories.map((): Losses => ({ war: 0, raids: 0, hunger: 0, plague: 0, age: 0, levy: 0, other: 0, born: 0, grew: 0, oneSex: false, taken: false }));
  for (const e of ledgerSince(c, seq)) {
const x = got[e.at];
if (!x) continue;
if (e.kind === 'sick' && s <= YEARS20) w.plagueDead += e.n;
if (e.kind === 'fell') x.war += e.n; else if (e.kind === 'starved') x.hunger += e.n; else if (e.kind === 'sick') x.plague += e.n; else if (e.kind === 'aged') x.age += e.n; else if (e.kind === 'born') x.born += e.n; else if (e.kind === 'grew') x.grew += e.n;
  }
  for (const r of (c.raids ?? []).filter((x) => x.turn === now)) got[r.at].raids += r.killed + r.taken.men + r.taken.women;
  for (const t of c.territories) {
const x = got[t.id], f = folkOf(c, t.id), away = awayFrom(c, t.id);
x.levy = Math.max(0, away - counted[t.id].away);
// Counted among the grown: the children a town loses when nobody grown is left (taken in elsewhere) are not what emptied it.
const gone = counted[t.id].grown + x.grew - grown(f), known = x.war + x.raids + x.hunger + x.plague + x.age + x.levy;
x.other = Math.max(0, gone - known);
x.oneSex = grown(f) > 0 && (f.men + away === 0 || f.women === 0);
x.taken = t.owner !== owners[t.id];
(losses[t.id] ??= []).push(x);
if (losses[t.id].length > DEAD_WINDOW) losses[t.id].shift();
  }
}
// Land that changed hands: both peoples were at war; a town taken by force carries a yoke (conquered.ts).
// A free town come back by treaty (freetown.ts) changed hands with no war: nobody fought for it.
const treaties = new Set(c.log.slice(logAt).filter((l) => l.includes('rule by treaty')).map((l) => c.territories.find((t) => l.startsWith(`${t.name} has come back`))?.id ?? -1));
for (const t of c.territories) {
  const was = owners[t.id];
  if (t.owner === was) continue;
  steady[t.id] = false;
  if (!treaties.has(t.id)) { for (const f of [was, t.owner]) if (f >= 0) { war[f] = now; warSeasons[f].add(now); } strife[t.id].war = now; }
  const ev = (c.events ?? []).some((e) => e.at === t.id && e.turn === now && e.kind === 'revolt');
  const watched = takenAt.get(t.id);
  // A town followed since it was taken: it rose, or it was taken again by force (and is not counted, having had no five years to settle).
  if (watched && watched.owner === was) { if (ev && now - watched.since <= 20) w.taken.push({ garrison: watched.garrisoned * 2 > watched.seen, rose: true }); else w.retaken++; takenAt.delete(t.id); }
  // Taken this season: the yoke is stamped with the season of the capture, which is the one just played (now - 1) or,
  // for a capture after the season turned, this one. It is followed from then, once for this capture.
  if (t.owner >= 0 && t.yoke && t.yoke.since >= now - 1) takenAt.set(t.id, { since: t.yoke.since, owner: t.owner, garrisoned: 0, seen: 0 });
}
for (const [tid, x] of takenAt) {
  const t = c.territories[tid];
  if (t.owner !== x.owner) { takenAt.delete(tid); continue; }
  x.seen++; if (armyAt(c, tid)?.owner === x.owner) x.garrisoned++;
  if (now - x.since >= 20) { w.taken.push({ garrison: x.garrisoned * 2 > x.seen, rose: false }); takenAt.delete(tid); }
}
if (w.firstAge < 0 && c.factions[0].alive && ageOf(c, 0) >= 1) w.firstAge = s;
// Unrest begun this season, with what weighed on the town; and the free towns: risen, come back, taken.
for (const e of c.events ?? []) if (e.kind === 'unrest' && e.turn === now && c.territories[e.at].owner >= 0) {
  const u = unrestWeights(c, e.at), t = c.territories[e.at];
  w.stirs.push({ hungry: u.hungry > 1, angry: u.nobles >= UNREST.angry, sour: u.nobles > 1.1 && u.nobles < UNREST.angry, fresh: u.held > 1.1, tavern: u.tavern > 1, founded: ownFounded(c, e.at), mine: t.owner === 0 });
}
for (const t of c.territories) {
  const was = freeWas[t.id];
  if (t.free && !was && t.free.claimant === undefined) w.free.rose++; // a town risen for a claimant is counted with the claimants, not here
  if (was && !t.free) { if (t.owner === was.from && treaties.has(t.id)) w.free.back++; else if (t.owner === was.from) w.free.retaken++; else w.free.taken++; }
  freeWas[t.id] = t.free && (was || t.free.claimant === undefined) ? { from: t.free.from } : null;
}
// Acts of God and raids this season, at each town.
for (const e of c.events ?? []) {
  if (e.turn !== now) continue;
  if (e.kind === 'famine') strife[e.at].famine = now;
  if (e.kind === 'plague' || e.kind === 'fever') strife[e.at].plague = now;
}
const raidsNow = (c.raids ?? []).filter((r) => r.turn === now);
for (const r of raidsNow) { if (r.owner >= 0) w.raids.push({ outcome: r.outcome, army: r.defence.army > 0 && r.kind !== 'highwaymen', road: r.kind === 'highwaymen', goods: r.stores.food + r.stores.wood + r.stores.gold + r.stores.stone, carried: r.taken.men + r.taken.women, rounds: r.rounds ?? 0, ...(r.would ? { would: r.would, men: r.men ?? 0, pressed: r.wouldLost ?? 0, killed: r.killed, dead: r.wouldDead ?? 0, ...(r.wouldCost !== undefined ? { cost: r.wouldCost } : {}) } : {}) }); if (r.outcome !== 'held') strife[r.at].war = now; }
for (const r of raidsNow) if (r.owner >= 0) w.strikes.push({ held: r.outcome === 'held', lost: r.killed + r.taken.men + r.taken.women, watch: hasStudy(c, r.owner, 'townwatch') && standsAt(c, r.at, 'watchhouse'), fort: hasFortress(c, r.at), mine: r.owner === 0, sum: r.outcome, clash: raidForeseen(r, faithAt(c, r.at)).outcome, road: r.kind === 'highwaymen', low: r.defence.total / Math.max(0.1, r.force) < THREATS.fall, ratio: r.defence.total / Math.max(0.1, r.force) });
// Thieves and killers at large this season: begun, not ended, and (a thief) not yet standing for judgement.
for (const x of c.intrigues ?? []) {
  if (!ofTown(x) || x.ended || x.caught !== undefined || x.owner !== 0) continue; // the player's towns (rivals' have them too: rivalstories.ts)
  const k = atLarge.get(x.id) ?? { seasons: 0, watched: 0 };
  k.seasons++; if (standsAt(c, x.at, 'watchhouse')) k.watched++;
  atLarge.set(x.id, k);
}
// Every held town.
if (s <= YEARS20) for (const t of c.territories) if (steady[t.id] && t.folk?.drift?.lost) lostTo[t.id] += t.folk.drift.lost; // drift's own toll, season by season
if (w.met < 0 && awaiting(c).length) w.met = s; // a story met face to face
if (s <= YEARS20) for (const t of c.territories) if (steady[t.id] && t.owner >= 0 && t.folk?.drift) { w.driftSeasons.lost += t.folk.drift.lost ?? 0; w.driftSeasons.ts++; } // and over every town held that season
for (const t of held(c)) {
  const f = folkOf(c, t.id), g = grown(f), away = awayFrom(c, t.id);
  if (f.hungry) strife[t.id].famine = now;
  const raided = raidsNow.some((r) => r.at === t.id) || (c.raids ?? []).some((r) => r.at === t.id && r.turn === now - 1);
  const newly = !!t.yoke && now - t.yoke.since <= 8;
  const drifted = (f.drifted?.tavern ?? 0) + (f.drifted?.mines ?? 0) > 0;
  const goods = STORE_KINDS.reduce((k, x) => k + Math.max(0, f.stores[x]), 0);
  const canFarm = !t.buildings.includes('farm') && t.buildings.length < slots(t) && goods - siteCost(t, 'farm', c.factions[t.owner].civ) * 100 >= GOVERN.floor;
  w.townSeasons.push({ tribe: false, hungry: !!f.hungry, farmed: t.buildings.includes('farm'), canFarm, convoy: convoyTo.has(t.id), drifted, strained: f.hungry ? 'hungry' : raided ? 'raided' : newly ? 'taken' : '', oneSex: g + away > 0 && (f.men + away === 0 || f.women === 0) });
  if (s <= YEARS20) {
townSeasonsOf[t.owner]++;
if (f.hungry) hungryOf[t.owner]++;
  }
  w.raidTownYears += 0.25;
}
// The tribes' towns, for the one figure that is theirs.
for (const t of c.territories) {
  if (t.owner >= 0 || t.horde) continue;
  const f = folkOf(c, t.id), g = grown(f);
  if (g > 0) w.townSeasons.push({ tribe: true, hungry: false, farmed: false, canFarm: false, convoy: true, drifted: false, strained: '', oneSex: f.men === 0 || f.women === 0 });
}
// Who turned sixty and seventy this season, in every town that keeps its people's ages (ageing.ts).
let r60 = 0, r70 = 0;
for (const t of c.territories) {
  const a = t.folk?.ages;
  if (!a) continue;
  for (const x of [...a.m, ...a.f]) { if (x === AT60) r60++; else if (x === AT70) r70++; }
}
w.reached60.push(r60); w.reached70.push(r70);
convoyTo.clear();
for (const f of c.factions) if (f.alive && c.territories.some((t) => t.owner === f.id && t.buildings.includes('church'))) churched[f.id]++;
// Towns that die out: nobody grown and no child left.
for (const t of c.territories) {
  if (t.horde) continue;
  const f = folkOf(c, t.id), any = grown(f) + f.children > 0;
  if (alive[t.id] && !any) w.dead.push(whyDead(losses[t.id] ?? [], owners[t.id] < 0 ? 'tribe' : owners[t.id] === 0 ? 'player' : 'rival'));
  if (alive[t.id] && !any && (owners[t.id] >= 0 || t.owner >= 0)) {
w.diedOut++;
const x = strife[t.id], recent = (k: number) => now - k <= 8;
if (recent(x.war) && recent(x.famine) && recent(x.plague)) w.diedAfterAll++;
  }
  alive[t.id] = any;
}
// Hunger's dead, from the log.
for (const line of c.log.slice(logAt)) {
  const g = /^Grain bought abroad for .+?: (\d+) food for (\d+) gold\./.exec(line);
  if (s <= YEARS20) { if (/young men to|gold of (his|her) own for the war/.test(line)) w.lordActs.help++; if (/withholds (his|her) due/.test(line)) w.lordActs.withhold++; if (/have joined the plot/.test(line)) w.lordActs.joined++; }
  if (g && s <= YEARS20) { w.grain.buys++; w.grain.food += +g[1]; w.grain.gold += +g[2]; }
  const m = /^Hunger has killed (\d+) of (your people|the (.+?)) at (.+?), after/.exec(line);
  if (!m) continue;
  const who = m[2] === 'your people' ? 0 : names.get(m[3]) ?? -1, dead = +m[1];
  if (s <= YEARS20) w.hungerDead[who] = (w.hungerDead[who] ?? 0) + dead;
  const t = c.territories.find((x) => x.name === m[4]);
  const before = t ? dead + grown(folkOf(c, t.id)) : 0;
  if (before >= 4) w.worstHunger = Math.max(w.worstHunger, dead / before);
}
// The player's convoys, from the log: each that came in or had nowhere to go, and each a band stopped.
{
  const inn = nationHas(c, 0, 'inn'), escorts = hasStudy(c, 0, 'escorts');
  let done = 0;
  const stops: number[] = [];
  for (const line of c.log.slice(logAt)) {
if (/^A convoy from .+ has come in to /.test(line) || /^Your convoy to .+ had nowhere left to go/.test(line)) done++;
const m = /stopped your convoy to .+ and took (.+)\.$/.exec(line);
if (m) stops.push([...m[1].matchAll(/(\d+) (?:food|wood|gold|stone)/g)].reduce((k, x) => k + +x[1], 0));
  }
  for (let i = 0; i < Math.max(done, stops.length); i++) w.convoys.push({ inn, escorts, stopped: i < stops.length, took: stops[i] ?? 0 });
}
// Spells of hunger, town by town.
for (const t of c.territories) if (t.owner === 0 && !t.horde) { const f = folkOf(c, t.id); w.mine.seasons++; w.mine.grown += grown(f); if (f.hungry) w.mine.hungry++; }
for (const t of c.territories) {
  const sp = hungrySpell[t.id], hungry = t.owner >= 0 && !!folkOf(c, t.id).hungry;
  if (sp && (!hungry || t.owner !== sp.owner)) { w.hungers.push({ seasons: sp.seasons, paved: sp.paved, mine: sp.owner === 0 }); hungrySpell[t.id] = null; }
  if (hungry) { const k = hungrySpell[t.id] ?? (hungrySpell[t.id] = { seasons: 0, paved: hasStudy(c, t.owner, 'pavedroads'), owner: t.owner }); k.seasons++; }
}
logAt = c.log.length;
// A rival reaching its next age.
for (const f of c.factions) {
  if (f.id === 0 || !f.alive) continue;
  const a = ageOf(c, f.id);
  if (a > lastAge[f.id].age) { w.ages.push(now - lastAge[f.id].at); lastAge[f.id] = { age: a, at: now }; }
}
// A nation's towns, side by side, and its men under arms.
for (const f of c.factions) {
  if (!f.alive) continue;
  const sp = faithSpread(c, f.id);
  if (sp.towns >= 2) w.faithGaps.push(sp.spread);
  const away = c.armies.filter((a) => a.owner === f.id).reduce((k, a) => k + menOf(c, a).town, 0);
  const home = c.territories.filter((t) => t.owner === f.id && !t.horde).reduce((k, t) => k + folkOf(c, t.id).men, 0);
  if (away + home > 0) w.arms.push({ war: now - war[f.id] <= 4, share: away / (away + home) });
  // A season of peace: ten years in, and the people fought for land in no more than two of the last ten.
  if (now >= PEACE_YEARS * 4) {
let fought = 0;
for (let k = now - PEACE_YEARS * 4 + 1; k <= now; k++) if (warSeasons[f.id].has(k)) fought++;
if (fought <= PEACE_WAR_SEASONS) {
  const own = c.territories.filter((t) => t.owner === f.id && !t.horde);
  const food = own.reduce((k, t) => k + folkOf(c, t.id).stores.food, 0), need = own.reduce((k, t) => k + needOf(c, t.id), 0);
  if (need > 0) fed[f.id].push(food / need);
}
  }
}
// Captives held by bands: got back, or held too long.
const seen = new Set<string>();
for (const b of c.bands ?? []) for (const h of b.held) {
  const key = `${b.id}:${h.since}:${h.from}`;
  seen.add(key);
  const near = c.armies.some((a) => a.owner === h.owner && [b.at, b.to].some((p) => p !== undefined && (a.at === p || c.territories[a.at].adj.includes(p))));
  const g = groups.get(key) ?? { near: false, since: h.since };
  groups.set(key, { near: g.near || near, since: h.since });
}
// Gone before their time was up: got back. Gone at it: held too long (threats.ts, captivesSeason).
for (const [key, g] of groups) if (!seen.has(key)) { w.captives.push({ near: g.near, back: now - g.since < THREATS.holdFor }); groups.delete(key); }
// Twenty years on.
if (now === YEARS20) {
  for (const t of c.territories) {
if (!steady[t.id] || t.owner !== start[t.id].owner || t.horde) continue;
if (start[t.id].all > 0) w.growth.push((grown(folkOf(c, t.id)) + folkOf(c, t.id).children) / start[t.id].all);
if (start[t.id].grown > 0) w.grownGrowth.push(grown(folkOf(c, t.id)) / start[t.id].grown);
w.fallingTowns++;
if (townStanding(c, t.id) <= start[t.id].standing - 10) w.falling++;
w.driftLost.push(lostTo[t.id]);
  }
  // What stands by twenty years (report only: read off the towns' records, townworks.ts).
  if (c.factions[0]?.alive) w.gold20.push(goldOf(c, 0));
  for (const fac of c.factions) {
if (!fac.alive) continue;
const lords = noblesOf(c, fac.id).filter((n) => n.rank === 'lord'), angry = lords.filter(isAngry).length, content = lords.filter((n) => n.mood >= ACTS.content).length;
if (fac.id === 0) { w.lords20.player += lords.length; w.lords20.playerAngry += angry; w.lords20.playerContent += content; } else { w.lords20.rivals += lords.length; w.lords20.rivalsAngry += angry; w.lords20.rivalsContent += content; }
  }
  for (const f of c.factions) {
if (f.id === 0 || !f.alive) continue;
w.halls.rivals++;
if (nationHas(c, f.id, 'hall')) w.halls.with++;
  }
  for (const t of c.territories) {
if (t.owner < 0 || t.horde || !c.factions[t.owner]?.alive || creedOf(faithAt(c, t.id)).id !== 'zealous') continue;
w.houses.holy++;
if (GREAT_HOUSES.some((b) => standsAt(c, t.id, b))) w.houses.with++;
  }
  for (const f of c.factions) {
if (!f.alive) continue;
const own = c.territories.filter((t) => t.owner === f.id && !t.horde);
if (churched[f.id] >= YEARS20 / 2 && townSeasonsOf[f.id] > 0 && hungryOf[f.id] / townSeasonsOf[f.id] < 0.05) w.holyMoves.push((f.virtue ?? 0) - virtue0[f.id]);
  }
}
  }
  w.sieges = watched;
  w.caravans = c.caravanTally ? JSON.parse(JSON.stringify(c.caravanTally)) : undefined;
  w.innRoads = c.convoyTally ? JSON.parse(JSON.stringify(c.convoyTally)) : undefined;
  w.roads = c.roadTally ? JSON.parse(JSON.stringify(c.roadTally)) : undefined;
  w.roadCosts = c.roadCost ? JSON.parse(JSON.stringify(c.roadCost)) : undefined;
  w.stories = (c.intrigueSeq ?? 0) - (c.rivalStoriesBegun ?? 0); w.storyYears = c.turn / 4; // the player's stories: the rivals' are counted apart (rivalstories.ts)
  w.lords20.plots = (c.intrigues ?? []).filter((it) => it.kind === 'plot' && it.owner === 0 && !it.claim).length; // a judgement after a claimant's rising is no plot begun (claimantjudged.ts)
  w.crimes = [...atLarge.values()];
  w.free.still = c.territories.filter((t) => t.free && t.owner < 0).length;
  w.marches = [...(c.marches ?? [])]; w.bandsCame = c.bandSeq ?? 0;
  w.claims.wives = c.wivesTaken ?? 0;
  for (const cl of c.claims ?? []) {
w.claims[cl.parent]++;
if (cl.owner === 0) w.claims.mine++;
w.claims.towns += cl.towns?.length ?? 0;
    if (cl.grown !== undefined) { w.claims.grown++; if (cl.owner === 0) { w.claims.mineGrown++; if (cl.parent === 'noble') w.claims.mineGrownNoble++; } }
const how = cl.ended?.how;
    if (cl.raised !== undefined) w.claims.raised++;
    if (cl.owner === 0 && (cl.raised !== undefined || (cl.grown !== undefined && how !== 'nofollowing'))) { w.claims.mineRisen++; if (cl.parent === 'noble') w.claims.mineRisenNoble++; if (cl.raised !== undefined) w.claims.mineChild++; }
if (how === 'home' || how === 'nofollowing' || how === 'putdown' || how === 'swallowed' || how === 'lapsed' || how === 'crowned') w.claims[how]++;
else if (!cl.ended && cl.grown !== undefined) w.claims.standing++;
  }
  for (const sp of hungrySpell) if (sp) w.hungers.push({ seasons: sp.seasons, paved: sp.paved, mine: sp.owner === 0 });
  for (const xs of fed) if (xs.length) { w.storeSeasons.push(median(xs)); w.peaceSeasons += xs.length; }
  w.unsettled = takenAt.size;
  w.townLives = w.townSeasons.filter((x) => !x.tribe).length / YEARS20;
  if (c.phase === 'over' && w.decided < 0) { w.decided = c.turn; w.how = c.ended === 'ruin' ? 'ruin' : !c.factions[0].alive ? 'player beaten' : c.winner === 0 ? 'player' : 'rival'; }
  return w;
}

/** The odds the map gives a real-time siege's attacker: its army's map strength over the town's defence (TUNING.md). */
const SIEGE_ODDS = [1.0, 1.6];
/** Real-time sieges, computer against computer, drawn like the sieges that happen in a campaign: the campaign is played
 * on by the computer for some years, so each people is at its own age, and then the rival comes against the player's
 * capital (given a Fortress, the case the figure asks about) with an army the map rates at SIEGE_ODDS of the town's
 * defence. Returns the sieges, and the odds and ages each was fought at. */
function realSieges(): { sieges: Siege[]; odds: number[]; ages: [number, number][] } {
  const out: Siege[] = [], odds: number[] = [], ages: [number, number][] = [];
  const kept = watched; watched = []; // these sieges' own map battles are not the campaigns'
  const peoples = CIV_IDS.filter((id) => id !== 'wild');
  for (let k = 1; out.length < SIEGES && k <= SIEGES * 4; k++) {
const seed = k * 2;
const c = newCampaign(seed, 1, 1, peoples[seed % peoples.length]);
// Years of the campaign first, so that both peoples are at the age they have come to.
const years = 20 + ((k * 7) % 29);
for (let s = 0; s < years; s++) { if (c.phase === 'over') c.phase = 'player'; season(c, true); }
const home = c.territories.find((t) => t.capital === 0 && t.owner === 0);
if (!home || !c.factions[1].alive || c.pending) continue;
if (!home.buildings.includes('fortress')) home.buildings.push('fortress');
const from = home.adj.find((n) => c.territories[n].owner === 1) ?? home.adj[0];
// The army, grown a company at a time until the map rates the assault within SIEGE_ODDS; each try on a copy.
const want = SIEGE_ODDS[0] + (SIEGE_ODDS[1] - SIEGE_ODDS[0]) * ((k * 0.37) % 1);
let chosen: Campaign | null = null, ratio = 0;
for (let n = 1; n <= 40 && !chosen; n++) {
  const t = structuredClone(c);
  t.phase = 'player'; t.demand = null; t.pending = null;
  t.territories[from].owner = 1;
  const units: Record<string, number> = { infantry: Math.ceil(n / 2), archers: Math.floor(n / 2) };
  t.armies = t.armies.filter((a) => a.at !== from);
  t.armies.push({ id: 9999, owner: 1, at: from, units, hero: false, vet: 0, moved: false });
  if (moveArmy(t, 9999, home.id) !== 'battle' || !t.pending) break;
  ratio = t.pending.aStr / Math.max(0.1, t.pending.dStr);
  if (ratio >= want || ratio >= SIEGE_ODDS[1]) chosen = t;
}
if (!chosen || ratio < SIEGE_ODDS[0] || ratio > SIEGE_ODDS[1]) continue;
chosen.pending!.mode = 'siege';
const cfg = battleConfig(chosen);
if (!cfg) continue;
const setups = cfg.setups.map((x) => ({ ...x, isAI: true }));
const g = new Game(cfg.seed, setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
if (cfg.ground) g.wear(cfg.ground);
g.fixedAge = true; g.bornOnly = true;
const ais = setups.map((_, i) => { const a = new AIController(g, i); a.setLevel(1); return a; });
const def = cfg.humanAttacks ? 1 : 0;
const walls = g.buildings.some((b) => b.owner === def && !b.dead && (b.def.wall || b.type === 'tower' || b.type === 'gate'));
const men = g.units.some((u) => u.owner === def && !u.dead && (u.type === 'villager' || g.isMilitary(u)));
for (let sec = 0; sec < MINUTES * 60 && g.winner < 0; sec++) { for (let i = 0; i < 20; i++) { g.step(); g.events.length = 0; } ais.forEach((a) => a.update()); }
out.push({ walls, men, held: g.winner < 0 || g.players[g.winner].team === g.players[def].team });
odds.push(ratio); ages.push([ageOf(chosen, 1), ageOf(chosen, 0)]);
  }
  watched = kept;
  return { sieges: out, odds, ages };
}

/** What emptied a town: the cause that took most of its people over the seasons looked back on. */
function whyDead(window: Losses[], side: DeadTown['side']): DeadTown {
  const sum = (k: Cause) => window.reduce((n, x) => n + x[k], 0);
  const cause = CAUSES.reduce((best, k) => (sum(k) > sum(best) ? k : best), 'other' as Cause);
  return { cause: CAUSES.some((k) => sum(k) > 0) ? cause : 'other', noBirths: window.every((x) => !x.born), oneSex: window.some((x) => x.oneSex), taken: window.some((x) => x.taken), side };
}

// ---- The report ----

const CAUSE_WORDS: Record<Cause | 'ageBare', string> = {
  war: 'War: men killed in battle, with the armies or in a town fought over',
  raids: 'Raids: people killed or carried off by bands',
  hunger: 'Hunger', plague: 'Plague',
  age: 'Old age, with children still being born', ageBare: 'Old age, with no child born',
  levy: 'Men levied away into the armies',
  other: 'Moved away or not accounted for (convoys, children taken in elsewhere, resettled)',
};
/** What emptied the towns that died out, by cause, nations and tribes apart; and what else was true of them. */
function deadSection(dead: DeadTown[]): string[] {
  if (!dead.length) return [];
  const key = (d: DeadTown): Cause | 'ageBare' => (d.cause === 'age' && d.noBirths ? 'ageBare' : d.cause);
  const keys = (Object.keys(CAUSE_WORDS) as (Cause | 'ageBare')[]).filter((k) => dead.some((d) => key(d) === k));
  const count = (list: DeadTown[], k: string) => list.filter((d) => key(d) === k).length;
  const nations = dead.filter((d) => d.side !== 'tribe'), tribes = dead.filter((d) => d.side === 'tribe');
  const player = dead.filter((d) => d.side === 'player'), rival = dead.filter((d) => d.side === 'rival');
  const pc = (n: number, of: number) => (of ? `${n} (${Math.round((n / of) * 100)}%)` : '0');
  const rows = keys.map((k) => ({ k, n: count(dead, k) })).sort((a, b) => b.n - a.n)
.map(({ k }) => `| ${CAUSE_WORDS[k]} | ${pc(count(dead, k), dead.length)} | ${count(nations, k)} | ${count(player, k)} | ${count(rival, k)} | ${count(tribes, k)} |`);
  const flag = (p: (d: DeadTown) => boolean) => `${pc(dead.filter(p).length, dead.length)}; nations ${pc(nations.filter(p).length, nations.length)}, tribes ${pc(tribes.filter(p).length, tribes.length)}`;
  return [
'## What emptied the towns that died out',
'',
`Every town that died out in the runs above, the tribes\' too (${dead.length}: ${nations.length} of nations, of them ${player.length} the player\'s and ${rival.length} rivals\', and ${tribes.length} of tribes), put down to whatever took most of its people in the ${DEAD_WINDOW} seasons before. Each season's losses among its grown people are read from the season\'s ledger (src/sim/ledger.ts: war, hunger, plague, old age), the raids (killed and carried off) and the men gone to the armies; whatever else the town lost is "moved away or not accounted for".`,
'',
'| What took most of its people | All | Nations | the player\'s | rivals\' | Tribes |',
'| --- | --- | --- | --- | --- | --- |',
...rows,
'',
`- No child born in its last ${DEAD_WINDOW} seasons: ${flag((d) => d.noBirths)}.`,
`- Left all one sex at some time in them: ${flag((d) => d.oneSex)}.`,
`- Taken, or changed hands, in them: ${flag((d) => d.taken)}.`,
'',
  ];
}

const median = (xs: number[]): number => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quart = (xs: number[], q: number): number => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number): string => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—');
const num = (x: number, d = 1): string => (Number.isFinite(x) ? x.toFixed(d) : '—');
const share = <T>(xs: T[], p: (x: T) => boolean): number => (xs.length ? xs.filter(p).length / xs.length : NaN);
const within = (x: number, lo: number, hi: number): boolean => Number.isFinite(x) && x >= lo && x <= hi;

/** The words before a sparse row's own count when it is judged pooled. */
const claimPooled = (pool: { risen: number; n: number; from: string[] }, n: number, risen: number): string =>
  pool.n > n ? `pooled over ${pool.n} campaigns (this set and ${pool.from.join(', ')}): ${num((100 * pool.risen) / pool.n, 1)} every 100 (${pool.risen} in ${pool.n}); this set alone: ` : '';
let claimBase = { risen: 0, noble: 0, n: 0 };
interface Row { area: string; figure: string; band: string; measured: string; verdict: 'IN' | 'OUT' | 'not measurable' | 'not measured' | 'no band yet'; note?: string }

it.skipIf(!process.env.HEALTH)('the health of a campaign', () => {
  const t0 = Date.now();
  const ruled: Watch[] = [], bare: Watch[] = [];
  for (let seed = FIRST; seed < FIRST + CAMPAIGNS; seed++) {
ruled.push(play(seed, true, SEASONS));
bare.push(play(seed, false, YEARS20));
  }
  const all = <K extends keyof Watch>(k: K): Watch[K] extends (infer U)[] ? U[] : never => ruled.flatMap((w) => w[k] as unknown as never[]) as never;
  const rows: Row[] = [];
  const add = (area: string, figure: string, band: string, measured: string, ok: boolean | null | 'report', note?: string) =>
rows.push({ area, figure, band, measured, verdict: ok === 'report' ? 'no band yet' : ok === null ? 'not measurable' : ok ? 'IN' : 'OUT', note });

  // Pace
  const decided = ruled.filter((w) => w.decided >= 0).map((w) => w.decided);
  add('Pace', 'Seasons until a campaign is decided', '60 to 160', `median ${num(median(decided), 0)} (${decided.length} of ${ruled.length} decided; range ${decided.length ? Math.min(...decided) : '—'} to ${decided.length ? Math.max(...decided) : '—'}; ${['player', 'rival', 'player beaten', 'ruin'].map((h) => `${ruled.filter((w) => w.how === h).length} ${h === 'player' ? 'won by the player' : h === 'rival' ? 'won by a rival' : h === 'ruin' ? 'ended in ruin (ruin.ts)' : 'with the player beaten'}`).join(', ')})`, within(median(decided), 60, 160),
'Decided means the campaign ended: one people rules beyond challenge, or the player is beaten. A campaign decided sooner is let go on turning to twenty years for the twenty-year figures, with nobody leaving it.');
  const undecided = share(ruled, (w) => w.decided < 0);
  add('Pace', `Campaigns undecided at ${SEASONS} seasons`, 'under 10%', pct(undecided), undecided < 0.1);
  const ruined = ruled.filter((w) => w.how === 'ruin');
  add('Pace', 'Campaigns ending in ruin', 'rare: under 6 in 100, and with those undecided under 10 in 100 together', `${pct(ruined.length / Math.max(1, ruled.length))} (${ruined.length} of ${ruled.length}${ruined.length ? `, at seasons ${ruined.map((w) => w.decided).sort((a, b) => a - b).join(', ')}` : ''})`, ruined.length / Math.max(1, ruled.length) < 0.06 && ruined.length / Math.max(1, ruled.length) + undecided < 0.1,
'A world where no people gained ground in twenty years while the bands held much of the map: no winner (src/sim/ruin.ts). They are counted among the decided.');
  const ages = all('ages');
  add('Pace', 'Seasons until a rival reaches its next age', '20 to 60', `median ${num(median(ages), 0)} (${ages.length} advances)`, within(median(ages), 20, 60), 'Counted from the start, or from its last age.');

  // People
  const growth = all('growth'), grownOnly = all('grownGrowth');
  add('People', 'A town left alone, all its people (grown and children) after 20 years', '1.5 to 3 times', `median ${num(median(growth), 2)}× (${growth.length} towns held by one people throughout; grown people alone ${num(median(grownOnly), 2)}×)`, within(median(growth), 1.5, 3),
'Nobody visits any town in these runs, so every town is left alone. Grown people and children together, against the same at the start; the grown alone are given beside it, since a child takes fifteen years to be counted grown. Whether it is held by its houses and food is not judged.');
  if (VISITS > 0) {
// The same campaign told twice: every town of the player's visited every season, and none. Each town the
// player held from the start to twenty years on in both tellings is one pair.
let left = 0, seen = 0, pairs = 0, campaigns = 0;
const each: number[] = [];
for (let seed = 1; seed <= VISITS; seed++) {
  const tell = (visits: boolean): Map<number, number> => {
const c = newCampaign(seed, 2, 1, civOf(seed));
const steady = new Set(c.territories.filter((t) => t.owner === 0).map((t) => t.id));
for (let s = 1; s <= YEARS20; s++) {
  if (c.phase === 'over') c.phase = 'player'; // let go on turning, as in play()
  if (visits) for (const id of steady) visit(c, id); // only the towns that can make a pair: a visit is costly
  season(c, true);
  for (const id of [...steady]) if (c.territories[id].owner !== 0) steady.delete(id);
}
return new Map([...steady].map((id) => [id, grown(folkOf(c, id))]));
  };
  const a = tell(false), b = tell(true), both = [...a.keys()].filter((id) => b.has(id));
  if (both.length) campaigns++;
  for (const id of both) { pairs++; left += a.get(id)!; seen += b.get(id)!; if (a.get(id)! > 0) each.push(b.get(id)! / a.get(id)! - 1); }
}
const larger = left > 0 ? seen / left - 1 : NaN;
add('People', 'A town visited every season vs left alone, after 20 years', 'visited 10 to 40% larger', pairs ? `${pct(larger)} larger in all (${pairs} town pairs from ${campaigns} of ${VISITS} campaigns; median town ${pct(median(each))})` : 'no town pair', pairs ? within(larger, 0.1, 0.4) : null,
  'The same campaign told twice, the player\'s first towns visited each season while they are still the player\'s (the computer keeping it for the whole ten minutes) and none; each town the player held from the start to twenty years on in both tellings is a pair, and their grown people are added up. The two tellings part ways as the campaign goes on, so a pair is a town in two different histories, not only visited and not.');
  } else rows.push({ area: 'People', figure: 'A town visited every season vs left alone, after 20 years', band: 'visited 10 to 40% larger', measured: '—', verdict: 'not measured', note: 'A visit is ten minutes of a real battle; run with VISITS=n to measure it on n campaigns (about two minutes each).' });
  const lives = ruled.reduce((k, w) => k + w.townLives, 0), died = ruled.reduce((k, w) => k + w.diedOut, 0), afterAll = ruled.reduce((k, w) => k + w.diedAfterAll, 0);
  const per100 = lives ? (died / lives) * 100 : NaN;
  add('People', 'Towns that die out (no people at all) per 100 town-lifetimes', 'under 3 (and how many after war, famine and plague together)', `${num(per100, 2)} (${died} died out, ${afterAll} of them after war, famine and plague together)`, per100 < 3,
'A town-lifetime is taken as twenty years of a held town, and only held towns are counted. Together means each of the three within the two years before.');
  const oneNation = share(all('townSeasons').filter((x) => !x.tribe), (x) => x.oneSex), oneTribe = share(all('townSeasons').filter((x) => x.tribe), (x) => x.oneSex);
  add('People', 'Towns left all one sex', 'a nation\'s towns under 5%; tribes\' towns under 20%', `nations' ${pct(oneNation)}, tribes' ${pct(oneTribe)} of town-seasons`, oneNation < 0.05 && oneTribe < 0.2,
'Of towns with anyone grown in them. A nation\'s men away with its armies are counted as their town\'s (armytown.ts).');
  // Those who turned sixty early enough to have reached seventy within the run, against those who turned seventy.
  let r60 = 0, r70 = 0;
  for (const w of ruled) { const n = w.reached60.length, gap = AT70 - AT60; for (let i = 0; i + gap < n; i++) r60 += w.reached60[i]; for (let i = gap; i < n; i++) r70 += w.reached70[i]; }
  const deadBy70 = r60 ? 1 - r70 / r60 : NaN;
  add('People', 'Of those who reach 60, the share dead by 70', '50 to 85%', r60 ? `${pct(deadBy70)} (${r60} turned sixty, ${r70} turned seventy)` : 'nobody turned sixty', r60 ? within(deadBy70, 0.5, 0.85) : null,
'Counted by cohort: everyone who turned sixty in a season early enough to have turned seventy before the run ended, against everyone who turned seventy from ten years in. People are not followed one by one, so those who move town, are carried off or come home older (threats.ts adds the years held) blur it a little.');

  // Food
  const ts = all('townSeasons').filter((x) => !x.tribe);
  const farmedHungry = share(ts.filter((x) => x.farmed), (x) => x.hungry);
  add('Food', 'Share of seasons a farmed town is hungry', 'under 2%', `${pct(farmedHungry)} (${ts.filter((x) => x.farmed).length} town-seasons)`, farmedHungry < 0.02);
  const bareTowns = ts.filter((x) => !x.farmed && !x.convoy), could = bareTowns.filter((x) => x.canFarm), couldNot = bareTowns.filter((x) => !x.canFarm);
  const couldHungry = share(could, (x) => x.hungry), couldNotHungry = share(couldNot, (x) => x.hungry);
  add('Food', 'Share of seasons an unfarmed town with no convoy is hungry, where its governor can still raise a farm', 'under 10%', `${pct(couldHungry)} (${could.length} town-seasons)`, could.length ? couldHungry < 0.1 : null,
'No convoy means none was on the road to it as the season began. Can still raise a farm is the governor\'s own test (governor.ts), read at the end of the season: a free place among its buildings, and its stores, less the farm\'s price, at or above his floor.');
  add('Food', 'Share of seasons an unfarmed town with no convoy is hungry, where no farm can be raised', '10 to 40%', `${pct(couldNotHungry)} (${couldNot.length} town-seasons)`, couldNot.length ? within(couldNotHungry, 0.1, 0.4) : null,
'The rest of the unfarmed towns with no convoy: no free place, or not the stores.');
  const dead = ruled.flatMap((w) => Object.values(w.hungerDead));
  const nations = ruled.length * 3; // a player and two rivals in each
  const perNation = dead.reduce((a, b) => a + b, 0) / nations;
  const worst = Math.max(...ruled.map((w) => w.worstHunger));
  add('Food', 'Deaths from hunger in a nation, per 20 years', '0.5 to 10, never most of a town at once', `${num(perNation, 1)} a nation (the worst season took ${pct(worst)} of a town of four or more)`, within(perNation, 0.5, 10) && worst <= 0.5,
'Read from the log, over the first twenty years, across all three peoples of each campaign (living or not). Whether a town that lost most was besieged or cut off is not judged.');

  // Stores
  const stores = all('storeSeasons');
  add('Stores', 'A nation\'s supplies after 20 years of peace', '2 to 4 seasons of full upkeep', `median ${num(median(stores), 1)} seasons (${stores.length} nations, ${ruled.reduce((k, w) => k + w.peaceSeasons, 0)} nation-seasons of peace; middle half ${num(quart(stores, 0.25), 1)} to ${num(quart(stores, 0.75), 1)})`, within(median(stores), 2, 4),
`The map has no upkeep but what its towns eat, so this is the food in a nation's towns over what they eat in a season. A season of peace is one at least ${PEACE_YEARS} years in, after a stretch of ${PEACE_YEARS} years in which the nation won or lost land in no more than ${PEACE_WAR_SEASONS} seasons (eight of the ten years without war). Each nation's seasons of peace are taken together as their median, and the figure is the median of the nations, so that one long-lived nation does not outweigh the rest.`);

  // Faith
  const gaps = all('faithGaps');
  const inGap = share(gaps, (x) => x >= 20 && x <= 60);
  add('Faith', 'Widest gap between two towns of one nation', '20 to 60 most of the time', `${pct(inGap)} of nation-seasons in band (median ${num(median(gaps), 0)}; under 20 ${pct(share(gaps, (x) => x < 20))}, over 60 ${pct(share(gaps, (x) => x > 60))})`, inGap > 0.5, 'Most of the time is taken as over half of the seasons of a nation with two towns or more.');
  const holy = all('holyMoves');
  add('Faith', 'A nation that builds churches and keeps its towns fed, over 20 years', 'toward the holy end by 15 to 40', holy.length ? `mean ${num(mean(holy), 1)} (${holy.length} nations)` : 'no such nation', holy.length ? within(mean(holy), 15, 40) : null,
'A nation with a church standing for at least ten of the twenty years and hungry in under 5% of its town-seasons.');
  const holyTowns = ruled.reduce((n, w) => n + w.houses.holy, 0), housed = ruled.reduce((n, w) => n + w.houses.with, 0);
  add('Faith', 'Holy towns with a Monastery or Convent by 20 years', 'some (5 to 30%)', holyTowns ? `${pct(housed / holyTowns)} (${housed} of ${holyTowns} Righteous towns in ${ruled.filter((w) => w.houses.holy).length} campaigns)` : 'no Righteous town at 20 years', holyTowns ? within(housed / holyTowns, 0.05, 0.3) : null,
'A holy town is one whose own standing is Righteous at the end of the twentieth year, whoever holds it. The house counts when it stands finished on the town\'s record.');
  {
const gold = all('gold20'), buys = ruled.reduce((n, w) => n + w.grain.buys, 0), food = ruled.reduce((n, w) => n + w.grain.food, 0), paid = ruled.reduce((n, w) => n + w.grain.gold, 0);
add('Food', 'The player\'s gold at 20 years, and grain bought abroad by decree', 'report only', `median ${Math.round(median(gold))} gold (${gold.length} players alive; middle half ${Math.round(quart(gold, 0.25))} to ${Math.round(quart(gold, 0.75))}); ${num(buys / Math.max(1, ruled.length), 1)} buys a campaign in twenty years, ${Math.round(food / Math.max(1, buys))} food for ${Math.round(paid / Math.max(1, buys))} gold each`, 'report',
  'Gold in all the player\'s towns at the end of the twentieth year. Grain bought abroad is the food decree (grain.ts), read from the player\'s log.');
  }
  {
const storyYearsAll = ruled.reduce((k, w) => k + w.storyYears, 0);
const l = ruled.reduce((a, w) => ({ player: a.player + w.lords20.player, playerAngry: a.playerAngry + w.lords20.playerAngry, playerContent: a.playerContent + w.lords20.playerContent, rivals: a.rivals + w.lords20.rivals, rivalsAngry: a.rivalsAngry + w.lords20.rivalsAngry, rivalsContent: a.rivalsContent + w.lords20.rivalsContent, plots: a.plots + w.lords20.plots }), { player: 0, playerAngry: 0, playerContent: 0, rivals: 0, rivalsAngry: 0, rivalsContent: 0, plots: 0 });
const share = (n: number, of: number): number => n / Math.max(1, of);
const pa = share(l.playerAngry, l.player), ra = share(l.rivalsAngry, l.rivals), pc = share(l.playerContent, l.player), rc = share(l.rivalsContent, l.rivals);
const acts = `in twenty years the player's lords helped ${ruled.reduce((n, w) => n + w.lordActs.help, 0)} times, withheld ${ruled.reduce((n, w) => n + w.lordActs.withhold, 0)} times, and joined a plot ${ruled.reduce((n, w) => n + w.lordActs.joined, 0)} times`;
add('Rule', 'Lords angry at 20 years, the player\'s and the rivals\' each', '1 to 8% (some at the edge of anger, never a revolt of the great)', `${pct(pa)} of the player's (${l.player} lords), ${pct(ra)} of the rivals' (${l.rivals}); ${acts}`, l.player && l.rivals ? within(pa, 0.01, 0.08) && within(ra, 0.01, 0.08) : null,
  'Lords of every living nation at the end of the twentieth year (nobles.ts) whose mood is -40 or under. The player played by the computer gives decrees but deals with no noble; a rival weighs its own (nobleweigh.ts).');
add('Rule', 'Lords content at 20 years, the player\'s and the rivals\' each', '5 to 20%', `${pct(pc)} of the player's, ${pct(rc)} of the rivals'`, l.player && l.rivals ? within(pc, 0.05, 0.2) && within(rc, 0.05, 0.2) : null,
  'Lords whose mood is 30 or over at the end of the twentieth year: enough to help the nation in need (nobleacts.ts).');
const plotEvery = l.plots ? storyYearsAll / l.plots : NaN;
add('Rule', 'A noble\'s plot against the player', 'about once in 30 to 150 years', l.plots ? `once in ${num(plotEvery, 1)} years (${l.plots} plots in ${ruled.length} campaigns)` : 'no plots', l.plots ? within(plotEvery, 30, 150) : false,
  'Every plot begun against the player (courtstory.ts), over the years the campaign ran.');
  }
  const rivalsAt20 = ruled.reduce((n, w) => n + w.halls.rivals, 0), halled = ruled.reduce((n, w) => n + w.halls.with, 0);
  add('Rule', 'Rival nations with a Hall of Judgement by 20 years', 'most (over half)', rivalsAt20 ? `${pct(halled / rivalsAt20)} (${halled} of ${rivalsAt20} rival nations alive at 20 years)` : 'no rival alive at 20 years', rivalsAt20 ? halled / rivalsAt20 > 0.5 : null,
'Rivals alive at the end of the twentieth year; a Hall counts when it stands finished in any town of theirs.');

  // Drift
  const drifted = share(ts, (x) => x.drifted);
  const by = (k: TownSeason['strained']) => pct(share(ts.filter((x) => x.strained === k), (x) => x.drifted));
  add('Drift', 'Share of town-seasons with anyone drifted', '5 to 20%, more in hungry, raided or newly taken towns', `${pct(drifted)} (hungry ${by('hungry')}, raided ${by('raided')}, newly taken ${by('taken')}, otherwise ${by('')})`, within(drifted, 0.05, 0.2) && ['hungry', 'raided', 'taken'].every((k) => share(ts.filter((x) => x.strained === k), (x) => x.drifted) >= share(ts.filter((x) => x.strained === ''), (x) => x.drifted) || !ts.some((x) => x.strained === k)));
  const fallR = ruled.reduce((k, w) => k + w.falling, 0) / Math.max(1, ruled.reduce((k, w) => k + w.fallingTowns, 0));
  const fallB = bare.reduce((k, w) => k + w.falling, 0) / Math.max(1, bare.reduce((k, w) => k + w.fallingTowns, 0));
  const lostR = mean(ruled.flatMap((w) => w.driftLost)), lostB = mean(bare.flatMap((w) => w.driftLost));
  const perSeason = (ws: Watch[]): number => { const a = ws.reduce((k, w) => k + w.driftSeasons.lost, 0), n = ws.reduce((k, w) => k + w.driftSeasons.ts, 0); return n ? (a / n) * YEARS20 : NaN; };
  const seasR = perSeason(ruled), seasB = perSeason(bare);
  add('Drift', 'With sensible decrees vs none', 'standing lost to drift alone at least a tenth less', `${num(lostR)} a town over twenty years with decrees, ${num(lostB)} without (${lostB > 0 ? pct(1 - lostR / lostB) : '—'} less); read season by season over every town held, ${num(seasR)} and ${num(seasB)} (${seasB > 0 ? pct(1 - seasR / seasB) : '—'} less); towns fallen 10 or more all told ${pct(fallR)} and ${pct(fallB)}`, lostB > 0 ? lostR <= lostB * 0.9 : null,
'Standing lost to drift alone is what drift took from a town season by season (drift.ts: its strain, its women at the tavern, the women ordered into it), before any rise and not counting war, raids or the nation\'s dips, summed over twenty years for every town held by one people throughout. With decrees, the player gives the sensible ones (decrees.ts) and rivals rule as they do; without, nobody gives any. The second reading sums drift\'s toll season by season over every town held that season by the people it began with, whether or not it is still theirs at twenty years, as a town over twenty years (proposed: the row\'s first reading averages only the towns still held at twenty years, and moves with which towns those are).');

  // Threats
  const raids = all('raids'), years = ruled.reduce((k, w) => k + w.raidTownYears, 0);
  const every = raids.length ? years / raids.length : NaN;
  add('Threats', 'Raids on a given town', 'about once in 3 to 5 years', raids.length ? `once in ${num(every, 1)} years (${raids.length} raids)` : 'no raids', within(every, 3, 5), 'Every strike by a band on a held town, the marauders\' included, per season it was held, over the whole run.');
  // Stories inside the story (intrigue.ts, courtstory.ts): how often one begins for the player's nation.
  const stories = ruled.reduce((k, w) => k + w.stories, 0), storyYears = ruled.reduce((k, w) => k + w.storyYears, 0), storyEvery = stories ? storyYears / stories : NaN;
  {
const firstMet = ruled.map((w) => w.met), early = firstMet.filter((x) => x >= 0 && x <= 40).length;
add('Stories', 'A story met face to face within the first ten years', 'report only', `${pct(early / Math.max(1, ruled.length))} of campaigns (${early} of ${ruled.length}); the first at a median of season ${num(median(firstMet.filter((x) => x >= 0)), 0)}`, 'report',
  'A story waiting on the player\'s word face to face (encounter.ts): a thief caught, a suitor, a rival\'s envoy, a plotter found out. Read from the first season one waits.');
  }
  add('Stories', 'A story begins for the player\'s nation', 'about once in 3 to 6 years', stories ? `once in ${num(storyEvery, 1)} years (${stories} stories in ${ruled.length} campaigns)` : 'no stories', within(storyEvery, 3, 6), 'Every story inside the story begun for the player (a thief, a killer, a rival king, a suitor, a plot), over the years the campaign ran. ' + (STORIES === 'answer' ? 'The computer-played player answers them by a plain policy (STORIES=answer, src/sim/storypolicy.ts).' : 'The computer-played player answers none of them (STORIES=answer makes it answer).'));
  // Crime (watchhouse.ts): how long a thief or a killer is at large, in a town with a Watch House against one without.
  {
const crimes = all('crimes'), mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const withHouse = crimes.filter((x) => x.watched * 2 >= x.seasons), without = crimes.filter((x) => x.watched * 2 < x.seasons);
const a = mean(withHouse.map((x) => x.seasons)), b = mean(without.map((x) => x.seasons));
add('Crime', 'Seasons a thief or a killer is at large in a town, as it is: towns with a Watch House against those without', 'report only', crimes.length ? `${withHouse.length ? num(a, 1) : 'none'} with (${withHouse.length}) against ${without.length ? num(b, 1) : 'none'} without (${without.length})` : 'no thieves or killers', 'report',
  'Every thief and killer begun in the campaigns above, counted each season it is at large: begun, not ended, and (a thief) not yet standing for judgement. One still at large when the count stops is counted as far as it got. "With" is a town where a Watch House stood for at least half of those seasons. ' + (STORIES === 'answer' ? 'The computer-played player answers the stories by a plain policy.' : 'The computer-played player answers none of them, so nobody is hunted on the leader\'s word: only the watch\'s own catches and the elders end them.'));
// Report only: what a town watch and a Fortress do when a band strikes.
const strikes = all('strikes'), heldOf = (xs: typeof strikes) => (xs.length ? `${pct(share(xs, (x) => x.held))} (${xs.length})` : 'none'), lostOf = (xs: typeof strikes) => (xs.length ? `${num(mean(xs.map((x) => x.lost)), 2)} (${xs.length})` : 'none');
const landed = strikes.filter((x) => !x.held);
add('Crime', 'Raids held off with a town watch against without', 'report only', `${heldOf(strikes.filter((x) => x.watch))} with against ${heldOf(strikes.filter((x) => !x.watch))} without`, 'report', 'Every strike by a band on a held town. "With" is a town whose people had learned Town Watch and where a Watch House stood when the band struck.');
add('Crime', 'People lost per band strike with a Fortress against without', 'report only', `${lostOf(strikes.filter((x) => x.fort))} with against ${lostOf(strikes.filter((x) => !x.fort))} without; of strikes not held off, ${lostOf(landed.filter((x) => x.fort))} against ${lostOf(landed.filter((x) => !x.fort))}`, 'report', 'The killed and the carried off in each strike by a band on a held town, the strikes held off counted too (a Fortress holds more of them off). A town that fell to the band is counted by what the strike itself cost it.');
// The forced comparison (CRIME=1): the same campaigns told again with a Watch House in every town of the player's, and with Town Watch besides.
if (CRIME && process.env.CRIME !== 'roads') {
  const house: Watch[] = [], watch: Watch[] = [];
  for (let seed = 1; seed <= CAMPAIGNS; seed++) { house.push(play(seed, true, SEASONS, 'house')); watch.push(play(seed, true, SEASONS, 'watch')); }
  const large = (ws: Watch[]) => { const xs = ws.flatMap((w) => w.crimes); return xs.length ? `${num(mean(xs.map((x) => x.seasons)), 2)} (${xs.length})` : 'none'; };
  const heldMine = (ws: Watch[]) => heldOf(ws.flatMap((w) => w.strikes).filter((x) => x.mine));
  const lostMine = (ws: Watch[]) => lostOf(ws.flatMap((w) => w.strikes).filter((x) => x.mine));
  const wins = (ws: Watch[]) => ws.filter((w) => w.how === 'player').length;
  const at = (ws: Watch[]) => mean(ws.flatMap((w) => w.crimes).map((x) => x.seasons)), fewer = 1 - at(house) / at(ruled);
  add('Crime', CRIME_ROW, CRIME_BAND, `${pct(fewer)} fewer: ${large(house)} with against ${large(ruled)} as it is; with Town Watch learnt besides ${large(watch)}`, within(fewer, 0.1, 0.3),
'The same campaigns told three times: as they are; with a finished Watch House, free, in every town the player holds, from the first season and in each town it takes; and with that and Town Watch learnt from the start. The tellings part ways as they go on, so these are the same seeds in different histories. In brackets, the thieves and killers begun in each telling. ' + `The player won ${wins(ruled)}, ${wins(house)} and ${wins(watch)} of the ${CAMPAIGNS} campaigns in the three tellings.`);
  const heldShare = (ws: Watch[]) => share(ws.flatMap((w) => w.strikes).filter((x) => x.mine), (x) => x.held), more = heldShare(watch) - heldShare(house);
  add('Crime', WATCH_ROW, WATCH_BAND, `${num(more * 100, 1)} more in every 100: ${heldMine(watch)} with against ${heldMine(house)} with the Watch Houses alone (and ${heldMine(ruled)} as it is)`, within(more, 0.05, 0.2),
`"Without" is the telling with the Watch Houses and no Town Watch, so that the study alone is what differs. Strikes by a band on the player\'s own towns in the same three tellings. A Watch House alone adds nothing to a town\'s defence; the study does. People lost per strike: ${lostMine(watch)} with Town Watch, ${lostMine(house)} with the Watch Houses alone, ${lostMine(ruled)} as it is.`);
} else {
  rows.push({ area: 'Crime', figure: CRIME_ROW, band: CRIME_BAND, measured: 'run with CRIME=1', verdict: 'not measured', note: 'The same campaigns are told again with a Watch House in every town of the player\'s, which makes the report take about four times as long; run with CRIME=1.' });
  rows.push({ area: 'Crime', figure: WATCH_ROW, band: WATCH_BAND, measured: 'run with CRIME=1', verdict: 'not measured' });
}
// Report only: the roads (roads.ts). The player's convoys alone: only theirs are written in the log.
const convoys = all('convoys'), stoppedOf = (xs: typeof convoys) => (xs.length ? `${pct(share(xs, (x) => x.stopped))} (${xs.length})` : 'none');
const tookOf = (xs: typeof convoys) => { const st = xs.filter((x) => x.stopped); return st.length ? `${num(mean(st.map((x) => x.took)), 0)} (${st.length})` : 'none'; };
{
  // The Inn's row: only the convoys a band lay in wait for, sorted by the convoy's own road (convoys.ts convoyTally). Inns
  // are raised where the highwaymen sit (inn.ts), so a nation with an Inn sends more convoys down dangerous roads: sorting
  // by the nation, or counting the safe roads in, measures the danger and not the Inn.
  const side = (k: 'inn' | 'none') => ruled.reduce((a, w) => ({ met: a.met + (w.innRoads?.[k].met ?? 0), robbed: a.robbed + (w.innRoads?.[k].robbed ?? 0) }), { met: 0, robbed: 0 });
  const inn = side('inn'), none = side('none'), rate = (x: { met: number; robbed: number }) => (x.met ? x.robbed / x.met : NaN);
  const fine = inn.met && none.met ? rate(inn) < rate(none) : undefined;
  add('Crime', INN_ROW, INN_BAND, `${inn.met ? pct(rate(inn)) : '-'} (${inn.met}) with an Inn on the road against ${none.met ? pct(rate(none)) : '-'} (${none.met}) without`, fine === undefined ? null : fine,
    'The player\'s convoys that finished their road with a band lying in wait on it (highwaymen at either end of a stretch of it, or pirates where it crosses the sea), counted as each comes in. "With" is a convoy whose own road passes a town of the player\'s with an Inn standing. A convoy no band lay in wait for is never stopped, Inn or none, and is left out.');
}
add('Crime', 'Stores a band takes from a convoy of the player\'s it stops, with Escorts against without', 'report only', `${tookOf(convoys.filter((x) => x.escorts))} with against ${tookOf(convoys.filter((x) => !x.escorts))} without`, 'report', 'Food, wood, gold and stone together, for each convoy stopped. "With" is a player who had learned Escorts by then.');
const hungers = all('hungers'), spellOf = (xs: typeof hungers) => (xs.length ? `${num(mean(xs.map((x) => x.seasons)), 2)} (${xs.length})` : 'none');
add('Crime', 'Seasons running a hungry town stays hungry, with Paved Roads against without', 'report only', `${spellOf(hungers.filter((x) => x.paved))} with against ${spellOf(hungers.filter((x) => !x.paved))} without`, 'report', 'Every spell of hunger in a held town, every people\'s: the seasons from the first hungry one until it is fed, changes hands or the count stops. "With" is a town whose people had learned Paved Roads when the spell began. The spell ends when the town is fed, by a convoy or by anything else.');
if (CRIME) {
  const roads: Watch[] = [];
  for (let seed = 1; seed <= CAMPAIGNS; seed++) roads.push(play(seed, true, SEASONS, 'roads'));
  const cv = (ws: Watch[]) => ws.flatMap((w) => w.convoys), mineOf = (ws: Watch[]) => ws.flatMap((w) => w.hungers).filter((x) => x.mine);
  const hungrySeasons = (ws: Watch[]) => mineOf(ws).reduce((k, x) => k + x.seasons, 0);
  const wins = (ws: Watch[]) => ws.filter((w) => w.how === 'player').length;
  const mineLine = (ws: Watch[]) => { const k = ws.reduce((a, w) => ({ seasons: a.seasons + w.mine.seasons, hungry: a.hungry + w.mine.hungry, grown: a.grown + w.mine.grown }), { seasons: 0, hungry: 0, grown: 0 }); return `${pct(k.hungry / k.seasons)} of ${k.seasons} town-seasons of the player\'s hungry, ${num(k.grown / k.seasons, 1)} grown people a town`; };
  add('Crime', 'Forced: the player\'s convoys stopped by a band, and the stores taken from each, with an Inn in every town and Escorts against as it is', 'report only', `stopped ${stoppedOf(cv(roads))} with against ${stoppedOf(cv(ruled))} as it is; stores taken ${tookOf(cv(roads))} against ${tookOf(cv(ruled))}`, 'report',
'The same campaigns told again with a finished Inn, free, in every town the player holds, and Escorts and Paved Roads learnt from the start. Convoys that finished their road, read from the log; the stores are those taken from each convoy stopped. ' + `The player won ${wins(roads)} of the ${CAMPAIGNS} campaigns in this telling against ${wins(ruled)} as it is.`);
  add('Crime', 'Forced: seasons running a town of the player\'s stays hungry, with Paved Roads against as it is', 'report only', `${spellOf(mineOf(roads))} with against ${spellOf(mineOf(ruled))} as it is`, 'report',
`Spells of hunger in the player\'s own towns in the same two tellings (the Inns and Escorts are there too). In all, ${hungrySeasons(roads)} hungry town-seasons with against ${hungrySeasons(ruled)} as it is. ${mineLine(roads)} with; ${mineLine(ruled)} as it is.`);
}
  }
  // Soldiers named on the map (veteranhome.ts, rivalrule.ts): how often for the player, and what a battle credits one with.
  {
{
  const mv = ruled.map((w) => w.moves), nations = ruled.length * 3, homes = mv.reduce((k, x) => k + x.households, 0), folk = mv.reduce((k, x) => k + x.people, 0), settlers = mv.reduce((k, x) => k + x.settlers, 0);
  const why: Record<string, number> = {};
  for (const x of mv) for (const [k, v] of Object.entries(x.why)) why[k] = (why[k] ?? 0) + v;
  const whyText = Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v / Math.max(1, homes))}`).join(', ');
  add('People', 'Households that move between a people\'s towns, per nation per 20 years', 'report only', `${num(homes / nations)} households a nation, ${num(homes ? folk / homes : NaN)} people a move (${whyText || 'none'}); ${num(settlers / nations)} parties of settlers a nation founding a town`, 'report',
'Every family that set out by road from one town of its people to another in the first twenty years (migration.ts migrateOf, the household of householdmove.ts: the couple, their children and an old one), every people\'s, over three peoples a campaign; the people a move counts those on the convoy, children included. Why: the push that sent them. Settlers who went to found a town on empty land are counted apart.');
}
const n = ruled.map((w) => w.named), battle = n.reduce((k, x) => k + x.battle, 0), wins = n.reduce((k, x) => k + x.wins, 0), mine = n.reduce((k, x) => k + x.mine, 0);
const years = ruled.reduce((k, w) => k + (w.decided >= 0 ? w.decided / 4 : w.storyYears), 0); // years the campaigns ran undecided, as the names are counted
const every = mine ? years / mine : NaN;
add('People', 'Soldiers named on the map for the player\'s nation, by a battle fought out there or an army\'s second win', 'about one every 1 to 4 years of campaign', `${mine ? `once in ${num(every, 1)} years` : 'none'} (${mine} in ${num(years, 0)} years undecided; every people's together ${num((battle + wins) / Math.max(1, ruled.length), 1)} a campaign, ${num(battle / Math.max(1, ruled.length), 1)} by a battle fought out on the map and ${num(wins / Math.max(1, ruled.length), 1)} by an army's second win)`, mine ? every >= 1 && every <= 4 : false,
  'Every army of the player\'s that comes to have a soldier known by name while the campaign is undecided. "By a battle" is one fought out on the map that the army won felling at least NAMED.least, with nobody known by name (veteranhome.ts); "by a second win" is rivalrule.ts\'s rule. A battle fought in person names its own and is not counted.');
const share = n.flatMap((x) => x.share), kills = n.flatMap((x) => x.kills), over = kills.filter((k) => k > 3).length / Math.max(1, kills.length);
add('People', 'Of the felled in a map battle that names a soldier, the share he is credited with', '25 to 40%, with over half of them credited more than the three that make a name', share.length ? `${pct(mean(share))} of the felled credited (${share.length} named by a battle, every people's); ${pct(over)} credited more than three, median ${num(median(kills), 0)} (middle half ${num(quart(kills, 0.25), 0)} to ${num(quart(kills, 0.75), 0)})` : 'none named by a battle', share.length ? mean(share) >= 0.25 && mean(share) <= 0.4 && over > 0.5 : null,
  `veteranhome.ts: credited NAMED.share (${NAMED.share}) of the felled, three at least (the least that makes a name, champion.ts), in a battle that felled NAMED.least (${NAMED.least}) or more.`);
  }
  // The markets' caravans (caravans.ts): report only, so the first guesses have numbers.
  {
const all = ruled.map((w) => w.caravans), sum = (k: 'sent' | 'came' | 'robbed' | 'gold', mine = false): number => all.reduce((n, x) => n + (x ? (mine ? x.mine[k] : x[k]) : 0), 0);
const n = Math.max(1, ruled.length), years = ruled.reduce((k, w) => k + w.storyYears, 0);
add('Stores', 'The markets\' caravans: how many, how many come home, how many are robbed, and the gold they bring', 'report only', sum('sent') ? `${num(sum('sent') / n, 0)} sent a campaign, every people's (${num(sum('sent', true) / n, 0)} the player's); ${pct(sum('came') / sum('sent'))} came home, ${pct(sum('robbed') / sum('sent'))} robbed on the way; ${num(sum('gold') / Math.max(1, years), 0)} gold a year every people's together, ${num(sum('gold', true) / Math.max(1, years), 0)} the player's (${num(sum('gold') / Math.max(1, sum('came')), 0)} a caravan)` : 'none sent', 'report',
  'A town with a Market standing trades by road with the nearest other market town within CARAVANS.reach lands, its own people\'s or one at peace with it, and its caravan comes home the season after with gold; highwaymen and pirates on its road meet it as a convoy, and a band standing on its road may fall on it (caravans.ts).');
  }
  // When the computer-played player takes its first age: report only.
  {
const got = ruled.filter((w) => w.firstAge > 0).map((w) => w.firstAge);
add('Pace', 'The player reaches its first age', 'report only', got.length ? `median season ${num(median(got), 0)} (${got.length} of ${ruled.length} campaigns; by season 12 ${pct(got.filter((x) => x <= 12).length / ruled.length)}, by season 20 ${pct(got.filter((x) => x <= 20).length / ruled.length)})` : 'never', 'report',
  SAVE ? `The computer-played player puts by ${pct(SAVE)} of the supplies it has in hand each season until the price of its ${SAVE_AGES <= 1 ? 'first' : 'next'} age is put by, then takes it${SAVE_AGES <= 1 ? '; later ages it takes by the rivals\' rule' : ''} (SAVE=0 turns that off).` : 'The computer-played player is saving nothing for its next age (SAVE=0): it takes one only by the rivals\' own rule, when it happens to have the price and 8 over in hand.');
  }
  // Unrest and the free towns (unrest.ts, freetown.ts): report only.
  {
const stirs = all('stirs'), n = stirs.length, of = (p: (x: (typeof stirs)[number]) => boolean) => pct(n ? stirs.filter(p).length / n : NaN);
const free = ruled.reduce((k, w) => ({ rose: k.rose + w.free.rose, back: k.back + w.free.back, retaken: k.retaken + w.free.retaken, taken: k.taken + w.free.taken, still: k.still + w.free.still }), { rose: 0, back: 0, retaken: 0, taken: 0, still: 0 });
add('Conquest', 'Unrest begun in a town, and what weighed on it', 'report only', n ? `${num(n / ruled.length, 1)} a campaign (${num(stirs.filter((x) => x.mine).length / ruled.length, 1)} in the player's towns): hungry ${of((x) => x.hungry)}, an angry noble ${of((x) => x.angry)}, sour nobles ${of((x) => x.sour)}, newly held ${of((x) => x.fresh)}, a tavern ${of((x) => x.tavern)}, none of these ${of((x) => !x.hungry && !x.angry && !x.sour && !x.fresh && !x.tavern)}; in a town its people founded ${of((x) => x.founded)}` : 'none', 'report',
  'Every time unrest began in a held town (unrest.ts), with the things that made it likelier as they stood at the season\'s end; a town may have several. Unrest comes to a rising two seasons on unless an army, the leader or a steadfast people keeps order.');
add('Conquest', 'Towns that rise from unrest become free towns, and what becomes of them', 'report only', free.rose ? `${num(free.rose / ruled.length, 1)} a campaign rose; of them ${pct(free.back / free.rose)} came back by treaty, ${pct(free.retaken / free.rose)} were taken back by force by the people they left, ${pct(free.taken / free.rose)} were taken by another people or the marauders, ${pct(free.still / free.rose)} were free at the end` : 'none rose', 'report',
  'A town that throws off its people\'s rule is nobody\'s, with its people in it, and remembers whose it was (freetown.ts). The towns a conqueror\'s yoke loses are another matter (conquered.ts) and are not counted here.');
  }
  // A raid as it was fought out (raidclash.ts decides it), against the old sum's lines: report only.
  {
const st = all('strikes').filter((x) => !x.road), n = st.length, of = (k: 'sum' | 'clash', o: string) => pct(n ? st.filter((x) => x[k] === o).length / n : NaN);
const hold = (x: (typeof st)[number]) => x.ratio >= THREATS.hold;
const same = st.filter((x) => x.sum === x.clash).length, worse = st.filter((x) => ({ held: 0, raided: 1, taken: 2 }[x.clash] ?? 0) > ({ held: 0, raided: 1, taken: 2 }[x.sum] ?? 0)).length;
add('Threats', 'A raid fought out a round at a time, against the old sum\'s lines', 'report only', n ? `as it was fought: held off ${of('sum', 'held')}, raided ${of('sum', 'raided')}, taken ${of('sum', 'taken')}; by the old lines the same strikes would have been held off ${pct(st.filter(hold).length / n)} and crossed the line for a taking ${pct(st.filter((x) => x.low).length / n)}; a town the old lines would have held was broken into in ${pct(st.filter((x) => hold(x) && x.sum !== 'held').length / Math.max(1, st.filter(hold).length))}, and one they would not have held held in ${pct(st.filter((x) => !hold(x) && x.sum === 'held').length / Math.max(1, st.filter((x) => !hold(x)).length))} (${n} strikes)` : 'no strikes', 'report',
  `Every strike on a town (not on a road). It is decided by mapbattle.ts's clash (raidclash.ts: a band's force worth ${RAID.press} of itself; taken where breaking the town cost the band ${pct(RAID.easily)} of its weight or less and the town is not already bled). The old lines: held at ${THREATS.hold} of the band's force, a taking under ${THREATS.fall}.`);
  }
  // Bands from the far wilds (bandwilds.ts, rim.ts), against docs/TUNING.md: how many a campaign, and whether they are seen coming.
  {
const ms = all('marches'), came = ruled.reduce((k, w) => k + w.bandsCame, 0), avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const there = ms.filter((m) => m.arrived !== undefined), seen = ms.filter((m) => m.seen !== undefined), ahead = seen.filter((m) => (m.struck ?? m.arrived) !== undefined);
const met = ms.filter((m) => m.met !== undefined), struck = ms.filter((m) => m.struck !== undefined);
const each = ms.length / ruled.length, warned = ahead.length ? avg(ahead.map((m) => (m.struck ?? m.arrived)! - m.seen!)) : NaN;
add('Threats', 'Bands that come from the far wilds', '1.5 to 4 a campaign', ms.length ? `${ms.length} of ${came} bands (${pct(ms.length / came)}), ${num(ms.length / ruled.length, 1)} a campaign; a march of ${num(avg(ms.map((m) => m.lands)), 1)} lands (${[2, 3, 4].map((k) => `${k === 4 ? '4 or more' : k}: ${pct(ms.filter((m) => (k === 4 ? m.lands >= 4 : m.lands === k)).length / ms.length)}`).join(', ')}), ${there.length ? num(avg(there.map((m) => m.arrived! - m.born)), 1) : '?'} seasons for the ${there.length} that got there` : 'none', ruled.length ? within(each, 1.5, 4) : null,
  'Camps of raiders and slavers born in wild country that is still empty, the rim of wilderness at the map\'s edge above all (rim.ts, wilds.ts), that march in for a mark (bandwilds.ts), a campaign; and against every band of any kind that came in the campaigns above. There must be such a land free, with a way in of more than one land.');
{
  // Report only, kept for a release: the march each made, drawn by the richest mark (bandwilds.ts deepWay), beside the one the old weighing would have made.
  const both = ms.filter((m) => m.would), sh = (xs: typeof ms, f: (m: (typeof ms)[number]) => boolean): string => pct(xs.length ? xs.filter(f).length / xs.length : NaN);
  const lands = (xs: typeof ms, get: (m: (typeof ms)[number]) => number): string => `${num(avg(xs.map(get)), 1)} lands (2: ${sh(xs, (m) => get(m) === 2)}, 3: ${sh(xs, (m) => get(m) === 3)}, 4 or more: ${sh(xs, (m) => get(m) >= 4)})`;
  add('Threats', 'The march in from the far wilds: drawn by the richest mark, and as the nearest would have had it', 'report only', ms.length
    ? `as it is: ${lands(ms, (m) => m.lands)}, its mark ${num(avg(ms.map((m) => m.depth ?? m.lands)), 1)} lands deep and defended with ${num(avg(ms.map((m) => m.meets ?? 0)), 1)}; by the old weighing, for the ${both.length} of them it had a march for: ${lands(both, (m) => m.would!.lands)}, its mark ${num(avg(both.map((m) => m.would!.depth)), 1)} lands deep and defended with ${num(avg(both.map((m) => m.would!.meets)), 1)}`
    : 'none', 'report',
    'Every camp that set out from the far wilds, by the march it made as a host out of the wilds makes it (the softest and richest town within eight lands with no reckoning of the march, and of those nearly as good the farthest half the time: bandwilds.ts deepWay; a rim land with a way of three lands or more is taken first when one is born) and by the one the old weighing would have made (the softest mark weighed against the seasons of the march: bandroam.ts wayTo), which decides nothing now. Lands: from where it was born to where it makes its place; the mark is the town it means to strike from there, at that place or one land on; defended with: what that town has against a band (threats.ts defenceOf).');
}
add('Threats', 'A band from the far wilds is seen before it strikes or arrives', 'at least 8 in 10, a season or more ahead', ms.length ? `seen ${pct(seen.length / ms.length)}, ${ahead.length ? num(warned, 1) : '?'} seasons before it struck or was there; met by an army first ${pct(met.length / ms.length)} (${met.length}, ${ms.filter((m) => m.broken).length} broken), struck someone ${pct(struck.length / ms.length)}` : 'none', ms.length ? seen.length / ms.length >= 0.8 && warned >= 1 : null,
  'Seen: an army in or beside a land it passed, or a town within two lands (of the rim where it gathered, too), told its people. Ahead: from when it was first seen to when it struck or arrived, the mean over those seen that did either. Both must hold: eight in ten seen, and a season or more. Met: an army went against it (not the band against the army) before it had struck anyone.');
  }
  // Claimants to the throne (noblefaith.ts, wifetaken.ts, claimants.ts, claimantrising.ts): report only, how often any of it happens.
  {
const k = ruled.reduce((a, w) => { for (const key of Object.keys(a) as (keyof typeof a)[]) a[key] += w.claims[key]; return a; }, { wives: 0, noble: 0, band: 0, home: 0, grown: 0, nofollowing: 0, towns: 0, putdown: 0, swallowed: 0, lapsed: 0, crowned: 0, standing: 0, mine: 0, mineGrown: 0, mineGrownNoble: 0, raised: 0, mineRisen: 0, mineRisenNoble: 0, mineChild: 0 });
const n = ruled.length, kids = k.noble + k.band;
claimBase = { risen: k.mineRisen, noble: k.mineRisenNoble, n };
const pool = pooledClaims({ risen: k.mineRisen, noble: k.mineRisenNoble }, n); // a sparse row, judged over more campaigns where they are to hand (POOL, SPARSE)
const per = (100 * pool.risen) / pool.n;
sparseCounts.claimants = { risen: k.mineRisen, noble: k.mineRisenNoble };
    add('Rule', 'Risings for a claimant to the throne against the player\'s nation, proclaimed in a child\'s name or by one come of age', '2 to 5 every 100 campaigns, some of them for a lord\'s son by the leader\'s wife', `${claimPooled(pool, n, k.mineRisen)}${num(100 * k.mineRisen / Math.max(1, n), 1)} every 100 campaigns (${k.mineRisen} in ${n}: ${k.mineChild} proclaimed in a child's name, ${k.mineRisen - k.mineChild} by a claimant grown), ${k.mineRisenNoble} of them for a child born in a lord's house and ${k.mineRisen - k.mineRisenNoble} for one born among a band; ${k.mineGrown} of the player's claimants came of age; every people's together: ${k.wives} wives taken into a lord's house; ${kids} children written down (${k.noble} in a lord's house, ${k.band} among a band; ${k.mine} of the player's house), ${k.home} of them home with their mothers; ${k.raised} risings proclaimed in a child's name; ${k.grown} came of age (${k.nofollowing} with nobody following); ${k.towns} towns out for a claim at the end; grown claimants' risings: ${k.putdown} put down or come back, ${k.swallowed} fallen to others, ${k.lapsed} lapsed, ${k.crowned} ended on the throne, ${k.standing} still standing`, n ? within(per, 2, 5) && pool.noble > 0 : null,
      'A plot by a lord who is not of the leader\'s faith in which he takes the leader\'s wife into his house; a child born there, or to a wife held by a band; a rising proclaimed in the child\'s name by whoever holds it, from half a year after the birth; and the child grown (HEIR_AGE), leading that rising or raising one. In band: 2 to 5 risings against the player every 100 campaigns, and at least one of them for a child born in a lord\'s house. Towns that rise for a claimant are counted here and not among the free towns risen from unrest.');
  }
  const out = (o: string) => share(raids, (r) => r.outcome === o);
  {
// Report only: what an army in the town is worth to it when a band strikes (the towns' strikes; not the roads').
const town = raids.filter((r) => !r.road), withArmy = town.filter((r) => r.army), bare = town.filter((r) => !r.army);
const of = (xs: typeof town, o: string): string => pct(xs.length ? xs.filter((r) => r.outcome === o).length / xs.length : NaN);
add('Threats', 'Raids on a town with an army of its people in it, against without', 'report only', town.length ? `${pct(withArmy.length / town.length)} of strikes on towns met an army; with one: held off ${of(withArmy, 'held')}, raided ${of(withArmy, 'raided')}, taken ${of(withArmy, 'taken')} (${withArmy.length}); without: held off ${of(bare, 'held')}, raided ${of(bare, 'raided')}, taken ${of(bare, 'taken')} (${bare.length})` : 'none', 'report',
  'Every strike on a held town, not on a road: whether an army of the town\'s people stood in it when the band struck (threats.ts defenceOf counts it), and how those strikes went against the rest. Roads have their own guard and are left out, so the shares here are not the row below\'s.');
  }
  {
// Report only, kept for a release after the switch: the same strikes by the fight as it was before stage three (`would`), beside the fight that decides them now, the town's own men turned out as militia bands (raidclash.ts `turnedOut`).
const both = raids.filter((r) => r.would !== undefined), roads = raids.filter((r) => r.road);
const sh = (xs: typeof both, f: (r: (typeof both)[number]) => boolean): string => pct(xs.length ? xs.filter(f).length / xs.length : NaN);
const line = (xs: typeof both, key: 'outcome' | 'would'): string => `held off ${sh(xs, (r) => r[key] === 'held')}, raided ${sh(xs, (r) => r[key] === 'raided')}, taken ${sh(xs, (r) => r[key] === 'taken')}`;
// With the roads' strikes as they are (they are not fought), what the whole row would read.
const all3 = (o: string): number => (raids.length ? (both.filter((r) => r.would === o).length + roads.filter((r) => r.outcome === o).length) / raids.length : NaN);
const sizes: [string, (m: number) => boolean][] = [['under 12 men', (m) => m < 12], ['12 to 23', (m) => m >= 12 && m < 24], ['24 to 47', (m) => m >= 24 && m < 48], ['48 and over', (m) => m >= 48]];
const bySize = sizes.map(([name, f]) => { const xs = both.filter((r) => f(r.men ?? 0)); return `${name} (${xs.length}): taken ${sh(xs, (r) => r.outcome === 'taken')} now, ${sh(xs, (r) => r.would === 'taken')} by the old fight; held off ${sh(xs, (r) => r.outcome === 'held')} and ${sh(xs, (r) => r.would === 'held')}`; }).join('; ');
const changed = both.filter((r) => r.would !== r.outcome).length;
add('Threats', 'A raid with the town\'s men turned out as bands, against the fight as it was', 'report only', both.length
  ? `as it is fought now, turned out: ${line(both, 'outcome')}; by the old fight: ${line(both, 'would')} (${both.length} strikes on towns, ${pct(changed / both.length)} would have gone otherwise). By the old fight the whole row would read held off ${pct(all3('held'))}, raided ${pct(all3('raided'))}, taken ${pct(all3('taken'))}. By the town's men: ${bySize}`
  : 'none', 'report',
  'Every strike on a town (not on a road), fought twice with the same band and the same day: as threats.ts decides it now, with the town\'s own men turned out as militia bands on foot beside any army and only its works, walls and guard as the place, as against a nation (militia.ts; stage three); and as it was decided before (the town a sum of its men, works, walls and army, its men part of the place). A town bled already cannot be taken either way. The old fight decides nothing: it is recorded on the raid for this row only, for a release.');
{
  // Where the line for a taking would have to lie, turned out, for as many towns to be taken as are now.
  const broke = both.filter((r) => r.cost !== undefined), lines = [0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16];
  const at = lines.map((x) => `${x}: ${pct(broke.filter((r) => r.cost! <= x).length / Math.max(1, both.length))}`).join(', ');
  add('Threats', 'Towns taken, by where the line for a taking lies', 'report only', both.length ? `taken now ${sh(both, (r) => r.outcome === 'taken')} of strikes on towns; a town that could be taken broke in ${pct(broke.length / both.length)} of them, and would be taken at a line of ${at}` : 'none', 'report',
'A town is taken, not only raided, where breaking it cost the band no more than a share of its own weight (raidclash.ts RAID.easilyOut). Every strike where the town broke and had nobody in a band\'s hands already, by what that cost the band: so what another line would give can be read off. (These are the strikes of a world run at the line as it is; moved, the world answers back.)');
}
const press = both.filter((r) => (r.pressed ?? 0) > 0), meanPress = press.length ? press.reduce((k, r) => k + (r.pressed ?? 0), 0) / both.length : 0;
const per = (xs: typeof both, f: (r: (typeof both)[number]) => number): string => num(xs.length ? xs.reduce((k, r) => k + f(r), 0) / xs.length : NaN, 2);
const by = (o: string): string => { const xs = both.filter((r) => r.outcome === o); return `${o === 'held' ? 'held off' : o} ${per(xs, (r) => r.killed ?? 0)} and ${per(xs, (r) => r.dead ?? 0)}`; };
add('Threats', 'Men a town loses to a strike, and what a battle with a nation would have cost it', 'report only', both.length
  ? `${per(both, (r) => r.killed ?? 0)} men killed a strike; at a nation's share dead it would be ${per(both, (r) => r.dead ?? 0)} (its side loses ${pct(meanPress)} of its weight a strike). By how it went: ${by('held')}; ${by('raided')}; ${by('taken')}`
  : 'none', 'report',
  'The men of a town killed in a strike are those its bands lost in the fight (militiatoll.ts: the men who stood, by the share of their strength lost in the fight and the rout), at a raid\'s own share dead (raidclash.ts RAID.dead): beside it, what the same losses would be at the share a battle with a nation goes by (FELL.dead, a half). By rule, before stage three, it was 0.6 a strike.');
  }
  {
    // Report only: what a band comes away with from a town it breaks, and how that goes with the fight.
    const town = raids.filter((r) => !r.road), mean = (xs: typeof town, f: (r: (typeof town)[number]) => number): string => num(xs.length ? xs.reduce((k, r) => k + f(r), 0) / xs.length : NaN, 1);
    const raided = town.filter((r) => r.outcome === 'raided'), taken = town.filter((r) => r.outcome === 'taken'), broke = [...raided, ...taken];
    const byRounds = [[1, 1], [2, 2], [3, 4], [5, 99]].map(([lo, hi]) => { const xs = broke.filter((r) => (r.rounds ?? 0) >= lo && (r.rounds ?? 0) <= hi); return `${lo === hi ? lo : hi > 8 ? `${lo} or more` : `${lo} to ${hi}`} rounds (${pct(xs.length / Math.max(1, broke.length))}): ${mean(xs, (r) => r.goods ?? 0)}`; }).join('; ');
    add('Threats', 'What a band takes from a town it breaks', 'report only', broke.length
      ? `${mean(broke, (r) => r.goods ?? 0)} goods a strike that breaks the town (raided ${mean(raided, (r) => r.goods ?? 0)}, taken ${mean(taken, (r) => r.goods ?? 0)}); ${mean(taken, (r) => r.carried ?? 0)} people carried off a taking, ${num(taken.reduce((k, r) => k + (r.carried ?? 0), 0) / Math.max(1, ruled.length), 1)} a campaign. Goods by how long the town stood: ${byRounds}`
      : 'none', 'report',
      'Every strike on a town (not on a road) that broke it: the goods of all four kinds taken from its stores, and for a taking the women (and, by slavers, men) carried off. By the rounds the fight ran before the town broke, since what a band takes follows how long it had the town and what it had left (raidclash.ts).');
  }
  {
    // Report only: each meeting of a band with soldiers away from a town's walls, by the rule it goes by and by the clash.
    const sum: Record<string, { n: number; ruleBand: number; clashBand: number; agree: number; neither: number }> = {};
    for (const w of ruled) for (const [k, t] of Object.entries(w.roads ?? {})) { const x = (sum[k] ??= { n: 0, ruleBand: 0, clashBand: 0, agree: 0, neither: 0 }); x.n += t.n; x.ruleBand += t.ruleBand; x.clashBand += t.clashBand; x.agree += t.agree; x.neither += t.neither; }
    const kinds = Object.keys(sum).sort((a, b) => sum[b].n - sum[a].n);
    add('Threats', 'A band meets soldiers on the road: by the rule as it is, and fought out', 'report only', kinds.length
      ? kinds.map((k) => { const x = sum[k]; return `${k} (${num(x.n / ruled.length, 1)} a campaign): the band has the better of it ${pct(x.ruleBand / x.n)} by rule and ${pct(x.clashBand / x.n)} fought out (neither breaks ${pct(x.neither / x.n)}); the two agree ${pct(x.agree / x.n)}`; }).join('; ')
      : 'none', 'report',
      'Each meeting of a band with soldiers away from a town\'s walls is decided by the fight (roadclash.ts); the rule it went by before is tallied beside it. hunt: an army of a computer people, or the report\'s player unwatched, goes against a band; ambush: a band falls on an army; convoy and caravan: highwaymen or pirates stop one that has an army of its people on its road; camp on a caravan: raiders, slavers or marauders fall on one so escorted; road: highwaymen strike a road\'s end where an army stands. By rule the stronger on the day wins (an escort as strong as the band sees it off); fought out, either may break or neither.');
  }
  {
    // Report only: what a fight of an army and a band costs each, fought out, beside the old shares.
    const sum: Record<string, { n: number; army: number; armyOld: number; band: number; bandOld: number }> = {};
    for (const w of ruled) for (const [k, t] of Object.entries(w.roadCosts ?? {})) { const x = (sum[k] ??= { n: 0, army: 0, armyOld: 0, band: 0, bandOld: 0 }); x.n += t.n; x.army += t.army; x.armyOld += t.armyOld; x.band += t.band; x.bandOld += t.bandOld; }
    const keys = Object.keys(sum).sort();
    add('Threats', 'What a fight of an army and a band costs each side: fought out, and by the old shares', 'report only', keys.length
      ? keys.map((k) => { const x = sum[k]; return `${k} (${num(x.n / ruled.length, 1)} a campaign): the army loses ${num(x.army / x.n, 2)} companies (${num(x.armyOld / x.n, 2)} by the old share), the band ${num(x.band / x.n, 2)} points (${num(x.bandOld / x.n, 2)})`; }).join('; ')
      : 'none', 'report',
      'Every fight of an army and a band with nobody watching (bandfight.ts fightByMeans): hunt, an army went against a band; ambush, a band fell on an army; won or lost by the army. Fought out (roadclash.ts) each loses what the fight took; by the old shares an army lost a quarter of its companies beating its equal and four tenths routed, and a band that beat an army off lost three tenths of the army\'s strength. A band the army beats is broken either way.');
  }
  add('Threats', 'Outcome of raids', 'held off 30 to 50%, raided 40 to 60%, taken under 15%', `held off ${pct(out('held'))}, raided ${pct(out('raided'))}, taken ${pct(out('taken'))}`, within(out('held'), 0.3, 0.5) && within(out('raided'), 0.4, 0.6) && out('taken') < 0.15);
  const caps = all('captives').filter((x) => x.near);
  const back = share(caps, (x) => x.back);
  add('Threats', 'Captives got back when the player has an army near', 'about half', caps.length ? `${pct(back)} (${caps.length} groups)` : 'none', caps.length ? within(back, 0.35, 0.65) : null,
'Every people\'s captives, the player\'s included: those whose people had an army at the band\'s place (either end of a highwaymen\'s road) or next door while they were held. The computer-played player sends an army it can reach and that is as strong as the band (attackBand, settled unwatched); rivals hunt as they do. Gone before the four seasons were up is got back. About half is taken as 35 to 65%.');

  // Conquest
  const taken = all('taken'), bareT = taken.filter((x) => !x.garrison), heldT = taken.filter((x) => x.garrison);
  const roseBare = share(bareT, (x) => x.rose), roseHeld = share(heldT, (x) => x.rose);
  add('Conquest', 'Taken towns that rise if left ungarrisoned', '15 to 35% within 5 years; under 5% with an army in them', `${pct(roseBare)} ungarrisoned (${bareT.length}), ${pct(roseHeld)} garrisoned (${heldT.length}); not counted: ${ruled.reduce((k, w) => k + w.retaken, 0)} taken again within five years, ${ruled.reduce((k, w) => k + w.unsettled, 0)} still followed at the end`, bareT.length ? within(roseBare, 0.15, 0.35) && (!heldT.length || roseHeld < 0.05) : null,
'A town taken by force (it bears a yoke, stamped with the season of the capture), followed from then for twenty seasons, once for each capture; garrisoned if an army of its taker stood in it for over half of the seasons it was followed. One taken again by force before it rose or settled, or still followed when the run ended, is not counted either way.');

  // Armies
  const arms = all('arms');
  const atWar = median(arms.filter((x) => x.war).map((x) => x.share)), atPeace = median(arms.filter((x) => !x.war).map((x) => x.share));
  add('Armies', 'A nation\'s men under arms', '10 to 25% in war, under 10% in peace', `median ${pct(atWar)} in war, ${pct(atPeace)} in peace (of the seasons in war, ${pct(share(arms.filter((x) => x.war), (x) => x.share > 0.25))} over a quarter, ${pct(share(arms.filter((x) => x.war), (x) => Math.abs(x.share - 0.25) < 1e-9))} at a quarter exactly)`, within(atWar, 0.1, 0.25) && atPeace < 0.1,
'Men with its armies (armytown.ts) over those and the men in its towns. In war is a season within a year of the nation winning or losing land; a free town that comes back by treaty (freetown.ts) is land gained with no war, and does not count.');

  // Sieges
  const sieges = all('sieges').filter((x) => x.walls && x.men), drawn = realSieges(), live = drawn.sieges;
  const holds = share(sieges, (x) => x.held), liveHolds = share(live.filter((x) => x.walls && x.men), (x) => x.held);
  const both = [...sieges, ...live.filter((x) => x.walls && x.men)], bothHolds = share(both, (x) => x.held);
  add('Sieges', 'A besieged town with walls or a fortress and its men (or an army) in it', 'holds 60 to 85%', both.length ? `${pct(bothHolds)} in all: on the map ${pct(holds)} (${sieges.length}), in real time ${pct(liveHolds)} (${live.filter((x) => x.walls && x.men).length} of ${live.length} fought, at odds ${drawn.odds.length ? `${num(Math.min(...drawn.odds), 2)} to ${num(Math.max(...drawn.odds), 2)}` : '—'}; attacker's age ${drawn.ages.map((a) => a[0]).join(',')} against ${drawn.ages.map((a) => a[1]).join(',')})` : 'none', both.length ? within(bothHolds, 0.6, 0.85) : null,
`On the map: every siege of a nation's town settled in resolvePending, the rivals' among themselves included (campaign.ts battleWatchers), with a Fortress or a tower, wall or gate standing in its town, and its men or an army of its own in it. In real time: ${SIEGES} sieges drawn like those a campaign has. A campaign is played on by the computer for 20 to 48 seasons, so that each people is at its own age, and then the rival comes against the player\'s capital (given a Fortress: it stands as towers in its town) with infantry and archers grown until the map rates the assault at ${SIEGE_ODDS[0]} to ${SIEGE_ODDS[1]} times the town\'s defence (its own measure, as in resolvePending); the computer plays both sides for up to ${MINUTES} minutes; a town still standing then is counted as having held. Holds means the attacker was thrown back.`);

  // SPARSE: the campaigns past this run's for the sparse rows alone, played last so that nothing else reads them.
  if (SPARSE > CAMPAIGNS) {
    const extra = { risen: 0, noble: 0, n: 0, first: FIRST + CAMPAIGNS };
    for (let seed = FIRST + CAMPAIGNS; seed < FIRST + SPARSE; seed++) { const w = play(seed, true, SEASONS); extra.risen += w.claims.mineRisen; extra.noble += w.claims.mineRisenNoble; extra.n++; }
    const row = rows.find((r) => r.figure.startsWith('Risings for a claimant'));
    if (row) {
      const pool = pooledClaims({ risen: claimBase.risen, noble: claimBase.noble }, claimBase.n, extra), per = (100 * pool.risen) / pool.n;
      row.measured = claimPooled(pool, claimBase.n, claimBase.risen) + row.measured.replace(/^pooled over [^;]*; this set alone: /, '');
      row.verdict = within(per, 2, 5) && pool.noble > 0 ? 'IN' : 'OUT';
    }
  }
  for (const r of rows) if (r.measured.startsWith('pooled over') && !r.figure.endsWith('(pooled)')) r.figure += ' (pooled)';
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const inN = rows.filter((r) => r.verdict === 'IN').length, outN = rows.filter((r) => r.verdict === 'OUT').length;
  const lines = [
'# Campaign health report',
'',
`Measured by \`scripts/health.test.ts\` against \`docs/TUNING.md\`: ${CAMPAIGNS} campaigns (seeds ${FIRST} to ${FIRST + CAMPAIGNS - 1}, a player and two rivals), up to ${SEASONS} seasons, the player ${PLAYER === 'computer' ? 'played by the computer' : 'let be'}, each also played ${YEARS20} seasons with no decrees${VISITS ? `, and ${VISITS} told again with the player's first towns visited every season` : ''}. ${inN} in band, ${outN} out. Took ${secs} seconds.`,
'',
'| Area | Figure | Target band | Measured | |',
'| --- | --- | --- | --- | --- |',
...rows.map((r) => `| ${r.area} | ${r.figure} | ${r.band} | ${r.measured} | **${r.verdict}** |`),
'',
...deadSection(ruled.flatMap((w) => w.dead)),
`Plague killed ${(ruled.reduce((k, w) => k + w.plagueDead, 0) / (ruled.length * 3)).toFixed(1)} people a nation in the first twenty years (the season's ledger, every people and the tribes together, over three peoples a campaign).`,
'',
'## How each was read',
'',
...rows.filter((r) => r.note).map((r) => `- **${r.figure}.** ${r.note}`),
'',
  ];
  writeFileSync(OUT, lines.join('\n'));
  writeFileSync(`${OUT}.sparse.json`, JSON.stringify({ ...sparseCounts, course: STORIES, player: PLAYER, first: FIRST, campaigns: CAMPAIGNS }, null, 1)); // for a later run to pool (POOL)
}, 36_000_000);
