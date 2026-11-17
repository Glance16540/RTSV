// Keeps docs/PORTING.md true to src/sim (the rules that are being ported to Unity).
//
//   node scripts/porting-check.mjs          check: what is wrong is listed, and the exit code says so
//   node scripts/porting-check.mjs --fix    also write the line counts and the dependencies into the table
//   node scripts/porting-check.mjs --hubs   also list how much each hub (game.ts, campaign.ts) touches each module
//
// What it holds the table to:
//   - every module in src/sim has exactly one row, and every row is a module that exists;
//   - no module in src/sim imports from src/client or three.js, or reaches for the DOM (the porting rule);
//   - every test file a row names exists, and every row names one;
//   - the "Depends on" column names the modules it really imports (--fix adds "(types only)" where it imports only types);
//   - no import cycle among the rules modules (imports of types alone aside);
//   - the "Lines" column is within a fifth of the truth (it is a size to plan by, not a count to keep exact).
// The last two are what --fix writes; `npm run sync` runs --fix after a merge. The words in "What it is", the
// tests named and the Unity column are written by hand and never touched here.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const SIM = 'src/sim', TABLE = 'docs/PORTING.md';
const fix = process.argv.includes('--fix'), hubs = process.argv.includes('--hubs');
const HUBS = ['game', 'campaign'];
/** How far the Lines column may be out before it counts as wrong. */
const SLACK = 0.2;

const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const modules = readdirSync(SIM).filter((f) => f.endsWith('.ts')).map((f) => f.slice(0, -3)).sort();
const source = Object.fromEntries(modules.map((m) => [m, readFileSync(`${SIM}/${m}.ts`, 'utf8')]));

