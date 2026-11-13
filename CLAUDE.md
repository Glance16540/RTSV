# Rise and Ruin: working in this repository

Several sessions work on this game at once, each on its own branch. These rules keep one session's
work from breaking another's. They apply to every session, whatever it was asked to do.

## The trunk

`main` is the game as it stands: everything that is finished, fitted together, with the tests passing
and the build clean. Every piece of work is a branch off `main` and comes back to it.

- **Before you start, and again before every push: `npm run sync`.** It merges `main` into your
  branch and rebuilds the pages that are built by script. If it stops on a clash, settle it (below).
- **Before every push: `npm run check`** (type-check, all tests, build). Do not push a branch that
  fails it. If a test fails that your work did not touch, say so plainly; do not skip or loosen it.
- **Never push to `main` and never force-push a shared branch.** Work reaches `main` by a pull
  request, or by the session the owner has asked to gather the branches. Do not merge another
  session's branch into yours to get at its work: wait for it to reach `main`, then sync.
- CI runs two jobs on every push: **test** (your branch alone) and **Fits the trunk** (your branch
  with `main` merged in). Green on the first and red on the second means another branch landed
  first: sync, settle, push again.

## Settling a clash

A clash means two sessions changed the same lines for different reasons. Both reasons still stand.
Keep both: never take one side whole, and never drop the other session's work to make yours fit.
Then run `npm run check`; a merge that type-checks can still have broken a rule the other side tested.

## Where clashes come from, and how not to cause them

These are the places that have clashed in practice.

- **Tests.** New tests go in a new file, `tests/<feature>.test.ts`, taking `run`, `setups`, `spot`
  and `villagers` from `tests/helpers.ts`. Do not add to the end of `tests/sim.test.ts`: every
  branch that does so clashes with every other. Change that file only to fix a test already in it.
- **Pages built by script** (`docs/systems-board.html`, `docs/voice-booth.html`,
  `docs/VOICE_SCRIPT.md`). Never edit or hand-merge them. Change the source (`scripts/systems.mjs`,
  the leaders' lines) and run `npm run board` / `voice-booth` / `voice-script`. `npm run sync`
  rebuilds them after every merge.
- **Arguments added to a shared function.** Two branches each adding a fourth argument to the same
  function cannot both be right. Where a function already takes a bag of named options, add a name
  to it (`finishBattle(c, won, survivors, { virtue, heroRank, town })`); where it does not and you
  need to add something optional, make it one.
- **New things in a file of their own.** A new system gets its own module (`src/sim/story.ts`,
  `src/client/title.ts`) and its own block of styles under a comment naming it at the end of
  `src/client/style.css`, rather than lines threaded through `campaign.ts`, `main.ts` or `index.html`.
  Touch those shared files as little as the feature allows.
- **The game's name and its saved-game keys.** The game is called *Rise and Ruin* wherever a player
  reads it. The keys in the browser's storage (`rtsv-save`, `rtsv-campaign`, ...) and the repository
  keep the old name on purpose, so that saved games are not lost: do not rename them.
- **`package.json` and `package-lock.json`.** Add a dependency only when the work needs it, and say
  so in the commit.

## Commands

```
npm run dev      play it locally
npm run sync     bring main into this branch
npm run check    type-check, tests, build: the bar for every push
npm test         tests alone (about two minutes)
npm run board    rebuild docs/systems-board.html from scripts/systems.mjs
```

## Layout

- `src/sim/` is the rules: no DOM, tested headless. `src/client/` is what is drawn and heard.
- `scripts/systems.mjs` is the hand-written account of what each system has and lacks. When a
  feature changes what is true there, change it in the same commit.
