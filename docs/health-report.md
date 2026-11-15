# Campaign health report

Measured by `scripts/health.test.ts` against `docs/TUNING.md`: 24 campaigns (seeds 1 to 24, a player and two rivals), up to 200 seasons, the player played by the computer, each also played 80 seasons with no decrees, and 8 told again with the player's first towns visited every season. 12 in band, 11 out. Took 797 seconds.

| Area | Figure | Target band | Measured | |
| --- | --- | --- | --- | --- |
| Pace | Seasons until a campaign is decided | 60 to 160 | median 66 (24 of 24 decided; range 39 to 155; 20 won by the player, 2 won by a rival, 2 with the player beaten) | **IN** |
| Pace | Campaigns undecided at 200 seasons | under 10% | 0.0% | **IN** |
| Pace | Seasons until a rival reaches its next age | 20 to 60 | median 24 (48 advances) | **IN** |
| People | A town left alone, grown people after 20 years | 1.3 to 2 times | median 1.00× (29 towns held by one people throughout) | **OUT** |
| People | A town visited every season vs left alone, after 20 years | visited 10 to 40% larger | 216.2% larger in all (7 town pairs from 7 of 8 campaigns; median town 240.0%) | **OUT** |
| People | Towns that die out (no people at all) per 100 town-lifetimes | under 3, and only after war, famine or plague together | 17.18 (76 died out, 15 of them after war, famine and plague together) | **OUT** |
| People | Towns left all one sex | a nation's towns under 5%; tribes' towns under 20% | nations' 27.5%, tribes' 4.5% of town-seasons | **OUT** |
| People | Of those who reach 60, the share dead by 70 | 50 to 85% | 74.1% (703 turned sixty, 182 turned seventy) | **IN** |
| Food | Share of seasons a farmed town is hungry | under 2% | 0.9% (32120 town-seasons) | **IN** |
| Food | Share of seasons an unfarmed town with no convoy is hungry, where its governor can still raise a farm | under 10% | 1.1% (542 town-seasons) | **IN** |
| Food | Share of seasons an unfarmed town with no convoy is hungry, where no farm can be raised | 15 to 40% | 14.4% (2720 town-seasons) | **OUT** |
| Food | Deaths from hunger in a nation, per 20 years | 1 to 10, never most of a town at once | 1.6 a nation (the worst season took 25.0% of a town of four or more) | **IN** |
| Stores | A nation's supplies after 20 years of peace | 2 to 4 seasons of full upkeep | median 2.9 seasons (15 nations, 226 nation-seasons of peace; middle half 1.9 to 3.1) | **IN** |
| Faith | Widest gap between two towns of one nation | 20 to 60 most of the time | 53.1% of nation-seasons in band (median 31) | **IN** |
| Faith | A nation that builds churches and keeps its towns fed, over 20 years | toward the holy end by 15 to 40 | mean 28.8 (14 nations) | **IN** |
| Drift | Share of town-seasons with anyone drifted | 5 to 20%, more in hungry, raided or newly taken towns | 15.3% (hungry 42.4%, raided 27.2%, newly taken 11.4%, otherwise 14.6%) | **OUT** |
| Drift | With sensible decrees vs none | at least a third fewer falling towns | 37.9% falling with decrees, 61.5% without (38.4% fewer) | **IN** |
| Threats | Raids on a given town | about once in 3 to 5 years | once in 4.0 years (2206 raids) | **IN** |
| Threats | Outcome of raids | held off 30 to 50%, raided 40 to 60%, taken under 15% | held off 20.4%, raided 63.4%, taken 16.2% | **OUT** |
| Threats | Captives got back when the player has an army near | about half | 34.6% (240 groups) | **OUT** |
| Conquest | Taken towns that rise if left ungarrisoned | 15 to 35% within 5 years; under 5% with an army in them | 25.9% ungarrisoned (410), 6.6% garrisoned (316); not counted: 470 taken again within five years, 212 still followed at the end | **OUT** |
| Armies | A nation's men under arms | 10 to 25% in war, under 10% in peace | median 8.3% in war, 0.0% in peace | **OUT** |
| Sieges | A besieged town with walls or a fortress and its men (or an army) in it | holds 60 to 85% | 24.6% in all: on the map 19.1% (110), in real time 100.0% (8 of 8 fought) | **OUT** |

## How each was read

- **Seasons until a campaign is decided.** Decided means the campaign ended: one people rules beyond challenge, or the player is beaten. A campaign decided sooner is let go on turning to twenty years for the twenty-year figures, with nobody leaving it.
- **Seasons until a rival reaches its next age.** Counted from the start, or from its last age.
- **A town left alone, grown people after 20 years.** Nobody visits any town in these runs, so every town is left alone. Whether it is held by its houses and food is not judged.
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
- **With sensible decrees vs none.** A falling town is one whose standing is 10 or more lower after twenty years, among towns held by one people throughout. With decrees, the player gives the sensible ones (decrees.ts) and rivals rule as they do; without, nobody gives any.
- **Raids on a given town.** Every strike by a band on a held town, the marauders' included, per season it was held, over the whole run.
- **Captives got back when the player has an army near.** Every people's captives, the player's included: those whose people had an army at the band's place (either end of a highwaymen's road) or next door while they were held. The computer-played player sends an army it can reach and that is as strong as the band (attackBand, settled unwatched); rivals hunt as they do. Gone before the four seasons were up is got back. About half is taken as 35 to 65%.
- **Taken towns that rise if left ungarrisoned.** A town taken by force (it bears a yoke, stamped with the season of the capture), followed from then for twenty seasons, once for each capture; garrisoned if an army of its taker stood in it for over half of the seasons it was followed. One taken again by force before it rose or settled, or still followed when the run ended, is not counted either way.
- **A nation's men under arms.** Men with its armies (armytown.ts) over those and the men in its towns. In war is a season within a year of the nation winning or losing land.
- **A besieged town with walls or a fortress and its men (or an army) in it.** On the map: every siege of a nation's town settled in resolvePending, the rivals' among themselves included (campaign.ts battleWatchers), with a Fortress or a tower, wall or gate standing in its town, and its men or an army of its own in it. In real time: 8 sieges of a rival against a capital given a Fortress (it stands as a tower in its town; otherwise as scripts/sieges.test.ts sets them up), the computer playing both sides for up to 20 minutes; a town still standing then is counted as having held. Holds means the attacker was thrown back.
