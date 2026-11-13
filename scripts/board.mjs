// Writes docs/systems-board.html: one page showing every system in the game, how far along it is and
// what is missing, with rosters drawn from the game's own data. Run with `npm run board`.
// What each system has and lacks is written by hand in scripts/systems.mjs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { AREAS } from './systems.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const load = (m) => vite.ssrLoadModule('/src/sim/' + m + '.ts');
const [D, C, K, S, L, ST] = await Promise.all(['data', 'campaign', 'creed', 'scenario', 'leaders', 'story'].map(load));
await vite.close();

const manifest = existsSync('public/assets/manifest.json') ? JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')) : {};
const count = (k) => Object.keys(manifest[k] ?? {}).length;
const aliasSrc = /const MODEL_ALIAS[^=]*=\s*\{([\s\S]*?)\};/.exec(readFileSync('src/client/models.ts', 'utf8'))?.[1] ?? '';
const ALIAS = Object.fromEntries([...aliasSrc.matchAll(/(\w+): \['(\w+)'/g)].map((m) => [m[1], m[2]]));
const tests = (readFileSync('tests/sim.test.ts', 'utf8').match(/^\s*it\(/gm) ?? []).length;

const units = Object.values(D.UNITS).filter((u) => !['prey'].includes(u.cls) && u.id !== 'wolf');
const owner = {};
for (const c of Object.values(D.CIVS)) { owner[c.unique] = c.name; owner[c.unique2] = c.name; }
const personas = Object.values(L.LEADERS).reduce((n, l) => n + (l.alt ? 2 : 1), 0);
const lines = Object.values(L.LEADERS).reduce((n, l) => n + Object.values(l.lines).flat().length, 0);
const N = {
  buildings: Object.keys(D.BUILDINGS).length, ages: D.AGES.length, techs: Object.keys(D.TECHS).length, units: units.length,
  places: Object.keys(ST.PLACES).length, worlds: Object.keys(ST.WORLD_EVENTS).length, tales: ST.TALES.length,
  dilemmas: K.DILEMMAS.length, pagan: units.filter((u) => u.pagan).length, civs: D.CIV_IDS.length, alias: Object.keys(ALIAS).length,
  personas, lines, events: L.LEADER_EVENTS.length, voiced: count('voice'), portraits: count('portraits') + Object.keys(manifest.icons ?? {}).filter((k) => k.startsWith('leader_')).length,
  sites: Object.keys(C.SITES).length, missions: S.MISSIONS.length, models: count('models'), icons: count('icons'), tests,
};
const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => (N[k] === 0 ? 'No' : String(N[k])));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

const STATUS = { solid: 'Working', rough: 'Working, rough', thin: 'First pass', none: 'Not built' };
const all = AREAS.flatMap((a) => a.systems);
const tally = Object.fromEntries(Object.keys(STATUS).map((k) => [k, all.filter((s) => s.status === k).length]));
const gapCount = all.reduce((n, s) => n + s.gaps.length, 0);

// One bubble on the whiteboard: coloured by status, larger the more gaps the system has.
const bubble = (s) => `<button class="bub ${s.status}" id="bub-${all.indexOf(s)}" data-status="${s.status}" data-i="${all.indexOf(s)}" style="--k:${Math.min(1, s.gaps.length / 8)}" aria-label="${esc(s.name)}: ${STATUS[s.status]}, ${s.gaps.length} gaps">${esc(s.name)}${s.gaps.length ? `<span class="g">${s.gaps.length}</span>` : ''}</button>`;
const cloud = (a) => `<section class="cloud"><h3>${esc(a.name)}</h3><div class="bubs">${a.systems.map(bubble).join('')}</div></section>`;

const card = (s) => `<article class="sys ${s.status}" id="sys-${all.indexOf(s)}" data-status="${s.status}">
  <header><h3>${esc(s.name)}</h3><span class="pill ${s.status}">${STATUS[s.status]}</span></header>
  <p class="what">${esc(fill(s.what))}</p>
  ${s.has.length ? `<ul class="has">${s.has.map((h) => `<li>${esc(fill(h))}</li>`).join('')}</ul>` : ''}
  ${s.gaps.length ? `<h4>Gaps</h4><ul class="gaps">${s.gaps.map((g) => `<li>${esc(fill(g))}</li>`).join('')}</ul>` : '<p class="nogap">No known gaps</p>'}
</article>`;

const CLS = { villager: 'Villager', infantry: 'Infantry', ranged: 'Ranged', cavalry: 'Cavalry', siege: 'Siege', support: 'Support', hero: 'Hero', beast: 'Beast' };
const unitChip = (u) => {
  const tags = [];
  if (owner[u.id]) tags.push(`<i class="t nation">${esc(owner[u.id])}</i>`);
  if (u.pagan) tags.push('<i class="t warn">pagan</i>');
  if (u.needs === 'holy') tags.push('<i class="t">holy town</i>');
  if (u.slaver) tags.push('<i class="t warn">decadent town</i>');
  if (ALIAS[u.id]) tags.push(`<i class="t gap">borrows ${esc(D.UNITS[ALIAS[u.id]].name)} figure</i>`);
  return `<li><b>${esc(u.name)}</b> <span class="cls">${u.naval ? 'Ship' : CLS[u.cls] ?? u.cls}</span>${tags.join('')}</li>`;
};
const byAge = (list, item) => `<div class="ages">${D.AGES.map((a, i) => {
  const here = list.filter((x) => (x.age ?? 0) === i);
  return `<section><h4>${esc(a.name)} <span class="n">${here.length}</span></h4><ul class="roster">${here.map(item).join('') || '<li class="empty">Nothing</li>'}</ul></section>`;
}).join('')}</div>`;

const nationRow = (c) => {
  const l = L.LEADERS[c.id];
  const voiced = Object.keys(manifest.voice ?? {}).filter((k) => k.startsWith(c.id + '_')).length;
  const total = Object.values(l.lines).flat().length;
  const fig = (id) => `${esc(D.UNITS[id].name)}${ALIAS[id] ? ' <i class="t gap">borrowed figure</i>' : ''}`;
  const lean = K.LEANING[c.id];
  return `<tr><th><span class="sw" style="background:${hex(D.CIV_COLOR[c.id])}"></span>${esc(c.name)}</th>
    <td>${esc(l.name)}${l.alt ? `<br><span class="dim">or ${esc(l.alt.name)}</span>` : '<br><span class="dim">one leader only</span>'}</td>
    <td>${fig(c.unique)}<br>${fig(c.unique2)}</td>
    <td>${c.bonuses.map(esc).join('<br>')}</td>
    <td><span class="lean"><span style="width:${Math.round(lean * 100)}%"></span></span><span class="dim">${lean >= 0.6 ? 'pious' : lean <= 0.4 ? 'worldly' : 'between'}</span></td>
    <td class="num ${voiced ? '' : 'zero'}">${voiced} / ${total}</td>
    <td class="${manifest.portraits?.[c.id] || manifest.icons?.['leader_' + c.id] ? '' : 'zero'}">${manifest.portraits?.[c.id] || manifest.icons?.['leader_' + c.id] ? 'Yes' : 'Seal only'}</td></tr>`;
};

const page = `<title>Hearth &amp; Empire Systems Board</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600&display=swap">
<style>
/* Layout: a whiteboard of clouds (one per area) holding a bubble per system, then a wall of system cards grouped by area, status carried by a coloured top edge and pill; rosters below. */
:root {
  --bg: #f3f4f1; --panel: #ffffff; --line: #d9dcd4; --fg: #1d221c; --dim: #5d665a; --accent: #2f5d50;
  --solid: #2e7d4f; --rough: #b07a12; --thin: #c2562a; --none: #7a7f78;
  --solid-bg: #e3f1e7; --rough-bg: #f7ecd2; --thin-bg: #f8e2d8; --none-bg: #e9eae6;
  --board: #ffffff; --dots: #d3d8d0; --cloud: #f2f6f8; --cloud-line: #b4c3cd; --shade: rgba(20, 26, 20, 0.45);
  --marker: Caveat, 'Segoe Print', 'Bradley Hand', cursive;
  --display: 'Space Grotesk', 'Segoe UI', system-ui, sans-serif; --body: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #141714; --panel: #1d211d; --line: #343a33; --fg: #e8ebe4; --dim: #a0a89b; --accent: #7fc2ad;
  --solid: #6cc48d; --rough: #e0b354; --thin: #ee8f66; --none: #9aa097;
  --solid-bg: #1d3326; --rough-bg: #3a2f14; --thin-bg: #40251a; --none-bg: #2a2e29;
  --board: #191d1a; --dots: #2e352e; --cloud: #20272b; --cloud-line: #4a5a65; --shade: rgba(0, 0, 0, 0.6); color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #141714; --panel: #1d211d; --line: #343a33; --fg: #e8ebe4; --dim: #a0a89b; --accent: #7fc2ad;
  --solid: #6cc48d; --rough: #e0b354; --thin: #ee8f66; --none: #9aa097;
  --solid-bg: #1d3326; --rough-bg: #3a2f14; --thin-bg: #40251a; --none-bg: #2a2e29;
  --board: #191d1a; --dots: #2e352e; --cloud: #20272b; --cloud-line: #4a5a65; --shade: rgba(0, 0, 0, 0.6); color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 15px/1.5 var(--body); padding-block: 28px 60px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.wrap { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
h1, h2, h3, h4 { font-family: var(--display); margin: 0; text-wrap: balance; }
h1 { font-size: 30px; font-weight: 600; }
h2 { font-size: 20px; font-weight: 600; display: flex; align-items: baseline; gap: 10px; }
h2 .n, h4 .n { font: 500 13px var(--body); color: var(--dim); font-variant-numeric: tabular-nums; }
p { margin: 0; }
.dim { color: var(--dim); }
.top { display: flex; flex-direction: column; gap: 14px; }
.top p { max-width: 70ch; color: var(--dim); }
.bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: var(--none-bg); }
.bar span.solid { background: var(--solid); } .bar span.rough { background: var(--rough); } .bar span.thin { background: var(--thin); } .bar span.none { background: var(--none); }
.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.filters button { font: 500 14px var(--body); color: var(--fg); background: var(--panel); border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; cursor: pointer; display: inline-flex; gap: 8px; align-items: center; }
.filters button:hover { border-color: var(--accent); }
.filters button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.filters button[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.dot.solid { background: var(--solid); } .dot.rough { background: var(--rough); } .dot.thin { background: var(--thin); } .dot.none { background: var(--none); }
.filters .n { font-variant-numeric: tabular-nums; opacity: 0.75; }
.area { display: flex; flex-direction: column; gap: 12px; }
.key { color: var(--dim); font-size: 14px; }
.board { background-color: var(--board); background-image: radial-gradient(var(--dots) 1.2px, transparent 1.6px); background-size: 22px 22px; border: 1px solid var(--line); border-radius: 10px; padding: 22px 14px; display: flex; flex-wrap: wrap; gap: 18px; justify-content: center; align-items: center; }
.cloud { flex: 1 1 270px; max-width: 430px; min-width: 0; background: var(--cloud); border: 2px solid var(--cloud-line); border-radius: 60px 84px 70px 92px / 72px 60px 88px 66px; padding: 16px 26px 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.cloud:nth-child(even) { border-radius: 88px 62px 94px 68px / 62px 84px 64px 90px; }
.cloud h3 { font: 700 27px/1.1 var(--marker); color: var(--accent); text-align: center; }
.bubs { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; }
.bub { font: 500 calc(13px + 5px * var(--k)) / 1.2 var(--body); color: var(--fg); background: var(--none-bg); border: 2px solid var(--none); border-radius: 999px; padding: calc(6px + 5px * var(--k)) calc(12px + 6px * var(--k)); cursor: pointer; display: inline-flex; align-items: center; gap: 7px; max-width: 100%; text-align: left; transition: opacity 0.15s, transform 0.15s; }
.bub.solid { background: var(--solid-bg); border-color: var(--solid); } .bub.rough { background: var(--rough-bg); border-color: var(--rough); }
.bub.thin { background: var(--thin-bg); border-color: var(--thin); } .bub.none { border-style: dashed; }
.bub:hover { transform: scale(1.05); }
.bub:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.bub.off { opacity: 0.2; }
.bub .g { flex: none; font: 600 11px/1 var(--body); font-variant-numeric: tabular-nums; background: var(--board); color: var(--fg); border-radius: 999px; min-width: 20px; padding: 4px 5px; text-align: center; }
@media (prefers-reduced-motion: reduce) { .bub { transition: none; } .bub:hover { transform: none; } }
dialog { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--fg); padding: 0; width: min(540px, calc(100vw - 32px)); max-height: min(80vh, 720px); overflow: auto; }
dialog::backdrop { background: var(--shade); }
dialog .sys { border-width: 4px 0 0; border-radius: 0; }
dialog .foot { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 0 16px 16px; }
dialog .foot button { font: 500 14px var(--body); color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; cursor: pointer; }
dialog .foot button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; align-items: start; }
.sys { background: var(--panel); border: 1px solid var(--line); border-top: 4px solid var(--none); border-radius: 6px; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.sys.solid { border-top-color: var(--solid); } .sys.rough { border-top-color: var(--rough); } .sys.thin { border-top-color: var(--thin); }
.sys.none { border-style: dashed; border-top-style: solid; }
.sys header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.sys h3 { font-size: 17px; font-weight: 600; }
.pill { flex: none; font: 600 11px var(--body); letter-spacing: 0.04em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; white-space: nowrap; }
.pill.solid { background: var(--solid-bg); color: var(--solid); } .pill.rough { background: var(--rough-bg); color: var(--rough); }
.pill.thin { background: var(--thin-bg); color: var(--thin); } .pill.none { background: var(--none-bg); color: var(--none); }
.what { color: var(--dim); }
.sys ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; font-size: 14px; }
.sys h4 { font: 600 11px var(--body); letter-spacing: 0.06em; text-transform: uppercase; color: var(--thin); margin-top: 4px; }
.gaps li::marker { color: var(--thin); }
.nogap { font-size: 13px; color: var(--solid); }
.ages { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; align-items: start; }
.ages section { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px 14px; min-width: 0; }
.ages h4 { font-size: 15px; font-weight: 600; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.roster { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
.roster li { display: flex; flex-wrap: wrap; gap: 3px 6px; align-items: baseline; min-width: 0; }
.roster b { font-weight: 500; }
.roster .empty { color: var(--dim); }
.cls { color: var(--dim); font-size: 12px; }
.t { font: 500 11px var(--body); font-style: normal; padding: 1px 6px; border-radius: 3px; background: var(--none-bg); color: var(--dim); }
.t.nation { background: var(--solid-bg); color: var(--accent); } .t.warn { background: var(--rough-bg); color: var(--rough); } .t.gap { background: var(--thin-bg); color: var(--thin); }
.scroll { overflow-x: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
table { border-collapse: collapse; width: 100%; min-width: 880px; font-size: 14px; }
th, td { text-align: left; vertical-align: top; padding: 9px 12px; border-bottom: 1px solid var(--line); }
thead th { font: 600 11px var(--body); letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); }
tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
tbody th { font-weight: 600; white-space: nowrap; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 8px; }
.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.zero { color: var(--thin); }
.lean { display: block; width: 90px; height: 6px; border-radius: 3px; background: var(--none-bg); overflow: hidden; margin: 6px 0 3px; }
.lean span { display: block; height: 100%; background: var(--accent); }
.lists { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; align-items: start; }
.lists section { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px 14px; min-width: 0; }
.lists h4 { font-size: 15px; font-weight: 600; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; }
footer { color: var(--dim); font-size: 13px; }
</style>
<div class="wrap">
  <div class="top">
    <h1>Hearth &amp; Empire Systems Board</h1>
    <p>Every system in the game, how far along it is, and what it still lacks. ${all.length} systems, ${gapCount} known gaps. Pick a status to see only those.</p>
    <div class="bar" role="img" aria-label="${Object.entries(tally).map(([k, n]) => `${n} ${STATUS[k]}`).join(', ')}">${Object.entries(tally).map(([k, n]) => `<span class="${k}" style="flex:${n}"></span>`).join('')}</div>
    <div class="filters" id="filters">
      <button id="f-all" data-f="all" aria-pressed="true">All <span class="n">${all.length}</span></button>
      ${Object.entries(tally).map(([k, n]) => `<button id="f-${k}" data-f="${k}" aria-pressed="false"><span class="dot ${k}"></span>${STATUS[k]} <span class="n">${n}</span></button>`).join('')}
    </div>
  </div>

  <section class="area"><h2>Whiteboard</h2>
    <p class="key">One cloud for each part of the game, one bubble for each system. Colour shows how far along it is, the number counts its known gaps, and a bigger bubble has more of them. Pick a bubble to read about it.</p>
    <div class="board">${AREAS.map(cloud).join('')}</div>
  </section>

  ${AREAS.map((a) => `<section class="area"><h2>${esc(a.name)} <span class="n">${a.systems.length}</span></h2><div class="grid">${a.systems.map(card).join('')}</div></section>`).join('\n  ')}

  <section class="area"><h2>Nations <span class="n">${N.civs}</span></h2>
    <div class="scroll"><table><thead><tr><th>Nation</th><th>Leader</th><th>Their own units</th><th>Bonuses</th><th>Leaning</th><th>Lines voiced</th><th>Portrait</th></tr></thead>
    <tbody>${Object.values(D.CIVS).map(nationRow).join('')}</tbody></table></div>
  </section>

  <section class="area"><h2>Units by age <span class="n">${units.length}</span></h2>${byAge(units, unitChip)}</section>

  <section class="area"><h2>Buildings by age <span class="n">${N.buildings}</span></h2>${byAge(Object.values(D.BUILDINGS), (b) => `<li><b>${esc(b.name)}</b>${b.staff ? '<i class="t">staffed</i>' : ''}${b.camp ? '<i class="t warn">decadent town</i>' : ''}</li>`)}</section>

  <section class="area"><h2>Research by age <span class="n">${N.techs}</span></h2>${byAge(Object.values(D.TECHS), (t) => `<li><b>${esc(t.name)}</b> <span class="cls">${esc(t.desc)}</span></li>`)}</section>

  <section class="area"><h2>Smaller lists</h2><div class="lists">
    <section><h4>Standings of a town <span class="n">${K.CREEDS.length}</span></h4><ul class="roster">${K.CREEDS.map((c) => `<li><b>${esc(c.name)}</b></li>`).join('')}</ul></section>
    <section><h4>Dilemmas <span class="n">${K.DILEMMAS.length}</span></h4><ul class="roster">${K.DILEMMAS.map((d) => `<li><b>${esc(d.title)}</b></li>`).join('')}</ul></section>
    <section><h4>Calamities <span class="n">${Object.keys(D.ABILITIES).length}</span></h4><ul class="roster">${Object.values(D.ABILITIES).map((a) => `<li><b>${esc(a.name)}</b></li>`).join('')}</ul></section>
    <section><h4>Villager traits <span class="n">${Object.keys(D.VILLAGER_TRAITS).length}</span></h4><ul class="roster">${Object.values(D.VILLAGER_TRAITS).map((a) => `<li><b>${esc(a.name)}</b> <span class="cls">${esc(a.desc)}</span></li>`).join('')}</ul></section>
    <section><h4>Campaign sites <span class="n">${N.sites}</span></h4><ul class="roster">${Object.values(C.SITES).map((a) => `<li><b>${esc(a.name)}</b></li>`).join('')}</ul></section>
    <section><h4>Territory traits <span class="n">${Object.keys(C.TRAITS).length + 1}</span></h4><ul class="roster">${[...Object.values(C.TRAITS), C.COAST].map((a) => `<li><b>${esc(a.name)}</b></li>`).join('')}</ul></section>
    <section><h4>Campaign companies <span class="n">${Object.keys(C.COMPANIES).length}</span></h4><ul class="roster">${Object.values(C.COMPANIES).map((a) => `<li><b>${esc(a.name)}</b></li>`).join('')}</ul></section>
    <section><h4>Missions <span class="n">${N.missions}</span></h4><ul class="roster">${S.MISSIONS.map((m) => `<li><b>${esc(m.name ?? m.title ?? m.id)}</b></li>`).join('')}</ul></section>
    <section><h4>Moments a leader speaks <span class="n">${N.events}</span></h4><ul class="roster">${[...new Set(L.LEADER_EVENTS.map((e) => L.EVENT_NOTES[e]))].map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>
  </div></section>

  <footer>Rosters and counts are read from the game's data. Statuses and gaps are written by hand and reflect what has been built and checked so far.</footer>
</div>
<dialog id="detail" aria-label="System details"><div id="detail-slot"></div><div class="foot"><button id="detail-jump" type="button">Show in the list below</button><button id="detail-close" type="button">Close</button></div></dialog>
<script>
const buttons = [...document.querySelectorAll('#filters button')];
function show(f) {
  for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.f === f));
  for (const b of document.querySelectorAll('.bub')) b.classList.toggle('off', f !== 'all' && b.dataset.status !== f);
  for (const s of document.querySelectorAll('.wrap .sys')) s.hidden = f !== 'all' && s.dataset.status !== f;
  for (const a of document.querySelectorAll('.area')) if (a.querySelector('.sys')) a.hidden = ![...a.querySelectorAll('.sys')].some((s) => !s.hidden);
}
for (const b of buttons) b.addEventListener('click', () => show(b.dataset.f));
const detail = document.getElementById('detail');
let open = null;
for (const b of document.querySelectorAll('.bub')) b.addEventListener('click', () => {
  open = document.getElementById('sys-' + b.dataset.i);
  const copy = open.cloneNode(true);
  copy.removeAttribute('id'); copy.hidden = false;
  document.getElementById('detail-slot').replaceChildren(copy);
  detail.showModal(); detail.scrollTop = 0;
});
document.getElementById('detail-close').addEventListener('click', () => detail.close());
document.getElementById('detail-jump').addEventListener('click', () => { detail.close(); show('all'); open.scrollIntoView({ block: 'center' }); });
detail.addEventListener('click', (e) => { if (e.target === detail) detail.close(); });
</script>
`;
writeFileSync('docs/systems-board.html', page);
console.log(`systems board: ${all.length} systems, ${gapCount} gaps`, tally);
