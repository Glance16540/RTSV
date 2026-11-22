# The reference figures for the port

The Unity rebuild (docs/PORTING.md) is measured against figures taken from this game as it stands. This page says
what each figure is, how the Unity side compares against it, and where the outputs are kept. The figures are taken
in one go, on one commit, by `npm run reference` (scripts/reference.mjs), and written to `docs/reference/`.

**State: final.** Taken again on 22 November 2026 on main `423d4e38`, frozen for it (manifest: commit `8b18dc9a`,
holding main at `423d4e38`, 71 minutes). It replaces the take on main `f717de56` (and before it `01b69fcc`,
`39210a51` and the first final, `f178f934`). Every people begins with an empty land beside its chief town
(emptybeside.ts), which changes the map. In this take the share of the map that wins a campaign by dominion,
`DOMINION_SHARE`, is 0.52 where it was 0.55: with the empty land fewer campaigns were decided in 200 seasons, and ruin
with undecided read 10.0% pooled against a bar of under 10. It now reads 7.4% pooled. The share changes only the
campaign's end, so the round and the fingerprint hash as in the take before (`c8e178c951258e02`,
`510f9ad0ba66fa39`). This is what the Unity side compares against.

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

- **Drift, "with sensible decrees vs none"** (bar: at least a tenth less). Since tending without a church, it reads 12.1
  to 15.0% less over the four reports (12.9 to 15.7% read season by season), all in band. Before that change it sat on the edge (6 to 14%). One reading of
  384 swings about 3.5 points either side by the luck of the campaigns.
- **Crime, "convoys stopped with an Inn on the road"** (bar: fewer with an Inn). It rests on a few hundred convoys
  with an Inn against ten thousand without, and reads either side of the bar by luck. It is OUT in `health-b-answer`
  (18.5% of 205 against 17.7%) and in band in the other three (5.9 to 14.2% with an Inn against 14.7 to 20.0%
  without). Pool the four before reading it.
- **Threats, "raids on a given town"** (bar: about once in 3 to 5 years). A row the map moves. Since every people
  begins with an empty land beside its chief town (`emptybeside.ts`, 22 November 2026) it reads once in 2.7 to 2.9
  years, OUT in all four, where it read 3.1 and 3.3 before; with the shorter campaigns of a dominion share of 0.52 it
  reads 2.7 on the second seed set (`health-b-*`). The raids are not more: 48 to 55 thousand a reading of 384, with the empty
  land or without. The towns are fewer: three tribal towns a world are empty land until settlers fill them, about 9%
  fewer town-years for the same raids to fall on, and bands come two of a kind however many towns there are. A new
  town's grace (`newtown.ts`: no band marks a founded town for eight seasons) does not move it, since a band with
  another town in reach strikes that. Raiding was not cut for it and the bar was not moved.
- **Rule, "lords content at twenty years"** (bar: 5 to 20%, the player's and the rivals' each). With the empty land,
  towns are less crowded and quiet more often, and it read 21 to 24%. Two things were done: a town founded by a
  people's own settlers no longer counts to its lords as a town won in war (`nobletemper.ts` warTurn), and a quiet,
  fed year is worth 2 to a lord where it was 2.5. In the final take it reads 14.5 to 20.8% of the player's and
  18.7 to 20.8% of the rivals', OUT by 0.8 in two cells (the player's in `health-a-answer`, the rivals' in
  `health-b-plain`) and in band in the other six. The row moves about two points between like readings (the same cell
  read 26.0, 21.8, 21.5 and 20.8 over four trees), so it is an edge.
- **Rule, "risings for a claimant to the throne"** (bar: 2 to 5 every 100 campaigns, some for a lord's son by the
  leader's wife). The rate is in band (2.6 to 3.9 every 100 campaigns), but children born in a lord's house are
  rare, so the "some of them for a child born in a lord's house" part can read 0 by luck. In the final take it is in
  band in all four (2 or 3 of 10 to 15 risings); in the take before it read 0 of 15 in `health-a-answer`, OUT on that
  alone. Pool the sparse counts (`*.sparse.json`) before reading it.
- **Pace, "campaigns ending in ruin, and with those undecided under 10 in 100"** (bar: ruin under 6, ruin and
  undecided together under 10). Ruin alone is rare (1.3 to 2.6%). With the empty land fewer campaigns were decided in
  200 seasons, and at a dominion share of 0.55 the two together read 7.0 to 12.8%, 10.0% pooled, on the bar. At 0.52
  they read 7.0% (`health-a-answer`), 4.9% (`health-a-plain`), 8.1% (`health-b-answer`) and 9.4% (`health-b-plain`),
  7.4% pooled, all in band; undecided alone is 3.4 to 6.8%. `health-b-plain` is the nearest the bar.
