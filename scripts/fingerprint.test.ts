// The fingerprint of a fixed set of battles, to prove that a change to the battle's code changed nothing.
//
// A set of seeded skirmishes and campaign sieges is fought headless, every side played by the computer, and the
// whole of each battle's state as it would be saved (Game.serialize: every unit, building, resource, projectile,
// the players, the clock and the run of chances) is hashed every two minutes and at the end; a siege's count of
// the town handed back to the campaign (Game.census) is hashed too. Run it before a change and after: if the two
// files are the same, the battles were fought the same.
//
//   FINGERPRINT=1 OUT=before.txt npx vitest run scripts/fingerprint.test.ts
//   (SKIRMISHES=6 SIEGES=6 MINUTES=8: how many of each, and how long each is fought)
//
// Skipped unless FINGERPRINT is set. It measures nothing and judges nothing: it only tells two runs apart.
import { it } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { AIController } from '../src/sim/ai';
import { armyAt, battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { CIV_IDS } from '../src/sim/data';
import { Game } from '../src/sim/game';

const SKIRMISHES = +(process.env.SKIRMISHES ?? 6), SIEGES = +(process.env.SIEGES ?? 6), MINUTES = +(process.env.MINUTES ?? 8);
const hash = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** Fight a battle with every side played by the computer; its state hashed every two minutes and at the end. */
function fight(g: Game, label: string): string[] {
  const ais = g.players.map((_, i) => { const a = new AIController(g, i); a.setLevel(1); return a; });
  const out: string[] = [];
  for (let s = 0; s < MINUTES * 60 && g.winner < 0; s++) {
    for (let i = 0; i < 20; i++) { g.step(); g.events.length = 0; }
    ais.forEach((a) => a.update());
    if ((s + 1) % 120 === 0) out.push(`${label} at ${(s + 1) / 60}m: ${hash(g.serialize())}`);
  }
  out.push(`${label} end: tick ${g.tick} winner ${g.winner} units ${g.units.filter((u) => !u.dead).length} buildings ${g.buildings.filter((b) => !b.dead).length} ${hash(g.serialize())}`);
  return out;
}
/** A siege out of a real campaign: a rival against the capital (even seeds), or the capital's army against a tribe's town (odd). */
function siege(seed: number) {
  const settled = CIV_IDS.filter((id) => id !== 'wild');
  const c = newCampaign(seed, 1, 1, settled[seed % settled.length]);
  const home = c.territories.find((t) => t.capital === 0)!;
  if (seed % 2 === 0) {
    c.armies.push({ id: 99, owner: 1, at: home.adj[0], units: { infantry: 2 + (seed % 3), archers: 1 + (seed % 2) }, hero: true, vet: 0, moved: false });
    c.territories[home.adj[0]].owner = 1;
    if (moveArmy(c, 99, home.id) !== 'battle') return null;
  } else {
    const to = home.adj.find((n) => c.territories[n].owner < 0 && !c.territories[n].horde);
    if (to === undefined || moveArmy(c, armyAt(c, home.id)!.id, to) !== 'battle') return null;
  }
  c.pending!.mode = 'siege';
  return battleConfig(c);
}

it.skipIf(!process.env.FINGERPRINT)('the fingerprint of a fixed set of battles', () => {
  const out: string[] = [];
  const civs = CIV_IDS;
  for (let seed = 1; seed <= SKIRMISHES; seed++) {
    // Two peoples, different every seed, each with its leader, so that leaders, their powers and their people's ways are all in it.
    const setups = [0, 1].map((i) => ({ name: 'AB'[i], color: [0x3366ff, 0xff3333][i], isAI: true, civ: civs[(seed * 3 + i * 5) % civs.length] }));
    const g = new Game(seed, setups);
    g.marauders = true;
    out.push(...fight(g, `skirmish ${seed} (${setups.map((s) => s.civ).join(' v ')})`));
  }
  for (let seed = 1; seed <= SIEGES; seed++) {
    const cfg = siege(seed);
    if (!cfg) { out.push(`siege ${seed}: none to fight`); continue; }
    const g = new Game(cfg.seed, cfg.setups.map((s) => ({ ...s, isAI: true })), cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    if (cfg.ground) g.wear(cfg.ground);
    g.fixedAge = true; g.bornOnly = true; g.marauders = true;
    out.push(...fight(g, `siege ${seed}`));
    // What the battle hands back to the campaign for each side: the town's people at their ages, and its stores.
    g.players.forEach((_, i) => out.push(`siege ${seed} census ${i}: ${hash(JSON.stringify(g.census(i)))}`));
  }
  writeFileSync(process.env.OUT ?? 'fingerprint.txt', out.join('\n') + '\n');
}, 3_600_000);
