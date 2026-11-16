# What the numbers should produce

Nearly every rate in `src/sim` was a first guess. This page says what a campaign should *feel* like, as
figures a computer-played campaign can be measured against, so the rates can be tuned toward them.
These targets are the gathering session's proposal from the owner's design (`docs/DESIGN.md`); the
owner may change any of them. Measure with `scripts/health.test.ts` (run with `HEALTH=1`): many
computer-played campaigns, the player let be or played by the computer, and one report of every
figure below against its band.

A season is three months; a campaign is meant to be won or lost over a few generations, not a few years.

| Area | Figure | Target band |
| --- | --- | --- |
| Pace | Seasons until a campaign is decided | 60 to 160 (15 to 40 years) |
| Pace | Campaigns undecided at 200 seasons | under 10% |
| Pace | Campaigns ending in ruin | rare: under 6 in 100, and with those undecided at 200 under 10 in 100 together |
| Pace | Seasons until a rival reaches its next age | 20 to 60 |
| People | A town left alone, all its people (grown and children) after 20 years | 1.5 to 3 times what it began with, held by its houses and food (a child takes fifteen years to be counted grown) |
| People | A town visited every season vs left alone, after 20 years | visited ends 10 to 40% larger |
| People | Towns that die out (no people at all) per 100 town-lifetimes | under 3 (the report also shows how many died after war, famine and plague together) |
| People | Towns left all one sex | a nation's towns under 5%; tribes' towns under 20% (war takes their men, by design) |
| People | Of those who reach 60, the share dead by 70 | 50 to 85% (age alone, and also war, plague, hunger and raids, which take a part of the old: the rate of death by age is set a little lower than it would be alone) |
| Food | Share of seasons a farmed town is hungry | under 2% |
| Food | Share of seasons an unfarmed town with no convoy is hungry, where its governor can still raise a farm | under 10% (a governed town answers want) |
| Food | Share of seasons an unfarmed town with no convoy is hungry, where no farm can be raised (no free place, or not the stores) | 15 to 40% (it must live on convoys or the decree that sends food) |
| Food | Deaths from hunger in a nation, per 20 years | some (0.5 to 10: hunger should be felt, not absent), never most of a town at once unless besieged or cut off |
| Stores | A nation's supplies after 20 years of peace | enough for 2 to 4 seasons of its full upkeep, not hoards |
| Faith | Widest gap between two towns of one nation | 20 to 60 most of the time |
| Faith | A nation that builds churches and keeps its towns fed, over 20 years | moves toward the holy end by 15 to 40 |
| Drift | Share of town-seasons with anyone drifted | 5 to 20%, more in hungry, raided or newly taken towns |
| Drift | With sensible decrees vs none | standing lost to drift alone (not war, raids or the nation's dips) at least a tenth less |
| Threats | Raids on a given town (every strike on a held town, marauders' included, per town-season held) | about once in 3 to 5 years |
| Threats | Outcome of raids | held off 30 to 50%, raided 40 to 60%, taken under 15% |
| Threats | Captives got back, of those whose people had an army at the band's place or next door within the four seasons (the computer-played player sends it with `attackBand` and settles it unwatched) | about half |
| Stories | A story inside the story begins for the player's nation (a thief, a killer, a rival king, a suitor, a plot: `src/sim/intrigue.ts`, `src/sim/courtstory.ts`), over the years the campaign ran | about once in 3 to 6 years |
| Conquest | Taken towns that rise if left ungarrisoned | 15 to 35% within 5 years; under 5% with an army in them |
| Armies | A nation's men under arms | 10 to 25% of its grown men in war, under 10% in peace |
| Sieges | A besieged town with walls or a fortress and its men (or an army) in it: the attacker thrown back, both in a siege settled unwatched on the map and in a computer-played real-time siege | holds 60 to 85% (not every time) |

When tuning: change one area's rates at a time, keep a short before/after table in the commit, and
never loosen a test to make a number fit; change the test only where its figure was itself a guess,
and say so.
