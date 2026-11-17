// The health of a campaign (docs/TUNING.md): many computer-played campaigns, and every figure that page asks for
// measured against its band. The measuring stick only: it changes no rate and no rule.
//
//   HEALTH=1 npx vitest run scripts/health.test.ts
//   HEALTH=1 CAMPAIGNS=48 SEASONS=200 PLAYER=computer VISITS=2 OUT=docs/health-report.md npx vitest run scripts/health.test.ts
//   npm run health                (the baseline: 96 campaigns, 24 visits; about 31 minutes)
//
//   CAMPAIGNS  how many campaigns (seeds 1..n, fixed so runs compare). Default 24.
//   SEASONS    the longest a campaign is played. Default 200.
//   PLAYER     'computer' (the player's turns are played as a rival's, campaign.ts `playForPlayer`) or 'passive'.
//   SIEGES     how many real-time sieges the computer fights on both sides (the rival against a capital). Default 8.
//   MINUTES    how long each may run before the town is counted as having held. Default 20.
//   STORIES    'answer': the computer-played player answers the stories inside the story by a plain policy
//              (src/sim/storypolicy.ts); left out, it answers none of them.
//   CRIME      'roads': the roads' telling alone. '1': every campaign is told three times more for the Crime rows, once with a finished Watch House in every
//              town of the player's from the start, and once with Town Watch learnt from the start besides, and once
//              with an Inn in every such town and Escorts and Paved Roads learnt
//   VISITS     how many of the campaigns are played again with every town of the player's visited each season for
//              twenty years (slow: a visit is ten minutes of a real battle). Default 0, and that figure is not measured.
//              The player begins with one town, so a campaign gives one pair at most: the figure swings 30 to 40 points
//              at 8, and reads steadily from 24 (18 pairs or so). `npm run health` is the baseline: 96 campaigns and 24 visits.
//   OUT        where the report is written. Default docs/health-report.md.
//
// Every campaign is played twice from the same seed: as the rules stand, the player giving the decrees a sensible
// ruler would ('ruled'), and with nobody giving decrees ('no decrees'). Every figure is read from the first, but
// the decrees' own. Skipped unless HEALTH is set.
import { sensibleAnswers } from '../src/sim/storypolicy';
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import type { Campaign } from '../src/sim/campaign';
import { ageOf, answerDemand, siteCost, slots, armyAt, armyStrength, battleConfig, battleWatchers, continueAI, endTurn, moveArmy, newCampaign, playForPlayer, resolvePending } from '../src/sim/campaign';
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
import type { March } from '../src/sim/bandmarch';
import { ofTown } from '../src/sim/intriguebase';
import { creedOf } from '../src/sim/creed';
import { faithAt } from '../src/sim/townfaith';
import { goldOf } from '../src/sim/grain';
import { isAngry, noblesOf } from '../src/sim/nobles';
import { ACTS } from '../src/sim/nobleacts';
import { awaiting } from '../src/sim/encounter';

const CAMPAIGNS = +(process.env.CAMPAIGNS ?? 24);
const SEASONS = +(process.env.SEASONS ?? 200);
const PLAYER = process.env.PLAYER === 'passive' ? 'passive' : 'computer';
const VISITS = +(process.env.VISITS ?? 0);
/** 'answer': the computer-played player answers the stories inside the story by a plain policy (src/sim/storypolicy.ts); otherwise it answers none. */
/** '1': the campaigns are told three times more for the Crime rows: the player's towns given a Watch House from the start; Town Watch besides; and an Inn in each with Escorts and Paved Roads learnt. */
const CRIME = !!process.env.CRIME;
const STORIES = process.env.STORIES === 'answer' ? 'answer' : 'ignore';
const OUT = process.env.OUT ?? 'docs/health-report.md';
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

