# Closing audit: the design against the game

Written 19 November 2026, on main at b6e60f4, for the move to the Unity build. It goes through
`docs/DESIGN.md` section by section and lists every promise that is not built, or is only half built.
It includes the three "Not yet" lines of DESIGN.md's last table, and the gaps on the systems board
(`scripts/systems.mjs`) that stand against the design.

This audit changes no rule. It leaves out gaps that only say a number is a first guess, was tried
in tests rather than played, or was seen only in still pictures. Those are true of nearly every
system and are not promises left unbuilt.

Each line gives what is missing, how big it is, and a recommendation:

- **Before**: build it before the move. It is small, its rule lives in `src/sim`, and the record
  Unity inherits is wrong or incomplete without it.
- **Unity**: port the module as it is and build the rest in Unity. Most of these are things drawn,
  played or felt, or larger rules best designed once on the new engine.
- **Drop**: let it go. The design no longer asks for it, or the owner has already ruled it out.

Size is the work it would take here: **small** is a day or less in one module, **medium** a few
modules or a new system, and **large** a new system that touches the field and the map.

## The three "Not yet" lines

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| A man at war is still of his house | **Done for the houses that sent men** (`src/sim/housekeep.ts`): a house once named is kept by name with everyone home while the town has a home for it (one to each woman), so a man comes home to his own. The cost to the record, measured on two twenty-year campaigns: some 120 to 175 bytes a house, a few hundred houses more at most, 40 to 60 thousand bytes on saves of 70 to 230 thousand; old saves load as they are. Still a count: a house that never sent a man, between sittings (`roofsmap.ts` keeps the last sitting's). | medium | Built as far as the record allows without naming everyone. The rest goes with naming everyone (No auto-resolve). |
| A town taken | Resentment costs no harvest, gold or levy. Each was tried and dropped, and it acts only through unrest, the governor's pace, drift and the walls. | small | Drop: tried three ways and dropped on measurement. Only the owner would reopen it. |
| Claimants to the throne | **Figures done (21 November 2026, `claimantfigures.ts`).** The grown claimant leads a rising on the field by name (`claimantcaptain.ts`), and the lord who raised them stands at its hall beside them; in a visit to the town a grown claimant lives in, both stand at the hall, named with faces. A child claimant is never shown. Still: a band's chief is the captain's name only, and the figures at the hall are not met or judged there. The player's own succession is asked of the player before a claimant can take the throne. The succession is **done** (`src/sim/succession.ts`, `thronemoods.ts`): when the line fails, a grown claimant standing in arms is one of the choices, after a child of both houses and before any captain, and each choice says who stands and what it costs (the towns that come back, the house ended, a war of succession pressed by the other house, a rising left standing, the lords' moods); put off, the claimant takes the throne as the season turns. Rivals and a computer-played player choose by the same order. | medium | Unity: the claimant as a figure is field work (a person to meet, fight or judge in a town). The succession order is the owner's ruling as it stands. |

## What the game is

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Systems deep enough that stories fall out of them | **Done (21 November 2026).** Threads of tales run three to five tellings, every answer picking the road, and the chronicle tells each whole when it ends (`threadtales.ts`, `talethreads.ts`); a land lost, a leader's fall, a plague, a royal marriage, a hungry winter and a claimant's rising each begin a thread of their own (`threadstarts.ts`, `worldtales.ts`); and the last page ends the campaign with what became of every thread, person of note and house (`epilogues.ts`). Still open: rivals' own threads, and the stories inside the story (`intrigue.ts`) do not yet lead into the tales. | medium | Done; the rest is narrative design for Unity, and every system it reads is here to port. |

## Time, and age belonging to the nation

Built as written (`ageing.ts`, `birthonly.ts`, `Game.fixedAge`). Skirmish and missions still age up and
buy villagers, which DESIGN.md allows. Nothing to list.

