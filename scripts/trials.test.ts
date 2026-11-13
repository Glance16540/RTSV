import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { AIController } from '../src/sim/ai';
import { Game, Unit } from '../src/sim/game';

const PAIRS: [string, string, number][] = (process.env.PAIRS ?? 'hearth:forge:3,wild:hearth:5,steppe:egypt:7,persia:japan:11,greece:dawn:13').split(',').map((s) => { const [a, b, n] = s.split(':'); return [a, b, +n]; });
const MIN = +(process.env.MIN ?? 25);
it.skipIf(!process.env.TRIALS)('AI trial games', () => {
  for (const [a, b, seed] of PAIRS) {
    const g = new Game(seed, [{ name: a, color: 1, isAI: true, civ: a }, { name: b, color: 2, isAI: true, civ: b }]);
    const ais = [0, 1].map((i) => { const c = new AIController(g, i); c.setLevel(1); return c; });
    const last = new Map<number, { x: number; y: number; t: number }>();
    const stuckSeen = new Map<string, number>();
    const taken = [0, 0]; let worst = 0, stuckSecs = 0, idleSecs = 0, unitSecs = 0, t0 = Date.now();
    const lines: string[] = [];
    for (let s = 0; s < MIN * 60 && g.winner < 0; s++) {
      const q0 = Date.now();
      for (let i = 0; i < 20; i++) { g.step(); for (const e of g.events as any[]) if (e.t === 'msg' && /carried off by raiders/.test(e.text ?? '')) taken[1 - e.player]++; g.events.length = 0; }
      ais.forEach((c) => c.update());
      worst = Math.max(worst, Date.now() - q0);
      for (const u of g.units) {
        if (u.owner > 1 || u.inside) continue;
        unitSecs++;
        const o = u.order as { t: string } | null;
        if (u.type === 'villager' && !o && u.growT <= 0) idleSecs++;
        const l = last.get(u.id);
        if (!l || Math.hypot(u.x - l.x, u.y - l.y) > 0.3) { last.set(u.id, { x: u.x, y: u.y, t: g.time }); continue; }
        // Standing in one place 12s with somewhere to go, and not at work or fighting there.
        if (o && g.time - l.t > 12 && u.attackAnim <= 0 && u.cooldown <= 0 && !(u as Unit).anchored && (o.t === 'move' || o.t === 'attack' || o.t === 'gather' || o.t === 'build' || o.t === 'amove')) {
          stuckSecs++;
          const k = `${u.owner}:${u.type}:${o.t}`;
          stuckSeen.set(k, (stuckSeen.get(k) ?? 0) + 1);
          if (process.env.DUMP && [5, 300, 1500, 3000].includes(stuckSeen.get(k)!)) { const oo = u.order as any; const tgt = oo.id ? g.entities.get(oo.id) as any : null; appendFileSync(process.env.OUT!, `    STUCK t=${Math.round(g.time)} ${k} at ${u.x.toFixed(1)},${u.y.toFixed(1)} order ${JSON.stringify(oo)} tgt ${tgt ? tgt.type + '@' + tgt.x.toFixed(1) + ',' + tgt.y.toFixed(1) : ''} path ${u.path ? u.path.length + ':' + u.pathI : 'none'} partial ${u.pathPartial}\n`); }
        }
      }
      if ((s + 1) % 300 === 0) {
        lines.push(`  ${(s + 1) / 60}m ` + g.players.slice(0, 2).map((p, i) => { const us = g.units.filter((u) => u.owner === i); const v = us.filter((u) => u.type === 'villager'); return `${p.civ}[age ${p.age} vil ${v.length} idle ${v.filter((u) => !u.order && !u.inside && u.growT <= 0).length} in ${v.filter((u) => u.inside).length} kid ${v.filter((u) => u.growT > 0).length} army ${us.length - v.length} bld ${g.buildings.filter((q) => q.owner === i).length} res ${Math.round(p.res.food)}/${Math.round(p.res.wood)}/${Math.round(p.res.gold)}/${Math.round(p.res.stone)}${p.defeated ? ' OUT' : ''}]`; }).join(' '));
      }
    }
    const top = [...stuckSeen].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, n]) => `${k}=${n}`).join(' ');
    appendFileSync(process.env.OUT ?? '/tmp/harness.txt', `${a} v ${b} seed ${seed}: winner ${g.winner < 0 ? 'none' : g.players[g.winner].civ} at ${(g.time / 60).toFixed(1)}m; stuck ${(100 * stuckSecs / unitSecs).toFixed(2)}% idle-villager ${(100 * idleSecs / unitSecs).toFixed(2)}%; ${((Date.now() - t0) / g.time).toFixed(1)}ms per sim-second, worst second ${worst}ms\n  stats ${JSON.stringify(g.players.slice(0, 2).map((q) => q.stats))} taken ${taken}\n${lines.join('\n')}\n  stuck: ${top}\n`);
  }
}, 3600000);
