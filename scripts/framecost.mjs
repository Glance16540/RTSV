// What a battle or a visit costs to draw (the playtest session's measure): plays saved campaigns in headless Chromium and
// prints, for each, the units and townsfolk on the field, the buildings standing, the main thread's time in
// Renderer.frame (scene update, culling, issuing the draw; median and 90th percentile), the draw calls and triangles a
// frame (three.js renderer.info), the meshes in the scene, and the sim's step.
//
//   npm run framecost                       make the saves (scripts/framecost-saves.test.ts) and play them all
//   node scripts/framecost.mjs a.json:battle b.json:visit ...   play saves of your own
//   (FRAMES=10, W=1440, H=900, PORT=5199; Q='&outline=0' is added to the page's address)
//
// Headless Chromium draws in software, so its wall frame (printed too) is seconds and says little; the draw calls and
// triangles do not depend on the graphics card, and the main-thread time is to be read against another run on the same
// machine. It starts its own dev server and needs Playwright with its Chromium (`npm i -D playwright` where it is not
// installed). It judges nothing: it prints figures for a person to compare.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.error('framecost: Playwright is not installed here (npm i -D playwright, then npx playwright install chromium).'); process.exit(1); }

const FRAMES = +(process.env.FRAMES ?? 10), W = +(process.env.W ?? 1440), H = +(process.env.H ?? 900), PORT = +(process.env.PORT ?? 5199);
const runs = process.argv.slice(2).map((a) => { const [file, kind = 'battle'] = a.split(':'); return { file, kind }; });
if (!runs.length) {
  const dir = process.env.OUT ?? 'framecost';
  if (!existsSync(dir)) { console.error(`framecost: no saves in ${dir}; run "npm run framecost" or name save files.`); process.exit(1); }
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) runs.push({ file: `${dir}/${f}`, kind: f.includes('visit') ? 'visit' : 'battle' });
}

/** The dev server, started for the measure and stopped after it. */
async function devServer() {
  const url = `http://localhost:${PORT}/`;
  const up = async () => { try { return (await fetch(url)).ok; } catch { return false; } };
  if (await up()) return { url, stop: () => {} };
  const p = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await up())) { console.error('framecost: the dev server did not start.'); process.exit(1); }
  return { url, stop: () => { try { process.kill(-p.pid); } catch { /* gone */ } } };
}

/** Play one save and measure it. */
async function measure(browser, url, { file, kind }) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const save = readFileSync(file, 'utf8'), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('framecost')) { sessionStorage.setItem('framecost', '1'); localStorage.setItem('rtsv-campaign', s); localStorage.setItem('rtsv-campaign-active', '1'); localStorage.removeItem('rtsv-visit-save'); }
    try { sessionStorage.setItem('rtsv-seen', '1'); } catch { /* no storage */ }
  }, save);
  await page.goto(`${url}?${kind === 'visit' ? 'visit' : 'battle'}=1${process.env.Q ?? ''}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.offsetParent && /To battle|Enter the town|Back to the town/.test(x.textContent))?.click());
  await page.waitForTimeout(7000);
  const out = await page.evaluate(async (FRAMES) => {
    const app = window.app, r = app.r, g = app.game, info = r.gl.info;
    const times = [], walls = [], calls = [], tris = [], orig = r.frame.bind(r);
    info.autoReset = false;
    r.frame = (...a) => { info.reset(); const t = performance.now(); const v = orig(...a); times.push(performance.now() - t); calls.push(info.render.calls); tris.push(info.render.triangles); return v; };
    let last = performance.now();
    await new Promise((res) => { const f = (t) => { walls.push(t - last); last = t; if (walls.length < FRAMES + 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    r.frame = orig; info.autoReset = true; walls.shift();
    const stat = (xs) => { const s = [...xs].sort((a, b) => a - b); return [Math.round(s[Math.floor(s.length / 2)] * 10) / 10, Math.round(s[Math.floor(s.length * 0.9)] * 10) / 10]; };
    let meshes = 0; r.scene?.traverseVisible?.((o) => { if (o.isMesh) meshes++; });
    const t0 = performance.now(); for (let i = 0; i < 100; i++) g.step();
    const own = g.buildings.filter((b) => b.owner === 0 && b.hp > 0);
    return {
      units: g.units.length, townsfolk: g.units.filter((u) => u.owner === 0 && u.type === 'villager').length,
      buildings: g.buildings.filter((b) => b.hp > 0).length, own: own.length, houses: own.filter((b) => b.type === 'house').length,
      renderMs: stat(times), drawCalls: stat(calls), trianglesK: stat(tris.map((x) => x / 1000)), meshes,
      simMs: Math.round(((performance.now() - t0) / 100) * 100) / 100, wallMs: stat(walls),
    };
  }, FRAMES);
  await page.close();
  return { save: file.split('/').pop(), kind, ...out, ...(errors.length ? { errors: errors.slice(0, 2) } : {}) };
}

// A fresh browser for each save: a later page in the same browser draws differently (it was seen to issue half the
// draw calls of the first), so each is measured as a player would open it.
const server = await devServer();
try {
  for (const run of runs) {
    const browser = await chromium.launch();
    try { console.log(JSON.stringify(await measure(browser, server.url, run))); } finally { await browser.close(); }
  }
} finally {
  server.stop();
}
