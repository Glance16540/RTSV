// The reference figures for the port (docs/REFERENCE.md): everything the Unity side is measured against, taken in one go.
//
//   npm run reference                       the full reference into docs/reference/ (about 90 minutes on four cores)
//   QUICK=1 REF_OUT=/tmp/ref npm run reference   a dry run: the same steps, small (about 17 minutes), to check the layout
//
// What it runs, in order (four processes at a time; the machine is assumed to have four cores):
//   1. The shared health report (scripts/health.test.ts), 384 campaigns, on both sets of seeds (1..384 and 385..768),
//      in both courses (the player answering no stories, and answering them by storypolicy.ts): four reports.
//   2. The round of all fifteen (scripts/round.test.ts), a map to a game, 1,680 games, in four parts by k.
//   3. The battles' fingerprint (scripts/fingerprint.test.ts).
// Then it writes the manifest (manifest.md): the commit it was taken on, when, how long each step took, the asking
// for each file and each file's sha256. A step that fails stops the run and says which; what was written stays.
// The round is resumable: run it again on the same commit and only the games missing from round.txt are played.
//
// The asking can be changed for a step without editing this file: CAMPAIGNS (384), ROUND_SEED1 (16), and QUICK=1,
// which sets CAMPAIGNS=16, ROUND_SEED1=4 and the fingerprint's defaults. It measures; it judges nothing.
import { spawn, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const QUICK = !!process.env.QUICK;
const OUT = resolve(process.env.REF_OUT ?? 'docs/reference');
const CAMPAIGNS = +(process.env.CAMPAIGNS ?? (QUICK ? 16 : 384));
const ROUND_SEED1 = +(process.env.ROUND_SEED1 ?? (QUICK ? 4 : 16));
mkdirSync(OUT, { recursive: true });

const commit = execSync('git rev-parse --short=8 HEAD').toString().trim();
let main = '';
try { main = execSync('git rev-parse --short=8 origin/main').toString().trim(); execSync(`git merge-base --is-ancestor ${main} HEAD`); } catch { main = ''; }
const dirty = execSync('git status --porcelain -- src scripts').toString().trim() !== '';
const started = new Date();
const steps = [];

/** Run one vitest file with this asking; resolves with its exit code. Its own output goes to <log>. */
function vitest(file, env, log) {
  return new Promise((done) => {
    const p = spawn('npx', ['vitest', 'run', file, '--testTimeout', '0'], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => chunks.push(d));
    p.on('close', (code) => { writeFileSync(log, Buffer.concat(chunks)); done(code ?? 1); });
  });
}

/** A step: some runs side by side; it fails if any of them fails. */
async function step(name, runs) {
  const t0 = Date.now();
  console.log(`reference: ${name} (${runs.length} at once)`);
  const codes = await Promise.all(runs.map((r) => vitest(r.file, r.env, join(OUT, 'logs', r.log))));
  const secs = Math.round((Date.now() - t0) / 1000);
  steps.push({ name, secs, runs });
  const bad = codes.map((c, i) => (c ? runs[i].log : null)).filter(Boolean);
  if (bad.length) { manifest(`failed at ${name}: see ${bad.map((b) => `logs/${b}`).join(', ')}`); console.error(`reference: ${name} failed (${bad.join(', ')})`); process.exit(1); }
  console.log(`reference: ${name} done in ${Math.round(secs / 60)} minutes`);
}

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
const asked = (env) => Object.entries(env).filter(([k]) => k !== 'OUT').map(([k, v]) => `${k}=${v}`).join(' ');

function manifest(state) {
  const files = readdirSync(OUT).filter((f) => f !== 'manifest.md' && f !== 'logs').sort();
  const lines = [
    `# Reference figures${QUICK ? ` (draft, main ${main || '?'}: a dry run, small)` : ''}`,
    '',
    `- Commit: \`${commit}\`${main && main !== commit ? `, holding main at \`${main}\`` : ''}${dirty ? ' (with uncommitted changes to src or scripts: not a reference)' : ''}`,
    `- Taken: ${started.toISOString().slice(0, 16).replace('T', ' ')} UTC, ${state}`,
    `- How it is read: docs/REFERENCE.md. How it was taken: \`${QUICK ? 'QUICK=1 ' : ''}npm run reference\` (scripts/reference.mjs).`,
    '',
    '| Step | Minutes | File | Asking |',
    '| --- | --- | --- | --- |',
    ...steps.flatMap((s) => s.runs.map((r, i) => `| ${i ? '' : s.name} | ${i ? '' : Math.round(s.secs / 60)} | ${r.env.OUT ? `\`${r.env.OUT.slice(OUT.length + 1)}\`` : ''} | ${asked(r.env)} |`)),
    '',
    '| File | sha256 (first 16) |',
    '| --- | --- |',
    ...files.map((f) => `| \`${f}\` | ${sha(join(OUT, f))} |`),
    '',
  ];
  writeFileSync(join(OUT, 'manifest.md'), lines.join('\n'));
}

mkdirSync(join(OUT, 'logs'), { recursive: true });
const health = (first, course) => ({
  file: 'scripts/health.test.ts', log: `health-${first === 1 ? 'a' : 'b'}-${course}.txt`,
  env: { HEALTH: '1', CAMPAIGNS: String(CAMPAIGNS), FIRST: String(first), ...(course === 'answer' ? { STORIES: 'answer' } : {}), OUT: join(OUT, `health-${first === 1 ? 'a' : 'b'}-${course}.md`) },
});
await step('Shared report', [health(1, 'plain'), health(1, 'answer'), health(CAMPAIGNS + 1, 'plain'), health(CAMPAIGNS + 1, 'answer')]);

const roundOut = join(OUT, 'round.txt');
const parts = 4, per = Math.ceil(ROUND_SEED1 / parts);
await step('Round of fifteen', Array.from({ length: parts }, (_, i) => ({ i, a: i * per, b: Math.min(ROUND_SEED1, (i + 1) * per) }))
  .filter((p) => p.a < p.b)
  .map((p) => ({ file: 'scripts/round.test.ts', log: `round-${p.i}.txt`, env: { ROUND: '1', SEED0: String(p.a), SEED1: String(p.b), OUT: roundOut } })));
// Each part writes the table only for what it asked; once all are in, one asking of the whole writes the whole table
// (every game is in round.txt already, so none is played again).
await step('Round table', [{ file: 'scripts/round.test.ts', log: 'round-table.txt', env: { ROUND: '1', SEED0: '0', SEED1: String(ROUND_SEED1), OUT: roundOut } }]);

// The four parts append as their games end, so the file's order is the order they finished in: sorted by each game's
// tag (#i.j.k), the same round gives the same file, and the same sha256.
{
  const key = (l) => (l.split('#')[1] ?? '').split('.').map(Number);
  const lines = readFileSync(roundOut, 'utf8').split('\n').filter(Boolean);
  lines.sort((x, y) => { const a = key(x), b = key(y); for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0); return 0; });
  writeFileSync(roundOut, lines.join('\n') + '\n');
}

await step('Fingerprint', [{ file: 'scripts/fingerprint.test.ts', log: 'fingerprint.txt', env: { FINGERPRINT: '1', OUT: join(OUT, 'fingerprint.txt') } }]);

manifest(`finished in ${Math.round((Date.now() - started.getTime()) / 60000)} minutes`);
console.log(`reference: written to ${OUT}${existsSync(join(OUT, 'manifest.md')) ? ' (manifest.md)' : ''}`);
