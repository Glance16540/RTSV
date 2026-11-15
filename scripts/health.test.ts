// The health of a campaign (docs/TUNING.md): many computer-played campaigns, and every figure that page asks for
// measured against its band. The measuring stick only: it changes no rate and no rule.
//
//   HEALTH=1 npx vitest run scripts/health.test.ts
//   HEALTH=1 CAMPAIGNS=48 SEASONS=200 PLAYER=computer VISITS=2 OUT=docs/health-report.md npx vitest run scripts/health.test.ts
//
//   CAMPAIGNS  how many campaigns (seeds 1..n, fixed so runs compare). Default 24.
//   SEASONS    the longest a campaign is played. Default 200.
//   PLAYER     'computer' (the player's turns are played as a rival's, campaign.ts `playForPlayer`) or 'passive'.
//   VISITS     how many of the campaigns are played again with every town of the player's visited each season for
//              twenty years (slow: a visit is ten minutes of a real battle). Default 0, and that figure is not measured.
//   OUT        where the report is written. Default docs/health-report.md.
//
// Every campaign is played twice from the same seed: as the rules stand, the player giving the decrees a sensible
// ruler would ('ruled'), and with nobody giving decrees ('no decrees'). Every figure is read from the first, but
// the decrees' own. Skipped unless HEALTH is set.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import type { Campaign } from '../src/sim/campaign';
import { ageOf, answerDemand, armyAt, continueAI, endTurn, newCampaign, playForPlayer, resolvePending } from '../src/sim/campaign';
import { folkOf, grown } from '../src/sim/township';
import { needOf } from '../src/sim/larder';
import { faithSpread } from '../src/sim/townfaith';
import { awayFrom, menOf } from '../src/sim/armytown';
import { driftOf, townStanding } from '../src/sim/drift';
import { sensibleDecrees } from '../src/sim/decrees';
import { THREATS } from '../src/sim/threats';
import { VISIT_SECONDS, beginVisit, finishVisit, visitConfig } from '../src/sim/visit';

const CAMPAIGNS = +(process.env.CAMPAIGNS ?? 24);
const SEASONS = +(process.env.SEASONS ?? 200);
const PLAYER = process.env.PLAYER === 'passive' ? 'passive' : 'computer';
const VISITS = +(process.env.VISITS ?? 0);
const OUT = process.env.OUT ?? 'docs/health-report.md';
/** Twenty years, in seasons. */
const YEARS20 = 80;
const CIVS = ['hearth', 'forge', 'greece', 'egypt', 'england', 'japan'];

// ---- Playing a campaign ----

/** A battle the campaign put to the player, as it was before it was settled. */
interface Siege { defender: number; walls: boolean; men: boolean; held: boolean }

/** Settle a battle waiting on the player, from the map, and note how a besieged town fared. */
function settle(c: Campaign, sieges: Siege[]): void {
  const p = c.pending!;
  const t = c.territories[p.to];
  const defender = p.defender, walls = t.buildings.includes('fortress'), men = !!armyAt(c, p.to) && armyAt(c, p.to)!.owner === defender;
  resolvePending(c, 'auto');
  if (defender >= 0) sieges.push({ defender, walls, men, held: c.territories[p.to].owner === defender });
}

/** One season: the player's turn (played or let be), then everyone else's. */
function season(c: Campaign, ruled: boolean, sieges: Siege[]): void {
  if (PLAYER === 'computer') {
    for (let i = 0; i < 40 && c.phase === 'player'; i++) {
      playForPlayer(c);
      if (c.pending) settle(c, sieges); else break;
    }
  }
  if (ruled) sensibleDecrees(c, 0, (tid) => driftOf(c, tid));
  endTurn(c);
  for (let i = 0; i < 200 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) settle(c, sieges); continueAI(c); }
  if (c.pending) settle(c, sieges);
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
  finishVisit(c, { town: g.standing(0), ground: g.ground(), virtue: g.players[0].virtue, seconds: g.time, folk: g.census(0) });
}