## Towns persist

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Ten women taken is ten women gone, and held somewhere real | **Checked: nothing to hand over.** A visit has only the player's side on the field, so the only ones who can take anyone there are the field's own marauders. A battle's marauder-held captives are already gone by `battlecarried.ts`'s rule, since the field's marauders are no band on the map to hold them. To hold them would mean giving them to a band of the map (the nearest marauders, or one made for it), which is a new rule, not a hand-off. | small | Unity: decide there whether the field's marauders are a band of the map. |
| What is built in a town is kept on its record | **Done (19 November 2026, `faithsites.ts`).** A Church or Tavern built in a battle or on a visit is raised as the map site that moves the town's faith, where the land has room and has none. | small | Done. |
| What is built in a town is kept on its record | **Done (21 November 2026, `handroads.ts`, `campaign.ts` finishBattle).** A road the player lays by hand in a siege is kept on the town's record when the town is theirs after it, and the town comes to its next siege or visit with it, as a visit's roads do. | small | Done. |
| Nobody from nowhere (towns persist, a soldier costs a person) | **Done for the settlers** (`src/sim/settlersfrom.ts`): a town taken empty, in a battle or as a dead town, is settled by couples its taker's nearest towns can spare, by road; where none can be spared it stands empty. Still from nowhere: a tribe's town made up to its old strength the first time it is looked into. | small | Built. The tribe's one-time top-up stays, since it happens once per save. |
| An attacking camp has no people from nowhere | **Done.** The check found one more case: a reserve army joining a siege (either side, or an ally's) got a camp with two men and two women from nowhere. `src/sim/reservecamp.ts` marks it in its set-up, so its camp is laid with none (`siegecamp.ts`) and it is not counted as died out (`dyingout.ts`). | small | Built. |

## No auto-resolve; a town defends itself

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| The town defends itself, and the player may be there | **Done for the player's towns (21 November 2026, `raidfought.ts`).** A band's strike on a town of the player's waits on the player, who may fight for it in person (the town as it defends, against the band's companies) or leave it to the town; the outcome is written back by the strike's own rule. Still missing: the town is not read back from the field (its dead, its houses and its stores change by the strike's rule only), and a strike on a road cannot be entered. | small | Unity: read the town back from the field as a nation's attack does. |
| A report of who was killed and who was taken | **Done (21 November 2026, `folkroll.ts`).** A town's record keeps its grown by name (`Folk.roll`), each of a house of the town (its houses at war, its known women, those already on the roll); children stay counts. The roll follows the counts once a season: newcomers are named, and those who die between battles go from the front of the roll, the longest there, never a known woman. In a battle fought in person the town's people bear the roll's names on the field (a soldier trained there keeps his), and the report names its dead (`The dead of ...`) beside those carried off (battlecarried.ts named them already). Men who fall where nobody watched are struck off by name, and the player is told who. Old saves load as they are and are named the first season. The cost, measured on a twenty-year campaign with three rivals: 1,140 named in 22 towns, about 37 bytes each, 42.6 thousand bytes of a 371-thousand-byte save (11.5%). Still a count: who dies of a season's age, plague or hunger is the longest on the roll, not drawn by age; a raid's dead and taken on the map are struck off by count. | large | Built. Unity: keep the roll, and let the season's deaths choose by age once a person carries one. |
| Which way the town's morals swayed | A raid's sway still reads the nation's standing, not the town's. Switching it moved campaigns ending in ruin out of band, so it was left. | small | Drop: left on measurement, and faith is otherwise the town's. |

## A soldier costs a person; people come only by birth; men and women

Built as written (`muster.ts`, `birthonly.ts`; a woman fights at `WOMAN_ATK` 0.4). Nothing beyond tuning.

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| A company is the men of its towns, never hired | **Done for those sent home** (`src/sim/hiredhome.ts`): an army sent home settles its men of no town in its chief town as grown men. Still: hired men of no town who fall are counted, not named. | small | Built. The naming ports with the larger question of naming everyone (see No auto-resolve). |

## Children are never shown

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| A child is written in the record of its house: name, parents, age, what it may inherit | Inside a battle a child has a name and a house (`nursery.ts`), but not its mother by name and nothing it may inherit. Between battles a town's children are counted, not named (`orphans.ts`). | medium | Unity: this is the same record change as naming every house. Port the rule that no child is ever shown, struck or taken as it is. It holds everywhere. |