/** What a module imports: other rules modules (and whether only their types), and anything it must not. */
function importsOf(name) {
  const code = strip(source[name]), deps = new Map(), bad = [];
  const see = (from, typeOnly) => {
    if (from.startsWith('./')) { const dep = from.slice(2).replace(/\.ts$/, ''); if (dep !== name) deps.set(dep, (deps.get(dep) ?? true) && typeOnly); }
    else if (from.startsWith('../client') || from === 'three' || from.startsWith('three/')) bad.push(`imports '${from}'`);
    else if (from.startsWith('..')) bad.push(`imports '${from}', outside src/sim`);
  };
  for (const m of code.matchAll(/^\s*(import|export)\s+(type\s+)?([^'"]*?)\s*from\s*['"]([^'"]+)['"]/gm)) {
    // `import type {..}` is types only; so is `import { type A, type B }`.
    const names = m[3].replace(/[{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    see(m[4], !!m[2] || (names.length > 0 && names.every((n) => n.startsWith('type '))));
  }
  for (const m of code.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) see(m[1], true); // a side-effect import, for its declarations
  for (const m of code.matchAll(/declare\s+module\s*['"]([^'"]+)['"]/g)) see(m[1], true);
  for (const m of code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) see(m[1], true);
  if (/\b(document|window|localStorage|sessionStorage|navigator)\s*\.|\bHTML[A-Z]\w*Element\b|\bTHREE\./.test(code)) bad.push('reaches for the DOM or three.js');
  return { deps, bad };
}
/**
 * Import cycles. The Unity side wants none: a module that can only be ported together with another is not a module.
 * Imports of types alone do not count (they vanish when the code is run, and C# has no trouble with them); what
 * counts is one module calling or reading another that, by whatever road, calls or reads it back.
 *
 * There are none today: the last knots were untied on 16 November 2026, and this list is empty, so any import
 * cycle among the rules modules fails the check. (The list is kept for the day one has to be let through for a
 * while: a module named here may be in a cycle; the check says when it no longer is, to be struck off again.)
 */
const KNOTTED = new Set([]);
/** The knots among the rules modules: each a set of two or more that reach one another by imports that are not of types alone. */
function knots(graph) {
  let n = 0; const stack = [], on = new Set(), index = {}, low = {}, out = [];
  const visit = (v) => {
    index[v] = low[v] = n++; stack.push(v); on.add(v);
    for (const w of graph[v] ?? []) {
      if (index[w] === undefined) { visit(w); low[v] = Math.min(low[v], low[w]); }
      else if (on.has(w)) low[v] = Math.min(low[v], index[w]);
    }
    if (low[v] === index[v]) { const c = []; let w; do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v); if (c.length > 1) out.push(c.sort()); }
  };
  for (const v of Object.keys(graph).sort()) if (index[v] === undefined) visit(v);
  return out;
}
const depsText = (deps) => [...deps.keys()].sort().map((d) => (deps.get(d) ? `${d} (types only)` : d)).join(', ') || 'none';
// Compared by the modules named: whether a row says "(types only)" is a help to whoever ports it, written by --fix, not a thing to fail on.
const depsKey = (text) => text.split(',').map((s) => s.trim().replace(/\s*\(.*$/, '').replace(/`/g, '')).filter((s) => s && s !== 'none' && s !== 'nothing' && s !== '-').sort().join(', ');

const text = readFileSync(TABLE, 'utf8'), lines = text.split('\n');
const rows = new Map(), errors = [], drift = [];
// A clash left unsettled: the marks of a merge still in the table (it has happened: a commit took them with it).
lines.forEach((line, i) => { if (/^(<{7}|>{7}|={7})( |$)/.test(line)) errors.push(`${TABLE} line ${i + 1} is the mark of an unsettled merge (${line.slice(0, 7)}): settle the clash, keeping both sides' rows`); });
lines.forEach((line, i) => {
  const m = /^\| `([\w-]+)` \|/.exec(line);
  if (!m) return;
  const cells = line.split(' | ');
  if (cells.length !== 6) { errors.push(`row \`${m[1]}\` has ${cells.length} columns, not 6 (a ' | ' inside its words?)`); return; }
  if (rows.has(m[1])) errors.push(`\`${m[1]}\` has more than one row`);
  rows.set(m[1], { i, cells });
});

const calls = {};
for (const name of modules) {
  const { deps, bad } = importsOf(name);
  calls[name] = [...deps.keys()].filter((d) => !deps.get(d) && modules.includes(d));
  for (const b of bad) errors.push(`src/sim/${name}.ts ${b}: the rules must not (docs/PORTING.md)`);
  const row = rows.get(name);
  if (!row) { errors.push(`src/sim/${name}.ts has no row in ${TABLE}`); continue; }
  const count = source[name].split('\n').length - (source[name].endsWith('\n') ? 1 : 0), had = Number(row.cells[1]);
  const want = depsText(deps);
  if (depsKey(row.cells[3]) !== depsKey(want)) { drift.push(`\`${name}\` depends on: ${want}   (the table says: ${row.cells[3]})`); row.cells[3] = want; row.changed = true; }
  if (!(Math.abs(had - count) <= Math.max(5, count * SLACK))) { drift.push(`\`${name}\` is ${count} lines (the table says ${row.cells[1]})`); row.cells[1] = String(count); row.changed = true; }
  else if (fix && had !== count) { row.cells[1] = String(count); row.changed = true; }
  const tests = row.cells[4].match(/[\w-]+\.test\.ts/g) ?? [];
  if (!tests.length) errors.push(`\`${name}\` names no test file`);
  for (const t of tests) if (!existsSync(`tests/${t}`) && !existsSync(`scripts/${t}`)) errors.push(`\`${name}\` names ${t}, which is not in tests/`);
}
for (const name of rows.keys()) if (!modules.includes(name)) errors.push(`\`${name}\` has a row but there is no src/sim/${name}.ts`);

const tied = knots(calls), inKnot = new Set(tied.flat());
for (const knot of tied) {
  const fresh = knot.filter((m) => !KNOTTED.has(m));
  if (fresh.length) errors.push(`${fresh.map((m) => `src/sim/${m}.ts`).join(', ')} ${fresh.length === 1 ? 'is' : 'are'} in an import cycle (with ${knot.filter((m) => !fresh.includes(m)).slice(0, 6).join(', ') || 'each other'}${knot.length - fresh.length > 6 ? ', ...' : ''}): the rules modules must not call each other in a ring. Import types only, or pass what is needed in`);
}
const freed = [...KNOTTED].filter((m) => !inKnot.has(m) && modules.includes(m));

if (hubs) {
  for (const hub of HUBS) {
    const code = strip(source[hub]), out = [];
    for (const m of code.matchAll(/^\s*import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]\.\/([\w-]+)['"]/gm)) {
      const names = m[2].split(',').map((s) => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()).filter(Boolean);
      const uses = names.reduce((n, id) => n + (code.match(new RegExp(`\\b${id}\\b`, 'g'))?.length ?? 1) - 1, 0);
      out.push([m[3], names.length, uses]);
    }
    console.log(`\n${hub}.ts touches (module: names imported, times used):`);
    for (const [mod, k, uses] of out.sort((a, b) => b[2] - a[2])) console.log(`  ${mod.padEnd(14)} ${String(k).padStart(3)} ${String(uses).padStart(4)}${uses > 3 ? '' : '   an import and a call or two'}`);
  }
}

if (fix) {
  let wrote = 0;
  for (const row of rows.values()) if (row.changed) { lines[row.i] = row.cells.join(' | '); wrote++; }
  if (wrote) writeFileSync(TABLE, lines.join('\n'));
  console.log(`porting table: ${modules.length} modules, ${wrote} row${wrote === 1 ? '' : 's'} rewritten${errors.length ? `, ${errors.length} thing${errors.length === 1 ? '' : 's'} only a person can settle` : ''}`);
} else {
  console.log(`porting table: ${modules.length} modules, ${rows.size} rows, ${errors.length + drift.length} wrong`);
  for (const d of drift) console.log(`  drifted: ${d}`);
  if (drift.length) console.log('  Run `npm run porting` to write the line counts and dependencies as they are.');
}
for (const e of errors) console.log(`  wrong: ${e}`);
if (tied.length) console.log(`  import cycles: ${tied.map((k) => `${k.length} modules round ${k.includes('campaign') ? 'campaign' : k[0]}`).join('; ')} (known; they may not grow)`);
if (freed.length) console.log(`  free of every cycle now, to be struck from KNOTTED in scripts/porting-check.mjs: ${freed.join(', ')}`);
process.exit(errors.length || (!fix && drift.length) ? 1 : 0);
