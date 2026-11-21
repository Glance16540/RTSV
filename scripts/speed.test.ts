// How long the rules take (a measure only: it changes nothing and judges nothing).
//
//   SPEED=1 npx vitest run scripts/speed.test.ts
//   SPEED=1 PROFILE=1 CAMPAIGNS=2 SEASONS=200 UNITS=250 TICKS=1200 OUT=speed.txt npx vitest run scripts/speed.test.ts
//
//   The map: CAMPAIGNS campaigns (seeds 1..n, a player the computer plays and two rivals) played SEASONS seasons as the
//   health report plays them, with the time of each season's turn (the player's orders, the rivals', the turn-over),
//   and the time to make each world.
//   A battle: a skirmish between two peoples the computer leads, each made up to UNITS/2 soldiers on the field, stepped
//   TICKS ticks, with the time of a tick while 200 or more are still standing.
//   PROFILE=1 adds where the time went, by function and by source file (V8's sampling profiler), for each.
//
// Times are this machine's and are to be read against another run on it. Skipped unless SPEED is set.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Session } from 'node:inspector';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import type { Campaign } from '../src/sim/campaign';
import { answerDemand, continueAI, endTurn, newCampaign, playForPlayer, resolvePending } from '../src/sim/campaign';
import { CIV_IDS } from '../src/sim/data';

const CAMPAIGNS = +(process.env.CAMPAIGNS ?? 2), SEASONS = +(process.env.SEASONS ?? 200), UNITS = +(process.env.UNITS ?? 250), TICKS = +(process.env.TICKS ?? 1200);
const PROFILE = !!process.env.PROFILE, OUT = process.env.OUT ?? 'speed.txt';

const ms = (x: number): string => (x < 10 ? x.toFixed(2) : x.toFixed(1));
const at = (sorted: number[], q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
function spread(times: number[]): string {
  const s = [...times].sort((a, b) => a - b), sum = s.reduce((n, v) => n + v, 0);
  return `median ${ms(at(s, 0.5))} ms, 90th ${ms(at(s, 0.9))} ms, worst ${ms(s[s.length - 1] ?? 0)} ms, mean ${ms(sum / Math.max(1, s.length))} ms (${s.length} measured, ${ms(sum / 1000)} s in all)`;
}

interface Node { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] }
/** Run `work` under V8's sampling profiler and say where its own time went: the functions and the files that cost most. */
function profiled(work: () => void, top = 25): string[] {
  if (!PROFILE) { work(); return []; }
  const session = new Session();
  session.connect();
  let profile: { nodes: Node[]; samples: number[]; timeDeltas: number[] } | undefined;
  session.post('Profiler.enable');
  session.post('Profiler.setSamplingInterval', { interval: 500 });
  session.post('Profiler.start');
  work();
  session.post('Profiler.stop', (_e: unknown, r: { profile: typeof profile }) => { profile = r.profile; });
  session.disconnect();
  if (!profile) return ['(no profile)'];
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const fn = new Map<string, number>(), file = new Map<string, number>();
  let all = 0;
  profile.samples.forEach((id, i) => {
    const n = byId.get(id), dt = profile!.timeDeltas[i] ?? 0;
    if (!n) return;
    all += dt;
    const src = n.callFrame.url.replace(/^.*\/(src|node_modules|scripts)\//, '$1/').replace(/\?.*$/, '') || '(engine)';
    const name = `${n.callFrame.functionName || '(anonymous)'} ${src}:${n.callFrame.lineNumber + 1}`;
    fn.set(name, (fn.get(name) ?? 0) + dt); file.set(src, (file.get(src) ?? 0) + dt);
  });
  const list = (m: Map<string, number>, n: number): string[] => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `  ${(v / all * 100).toFixed(1).padStart(5)}%  ${k}`);
  return ['  by function (its own time):', ...list(fn, top), '  by file:', ...list(file, 18)];
}

/** One season as the health report plays it: the player's turn played by the computer, then everyone else's. */
function season(c: Campaign): void {
  for (let i = 0; i < 40 && c.phase === 'player'; i++) { playForPlayer(c); if (c.pending) resolvePending(c, 'auto'); else break; }
  endTurn(c);
  for (let i = 0; i < 200 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
  if (c.pending) resolvePending(c, 'auto');
}

it.skipIf(!process.env.SPEED)('how long the rules take', () => {
  const out: string[] = [];
  // ---- The map ----
  const turns: number[] = [], late: number[] = [];
  const making: number[] = [], worlds: Campaign[] = [];
  for (let seed = 1; seed <= CAMPAIGNS; seed++) { const t = performance.now(); worlds.push(newCampaign(seed, 2)); making.push(performance.now() - t); }
  out.push(`The map: ${CAMPAIGNS} campaigns of up to ${SEASONS} seasons.`, ...profiled(() => {
    for (const c of worlds) {
      for (let s = 0; s < SEASONS && c.phase !== 'over'; s++) {
        const t = performance.now();
        season(c);
        const dt = performance.now() - t;
        turns.push(dt); if (s >= 100) late.push(dt);
      }
    }
  }));
  out.splice(1, 0, `  making a world (once a campaign, not in the profile below): ${spread(making)}`, `  a season's turn: ${spread(turns)}`, `  after season 100: ${spread(late)}`);
  // ---- A battle ----
  const ticks: number[] = [];
  let most = 0, least = Infinity;
  const mark = out.length;
  out.push(`A battle: a skirmish made up to ${UNITS} soldiers, ${TICKS} ticks.`, ...profiled(() => {
    const civs = CIV_IDS.filter((id) => id !== 'wild');
    const g = new Game(7, [0, 1].map((i) => ({ name: 'AB'[i], color: [0x3366ff, 0xff3333][i], isAI: true, civ: civs[(3 + i * 5) % civs.length] })));
    const ais = g.players.map((_, i) => { const a = new AIController(g, i); a.setLevel(1); return a; });
    for (const i of [0, 1]) {
      const home = g.units.find((u) => u.owner === i)!;
      for (let k = 0; k < UNITS / 2; k++) g.spawnUnit(k % 3 === 0 ? 'slinger' : 'clubman', i, home.x + (k % 12) - 6, home.y + Math.floor(k / 12) - 5, 'm');
    }
    const soldiers = (): number => g.units.reduce((n, u) => n + (!u.dead && u.owner >= 0 && u.owner < 2 ? 1 : 0), 0);
    for (let s = 0; s < TICKS && g.winner < 0; s++) {
      const n = soldiers(), t = performance.now();
      g.step(); g.events.length = 0;
      if (s % 20 === 19) ais.forEach((a) => a.update());
      const dt = performance.now() - t;
      if (n >= 200) { ticks.push(dt); most = Math.max(most, n); least = Math.min(least, n); }
    }
  }));
  out.splice(mark + 1, 0, `  a tick with ${least} to ${most} people of the two sides on the field: ${spread(ticks)}`);
  writeFileSync(OUT, out.join('\n') + '\n');
  console.log(out.join('\n'));
}, 3_600_000);