## A man at war is still of his house

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| What he earns and wins counts to the house's output | **Done** (`src/sim/warspoils.ts`): the spoils of a town his army took and his share in each town taken or attack thrown back count to his house as goods carried in, on its record and its known mother's. Still: men with the armies are not counted in a town's output while away. | small | Built. |
| He is not lost until he dies or is taken | A man taken captive is not handled apart from one who dies, because slavers take villagers, not soldiers. | small | Drop: nothing takes a soldier captive today. |
| The case where his house falls while he is away | Settled without the owner's word, as asked: the house's record falls with it, he keeps his name, and he comes home unhoused. | none | Confirmed by the owner (19 November 2026): kept as built. |

## Icons tell status

Built: all fourteen marks (`portrait.ts`), each nation's dress, the standing in the picture, one body
for life, and a face that shows content, afraid, grief or anger (`faces.ts`).

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Icons are the main way the player reads a person | Faces are flat ink sketches, not woodblock pictures like the people's icons. Nobles have no faces beyond the notable people's. | medium | Unity: art. |

## Notable people

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| A woman whose home produces most | **Done** (`src/sim/rivalhomes.ts`): a rival's town counts each season's harvest to its working houses by their share of the work, as notableweight.ts weighs a house's output; the house that has done most is the next known home, once it comes to a rank of standing, up to three to a town. | small | Built. |
| Their loss carries weight | **Done** (`src/sim/carriednamed.ts`): a known person among those a nation leads away is marked carried off by name, mourned, and known again if got back. The rest are counted, as the town's record keeps them. | small | Built. |

## Captivity

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Slavers gain output from the children born in captivity | On the map a band holds captives but has no output to gain, so children born there do nothing for it, and nobody is paid for captives a band sells on. | small | Drop on the map: a band is not a town. It is built in a town (`captivity.ts`). |
| Got back for a time | **Done (21 November 2026, `rescue.ts`).** Those held in the marauders' camp are let out at its gate by soldiers of their own people or its allies, one at a time as at a Work Camp, once the band standing at the camp is beaten or drawn off; burning it still frees everyone at once. | small | Done. |
| The player's nation, if it assimilates | **Built here after all (20 November 2026, `carriedoff.ts`), by the rivals' rule reused:** at a Dissolute or Depraved standing the player's nation leads away a share of the grown people of a town it takes, held four seasons and then its own; never a child, nothing shown, told plainly. The player may forbid it by decree (`nocarry.ts`, the owner's word of 21 November 2026): a law of the nation, free to give, standing until lifted, resented a little by the worldly and martial lords of a people who would have carried off. | small | Done. |
| What is shown of it | **Escapes and risings are drawn (21 November 2026, `campout.ts`, `src/client/campscene.ts`):** one who slips away by night goes crouched and without a light for fourteen seconds, and those who break out in a rising carry lit brands from the fire they set for ten, beside the dust, chips and sign at the gate. Grown people only, clothed as their people are; the camp's children are records and never on the field. The captives' daily round inside the camp has not been watched. | small | Unity: port `campout.ts` (two marks and their seconds) and draw the same two looks. |

## Acts of God

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Famine, plague, fire and the like | **Done on the map and for the hunters** (`src/sim/floods.ts`, `src/sim/leanwild.ts`): a river land floods by its standing (food spoilt, the town worn, struck hard its farmland washed away, nobody drowned, halved by the Flood Calendar); and a town with no farm has a lean season by a failed harvest's chance, its hunters and fishers at half. Still: inside a town the ground never goes under water. | medium | Built on the map. Unity: water on the field. |
| By creed, sparing nobody | **Done (19 November 2026).** A Prophet's fire, blight and earthquake go by the creed of those they fall on, as his plague does (`wrath.ts`, `game.ts`); fever in the camp and a hard season go by the town's own standing (`chancecreed.ts`, through `wrathAt`). An ordinary people is struck exactly as before. | small | Done. |
| They carry over into a town | **Done** (`src/sim/ailing.ts`, through the setup bag): a battle or visit in a land with plague begins with a few of the town sick, and one in a hungry town or after a failed harvest that season begins hungry. | small | Built. |

