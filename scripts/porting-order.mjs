// Writes the generated sections of docs/PORTING.md, for the session porting the rules to Unity:
//
//   - the order to port in, as layers, worked out from the table's "Depends on" column: what depends on nothing,
//     then what depends only on those, and so on (dependencies of types alone do not hold a module back; the shapes
//     it needs declared first are listed beside);
//   - the tests: that every module's named tests are there, how many cases they hold, and which large modules have few;
//   - the constants: which named bags of numbers (`export const NAME`) live in which module.
//
//   node scripts/porting-order.mjs           write the sections (run by `npm run porting` and `npm run sync`, after
//                                            porting-check.mjs --fix has made the dependency column true)
//   node scripts/porting-order.mjs --check   write nothing; say whether the sections are as they would be written
//
// Each section lies between a pair of marks, `<!-- generated:NAME -->` and `<!-- /generated:NAME -->`. Everything
// between them is rewritten; nothing outside them is touched. A section whose marks are missing is added at the end.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SIM = 'src/sim', TABLE = 'docs/PORTING.md';
const check = process.argv.includes('--check');
/** A module this long with this few cases is listed as thinly tested; and one this long with fewer than a case for every `PER` lines as lightly. */
const THIN = { lines: 150, cases: 2 }, LIGHT = { lines: 150, per: 60 };
/** A smaller module, of this many lines or more, with as few cases as THIN.cases is listed too, apart. */
const SMALL = 50;
const HUBS = ['game', 'campaign'];

