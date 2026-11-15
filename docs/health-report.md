# Campaign health report

Measured by `scripts/health.test.ts` against `docs/TUNING.md`: 24 campaigns (seeds 1 to 24, a player and two rivals), up to 200 seasons, the player played by the computer, each also played 80 seasons with no decrees, and 2 with every town visited. 3 in band, 18 out. Took 136 seconds.

| Area | Figure | Target band | Measured | |
| --- | --- | --- | --- | --- |
| Pace | Seasons until a campaign is decided | 60 to 160 | median 31 (24 of 24 decided; range 17 to 50; 15 won by the player, 5 won by a rival, 4 with the player beaten) | **OUT** |
| Pace | Campaigns undecided at 200 seasons | under 10% | 0.0% | **IN** |
| Pace | Seasons until a rival reaches its next age | 20 to 60 | median 8 (64 advances) | **OUT** |
| People | A town left alone, grown people after 20 years | 1.3 to 2 times | median 0.41× (14 towns held by one people throughout) | **OUT** |
| People | A town visited every season vs left alone, after 20 years | visited 10 to 40% larger | -100.0% larger (1 campaigns) | **OUT** |
| People | Towns that die out (no people at all) per 100 town-lifetimes | under 3, and only after war, famine or plague together | 21.08 (94 died out, 11 of them after war, famine and plague together) | **OUT** |
| People | Towns left all one sex | under 5% | 41.8% of town-seasons | **OUT** |
| Food | Share of seasons a farmed town is hungry | under 2% | 0.8% (32462 town-seasons) | **IN** |
| Food | Share of seasons an unfarmed town with no convoy is hungry | 15 to 40% | 4.6% (3190 town-seasons) | **OUT** |
| Food | Deaths from hunger in a nation, per 20 years | 1 to 10, never most of a town at once | 0.6 a nation (the worst season took 25.0% of a town of four or more) | **OUT** |
| Stores | A nation's supplies after 20 years of peace | 2 to 4 seasons of full upkeep | median 18.5 seasons (4 nations) | **OUT** |
| Faith | Widest gap between two towns of one nation | 20 to 60 most of the time | 51.6% of nation-seasons in band (median 33) | **IN** |
| Faith | A nation that builds churches and keeps its towns fed, over 20 years | toward the holy end by 15 to 40 | mean 40.5 (10 nations) | **OUT** |
| Drift | Share of town-seasons with anyone drifted | 5 to 20%, more in hungry, raided or newly taken towns | 6.0% (hungry 14.4%, raided 5.0%, newly taken 8.3%, otherwise 5.2%) | **OUT** |
| Drift | With sensible decrees vs none | at least a third fewer falling towns | 42.9% falling with decrees, 50.0% without (14.3% fewer) | **OUT** |
| Threats | Raids on a given town | about once in 3 to 5 years | once in 2.8 years (3176 raids) | **OUT** |
| Threats | Outcome of raids | held off 30 to 50%, raided 40 to 60%, taken under 15% | held off 12.6%, raided 71.4%, taken 16.1% | **OUT** |
| Threats | Captives got back when the player has an army near | about half | 11.5% (340 groups) | **OUT** |
| Conquest | Taken towns that rise if left ungarrisoned | 15 to 35% within 5 years; under 5% with an army in them | 42.2% ungarrisoned (64), 18.3% garrisoned (60) | **OUT** |
| Armies | A nation's men under arms | 10 to 25% in war, under 10% in peace | median 6.7% in war, 15.0% in peace | **OUT** |
| Sieges | A besieged town defended with walls and men | holds 60 to 85% | 11.1% (18 sieges) | **OUT** |

## How each was read

- **Seasons until a campaign is decided.** Decided means the campaign ended: one people rules beyond challenge, or the player is beaten. A campaign decided sooner is let go on turning to twenty years for the twenty-year figures, with nobody leaving it.
- **Seasons until a rival reaches its next age.** Counted from the start, or from its last age.
- **A town left alone, grown people after 20 years.** Nobody visits any town in these runs, so every town is left alone. Whether it is held by its houses and food is not judged.
- **A town visited every season vs left alone, after 20 years.** The player's first towns, all of them visited each season, against the same campaign unvisited; only towns still the player's after twenty years in both are compared.
- **Towns that die out (no people at all) per 100 town-lifetimes.** A town-lifetime is taken as twenty years of a held town, and only held towns are counted. Together means each of the three within the two years before.
- **Towns left all one sex.** Of held towns with anyone grown in them; men away with its armies are counted as the town's (armytown.ts).
- **Share of seasons an unfarmed town with no convoy is hungry.** No convoy means none was on the road to it as the season began.
- **Deaths from hunger in a nation, per 20 years.** Read from the log, over the first twenty years, across all three peoples of each campaign (living or not). Whether a town that lost most was besieged or cut off is not judged.
- **A nation's supplies after 20 years of peace.** The map has no upkeep but what its towns eat, so this is the food in a nation's towns over what they eat in a season. Peace is taken as no land won or lost in the last two years.
- **Widest gap between two towns of one nation.** Most of the time is taken as over half of the seasons of a nation with two towns or more.
- **A nation that builds churches and keeps its towns fed, over 20 years.** A nation with a church standing for at least ten of the twenty years and hungry in under 5% of its town-seasons.
- **With sensible decrees vs none.** A falling town is one whose standing is 10 or more lower after twenty years, among towns held by one people throughout. With decrees, the player gives the sensible ones (decrees.ts) and rivals rule as they do; without, nobody gives any.
- **Raids on a given town.** Over the first twenty years of every held town.
- **Captives got back when the player has an army near.** Every people's captives, as the player is computer-played: those whose people had an army at the band's place or next to it while they were held. About half is taken as 35 to 65%.
- **Taken towns that rise if left ungarrisoned.** A town taken by force (it bears a yoke), followed for twenty seasons; garrisoned if an army of its taker stood in it for over half of them.
- **A nation's men under arms.** Men with its armies (armytown.ts) over those and the men in its towns. In war is a season within a year of the nation winning or losing land.
- **A besieged town defended with walls and men.** Only battles put to the player can be watched (rivals settle their own inside the campaign's turn): those in which a people defended a town with a Fortress and an army of its own in it, settled from the map. For sieges fought in person see scripts/sieges.test.ts.
