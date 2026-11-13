// Brings the trunk into the branch you are on, so that work going on in several branches at once
// keeps fitting together. Run with `npm run sync` before you start a piece of work and before you push.
//
//   npm run sync            merge the trunk in; pages built by a script are rebuilt, never merged by hand
//   npm run sync -- --ci    for CI: the merge is made in the checkout only, so the tests can run on the two together
//
// The trunk is `main`. Set TRUNK=some-branch to try against another.
import { execFileSync, spawnSync } from 'node:child_process';

const TRUNK = process.env.TRUNK || 'main';
const CHECK = process.argv.includes('--ci');
/** Pages written by a script from the game's own data. A clash in one is settled by building it again. */
const BUILT = { 'docs/systems-board.html': 'board', 'docs/voice-booth.html': 'voice-booth', 'docs/VOICE_SCRIPT.md': 'voice-script' };

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const tryGit = (...a) => spawnSync('git', a, { encoding: 'utf8' });
const npm = (...a) => { if (spawnSync('npm', ['run', '--silent', ...a], { stdio: 'inherit' }).status) throw new Error(`npm run ${a.join(' ')} failed`); };
const say = (s) => console.log(`sync: ${s}`);
const stop = (s) => { console.error(`sync: ${s}`); process.exit(1); };

if (git('status', '--porcelain', '--untracked-files=no')) stop('there is uncommitted work here. Commit it first, then sync.');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (tryGit('fetch', '--quiet', 'origin', TRUNK).status) {
  say(`there is no ${TRUNK} branch on origin yet, so there is nothing to fit to.`);
  process.exit(0);
}
const trunk = `origin/${TRUNK}`;
const behind = Number(git('rev-list', '--count', `HEAD..${trunk}`));
if (!behind) { say(`${branch} already has everything on ${TRUNK}.`); process.exit(0); }
say(`${branch} is ${behind} commit${behind > 1 ? 's' : ''} behind ${TRUNK}; merging.`);

const start = git('rev-parse', 'HEAD');
const id = CHECK ? ['-c', 'user.name=sync', '-c', 'user.email=sync@localhost'] : [];
const undo = () => { tryGit('merge', '--abort'); tryGit('reset', '--quiet', '--hard', start); };

const merged = tryGit(...id, 'merge', '--no-ff', '--no-edit', '-m', `Merge ${TRUNK} into ${branch}`, trunk);
const clashes = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
const real = clashes.filter((f) => !BUILT[f]);
if (real.length) {
  console.error(`sync: ${branch} and ${TRUNK} have both changed the same lines in:\n${real.map((f) => `  ${f}`).join('\n')}`);
  if (CHECK) { undo(); stop('this branch no longer fits the trunk. Run `npm run sync` on it and settle these.'); }
  for (const f of clashes.filter((f) => BUILT[f])) { tryGit('checkout', '--ours', '--', f); tryGit('add', '--', f); }
  stop('settle those by hand, keeping what both sides meant (see CLAUDE.md), then `git add` them, `git commit`, and run `npm run check`.\n'
    + '      Pages built by a script have been set aside: run `npm run board` once the rest is settled.');
} else if (merged.status && !clashes.length) {
  stop(`the merge failed:\n${merged.stdout}${merged.stderr}`);
}
for (const f of clashes) { tryGit('checkout', '--ours', '--', f); tryGit('add', '--', f); }

// If the trunk brought new packages, they are installed before anything is built or tested.
if (git('diff', '--name-only', `${start}...${trunk}`, '--', 'package-lock.json')) {
  say('the packages have changed; installing.');
  if (spawnSync('npm', ['ci', '--silent'], { stdio: 'inherit' }).status) { if (CHECK) undo(); stop('npm ci failed'); }
}

// Whatever came in, the built pages are made again from the merged sources, so they are never stale.
try {
  npm('assets');
  for (const script of new Set(Object.values(BUILT))) npm(script);
} catch (e) { if (CHECK) undo(); stop(String(e.message)); }
tryGit('add', '--', ...Object.keys(BUILT));
if (clashes.length) tryGit(...id, 'commit', '--quiet', '--no-edit');
else if (git('diff', '--cached', '--name-only')) tryGit(...id, 'commit', '--quiet', '-m', `Rebuild the pages built by script after merging ${TRUNK}`);

if (CHECK) say(`${branch} fits ${TRUNK}. The tests and the build now run on the two together.`);
else say(`${branch} now has everything on ${TRUNK}. Run \`npm run check\` before you push.`);