const civOf = (seed: number): string => CIVS[seed % CIVS.length];
const held = (c: Campaign) => c.territories.filter((t) => t.owner >= 0 && !t.horde && c.factions[t.owner]?.alive);

// ---- What is watched, season by season ----

interface TownSeason { hungry: boolean; farmed: boolean; convoy: boolean; drifted: boolean; strained: 'hungry' | 'raided' | 'taken' | ''; oneSex: boolean }
interface Watch {
  decided: number; // the season the campaign was decided, or -1
  how: string; // who won it: 'player beaten', 'player', 'rival'
  ages: number[]; // seasons a rival took to reach each next age
  growth: number[]; // grown after 20 years over grown at the start, for towns held by one people throughout
  townSeasons: TownSeason[];
  townLives: number; diedOut: number; diedAfterAll: number;
  hungerDead: Record<number, number>; // by people, over the first 20 years
  worstHunger: number; // the largest share of a town lost to hunger in one season
  storeSeasons: number[]; // a nation at peace: seasons of food in store, at 20 years
  faithGaps: number[]; // widest gap between two towns of one nation, each nation-season
  holyMoves: number[]; // a nation with churches, fed: its standing over 20 years
  raids: { outcome: string }[]; raidTownYears: number;
  captives: { near: boolean; back: boolean }[];
  taken: { garrison: boolean; rose: boolean }[];
  arms: { war: boolean; share: number }[];
  sieges: Siege[];
  falling: number; // towns whose standing fell 10 or more over 20 years, held by one people throughout
  fallingTowns: number;
}