const text = readFileSync(TABLE, 'utf8');
const rows = [];
for (const line of text.split('\n')) {
  if (line.startsWith('<!-- generated:')) break; // the table ends where the generated sections begin
  const m = /^\| `([\w-]+)` \|/.exec(line);
  if (!m) continue;
  const cells = line.split(' | ');
  if (cells.length !== 6) continue; // porting-check.mjs says so
  const deps = cells[3].split(',').map((s) => s.trim().replace(/`/g, '')).filter((s) => s && !/^(none|nothing|-)$/.test(s));
  rows.push({
    name: m[1], lines: Number(cells[1]) || 0,
    calls: deps.filter((d) => !/\(types only\)/.test(d)).map((d) => d.replace(/\s*\(.*$/, '')),
    shapes: deps.filter((d) => /\(types only\)/.test(d)).map((d) => d.replace(/\s*\(.*$/, '')),
    tests: cells[4].match(/[\w-]+\.test\.ts/g) ?? [],
    unity: cells[5].replace(/\s*\|\s*$/, '').trim(),
  });
}
const by = new Map(rows.map((r) => [r.name, r]));

// ---- the order: layers ----
const layer = new Map();
for (let n = 0; layer.size < rows.length; n++) {
  const next = rows.filter((r) => !layer.has(r.name) && r.calls.every((d) => !by.has(d) || (layer.has(d) && layer.get(d) < n)));
  if (!next.length) break; // an import cycle: porting-check.mjs fails on it, and what is in it is listed below
  for (const r of next) layer.set(r.name, n);
}
const depth = Math.max(-1, ...layer.values()) + 1;
const knotted = rows.filter((r) => !layer.has(r.name)).map((r) => r.name);
const neededBy = new Map(rows.map((r) => [r.name, 0]));
for (const r of rows) for (const d of r.calls) if (neededBy.has(d)) neededBy.set(d, neededBy.get(d) + 1);
// The shapes a module needs that are declared in a module of a later layer than itself (or its own): to be declared first.
const early = new Map();
for (const r of rows) for (const d of r.shapes) {
  if (!by.has(d) || !layer.has(r.name) || !layer.has(d) || layer.get(d) <= layer.get(r.name)) continue;
  const e = early.get(d) ?? { users: 0, first: Infinity };
  e.users++; e.first = Math.min(e.first, layer.get(r.name));
  early.set(d, e);
}
const order = [];
order.push(`${rows.length} modules, ${rows.reduce((n, r) => n + r.lines, 0).toLocaleString('en')} lines, in ${depth} layers. A module can be ported once every module in the layers above its own has been; within a layer the order is free, and the modules most others wait on are named first. "Ported" is the Unity column of the table: ${rows.filter((r) => /^ported/i.test(r.unity)).length} so far.`);
order.push('');
order.push('| Layer | Modules | Lines | Which (lines; how many modules call it) |');
order.push('| --- | --- | --- | --- |');
for (let n = 0; n < depth; n++) {
  const here = rows.filter((r) => layer.get(r.name) === n).sort((a, b) => neededBy.get(b.name) - neededBy.get(a.name) || a.name.localeCompare(b.name));
  order.push(`| ${n} | ${here.length} | ${here.reduce((k, r) => k + r.lines, 0).toLocaleString('en')} | ${here.map((r) => `\`${r.name}\` (${r.lines}${neededBy.get(r.name) ? `; ${neededBy.get(r.name)}` : ''})`).join(', ')} |`);
}
if (knotted.length) { order.push(''); order.push(`**In an import cycle, so in no layer:** ${knotted.map((m) => `\`${m}\``).join(', ')}. \`npm run check\` fails until it is untied.`); }
order.push('');
order.push('**Shapes to declare first.** A dependency of types alone does not hold a module back, but the C# side still needs the shape (the fields of the record) declared before the module that reads it. These are declared in a module of a later layer than a module that needs them, so write the record as plain data at the layer given, and the rules of its own module when its layer comes:');
order.push('');
order.push('| Shapes from | Needed by | From layer | Its own layer |');
order.push('| --- | --- | --- | --- |');
for (const [d, e] of [...early].sort((a, b) => a[1].first - b[1].first || b[1].users - a[1].users || a[0].localeCompare(b[0]))) order.push(`| \`${d}\` | ${e.users} module${e.users === 1 ? '' : 's'} | ${e.first} | ${layer.get(d)} |`);

// ---- the tests ----
const read = (file) => { const path = existsSync(`tests/${file}`) ? `tests/${file}` : existsSync(`scripts/${file}`) ? `scripts/${file}` : ''; return path ? readFileSync(path, 'utf8') : null; };
const casesIn = (file) => { const src = read(file); return src === null ? null : (src.match(/^\s*(it|test)(\.each\([^)]*\))?\s*\(/gm) ?? []).length; };
/** Does a test file take anything from this module itself? */
const imports = (file, name) => new RegExp(`sim/${name}['"]`).test(read(file) ?? '');
const tested = rows.map((r) => {
  const counts = r.tests.map((t) => [t, casesIn(t)]);
  return { ...r, missing: counts.filter(([, n]) => n === null).map(([t]) => t), cases: counts.reduce((n, [, k]) => n + (k ?? 0), 0), direct: r.tests.some((t) => imports(t, r.name)) };
});
const none = tested.filter((r) => !r.tests.length), missing = tested.filter((r) => r.missing.length);
const thin = tested.filter((r) => r.tests.length && r.lines >= THIN.lines && r.cases <= THIN.cases).sort((a, b) => b.lines - a.lines);
const light = tested.filter((r) => r.tests.length && !thin.includes(r) && r.lines >= LIGHT.lines && r.cases < r.lines / LIGHT.per).sort((a, b) => b.lines / Math.max(1, b.cases) - a.lines / Math.max(1, a.cases));
const list = (rs) => rs.map((r) => `| \`${r.name}\` | ${r.lines} | ${r.cases} | ${r.tests.join(', ')} |`);
const tests = [];
tests.push(`Every module names its tests in the table, and \`npm run check\` fails if one named is not there. As this was written: ${rows.length} modules, ${none.length} naming no test, ${missing.length} naming a test file that is missing; ${tested.reduce((n, r) => n + r.cases, 0).toLocaleString('en')} cases in the files named (a file named by two modules is counted for each).`);
if (none.length) tests.push('', `**Naming no test:** ${none.map((r) => `\`${r.name}\``).join(', ')}.`);
if (missing.length) tests.push('', `**Naming a test file that is not there:** ${missing.map((r) => `\`${r.name}\` (${r.missing.join(', ')})`).join('; ')}.`);
tests.push('', `**Thin: a module of ${THIN.lines} lines or more with ${THIN.cases === 1 ? 'one case' : `${THIN.cases} cases or fewer`} in the tests it names.** Port these with more care than their tests ask: a C# version can pass them and still be wrong.`, '');
if (thin.length) tests.push('| Module | Lines | Cases | Tests named |', '| --- | --- | --- | --- |', ...list(thin)); else tests.push('None.');
const few = tested.filter((r) => r.tests.length && !thin.includes(r) && r.lines >= SMALL && r.lines < THIN.lines && r.cases <= THIN.cases).sort((a, b) => b.lines - a.lines);
const indirect = tested.filter((r) => r.tests.length && !r.direct).sort((a, b) => b.lines - a.lines);
tests.push('', `**Light: a module of ${LIGHT.lines} lines or more with fewer than one case for every ${LIGHT.per} lines.** These are also exercised through other modules' tests, the fingerprint and the health report; the count here is only of the tests named for them.`, '');
if (light.length) tests.push('| Module | Lines | Cases | Tests named |', '| --- | --- | --- | --- |', ...list(light)); else tests.push('None.');
tests.push('', `**Few: a smaller module (${SMALL} to ${THIN.lines - 1} lines) with ${THIN.cases} cases or fewer.**`, '');
if (few.length) tests.push('| Module | Lines | Cases | Tests named |', '| --- | --- | --- | --- |', ...list(few)); else tests.push('None.');
tests.push('', '**Tested only through another module: none of the tests named takes anything from the module itself.** Its rules are reached by way of a hub or a neighbour, so the cases counted for it are not all about it; when it is ported, the test that proves it is the neighbour\'s.', '');
if (indirect.length) tests.push('| Module | Lines | Cases | Tests named |', '| --- | --- | --- | --- |', ...list(indirect)); else tests.push('None.');

