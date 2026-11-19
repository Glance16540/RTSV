// Campaign-shaped trial sieges, computer against computer: a real campaign's battle over a town, fought with the
// town's own people and stores, both sides played by the computer. Run with the villager for hire and without it
// (birthonly.ts), over the same seeds, to see what people coming only by birth does to a siege.
//
//   SIEGES=1 SEEDS=1-12 OUT=sieges.jsonl npx vitest run scripts/sieges.test.ts   (AGING=0: nobody grows old; AGE=2: every people in that age, as a later war is)
//
// Each game is written as one line of JSON to OUT. Skipped unless SIEGES is set.
import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { armyAt, battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { CIV_IDS } from '../src/sim/data';

const [lo, hi] = (process.env.SEEDS ?? '1-4').split('-').map(Number);
const MIN = +(process.env.MIN ?? 30);
const MODES = (process.env.MODES ?? 'hire,born').split(',');

/** A siege to fight: the rival comes against the capital (even seeds), or the capital's army goes against a tribe's town (odd). */
function siege(seed: number) {
  const settled = CIV_IDS.filter((id) => id !== 'wild');
  const c = newCampaign(seed, 1, 1, settled[seed % settled.length]);
  if (process.env.AGE) for (const f of c.factions) f.age = +process.env.AGE;
  const home = c.territories.find((t) => t.capital === 0)!;
  if (seed % 2 === 0) {
    c.armies.push({ id: 99, owner: 1, at: home.adj[0], units: { infantry: 2 + (seed % 3), archers: 1 + (seed % 2) }, hero: false, vet: 0, moved: false });
    c.territories[home.adj[0]].owner = 1;
    if (moveArmy(c, 99, home.id) !== 'battle') return null;
  } else {
    const to = home.adj.find((n) => c.territories[n].owner < 0 && !c.territories[n].horde);
    if (to === undefined || moveArmy(c, armyAt(c, home.id)!.id, to) !== 'battle') return null;
  }
  c.pending!.mode = 'siege';
  return battleConfig(c);
}

/** What a side has: villagers at work (not called to arms), soldiers, and children on its houses' records. */
function side(g: Game, pid: number) {
  let vil = 0, sol = 0, kids = 0;
  for (const u of g.units) {
    if (u.owner !== pid || u.dead) continue;
    if (u.type === 'villager') vil++;
    else if (g.isMilitary(u)) sol++;
  }
  for (const b of g.buildings) if (b.owner === pid && !b.dead) kids += b.young?.length ?? 0;
  kids += g.players[pid].wards?.length ?? 0;
  return { vil, sol, kids };
}

it.skipIf(!process.env.SIEGES)('campaign-shaped trial sieges', () => {
  for (let seed = lo; seed <= hi; seed++) {
    const cfg = siege(seed);
    if (!cfg) continue;
    for (const mode of MODES) {
      const setups = cfg.setups.map((s) => ({ ...s, isAI: true }));
      const g = new Game(cfg.seed, setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
      if (cfg.ground) g.wear(cfg.ground);
      g.fixedAge = true;
      g.bornOnly = mode === 'born';
      g.marauders = true;
      if (process.env.AGING === '0') g.aging = false; // nobody grows old in the battle: to see what ageing costs
      const ais = setups.map((_, i) => { const a = new AIController(g, i); a.setLevel(1); return a; });
      const def = cfg.humanAttacks ? 1 : 0, att = 1 - def;
      const at20: Record<string, unknown> = {};
      const start = [side(g, def), side(g, att)];
      let fewest = [Infinity, Infinity], emptied = [-1, -1];
      const t0 = Date.now();
      for (let s = 0; s < MIN * 60 && g.winner < 0; s++) {
        for (let i = 0; i < 20; i++) { g.step(); g.events.length = 0; }
        ais.forEach((a) => a.update());
        const now = [side(g, def), side(g, att)];
        now.forEach((x, k) => {
          fewest[k] = Math.min(fewest[k], x.vil);
          // A town dies out when it has nobody left to work and nobody coming of age.
          if (emptied[k] < 0 && x.vil === 0 && x.kids === 0) emptied[k] = Math.round(g.time);
        });
        if (s + 1 === 20 * 60) { at20.def = now[0]; at20.att = now[1]; }
      }
      const end = [side(g, def), side(g, att)];
      const who = g.winner < 0 ? 'none' : g.players[g.winner].team === g.players[def].team ? 'defender' : 'attacker';
      appendFileSync(process.env.OUT ?? 'sieges.jsonl', JSON.stringify({
        seed, mode, kind: cfg.humanAttacks ? 'assault' : 'besieged', civs: [g.players[def].civ, g.players[att].civ], players: setups.length,
        winner: who, minutes: +(g.time / 60).toFixed(1), start, at20, end, fewest, emptied,
        born: [g.players[def].stats.born, g.players[att].stats.born], trained: [g.players[def].stats.trained, g.players[att].stats.trained],
        ms: Date.now() - t0,
      }) + '\n');
    }
  }
}, 36_000_000);