function play(seed: number, ruled: boolean, seasons: number): Watch {
  const c = newCampaign(seed, 2, 1, civOf(seed));
  if (!ruled) c.decreesOff = true;
  const w: Watch = { decided: -1, how: '', ages: [], growth: [], townSeasons: [], townLives: 0, diedOut: 0, diedAfterAll: 0, hungerDead: {}, worstHunger: 0, storeSeasons: [], faithGaps: [], holyMoves: [], raids: [], raidTownYears: 0, captives: [], taken: [], arms: [], sieges: [], falling: 0, fallingTowns: 0 };
  const start = c.territories.map((t) => ({ owner: t.owner, grown: grown(folkOf(c, t.id)), standing: townStanding(c, t.id) }));
  const steady = c.territories.map((t) => t.owner >= 0); // held by the one people since the start
  const virtue0 = c.factions.map((f) => f.virtue ?? 0);
  const churched = c.factions.map(() => 0), hungryOf = c.factions.map(() => 0), townSeasonsOf = c.factions.map(() => 0);
  const lastAge = c.factions.map((f) => ({ age: ageOf(c, f.id), at: 0 }));
  const war = c.factions.map(() => -99); // the last season each people fought for land
  const strife = c.territories.map(() => ({ war: -99, famine: -99, plague: -99 })); // the last season of each at a town
  const alive = c.territories.map((t) => grown(folkOf(c, t.id)) + folkOf(c, t.id).children > 0);
  const convoyTo = new Set<number>();
  const groups = new Map<string, { near: boolean; since: number }>();
  const takenAt = new Map<number, { since: number; owner: number; garrisoned: number; seen: number }>();
  let logAt = c.log.length;
  const names = new Map(c.factions.map((f) => [f.name, f.id]));
  for (let s = 1; s <= seasons; s++) {
    // Once a campaign is decided, the world is let go on turning until twenty years have passed, so that the
    // twenty-year figures are read from every campaign; the campaign's figures are read from the decision.
    if (c.phase === 'over') {
      if (w.decided < 0) { w.decided = c.turn; w.how = !c.factions[0].alive ? 'player beaten' : c.winner === 0 ? 'player' : 'rival'; }
      if (s > YEARS20) break;
      c.phase = 'player';
    }
    const owners = c.territories.map((t) => t.owner);
    for (const x of c.convoys ?? []) convoyTo.add(x.to);
    season(c, ruled, w.sieges);
    const now = c.turn;
    // Land that changed hands: both peoples were at war; a town taken by force carries a yoke (conquered.ts).
    for (const t of c.territories) {
      const was = owners[t.id];
      if (t.owner === was) continue;
      steady[t.id] = false;
      for (const f of [was, t.owner]) if (f >= 0) war[f] = now;
      strife[t.id].war = now;
      const ev = (c.events ?? []).some((e) => e.at === t.id && e.turn === now && e.kind === 'revolt');
      const watched = takenAt.get(t.id);
      if (watched && watched.owner === was) { if (now - watched.since <= 20) w.taken.push({ garrison: watched.garrisoned * 2 > watched.seen, rose: ev }); takenAt.delete(t.id); }
      if (t.owner >= 0 && t.yoke && t.yoke.since === now) takenAt.set(t.id, { since: now, owner: t.owner, garrisoned: 0, seen: 0 });
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
    for (const r of raidsNow) { w.raids.push({ outcome: r.outcome }); if (r.outcome !== 'held') strife[r.at].war = now; }
    // Every held town.
    for (const t of held(c)) {
      const f = folkOf(c, t.id), g = grown(f), away = awayFrom(c, t.id);
      if (f.hungry) strife[t.id].famine = now;
      const raided = raidsNow.some((r) => r.at === t.id) || (c.raids ?? []).some((r) => r.at === t.id && r.turn === now - 1);
      const newly = !!t.yoke && now - t.yoke.since <= 8;
      const drifted = (f.drifted?.tavern ?? 0) + (f.drifted?.mines ?? 0) > 0;
      w.townSeasons.push({ hungry: !!f.hungry, farmed: t.buildings.includes('farm'), convoy: convoyTo.has(t.id), drifted, strained: f.hungry ? 'hungry' : raided ? 'raided' : newly ? 'taken' : '', oneSex: g + away > 0 && (f.men + away === 0 || f.women === 0) });
      if (s <= YEARS20) {
        townSeasonsOf[t.owner]++;
        if (f.hungry) hungryOf[t.owner]++;
        w.raidTownYears += 0.25;
      }
    }
    convoyTo.clear();
    for (const f of c.factions) if (f.alive && c.territories.some((t) => t.owner === f.id && t.buildings.includes('church'))) churched[f.id]++;
    // Towns that die out: nobody grown and no child left.
    for (const t of c.territories) {
      if (t.horde) continue;
      const f = folkOf(c, t.id), any = grown(f) + f.children > 0;
      if (alive[t.id] && !any && (owners[t.id] >= 0 || t.owner >= 0)) {
        w.diedOut++;
        const x = strife[t.id], recent = (k: number) => now - k <= 8;
        if (recent(x.war) && recent(x.famine) && recent(x.plague)) w.diedAfterAll++;
      }
      alive[t.id] = any;
    }
    // Hunger's dead, from the log.
    for (const line of c.log.slice(logAt)) {
      const m = /^Hunger has killed (\d+) of (your people|the (.+?)) at (.+?), after/.exec(line);
      if (!m) continue;
      const who = m[2] === 'your people' ? 0 : names.get(m[3]) ?? -1, dead = +m[1];
      if (s <= YEARS20) w.hungerDead[who] = (w.hungerDead[who] ?? 0) + dead;
      const t = c.territories.find((x) => x.name === m[4]);
      const before = t ? dead + grown(folkOf(c, t.id)) : 0;
      if (before >= 4) w.worstHunger = Math.max(w.worstHunger, dead / before);
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
    }
    // Captives held by bands: got back, or held too long.
    const seen = new Set<string>();
    for (const b of c.bands ?? []) for (const h of b.held) {
      const key = `${b.id}:${h.since}:${h.from}`;
      seen.add(key);
      const near = c.armies.some((a) => a.owner === h.owner && (a.at === b.at || c.territories[a.at].adj.includes(b.at)));
      const g = groups.get(key) ?? { near: false, since: h.since };
      groups.set(key, { near: g.near || near, since: h.since });
    }
    // Gone before their time was up: got back. Gone at it: held too long (threats.ts, captivesSeason).
    for (const [key, g] of groups) if (!seen.has(key)) { w.captives.push({ near: g.near, back: now - g.since < THREATS.holdFor }); groups.delete(key); }
    // Twenty years on.
    if (now === YEARS20) {
      for (const t of c.territories) {
        if (!steady[t.id] || t.owner !== start[t.id].owner || t.horde) continue;
        if (start[t.id].grown > 0) w.growth.push(grown(folkOf(c, t.id)) / start[t.id].grown);
        w.fallingTowns++;
        if (townStanding(c, t.id) <= start[t.id].standing - 10) w.falling++;
      }
      for (const f of c.factions) {
        if (!f.alive) continue;
        const own = c.territories.filter((t) => t.owner === f.id && !t.horde);
        if (now - war[f.id] > 8) {
          const food = own.reduce((k, t) => k + folkOf(c, t.id).stores.food, 0), need = own.reduce((k, t) => k + needOf(c, t.id), 0);
          if (need > 0) w.storeSeasons.push(food / need);
        }
        if (churched[f.id] >= YEARS20 / 2 && townSeasonsOf[f.id] > 0 && hungryOf[f.id] / townSeasonsOf[f.id] < 0.05) w.holyMoves.push((f.virtue ?? 0) - virtue0[f.id]);
      }
    }
  }
  w.townLives = w.townSeasons.length / YEARS20;
  if (c.phase === 'over' && w.decided < 0) { w.decided = c.turn; w.how = !c.factions[0].alive ? 'player beaten' : c.winner === 0 ? 'player' : 'rival'; }
  return w;
}

// ---- The report ----

const median = (xs: number[]): number => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number): string => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—');
const num = (x: number, d = 1): string => (Number.isFinite(x) ? x.toFixed(d) : '—');
const share = <T>(xs: T[], p: (x: T) => boolean): number => (xs.length ? xs.filter(p).length / xs.length : NaN);
const within = (x: number, lo: number, hi: number): boolean => Number.isFinite(x) && x >= lo && x <= hi;

