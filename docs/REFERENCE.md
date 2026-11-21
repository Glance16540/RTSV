# The reference figures for the port

The Unity rebuild (docs/PORTING.md) is measured against figures taken from this game as it stands. This page says
what each figure is, how the Unity side compares against it, and where the outputs are kept. The figures are taken
in one go, on one commit, by `npm run reference` (scripts/reference.mjs), and written to `docs/reference/`.

**State: final.** Taken on 21 November 2026 on main `f178f934`, when main stopped moving (manifest: commit `fc3bf615`,
holding main at `f178f934`, 74 minutes). This is what the Unity side compares against.

## Taking it

```
npm run reference                              the full reference into docs/reference/ (about 90 minutes on four cores)
QUICK=1 REF_OUT=/tmp/ref npm run reference     a dry run: the same steps, small (about 17 minutes)
```

Take it on a clean tree, on main (the manifest marks a tree with uncommitted changes to `src` or `scripts` as not a
reference). It runs four processes at a time. A step that fails stops the run, and the manifest says which step and
which log. The round is resumable: run it again on the same commit and it plays only the games missing from
`round.txt`.

## What is in `docs/reference/`

| File | What it is | Made by |
| --- | --- | --- |
| `manifest.md` | The commit it was taken on (and the main it holds), when, how long each step took, the asking for each file, and each file's sha256 | scripts/reference.mjs |
| `health-a-plain.md` | The shared health report: 384 computer-played campaigns, seeds 1 to 384, the player answering no stories | scripts/health.test.ts |
| `health-a-answer.md` | The same campaigns with the player answering the stories by a plain policy (`STORIES=answer`, src/sim/storypolicy.ts) | scripts/health.test.ts |
| `health-b-plain.md`, `health-b-answer.md` | The same two courses on the second set of seeds, 385 to 768 | scripts/health.test.ts |
| `health-*.md.sparse.json` | The counts behind the report's sparse rows (the claimant risings), for pooling across runs | scripts/health.test.ts |
| `round.txt` | The round of all fifteen: 1,680 computer battles, a line each: the first and second people, the winner (`-` for none), the battle's second when it ended (1,800 if it ran its half hour), and the game's tag `#i.j.k` (the two peoples' places in `CIV_IDS`, and k; its map is seed 3000 + 131 i + 17 j + 7 k). Sorted by tag, so the same round gives the same file | scripts/round.test.ts |
| `round.txt.md` | The round's table: each people's games won, lost and undecided, and its share of those decided | scripts/round.test.ts |
| `fingerprint.txt` | The battles' fingerprint: a fixed set of seeded skirmishes, sieges, leader drills and camp drills, each battle's whole saved state hashed every two minutes and at the end | scripts/fingerprint.test.ts |
| `logs/` | Each run's own output, for when a step fails | scripts/reference.mjs |

## How the Unity side compares

There are two kinds of comparison. Which one applies depends on whether the Unity side plays the same chances in the
same order.

**Exact, for the same seed.** Every run here is deterministic: the same commit and the same asking give the same
file, line for line (tests/determinism.test.ts). A port that keeps the game's chances (each system's own hash, the
battle's run of chances) and its order of stepping, number for number, plays the same games:
- **The round** (`round.txt`): for each game the same winner (or none) at the same second. A port that is exact
  here plays the battle the same. Compare game by game, by the tag, not by the table: a game that changes winner is a place where
  the two part.
- **The fingerprint** (`fingerprint.txt`): the hashes are of `Game.serialize()`, this game's own saved form. They
  can match only if the Unity side writes a battle's state in the same form, field for field. Short of that, the
  fingerprint is a check between commits on this side (did a change move any battle?), and the place to look first
  when the round parts: each line names the battle and the minute.
- **The health reports**: a campaign is as deterministic as a battle. A port exact on the map gives each row the same
  figure, to the decimal. (A report's third line ends with how long it took, so two runs on this side give the same
  rows but not the same sha256: compare the rows. The round's file, its table and the fingerprint hash the same
  from run to run.)

**Banded, where the port plays its own chances.** A port that keeps the rules but not the run of chances (the likelier
case: another language, another stepping) cannot match a game. It should land each figure where this game's does:
- **The health reports**: every row has its band (docs/TUNING.md), and the report marks each **IN** or **OUT**.
  The Unity side runs its own 384 campaigns in each course and reads the same rows. A row is in agreement when it lands
  inside the band where this game's does. For a row this game has **OUT**, or with no band, the Unity figure should be
  within what the two seed sets here differ by: the gap between `health-a-*` and `health-b-*` is the luck of the seeds,
  and a figure further from both than that is a real difference. For the sparse rows (a few events in 384 campaigns),
  pool the two sets.
- **The round**: each people's share of its decided games (`round.txt.md`). A people's share rests on about sixty
  decided games and moves seven to ten points by luck alone (see scripts/round.test.ts), so a Unity share within ten
  points of this one agrees. Look past ten points, or at a people that changes its place by more than three in the
  order. The share of games decided at all (about a third at thirty minutes) should agree too: a port where far more
  or far fewer battles end inside the half hour fights differently, whatever the shares say.
- **The fingerprint** has no banded reading. Where the chances differ, it is not compared.

## What is fixed in the asking

So that a figure can be taken again, and on the Unity side the same way:
- **Health**: 384 campaigns a set, seeds 1 to 384 and 385 to 768, up to 200 seasons, the player played by the computer
  (each campaign also played with nobody giving decrees, for the decree rows), no visits (that row is not measured).
- **Round**: the 15 peoples in data.ts `CIV_IDS` order, every pair, 16 games a pair (k = 0 to 15), each on a map of
  its own (seed 3000 + 131 i + 17 j + 7 k), sides swapped on odd k, both sides the computer at level 1, 30 minutes of
  the battle's clock, the computer thinking once a second (20 steps).
- **Fingerprint**: 6 skirmishes, 6 sieges, 6 leader drills and 4 camp drills, 8 minutes each (its defaults).

## Known edges

Rows that sit on the edge of their band in the game as it stands, so that a reading out of band is not a fault in the
port. Each is a few lines; the finding behind it is in the commits and the board.

- **Drift, "with sensible decrees vs none"** (bar: at least a tenth less). Over both seed sets on 21 November 2026 it
  reads about 13.5% less with stories ignored and 9.5 to 10% with stories answered; the second set with stories
  answered reads 6 to 7% while its first-set twin reads about 12.5%. One reading of 384 swings about 3.5 points either
  side by the luck of the campaigns, and the row has read 6 to 16% since its bar was set. Posting guards does nearly
  all of what decrees do; grief and sickness are over half of drift, and tending them needs a church the town
  mostly lacks. Lifting the row needs a rule from the owner (tending without a church); nothing was tuned.
- **Crime, "thieves taken in a season in a town with a Watch House"** (band: 10 to 20 more in every 100 seasons). The
  row is counted like for like (the same draw with the Watch House's 0.15 and without), so its true value is the rule's
  15 and nothing else; a reading has only 300 to 480 thief-seasons and swings about 1.8 points either side. A draw is
  fixed by the campaign's seed, the season and the thief's number, so the reference seeds give the same draws until a
  change moves the thieves about: on main 2cd376b (21 November 2026) seeds 1 to 768 read 20.3 and 19.6 with stories
  ignored and 11.0 and 16.3 with stories answered, where the reference read 16.1. Four fresh sets of 384 on the same
  main (seeds 769 to 2304) read 17.3, 14.7, 15.0 and 15.1, and 16.0 over their 3,485 draws; the chance function is even
  (15.01% over 720,000 draws). Nothing to tune; the band is as it was.