## Threats of men never stop

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| There is always something to fight | **Built here after all (20 November 2026, `rivalhunt.ts`).** A rival marches through its own lands for a band that holds its people, if it can be there in time, or that sits in its land; and it marches first on a camp of the marauders that holds its people or has struck its towns. Still missing: it never crosses another people's land or the wild to reach a band, and plans no march of several lands to a marauders' camp. | medium | Done as far as its own lands. The rest with the rival's mind, in Unity. |
| Bands choose marks and strike | **The rule for a wider map is built (21 November 2026, `bandroam.ts` `roamScale`, `roamRange`, `weighed`):** on a map with more than 32 lands inside the rim a camp looks farther for a softer mark and minds the march less, both by the map's breadth (the root of its lands), up to eight lands off. Every map made here has 25 to 29 lands, so in this game nothing changes: bands still seldom live long enough to roam, and a softer mark is nearly always one land away. The far wilds' hosts do march. | small | Unity: the scaling is ready for a wider map; here it has none to act on. |

## Drift, decrees, and the tavern as a town falls

Built as written (`drift.ts`, `driftintown.ts`, `decrees.ts`, `tavernfall.ts`).

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| The tavern shown by the house as the town falls | Its shape by day has two looks (plain and gaudy), not three. | small | Unity: art. |

## A visit; a town left to itself

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| A visit is about ten minutes of its season | A visit costs nothing and the season does not move for it. It is not offered on a land the marauders hold. | small | Unity: port as is. "Each town once a season" is kept. |
| It carries on with its last orders | The men in a town's queues go out as companies of the map's kinds, so a queue of swordsmen and one of clubmen both raise infantry. **Done**: the stop can be set by a standing order (townorders.ts `drillStop`, on the governor's orders: 2 to 12 companies, 4 the usual), and a rival's frontier towns with a yard and an enemy army beside them train by orders it gives them, to stop at 3 (`src/sim/rivaldrill.ts`). | small | Unity: the map has five kinds of company by design. Port as is. |

## Stores

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Towns send food, goods and people to one another by road | **Done** (`src/sim/rivalsettle.ts`): a rival sends settlers by road, by the player's own rule (migration.ts `settle`), from its fullest town to its town with too few people, now and then, one a season. | small | Built. |
| A market's trade by caravan | **Done** (`src/sim/fieldcaravan.ts`): in a battle or a visit at a town of the player's whose caravan is on the road that season, a trade cart leaves the Market, goes off at the field's edge toward its partner town and comes back with the gold the map's caravan brings; an enemy can catch it, and the map's caravan is settled by how it went. For a Traders' town it stands in for the Traders' rule. | small | Built. Unity: field work. |

## Armies belong to towns

Built (`armytown.ts`, `warhouse.ts`, `companyroll.ts`, `fieldcap.ts`). Only the hired men of no town,
listed above.

## A dead town

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Any rival nation or marauders that come for it can take it | **Done** (`src/sim/bandturn.ts`): a camp of raiders or slavers with a dead town in reach sets out for a land beside it and, standing there, walks in: the town is overrun as deadtown.ts overruns one a wandering band finds, and the band is the camp. | small | Built. |

## A town taken

The "Not yet" line is listed above.

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Sooner settled where they are ruled well | **Done**: a rival builds Farmland in its most resentful town when it can spare the price (`src/sim/rivalyoke.ts`), and a computer-led people counted out takes back a town that rises for it and lives again, the town its seat (`src/sim/revival.ts`). | small | Built. |

## Rivals live by the same rules

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| The same rules, the same losses | A rival's income is scaled by difficulty (the owner's choice: keep). The tales told every few turns are the player's only, and a rival is moved by a fixed step. | small | Unity: port as is. The scaling is the owner's choice. |
| A rival that thinks as a people | **Built (21 November 2026):** it sets its heart on a land and goes for it over seasons (`rivalplan.ts`), masses two armies for one assault (`rivalmass.ts`), weighs its towns' dead, hunger and unrest and sues for peace when they bleed (`rivalweary.ts`), and takes named places, plague, winter, the world's seasons and creed into account (`rivalworld.ts`). Its mind is not shown to the player, it never masses three armies, and it plans no road by sea beyond its harbours' reach. | small | Unity: port the four modules with `rivalaim.ts`, `rivalrule.ts` and `rivalcaptives.ts`; showing a rival's mind (the words are written: `planText`, `wearyText`, `worldText`) is a screen for the Unity side. |