/** One season: the player's turn (played or let be), then everyone else's. */
function season(c: Campaign, ruled: boolean): void {
  if (PLAYER === 'computer') {
    if (STORIES === 'answer') sensibleAnswers(c, 0);
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
  stories: number; storyYears: number; // stories inside the story begun for the player (intrigue.ts), and the years the player's nation lived
  townLives: number; diedOut: number; diedAfterAll: number;
  /** Every town that died out (tribes' too), with what emptied it: see `whyDead`. */
  dead: DeadTown[];
  /** People killed by plague in the first twenty years, every people and the tribes together (the season's ledger). */
  plagueDead: number;
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
  raids: { outcome: string }[]; raidTownYears: number;
  /** Every strike by a band on a held town: was it held off, what it cost in people, and whether the town kept a town watch (townwatch.ts) or had a Fortress (fortress.ts). */
  strikes: { held: boolean; lost: number; watch: boolean; fort: boolean; mine: boolean }[];
  /** Marches in from the far wilds (bandwilds.ts), and how many bands of any kind came in the campaign. */
  marches: March[]; bandsCame: number;
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
}

const CRIME_ROW = 'Seasons a thief or a killer is at large, with a Watch House in every town against as it is (read with CRIME=1)', CRIME_BAND = '10 to 30% fewer';
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
  const w: Watch = { decided: -1, how: '', stories: 0, storyYears: 0, ages: [], growth: [], grownGrowth: [], townSeasons: [], townLives: 0, diedOut: 0, diedAfterAll: 0, dead: [], plagueDead: 0, hungerDead: {}, worstHunger: 0, storeSeasons: [], peaceSeasons: 0, faithGaps: [], holyMoves: [], lords20: { player: 0, playerAngry: 0, playerContent: 0, rivals: 0, rivalsAngry: 0, rivalsContent: 0, plots: 0 }, lordActs: { help: 0, withhold: 0, joined: 0 }, gold20: [], grain: { buys: 0, food: 0, gold: 0 }, halls: { rivals: 0, with: 0 }, houses: { holy: 0, with: 0 }, raids: [], raidTownYears: 0, strikes: [], marches: [], bandsCame: 0, crimes: [], convoys: [], hungers: [], mine: { seasons: 0, hungry: 0, grown: 0 }, captives: [], taken: [], retaken: 0, unsettled: 0, arms: [], reached60: [], reached70: [], sieges: [], falling: 0, fallingTowns: 0, driftSeasons: { lost: 0, ts: 0 }, met: -1, driftLost: [] };
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
  const takenAt = new Map<number, { since: number; owner: number; garrisoned: number; seen: number }>();
  let logAt = c.log.length;
  const hungrySpell = c.territories.map((): { seasons: number; paved: boolean; owner: number } | null => null); // the spell of hunger each town is in
  const atLarge = new Map<number, { seasons: number; watched: number }>(); // each thief and killer, by the story's id
  const losses: Losses[][] = [];
  const names = new Map(c.factions.map((f) => [f.name, f.id]));
  for (let s = 1; s <= seasons; s++) {
    if (forced) give(c, FORCED[forced]);
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
    for (const t of c.territories) {
      const was = owners[t.id];
      if (t.owner === was) continue;
      steady[t.id] = false;
      for (const f of [was, t.owner]) if (f >= 0) { war[f] = now; warSeasons[f].add(now); }
      strife[t.id].war = now;
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
    // Acts of God and raids this season, at each town.
    for (const e of c.events ?? []) {
      if (e.turn !== now) continue;
      if (e.kind === 'famine') strife[e.at].famine = now;
      if (e.kind === 'plague' || e.kind === 'fever') strife[e.at].plague = now;
    }
    const raidsNow = (c.raids ?? []).filter((r) => r.turn === now);
    for (const r of raidsNow) { if (r.owner >= 0) w.raids.push({ outcome: r.outcome }); if (r.outcome !== 'held') strife[r.at].war = now; }
    for (const r of raidsNow) if (r.owner >= 0) w.strikes.push({ held: r.outcome === 'held', lost: r.killed + r.taken.men + r.taken.women, watch: hasStudy(c, r.owner, 'townwatch') && standsAt(c, r.at, 'watchhouse'), fort: hasFortress(c, r.at), mine: r.owner === 0 });
    // Thieves and killers at large this season: begun, not ended, and (a thief) not yet standing for judgement.
    for (const x of c.intrigues ?? []) {
      if (!ofTown(x) || x.ended || x.caught !== undefined) continue;
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
  w.stories = c.intrigueSeq ?? 0; w.storyYears = c.turn / 4;
  w.lords20.plots = (c.intrigues ?? []).filter((it) => it.kind === 'plot').length;
  w.crimes = [...atLarge.values()];
  w.marches = [...(c.marches ?? [])]; w.bandsCame = c.bandSeq ?? 0;
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

interface Row { area: string; figure: string; band: string; measured: string; verdict: 'IN' | 'OUT' | 'not measurable' | 'not measured' | 'no band yet'; note?: string }

it.skipIf(!process.env.HEALTH)('the health of a campaign', () => {
  const t0 = Date.now();
  const ruled: Watch[] = [], bare: Watch[] = [];
  for (let seed = 1; seed <= CAMPAIGNS; seed++) {
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
  add('Faith', 'Widest gap between two towns of one nation', '20 to 60 most of the time', `${pct(inGap)} of nation-seasons in band (median ${num(median(gaps), 0)})`, inGap > 0.5, 'Most of the time is taken as over half of the seasons of a nation with two towns or more.');
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
    add('Crime', 'The player\'s convoys stopped by a band, with an Inn against without', 'report only', `${stoppedOf(convoys.filter((x) => x.inn))} with against ${stoppedOf(convoys.filter((x) => !x.inn))} without`, 'report', 'Every convoy of the player\'s that finished its road, read from the log (rivals\' convoys are not written there). "With" is a season in which the player had an Inn standing in any town, whether or not it was on that convoy\'s road.');
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
  // Bands from the far wilds (bandwilds.ts): report only.
  {
    const ms = all('marches'), came = ruled.reduce((k, w) => k + w.bandsCame, 0), avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
    const there = ms.filter((m) => m.arrived !== undefined), seen = ms.filter((m) => m.seen !== undefined), ahead = seen.filter((m) => (m.struck ?? m.arrived) !== undefined);
    const met = ms.filter((m) => m.met !== undefined), struck = ms.filter((m) => m.struck !== undefined);
    add('Threats', 'Bands that come from the far wilds', 'report only', ms.length ? `${ms.length} of ${came} bands (${pct(ms.length / came)}), ${num(ms.length / ruled.length, 1)} a campaign; a march of ${num(avg(ms.map((m) => m.lands)), 1)} lands, ${there.length ? num(avg(there.map((m) => m.arrived! - m.born)), 1) : '?'} seasons for the ${there.length} that got there` : 'none', 'report',
      'Camps of raiders and slavers born in a land that began wild and is still empty (wilds.ts), that set out at once for a mark (bandwilds.ts), against every band of any kind that came in the campaigns above. There must be such a land free, with a way in of more than one land.');
    add('Threats', 'A band from the far wilds is seen coming, and met before it strikes', 'report only', ms.length ? `seen ${pct(seen.length / ms.length)}, ${ahead.length ? num(avg(ahead.map((m) => (m.struck ?? m.arrived)! - m.seen!)), 1) : '?'} seasons before it struck or was there; met by an army first ${pct(met.length / ms.length)} (${met.length}, ${ms.filter((m) => m.broken).length} broken), struck someone ${pct(struck.length / ms.length)}` : 'none', 'report',
      'Seen: an army in or beside a land it passed, or a town within two lands, told its people. Met: an army went against it (not the band against the army) before it had struck anyone.');
  }
  const out = (o: string) => share(raids, (r) => r.outcome === o);
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
  add('Armies', 'A nation\'s men under arms', '10 to 25% in war, under 10% in peace', `median ${pct(atWar)} in war, ${pct(atPeace)} in peace`, within(atWar, 0.1, 0.25) && atPeace < 0.1,
    'Men with its armies (armytown.ts) over those and the men in its towns. In war is a season within a year of the nation winning or losing land.');

  // Sieges
  const sieges = all('sieges').filter((x) => x.walls && x.men), drawn = realSieges(), live = drawn.sieges;
  const holds = share(sieges, (x) => x.held), liveHolds = share(live.filter((x) => x.walls && x.men), (x) => x.held);
  const both = [...sieges, ...live.filter((x) => x.walls && x.men)], bothHolds = share(both, (x) => x.held);
  add('Sieges', 'A besieged town with walls or a fortress and its men (or an army) in it', 'holds 60 to 85%', both.length ? `${pct(bothHolds)} in all: on the map ${pct(holds)} (${sieges.length}), in real time ${pct(liveHolds)} (${live.filter((x) => x.walls && x.men).length} of ${live.length} fought, at odds ${drawn.odds.length ? `${num(Math.min(...drawn.odds), 2)} to ${num(Math.max(...drawn.odds), 2)}` : '—'}; attacker's age ${drawn.ages.map((a) => a[0]).join(',')} against ${drawn.ages.map((a) => a[1]).join(',')})` : 'none', both.length ? within(bothHolds, 0.6, 0.85) : null,
    `On the map: every siege of a nation's town settled in resolvePending, the rivals' among themselves included (campaign.ts battleWatchers), with a Fortress or a tower, wall or gate standing in its town, and its men or an army of its own in it. In real time: ${SIEGES} sieges drawn like those a campaign has. A campaign is played on by the computer for 20 to 48 seasons, so that each people is at its own age, and then the rival comes against the player\'s capital (given a Fortress: it stands as towers in its town) with infantry and archers grown until the map rates the assault at ${SIEGE_ODDS[0]} to ${SIEGE_ODDS[1]} times the town\'s defence (its own measure, as in resolvePending); the computer plays both sides for up to ${MINUTES} minutes; a town still standing then is counted as having held. Holds means the attacker was thrown back.`);

  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const inN = rows.filter((r) => r.verdict === 'IN').length, outN = rows.filter((r) => r.verdict === 'OUT').length;
  const lines = [
    '# Campaign health report',
    '',
    `Measured by \`scripts/health.test.ts\` against \`docs/TUNING.md\`: ${CAMPAIGNS} campaigns (seeds 1 to ${CAMPAIGNS}, a player and two rivals), up to ${SEASONS} seasons, the player ${PLAYER === 'computer' ? 'played by the computer' : 'let be'}, each also played ${YEARS20} seasons with no decrees${VISITS ? `, and ${VISITS} told again with the player's first towns visited every season` : ''}. ${inN} in band, ${outN} out. Took ${secs} seconds.`,
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
}, 36_000_000);
