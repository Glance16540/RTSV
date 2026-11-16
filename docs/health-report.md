# Campaign health report

Measured by `scripts/health.test.ts` against `docs/TUNING.md`: 96 campaigns (seeds 1 to 96, a player and two rivals), up to 200 seasons, the player played by the computer, each also played 80 seasons with no decrees, and 8 told again with the player's first towns visited every season. 23 in band, 2 out. Took 842 seconds.

| Area | Figure | Target band | Measured | |
| --- | --- | --- | --- | --- |
| Pace | Seasons until a campaign is decided | 60 to 160 | median 72 (94 of 96 decided; range 29 to 194; 57 won by the player, 27 won by a rival, 8 with the player beaten, 2 ended in ruin (ruin.ts)) | **IN** |
| Pace | Campaigns undecided at 200 seasons | under 10% | 2.1% | **IN** |
| Pace | Campaigns ending in ruin | rare: under 6 in 100, and with those undecided under 10 in 100 together | 2.1% (2 of 96, at seasons 156, 163) | **IN** |
| Pace | Seasons until a rival reaches its next age | 20 to 60 | median 22 (270 advances) | **IN** |
| People | A town left alone, all its people (grown and children) after 20 years | 1.5 to 3 times | median 2.15× (139 towns held by one people throughout; grown people alone 1.25×) | **IN** |
| People | A town visited every season vs left alone, after 20 years | visited 10 to 40% larger | -21.6% larger in all (6 town pairs from 6 of 8 campaigns; median town -20.1%) | **OUT** |
| People | Towns that die out (no people at all) per 100 town-lifetimes | under 3 (and how many after war, famine and plague together) | 1.02 (22 died out, 3 of them after war, famine and plague together) | **IN** |
| People | Towns left all one sex | a nation's towns under 5%; tribes' towns under 20% | nations' 2.3%, tribes' 0.5% of town-seasons | **IN** |
| People | Of those who reach 60, the share dead by 70 | 50 to 85% | 81.6% (5560 turned sixty, 1024 turned seventy) | **IN** |
| Food | Share of seasons a farmed town is hungry | under 2% | 1.6% (159812 town-seasons) | **IN** |
| Food | Share of seasons an unfarmed town with no convoy is hungry, where its governor can still raise a farm | under 10% | 0.2% (2197 town-seasons) | **IN** |
| Food | Share of seasons an unfarmed town with no convoy is hungry, where no farm can be raised | 15 to 40% | 14.1% (9839 town-seasons) | **OUT** |
| Food | Deaths from hunger in a nation, per 20 years | 0.5 to 10, never most of a town at once | 0.9 a nation (the worst season took 25.0% of a town of four or more) | **IN** |
| Stores | A nation's supplies after 20 years of peace | 2 to 4 seasons of full upkeep | median 2.8 seasons (91 nations, 1676 nation-seasons of peace; middle half 2.1 to 3.4) | **IN** |
| Faith | Widest gap between two towns of one nation | 20 to 60 most of the time | 51.2% of nation-seasons in band (median 28) | **IN** |
| Faith | A nation that builds churches and keeps its towns fed, over 20 years | toward the holy end by 15 to 40 | mean 30.3 (65 nations) | **IN** |
| Drift | Share of town-seasons with anyone drifted | 5 to 20%, more in hungry, raided or newly taken towns | 15.3% (hungry 79.5%, raided 37.2%, newly taken 20.3%, otherwise 8.0%) | **IN** |
| Drift | With sensible decrees vs none | standing lost to drift alone at least a tenth less | 28.5 a town over twenty years with decrees, 33.3 without (14.3% less); towns fallen 10 or more all told 42.4% and 48.0% | **IN** |
| Threats | Raids on a given town | about once in 3 to 5 years | once in 3.3 years (13201 raids) | **IN** |
| Stories | A story begins for the player's nation | about once in 3 to 6 years | once in 5.4 years (438 stories in 96 campaigns) | **IN** |
| Threats | Outcome of raids | held off 30 to 50%, raided 40 to 60%, taken under 15% | held off 40.0%, raided 45.5%, taken 14.5% | **IN** |
| Threats | Captives got back when the player has an army near | about half | 48.2% (940 groups) | **IN** |
| Conquest | Taken towns that rise if left ungarrisoned | 15 to 35% within 5 years; under 5% with an army in them | 20.1% ungarrisoned (2112), 1.0% garrisoned (1052); not counted: 1791 taken again within five years, 778 still followed at the end | **IN** |
| Armies | A nation's men under arms | 10 to 25% in war, under 10% in peace | median 17.5% in war, 8.8% in peace | **IN** |
| Sieges | A besieged town with walls or a fortress and its men (or an army) in it | holds 60 to 85% | 64.6% in all: on the map 64.6% (1498), in real time 62.5% (8 of 8 fought, at odds 1.11 to 1.57; attacker's age 0,2,0,0,0,1,1,1 against 1,1,0,1,1,0,1,1) | **IN** |

## What emptied the towns that died out

Every town that died out in the runs above, the tribes' too (22: 22 of nations, of them 6 the player's and 16 rivals', and 0 of tribes), put down to whatever took most of its people in the 8 seasons before. Each season's losses among its grown people are read from the season's ledger (src/sim/ledger.ts: war, hunger, plague, old age), the raids (killed and carried off) and the men gone to the armies; whatever else the town lost is "moved away or not accounted for".

| What took most of its people | All | Nations | the player's | rivals' | Tribes |
| --- | --- | --- | --- | --- | --- |
| Hunger | 19 (86%) | 19 | 5 | 14 | 0 |
| Plague | 3 (14%) | 3 | 1 | 2 | 0 |

- No child born in its last 8 seasons: 17 (77%); nations 17 (77%), tribes 0.
- Left all one sex at some time in them: 22 (100%); nations 22 (100%), tribes 0.
- Taken, or changed hands, in them: 5 (23%); nations 5 (23%), tribes 0.

Plague killed 10.8 people a nation in the first twenty years (the season's ledger, every people and the tribes together, over three peoples a campaign).

## How each was read

- **Seasons until a campaign is decided.** Decided means the campaign ended: one people rules beyond challenge, or the player is beaten. A campaign decided sooner is let go on turning to twenty years for the twenty-year figures, with nobody leaving it.
- **Campaigns ending in ruin.** A world where no people gained ground in twenty years while the bands held much of the map: no winner (src/sim/ruin.ts). They are counted among the decided.
- **Seasons until a rival reaches its next age.** Counted from the start, or from its last age.
- **A town left alone, all its people (grown and children) after 20 years.** Nobody visits any town in these runs, so every town is left alone. Grown people and children together, against the same at the start; the grown alone are given beside it, since a child takes fifteen years to be counted grown. Whether it is held by its houses and food is not judged.
- **A town visited every season vs left alone, after 20 years.** The same campaign told twice, the player's first towns visited each season while they are still the player's (the computer keeping it for the whole ten minutes) and none; each town the player held from the start to twenty years on in both tellings is a pair, and their grown people are added up. The two tellings part ways as the campaign goes on, so a pair is a town in two different histories, not only visited and not.
- **Towns that die out (no people at all) per 100 town-lifetimes.** A town-lifetime is taken as twenty years of a held town, and only held towns are counted. Together means each of the three within the two years before.
- **Towns left all one sex.** Of towns with anyone grown in them. A nation's men away with its armies are counted as their town's (armytown.ts).
- **Of those who reach 60, the share dead by 70.** Counted by cohort: everyone who turned sixty in a season early enough to have turned seventy before the run ended, against everyone who turned seventy from ten years in. People are not followed one by one, so those who move town, are carried off or come home older (threats.ts adds the years held) blur it a little.
- **Share of seasons an unfarmed town with no convoy is hungry, where its governor can still raise a farm.** No convoy means none was on the road to it as the season began. Can still raise a farm is the governor's own test (governor.ts), read at the end of the season: a free place among its buildings, and its stores, less the farm's price, at or above his floor.
- **Share of seasons an unfarmed town with no convoy is hungry, where no farm can be raised.** The rest of the unfarmed towns with no convoy: no free place, or not the stores.
- **Deaths from hunger in a nation, per 20 years.** Read from the log, over the first twenty years, across all three peoples of each campaign (living or not). Whether a town that lost most was besieged or cut off is not judged.
- **A nation's supplies after 20 years of peace.** The map has no upkeep but what its towns eat, so this is the food in a nation's towns over what they eat in a season. A season of peace is one at least 10 years in, after a stretch of 10 years in which the nation won or lost land in no more than 8 seasons (eight of the ten years without war). Each nation's seasons of peace are taken together as their median, and the figure is the median of the nations, so that one long-lived nation does not outweigh the rest.
- **Widest gap between two towns of one nation.** Most of the time is taken as over half of the seasons of a nation with two towns or more.
- **A nation that builds churches and keeps its towns fed, over 20 years.** A nation with a church standing for at least ten of the twenty years and hungry in under 5% of its town-seasons.
- **With sensible decrees vs none.** Standing lost to drift alone is what drift took from a town season by season (drift.ts: its strain, its women at the tavern, the women ordered into it), before any rise and not counting war, raids or the nation's dips, summed over twenty years for every town held by one people throughout. With decrees, the player gives the sensible ones (decrees.ts) and rivals rule as they do; without, nobody gives any.
- **Raids on a given town.** Every strike by a band on a held town, the marauders' included, per season it was held, over the whole run.
- **A story begins for the player's nation.** Every story inside the story begun for the player (a thief, a killer, a rival king, a suitor, a plot), over the years the campaign ran. The computer-played player answers none of them (STORIES=answer makes it answer).
- **Captives got back when the player has an army near.** Every people's captives, the player's included: those whose people had an army at the band's place (either end of a highwaymen's road) or next door while they were held. The computer-played player sends an army it can reach and that is as strong as the band (attackBand, settled unwatched); rivals hunt as they do. Gone before the four seasons were up is got back. About half is taken as 35 to 65%.
- **Taken towns that rise if left ungarrisoned.** A town taken by force (it bears a yoke, stamped with the season of the capture), followed from then for twenty seasons, once for each capture; garrisoned if an army of its taker stood in it for over half of the seasons it was followed. One taken again by force before it rose or settled, or still followed when the run ended, is not counted either way.
- **A nation's men under arms.** Men with its armies (armytown.ts) over those and the men in its towns. In war is a season within a year of the nation winning or losing land.
- **A besieged town with walls or a fortress and its men (or an army) in it.** On the map: every siege of a nation's town settled in resolvePending, the rivals' among themselves included (campaign.ts battleWatchers), with a Fortress or a tower, wall or gate standing in its town, and its men or an army of its own in it. In real time: 8 sieges drawn like those a campaign has. A campaign is played on by the computer for 20 to 48 seasons, so that each people is at its own age, and then the rival comes against the player's capital (given a Fortress: it stands as towers in its town) with infantry and archers grown until the map rates the assault at 1 to 1.6 times the town's defence (its own measure, as in resolvePending); the computer plays both sides for up to 20 minutes; a town still standing then is counted as having held. Holds means the attacker was thrown back.