// ---- the constants ----
const consts = [];
let bags = 0;
const found = rows.map((r) => {
  const path = `${SIM}/${r.name}.ts`;
  const names = existsSync(path) ? [...readFileSync(path, 'utf8').matchAll(/^export const ([A-Z][A-Z0-9_]*)\b/gm)].map((m) => m[1]) : [];
  bags += names.length;
  return { name: r.name, names };
}).filter((x) => x.names.length);
consts.push(`The numbers a rule goes by are kept in named constants at the top of the module that owns the rule (\`export const NAME\`), each with a comment saying what it does. ${bags} of them in ${found.length} modules. Port each with its module, under the same name, so that a number tuned here can be found there. The hubs (${HUBS.map((h) => `\`${h}\``).join(', ')}) hold few: most of what was theirs is in \`data\`, \`campaignbase\` and the systems' own modules.`);
consts.push('', '| Module | Constants |', '| --- | --- |');
for (const x of found) consts.push(`| \`${x.name}\` | ${x.names.map((n) => `\`${n}\``).join(', ')} |`);

// ---- write them between their marks ----
const SECTIONS = [
  ['order', '## The order to port in (generated)', order],
  ['tests', '## The tests (generated)', tests],
  ['constants', '## Where the constants live (generated)', consts],
];
let out = text;
for (const [key, title, body] of SECTIONS) {
  const open = `<!-- generated:${key} -->`, close = `<!-- /generated:${key} -->`;
  const block = `${open}\n${title}\n\nWritten by \`scripts/porting-order.mjs\` (\`npm run porting\`). Do not edit by hand.\n\n${body.join('\n')}\n${close}`;
  const a = out.indexOf(open), b = out.indexOf(close);
  out = a >= 0 && b > a ? out.slice(0, a) + block + out.slice(b + close.length) : `${out.replace(/\n*$/, '')}\n\n${block}\n`;
}
if (check) {
  const same = out === text;
  console.log(`porting order: ${rows.length} modules in ${depth} layers; the generated sections are ${same ? 'as they should be' : 'out of date (run `npm run porting`)'}`);
  process.exit(same ? 0 : 1);
}
if (out !== text) writeFileSync(TABLE, out);
console.log(`porting order: ${rows.length} modules in ${depth} layers; ${thin.length} thinly tested, ${light.length} lightly, ${few.length} small with few cases, ${indirect.length} only through another; ${bags} constants in ${found.length} modules${out === text ? '' : ' (written)'}`);