## Faith is a town's; every town its own faith; a town's own life moves its faith

Built (`townfaith.ts`, `townlean.ts`, `townlife.ts`). The raid sway is listed under "No auto-resolve",
and the church built in battle under "Towns persist".

## The leader is one person in one place

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| He can call armies to meet him and move with them as one | **Built here after all (20 November 2026, `courtcall.ts` with `court.ts`).** The leader may call armies by name; with none named, an army holding a town that needs it stays; a called army passes a garrison without joining it and crosses a sworn ally's land; and a leader travelling alone by a road highwaymen sit on may be set upon, turned back and wounded. Still missing: a control on the map for naming armies, and a warning of the road's risk before the journey. Travel still costs nothing. | medium | Done in the rules. The two controls are the map's, in Unity. |
| He is in a town or with an army | **Done** (`src/sim/seatedleader.ts`): a leader holding an ungarrisoned town alone leads its defence when the battle is settled on the map, at their rank. | small | Built. |

## Grief

Built: in a town (`grief.ts`), and on the map now too (`mapgrief.ts`). DESIGN.md names the mother
and the sons, so a father lost is not grieved. Nothing to list.

## Relationships

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| The leader's household can be threatened, married off, lost or taken | A spouse cannot be married off or offered in a treaty or ransom (only a rival's threat and demand exist). Royal matches go through `royalmarriage.ts`, but not the spouse. | medium | Unity: port as is. Asked 19 November 2026, the owner had no preference, so it stays as built: the player never offers the spouse. |
| The inner circle: a mood and a loyalty that can turn | Built. The confidant does not warn of the knife. **The war is done (19 November 2026, `feudwar.ts`):** a defied rival king may declare war as his feud begins, which ends the truce or alliance between them and bars a new truce while the feud runs. **The raid on the court is done (21 November 2026, `feudraid.ts`):** while that war runs he may once send a raiding party against the town where the court sits, a band's strike by every rule but that it carries nobody off and goes home when it has struck; the player may fight it in person as any strike. | small | Done for the war. Unity for the warning, which is a scene. |
| Nobles | Built (`nobles.ts`, `nobledeal.ts`, `nobleacts.ts`, `nobleweigh.ts`, `nobletemper.ts`). Only the plot story has a plot. | none | Unity: port as is. |
| Stories inside the story | **Done (21 November 2026).** A killer's suspect may be accused and seized on the field, by the map's rule for an accusation: the guilty held for judgement at the Hall, an innocent let go with the town's grudge and its standing down (`fieldaccuse.ts`, `killerseized.ts`). A battle for the player's own town brings in the thief, the killer and a plot as a visit does (`battlestory.ts`). Left out of a battle: a rival ruler's envoy and a suitor at the hall, whose answers wait for the map or a visit. | medium | Done; the rest is Unity field work. |
| Several campaigns | Built. Worlds are kept in this browser only, and a skirmish has one save. | small | Unity: saving is the engine's. |

## Meeting them face to face

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| The ones met shown as living 3D figures, the choices beside them | **Built, and they answer the choice (21 November 2026):** one pardoned or given what they asked bows, one set to work or taken is led away, one banished, refused or defied leaves, and a hanging or a death is told in a line, never shown (`encounter.ts` reactionTo, drawn in `src/client/encounter.ts`). A band's men are dressed by kind, not as who they were. | small | Unity: the new engine's figures. |