interface Row { area: string; figure: string; band: string; measured: string; verdict: 'IN' | 'OUT' | 'not measurable' | 'not measured'; note?: string }

it.skipIf(!process.env.HEALTH)('the health of a campaign', () => {
  const t0 = Date.now();
  const ruled: Watch[] = [], bare: Watch[] = [];
  for (let seed = 1; seed <= CAMPAIGNS; seed++) {
    ruled.push(play(seed, true, SEASONS));
    bare.push(play(seed, false, YEARS20));
  }
  const all = <K extends keyof Watch>(k: K): Watch[K] extends (infer U)[] ? U[] : never => ruled.flatMap((w) => w[k] as unknown as never[]) as never;
  const rows: Row[] = [];
  const add = (area: string, figure: string, band: string, measured: string, ok: boolean | null, note?: string) =>
    rows.push({ area, figure, band, measured, verdict: ok === null ? 'not measurable' : ok ? 'IN' : 'OUT', note });

  // Pace
  const decided = ruled.filter((w) => w.decided >= 0).map((w) => w.decided);
  add('Pace', 'Seasons until a campaign is decided', '60 to 160', `median ${num(median(decided), 0)} (${decided.length} of ${ruled.length} decided; range ${decided.length ? Math.min(...decided) : '—'} to ${decided.length ? Math.max(...decided) : '—'}; ${['player', 'rival', 'player beaten'].map((h) => `${ruled.filter((w) => w.how === h).length} ${h === 'player' ? 'won by the player' : h === 'rival' ? 'won by a rival' : 'with the player beaten'}`).join(', ')})`, within(median(decided), 60, 160),
    'Decided means the campaign ended: one people rules beyond challenge, or the player is beaten. A campaign decided sooner is let go on turning to twenty years for the twenty-year figures, with nobody leaving it.');
  const undecided = share(ruled, (w) => w.decided < 0);
  add('Pace', `Campaigns undecided at ${SEASONS} seasons`, 'under 10%', pct(undecided), undecided < 0.1);
  const ages = all('ages');
  add('Pace', 'Seasons until a rival reaches its next age', '20 to 60', `median ${num(median(ages), 0)} (${ages.length} advances)`, within(median(ages), 20, 60), 'Counted from the start, or from its last age.');

  // People
  const growth = all('growth');
  add('People', 'A town left alone, grown people after 20 years', '1.3 to 2 times', `median ${num(median(growth), 2)}× (${growth.length} towns held by one people throughout)`, within(median(growth), 1.3, 2),
    'Nobody visits any town in these runs, so every town is left alone. Whether it is held by its houses and food is not judged.');
  if (VISITS > 0) {
    const pairs: number[] = [];
    for (let seed = 1; seed <= VISITS; seed++) {
      // The same campaign twice, the player's towns visited every season and not, compared at 20 years.
      const sum = (visits: boolean) => {
        const c = newCampaign(seed, 2, 1, civOf(seed));
        const own = c.territories.filter((t) => t.owner === 0).map((t) => t.id);
        for (let s = 1; s <= YEARS20; s++) {
          if (c.phase === 'over') c.phase = 'player'; // let go on turning, as in play()
          if (visits) for (const id of own) if (c.territories[id].owner === 0) visit(c, id);
          season(c, true, []);
        }
        return new Map(own.filter((id) => c.territories[id].owner === 0).map((id) => [id, grown(folkOf(c, id))]));
      };
      // Only towns still the player's in both tellings are compared.
      const left = sum(false), seen = sum(true), both = [...left.keys()].filter((id) => seen.has(id));
      const a = both.reduce((k, id) => k + left.get(id)!, 0), b = both.reduce((k, id) => k + seen.get(id)!, 0);
      if (a > 0) pairs.push(b / a - 1);
    }
    add('People', 'A town visited every season vs left alone, after 20 years', 'visited 10 to 40% larger', `${pct(mean(pairs))} larger (${pairs.length} campaigns)`, within(mean(pairs), 0.1, 0.4), 'The player\'s first towns, all of them visited each season, against the same campaign unvisited; only towns still the player\'s after twenty years in both are compared.');
  } else rows.push({ area: 'People', figure: 'A town visited every season vs left alone, after 20 years', band: 'visited 10 to 40% larger', measured: '—', verdict: 'not measured', note: 'A visit is ten minutes of a real battle; run with VISITS=n to measure it on n campaigns.' });
  const lives = ruled.reduce((k, w) => k + w.townLives, 0), died = ruled.reduce((k, w) => k + w.diedOut, 0), afterAll = ruled.reduce((k, w) => k + w.diedAfterAll, 0);
  const per100 = lives ? (died / lives) * 100 : NaN;
  add('People', 'Towns that die out (no people at all) per 100 town-lifetimes', 'under 3, and only after war, famine or plague together', `${num(per100, 2)} (${died} died out, ${afterAll} of them after war, famine and plague together)`, per100 < 3 && afterAll === died,
    'A town-lifetime is taken as twenty years of a held town, and only held towns are counted. Together means each of the three within the two years before.');
  const oneSex = share(all('townSeasons'), (x) => x.oneSex);
  add('People', 'Towns left all one sex', 'under 5%', `${pct(oneSex)} of town-seasons`, oneSex < 0.05, 'Of held towns with anyone grown in them; men away with its armies are counted as the town\'s (armytown.ts).');

  // Food
  const ts = all('townSeasons');
  const farmedHungry = share(ts.filter((x) => x.farmed), (x) => x.hungry);
  add('Food', 'Share of seasons a farmed town is hungry', 'under 2%', `${pct(farmedHungry)} (${ts.filter((x) => x.farmed).length} town-seasons)`, farmedHungry < 0.02);
  const bareTowns = ts.filter((x) => !x.farmed && !x.convoy);
  const bareHungry = share(bareTowns, (x) => x.hungry);
  add('Food', 'Share of seasons an unfarmed town with no convoy is hungry', '15 to 40%', `${pct(bareHungry)} (${bareTowns.length} town-seasons)`, within(bareHungry, 0.15, 0.4), 'No convoy means none was on the road to it as the season began.');
  const dead = ruled.flatMap((w) => Object.values(w.hungerDead));
  const nations = ruled.length * 3; // a player and two rivals in each
  const perNation = dead.reduce((a, b) => a + b, 0) / nations;
  const worst = Math.max(...ruled.map((w) => w.worstHunger));
  add('Food', 'Deaths from hunger in a nation, per 20 years', '1 to 10, never most of a town at once', `${num(perNation, 1)} a nation (the worst season took ${pct(worst)} of a town of four or more)`, within(perNation, 1, 10) && worst <= 0.5,
    'Read from the log, over the first twenty years, across all three peoples of each campaign (living or not). Whether a town that lost most was besieged or cut off is not judged.');

  // Stores
  const stores = all('storeSeasons');
  add('Stores', 'A nation\'s supplies after 20 years of peace', '2 to 4 seasons of full upkeep', `median ${num(median(stores), 1)} seasons (${stores.length} nations)`, within(median(stores), 2, 4),
    'The map has no upkeep but what its towns eat, so this is the food in a nation\'s towns over what they eat in a season. Peace is taken as no land won or lost in the last two years.');

  // Faith
  const gaps = all('faithGaps');
  const inGap = share(gaps, (x) => x >= 20 && x <= 60);
  add('Faith', 'Widest gap between two towns of one nation', '20 to 60 most of the time', `${pct(inGap)} of nation-seasons in band (median ${num(median(gaps), 0)})`, inGap > 0.5, 'Most of the time is taken as over half of the seasons of a nation with two towns or more.');
  const holy = all('holyMoves');
  add('Faith', 'A nation that builds churches and keeps its towns fed, over 20 years', 'toward the holy end by 15 to 40', holy.length ? `mean ${num(mean(holy), 1)} (${holy.length} nations)` : 'no such nation', holy.length ? within(mean(holy), 15, 40) : null,
    'A nation with a church standing for at least ten of the twenty years and hungry in under 5% of its town-seasons.');

  // Drift
  const drifted = share(ts, (x) => x.drifted);
  const by = (k: TownSeason['strained']) => pct(share(ts.filter((x) => x.strained === k), (x) => x.drifted));
  add('Drift', 'Share of town-seasons with anyone drifted', '5 to 20%, more in hungry, raided or newly taken towns', `${pct(drifted)} (hungry ${by('hungry')}, raided ${by('raided')}, newly taken ${by('taken')}, otherwise ${by('')})`, within(drifted, 0.05, 0.2) && ['hungry', 'raided', 'taken'].every((k) => share(ts.filter((x) => x.strained === k), (x) => x.drifted) >= share(ts.filter((x) => x.strained === ''), (x) => x.drifted) || !ts.some((x) => x.strained === k)));
  const fallR = ruled.reduce((k, w) => k + w.falling, 0) / Math.max(1, ruled.reduce((k, w) => k + w.fallingTowns, 0));
  const fallB = bare.reduce((k, w) => k + w.falling, 0) / Math.max(1, bare.reduce((k, w) => k + w.fallingTowns, 0));
  add('Drift', 'With sensible decrees vs none', 'at least a third fewer falling towns', `${pct(fallR)} falling with decrees, ${pct(fallB)} without (${fallB > 0 ? pct(1 - fallR / fallB) : '—'} fewer)`, fallB > 0 ? fallR <= fallB * (2 / 3) : null,
    'A falling town is one whose standing is 10 or more lower after twenty years, among towns held by one people throughout. With decrees, the player gives the sensible ones (decrees.ts) and rivals rule as they do; without, nobody gives any.');

  // Threats
  const raids = all('raids'), years = ruled.reduce((k, w) => k + w.raidTownYears, 0);
  const every = raids.length ? years / raids.length : NaN;
  add('Threats', 'Raids on a given town', 'about once in 3 to 5 years', raids.length ? `once in ${num(every, 1)} years (${raids.length} raids)` : 'no raids', within(every, 3, 5), 'Over the first twenty years of every held town.');
  const out = (o: string) => share(raids, (r) => r.outcome === o);
  add('Threats', 'Outcome of raids', 'held off 30 to 50%, raided 40 to 60%, taken under 15%', `held off ${pct(out('held'))}, raided ${pct(out('raided'))}, taken ${pct(out('taken'))}`, within(out('held'), 0.3, 0.5) && within(out('raided'), 0.4, 0.6) && out('taken') < 0.15);
  const caps = all('captives').filter((x) => x.near);
  const back = share(caps, (x) => x.back);
  add('Threats', 'Captives got back when the player has an army near', 'about half', caps.length ? `${pct(back)} (${caps.length} groups)` : 'none', caps.length ? within(back, 0.35, 0.65) : null,
    'Every people\'s captives, as the player is computer-played: those whose people had an army at the band\'s place or next to it while they were held. About half is taken as 35 to 65%.');

  // Conquest
  const taken = all('taken'), bareT = taken.filter((x) => !x.garrison), heldT = taken.filter((x) => x.garrison);
  const roseBare = share(bareT, (x) => x.rose), roseHeld = share(heldT, (x) => x.rose);
  add('Conquest', 'Taken towns that rise if left ungarrisoned', '15 to 35% within 5 years; under 5% with an army in them', `${pct(roseBare)} ungarrisoned (${bareT.length}), ${pct(roseHeld)} garrisoned (${heldT.length})`, bareT.length ? within(roseBare, 0.15, 0.35) && (!heldT.length || roseHeld < 0.05) : null,
    'A town taken by force (it bears a yoke), followed for twenty seasons; garrisoned if an army of its taker stood in it for over half of them.');

  // Armies
  const arms = all('arms');
  const atWar = median(arms.filter((x) => x.war).map((x) => x.share)), atPeace = median(arms.filter((x) => !x.war).map((x) => x.share));
  add('Armies', 'A nation\'s men under arms', '10 to 25% in war, under 10% in peace', `median ${pct(atWar)} in war, ${pct(atPeace)} in peace`, within(atWar, 0.1, 0.25) && atPeace < 0.1,
    'Men with its armies (armytown.ts) over those and the men in its towns. In war is a season within a year of the nation winning or losing land.');

  // Sieges
  const sieges = all('sieges').filter((x) => x.walls && x.men);
  const holds = share(sieges, (x) => x.held);
  add('Sieges', 'A besieged town defended with walls and men', 'holds 60 to 85%', sieges.length ? `${pct(holds)} (${sieges.length} sieges)` : 'none', sieges.length ? within(holds, 0.6, 0.85) : null,
    'Only battles put to the player can be watched (rivals settle their own inside the campaign\'s turn): those in which a people defended a town with a Fortress and an army of its own in it, settled from the map. For sieges fought in person see scripts/sieges.test.ts.');

  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const inN = rows.filter((r) => r.verdict === 'IN').length, outN = rows.filter((r) => r.verdict === 'OUT').length;
  const lines = [
    '# Campaign health report',
    '',
    `Measured by \`scripts/health.test.ts\` against \`docs/TUNING.md\`: ${CAMPAIGNS} campaigns (seeds 1 to ${CAMPAIGNS}, a player and two rivals), up to ${SEASONS} seasons, the player ${PLAYER === 'computer' ? 'played by the computer' : 'let be'}, each also played ${YEARS20} seasons with no decrees${VISITS ? `, and ${VISITS} with every town visited` : ''}. ${inN} in band, ${outN} out. Took ${secs} seconds.`,
    '',
    '| Area | Figure | Target band | Measured | |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.area} | ${r.figure} | ${r.band} | ${r.measured} | **${r.verdict}** |`),
    '',
    '## How each was read',
    '',
    ...rows.filter((r) => r.note).map((r) => `- **${r.figure}.** ${r.note}`),
    '',
  ];
  writeFileSync(OUT, lines.join('\n'));
}, 36_000_000);
