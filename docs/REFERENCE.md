# The reference figures for the port

The Unity rebuild (docs/PORTING.md) is measured against figures taken from this game as it stands. This page says
what each figure is, how the Unity side compares against it, and where the outputs are kept. The figures are taken
in one go, on one commit, by `npm run reference` (scripts/reference.mjs), and written to `docs/reference/`.

**State: final.** Taken again on 21 November 2026 on main `01b69fcc`, frozen for it (manifest: commit `b1699ae4`,
holding main at `01b69fcc`, 67 minutes). It replaces the take on main `39210a51`, which replaced the first final
(main `f178f934`). Since then the town's grown are kept by name (folkroll.ts), and the names seed a few draws, so the
round and the fingerprint no longer hash as before. This is what the Unity side compares against.

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

- **Drift, "with sensible decrees vs none"** (bar: at least a tenth less). Since tending without a church, it reads 12.2
  to 16.5% less over the four reports (12.1 to 15.3% read season by season), all in band. Before that change it sat on the edge (6 to 14%). One reading of
  384 swings about 3.5 points either side by the luck of the campaigns.
- **Crime, "convoys stopped with an Inn on the road"** (bar: fewer with an Inn). It rests on a few hundred convoys
  with an Inn against ten thousand without, and reads either side of the bar by luck. It is OUT in `health-a-answer`
  (19.9% of 418 against 17.0%) and in band in the other three. Pool the four before reading it.
- **Threats, "raids on a given town"** (bar: about once in 3 to 5 years). A row the map moves. Since every people
  begins with an empty land beside its chief town (`emptybeside.ts`, 22 November 2026) it reads once in 2.8 to 3.0
  years, where it read 3.1 and 3.3 before. The raids are not more: 50 to 54 thousand a reading of 384, with the empty
  land or without. The towns are fewer: three tribal towns a world are empty land until settlers fill them, about 9%
  fewer town-years for the same raids to fall on, and bands come two of a kind however many towns there are. A new
  town's grace (`newtown.ts`: no band marks a founded town for eight seasons) does not move it, since a band with
  another town in reach strikes that. Raiding was not cut for it and the bar was not moved.
- **Rule, "lords content at twenty years"** (bar: 5 to 20%, the player's and the rivals' each). With the empty land,
  towns are less crowded and quiet more often, and it read 21 to 24%. Two things were done: a town founded by a
  people's own settlers no longer counts to its lords as a town won in war (`nobletemper.ts` warTurn), and a quiet,
  fed year is worth 2 to a lord where it was 2.5. It now reads 19.3% and 18.7% of the rivals' and 14.5% of the
  player's in band, and 20.8% of the player's in the attended course, OUT by 0.8. The row moves about two points
  between like readings (the same cell read 26.0, 21.8, 21.5 and 20.8 over four trees), so that cell is an edge.
- **Rule, "risings for a claimant to the throne"** (bar: 2 to 5 every 100 campaigns, some for a lord's son by the
  leader's wife). The rate is in band (3.9 in `health-a-answer`), but children born in a lord's house are rare (2 of
  66 written down), so the "some of them for a child born in a lord's house" part can read 0 by luck, and does in
  `health-a-answer` (0 of 15), OUT on that alone. Pool the sparse counts (`*.sparse.json`) before reading it.