## Buildings and research that answer the systems

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Each works on the map as well as in a town | The Noble's Manor is a building only in a town. Oaths of Fealty and Pilgrimage have no meaning in a town's streets (`studiesintown.ts`, by design). | small | Unity: port as is. The map is where they act. |
| A Fortress stands in the town as a stronghold against bands | **The map's side built here after all (20 November 2026, `fortkeep.ts`):** a Fortress keeps a garrison of the town's own men between seasons, and one with anyone to hold it is a stronghold a band may raid but never take. **The field's side is built too (21 November 2026, `data.ts`, `fortkeep.ts` `fieldArms`):** in a town's streets the Fortress shoots as a Watch Tower does, and where no army stands in the town its garrison of the town's own men stands to arms as the battle begins. Against a nation's army on the map it is as it was (three points of defence and walls). | medium | Done on the map. The field's side with the battle code, in Unity. |
| Feast Days and Pilgrimage | Feast Days is only a nation's study on the map: a Church in a town keeps no feast day. | small | Unity: field. |
| A Monastery or Convent | One building for both, a Convent only in its name and its people. On the map it keeps no count of who serves in it. | small | Unity: port as is. |
| Each people its own: one or two studies each | **Done** (`src/sim/ownstudies.ts`): every one of the fifteen has a second study, each with a job in a system that already runs (floods, grief, crime, the nation's loss, the militia, plague, decrees, famine, plots, settlers, trade, caravans, the coast, the sea), learned by rivals by the shared rule. | medium | Built; the figures are first guesses. |
| A Well (or Bathhouse), an Infirmary (or Almshouse) | Built as the Well and the Infirmary. The second names were alternatives, not both. | none | Drop the alternatives. |

## The food decree; settlers and the far wilds; a rim of true wilderness

Built (`grain.ts`, `founding.ts`, `wilds.ts`, `bandwilds.ts`, `rim.ts`).

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| A people may send settlers to an empty land beside its own | A young people seldom has an empty land in reach. Leaving one beside every chief town was tried and cost the player wins badly, and it was left for a decision. | small | Owner's call: it is a map-making choice, best made in Unity's map generator. |

## Towns big enough to raise armies; a garrison pays; one rule for who defends a town

Built (`TOWN_SCALE` 4, `armytown.ts`, `raidclash.ts`, `militia.ts`). Only forty of a town's grown are on
the field (`fieldcap.ts`): the rest are held on the record. That is a cost of drawing, not a promise left
unbuilt; Unity may raise it.

## A dip does not undo dominion; caravans on the roads; what a town lacks comes by road; a siege camp has no people from nowhere

Built (`dominion.ts`, `caravans.ts`, `prices.ts`, `siegecamp.ts`). The field's caravans and the camp check
are listed above.

## Claimants to the throne

The "Not yet" line is listed above.

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| A child of theirs may grow up to claim the throne | A claimant of both houses rules one throne at most: the same person never comes to rule both peoples, and a war of succession between two rivals is only the end of their peace. | medium | Unity: port as is. |

## Across the design: what the board says has never been done

These are not single promises, but they stand against the whole of DESIGN.md:

- **Played by a person.** No campaign has been played through by hand, and few battles have. The health
  report (`HEALTH=1`) and the trial sieges measure the computer playing itself. Recommendation: Unity.
  The first playtests should be there, against `docs/TUNING.md`'s targets, which port as the bar.
- **Voices and portraits.** Most lines are unrecorded and most nations have no portrait.
  Recommendation: Unity, as assets.
- **Playing with friends.** None. DESIGN.md does not ask for it. Recommendation: Drop, unless the
  owner adds it.

## Recommended before the move, in one list

All small, each in its own module with its own test, and none changes a rule's meaning:

1. Captives taken in a visit are held on the map, as a battle's are (`battlecarried.ts`). **Checked, not built:** in a visit only the field's marauders take anyone, and a battle's marauder-held are gone by the same rule; there is no taker on the map to hold them (see Towns persist).
2. ~~A Church or Tavern built in a battle is raised as the map site that moves the town's faith.~~ Done: `faithsites.ts`.
3. Settlers into a town emptied in battle, or behind a rival's army, come from the taker's nearest town. **Done** (`settlersfrom.ts`).
4. Check whether any attacker's camp still has villagers from nowhere; fix it or strike the board line. **Done:** a reserve's camp (`reservecamp.ts`).
5. Men of no town sent home go to the army's chief town, or the last hired men are dropped. **Done** (`hiredhome.ts`).
6. A known person carried off by a nation is marked carried off by name. **Done** (`carriednamed.ts`).
7. ~~The Prophet's fire, blight and earthquake, and the older chance events, go by creed (`wrathAt`).~~ Done: `wrath.ts` in `game.ts`, and `chancecreed.ts`.
8. A leader standing alone in an ungarrisoned town is counted when the battle is settled on the map. **Done** (`seatedleader.ts`).
9. ~~A defied rival king may declare war.~~ Done: `feudwar.ts`.

Everything else ports as it is, and is built or decided in Unity.
