// Towns over many seasons (seasonfolk.ts): a campaign played turn by turn, battles settled from the map, with
// and without a ten-minute visit to every town of the player's each season. A visit is played by the computer
// standing in for the player (it keeps the town: houses its couples, works, trains), with the town's own people
// and stores, and what it leaves goes home as a real visit's would. Mode 'calm' is a visit with nobody growing old
// in it (`Game.aging` off), to see what in-town ageing costs a town.
//
//   SEASONS=1 SEEDS=1-4 TURNS=20 OUT=seasons.jsonl npx vitest run scripts/seasons.test.ts
//
// One line of JSON per campaign and mode. Skipped unless SEASONS is set.
import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { answerDemand, continueAI, endTurn, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { VISIT_SECONDS, beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { folkOf, grown } from '../src/sim/township';

const [lo, hi] = (process.env.SEEDS ?? '1-2').split('-').map(Number);
const TURNS = +(process.env.TURNS ?? 20);
const MODES = (process.env.MODES ?? 'map,visit').split(',');

/** A visit to one town, the computer keeping it for the player for the whole ten minutes. */
function visit(c: Campaign, tid: number, aging = true): { born: number } {
  if (!beginVisit(c, tid)) return { born: 0 };
  const cfg = visitConfig(c)!;
  const g = new Game(cfg.seed, cfg.setups.map((s) => ({ ...s, isAI: true })), cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  if (cfg.ground) g.wear(cfg.ground);
  g.fixedAge = true; g.bornOnly = true; g.aging = aging;
  const ai = new AIController(g, 0); ai.setLevel(1);
  for (let s = 0; s < VISIT_SECONDS && !g.players[0].defeated; s++) { for (let i = 0; i < 20; i++) g.step(); g.events.length = 0; ai.update(); }
  finishVisit(c, { town: g.standing(0), ground: g.ground(), virtue: g.players[0].virtue, seconds: g.time, folk: g.census(0) });
  return { born: g.players[0].stats.born };
}

/** Everyone in the towns of one people (or of the tribes, -1): grown, children, and towns that cannot raise a child. */
function people(c: Campaign, owner: number) {
  let grownN = 0, kids = 0, elders = 0, towns = 0, barren = 0, empty = 0;
  for (const t of c.territories) {
    if (t.owner !== owner || t.horde) continue;
    const f = folkOf(c, t.id);
    towns++; grownN += grown(f); kids += f.children; elders += f.elders;
    if (!f.men || !f.women) barren++;
    if (!grown(f) && !f.children) empty++;
  }
  return { towns, grown: grownN, kids, elders, barren, empty };
}

it.skipIf(!process.env.SEASONS)('towns over many seasons', () => {
  for (let seed = lo; seed <= hi; seed++) {
    for (const mode of MODES) {
      const c = newCampaign(seed, 2, 1, ['hearth', 'forge', 'greece', 'egypt'][seed % 4]);
      const track: unknown[] = [];
      let visitBorn = 0, visits = 0, most = 0;
      const deltas: number[] = [];
      for (let turn = 0; turn < TURNS && c.factions[0].alive; turn++) {
        if (mode !== 'map') for (const t of c.territories.filter((x) => x.owner === 0 && !x.horde)) {
          const before = grown(folkOf(c, t.id)) + folkOf(c, t.id).children;
          visitBorn += visit(c, t.id, mode !== 'calm').born; visits++;
          const d = grown(folkOf(c, t.id)) + folkOf(c, t.id).children - before;
          deltas.push(d); most = Math.max(most, d);
        }
        endTurn(c);
        for (let i = 0; i < 80 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
        if (c.pending) resolvePending(c, 'auto');
        track.push({ turn: c.turn, me: people(c, 0), rivals: [1, 2].map((f) => people(c, f)), tribes: people(c, -1) });
      }
      appendFileSync(process.env.OUT ?? 'seasons.jsonl', JSON.stringify({ seed, mode, visits, visitBorn, mostFromOneVisit: most, deltas, track }) + '\n');
    }
  }
}, 36_000_000);
