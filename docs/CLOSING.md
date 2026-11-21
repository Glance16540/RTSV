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
| A man at war is still of his house | On the map a house is kept by name only while it has a man away, one fallen in the last forty seasons, or deeds to its name. An ordinary house with everyone home is a count again, so a man can come home to a house the record has forgotten (`warhouse.ts`). | medium | Unity: keeping every house by name on the map is a change to the town record's shape, best made once in the new save format. |
| A town taken | Resentment costs no harvest, gold or levy. Each was tried and dropped, and it acts only through unrest, the governor's pace, drift and the walls. | small | Drop: tried three ways and dropped on measurement. Only the owner would reopen it. |
| Claimants to the throne | The lord, the band and the grown claimant are names and a line on the land's panel, not figures on the field. The player's own succession is asked of the player before a claimant can take the throne. | medium | Unity: the claimant as a figure is field work (a person to meet, fight or judge in a town). The succession order is the owner's ruling as it stands. |

## What the game is

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Systems deep enough that stories fall out of them | Story threads are one step long: an answer leads to one later tale and stops, and a world event, a land lost or a leader's fall starts none. No campaign has an ending of its own beyond the summing-up page (board, Story and events). | medium | Unity: this is narrative design across the systems, and the systems it would read are all here to port. |

## Time, and age belonging to the nation

Built as written (`ageing.ts`, `birthonly.ts`, `Game.fixedAge`). Skirmish and missions still age up and
buy villagers, which DESIGN.md allows. Nothing to list.

## Towns persist

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Ten women taken is ten women gone, and held somewhere real | **Checked: nothing to hand over.** A visit has only the player's side on the field, so the only ones who can take anyone there are the field's own marauders. A battle's marauder-held captives are already gone by `battlecarried.ts`'s rule, since the field's marauders are no band on the map to hold them. To hold them would mean giving them to a band of the map (the nearest marauders, or one made for it), which is a new rule, not a hand-off. | small | Unity: decide there whether the field's marauders are a band of the map. |
| What is built in a town is kept on its record | **Done (19 November 2026, `faithsites.ts`).** A Church or Tavern built in a battle or on a visit is raised as the map site that moves the town's faith, where the land has room and has none. | small | Done. |
| What is built in a town is kept on its record | A road laid by hand in a siege is not kept; only a visit keeps roads. | small | Unity: roads are field work and the new engine lays its own. |
| Nobody from nowhere (towns persist, a soldier costs a person) | **Done for the settlers** (`src/sim/settlersfrom.ts`): a town taken empty, in a battle or as a dead town, is settled by couples its taker's nearest towns can spare, by road; where none can be spared it stands empty. Still from nowhere: a tribe's town made up to its old strength the first time it is looked into. | small | Built. The tribe's one-time top-up stays, since it happens once per save. |
| An attacking camp has no people from nowhere | **Done.** The check found one more case: a reserve army joining a siege (either side, or an ally's) got a camp with two men and two women from nowhere. `src/sim/reservecamp.ts` marks it in its set-up, so its camp is laid with none (`siegecamp.ts`) and it is not counted as died out (`dyingout.ts`). | small | Built. |

## No auto-resolve; a town defends itself

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| The town defends itself, and the player may be there | A band's strike on a town is a clash on the map (`raidclash.ts`). Nobody can enter it, watch it or play it, unlike a nation's attack or a fight with a band in the open. | medium | Unity: the rule is done. What is missing is a real-time battle for a raid, which is the new engine's work. |
| A report of who was killed and who was taken | The report counts them and ages them, but names only the notable. A town keeps counts and ages, not names. | large | Unity: naming everyone is a change to the town record's shape, the same decision as keeping every house by name. |
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
| What he earns and wins counts to the house's output | Men with the armies are not counted in a town's output. War counts by foes felled only: veterancy beyond kills and loot are not counted to a house. | small | Unity: it is the house's output figure, which `notableweight.ts` has. Port and extend. |
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
| A woman whose home produces most | A rival's notable homes on the map are named by rule, one to a town, not by which house did most (board, How a rival rules its towns). | small | Unity: port `notableweight.ts`, which already weighs a house's output, and let rivals read it. |
| Their loss carries weight | **Done** (`src/sim/carriednamed.ts`): a known person among those a nation leads away is marked carried off by name, mourned, and known again if got back. The rest are counted, as the town's record keeps them. | small | Built. |

## Captivity

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Slavers gain output from the children born in captivity | On the map a band holds captives but has no output to gain, so children born there do nothing for it, and nobody is paid for captives a band sells on. | small | Drop on the map: a band is not a town. It is built in a town (`captivity.ts`). |
| Got back for a time | A captive in the marauders' camp cannot be let out at the gate as one in a Work Camp can; the camp must be burnt. | small | Unity: field work. |
| The player's nation, if it assimilates | The player's nation never carries people off, whatever its creed: there is no order for it. | medium | Unity, if the owner wants it. DESIGN.md names only rival nations, so Drop is also defensible. |
| What is shown of it | Escapes and risings are told and not drawn. The captives' daily round has not been watched. | medium | Unity: drawing. The content rules port as written. |

## Acts of God

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Famine, plague, fire and the like | No flood. Rivers run on the map and are laid on a town's ground, but nothing lets ground go under water. A failed harvest strikes only fields, never a town that lives by hunting, fishing or herds. | medium | Unity: a flood is terrain work. Port `acts.ts` as it is. |
| By creed, sparing nobody | **Done (19 November 2026).** A Prophet's fire, blight and earthquake go by the creed of those they fall on, as his plague does (`wrath.ts`, `game.ts`); fever in the camp and a hard season go by the town's own standing (`chancecreed.ts`, through `wrathAt`). An ordinary people is struck exactly as before. | small | Done. |
| They carry over into a town | A battle in a land with plague on the map begins with nobody sick, and one after a failed harvest with nobody hungry. | small | Unity: the field's start-up reads the map's state, and that start-up is being rebuilt. |

## Threats of men never stop

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| There is always something to fight | **Built here after all (20 November 2026, `rivalhunt.ts`).** A rival marches through its own lands for a band that holds its people, if it can be there in time, or that sits in its land; and it marches first on a camp of the marauders that holds its people or has struck its towns. Still missing: it never crosses another people's land or the wild to reach a band, and plans no march of several lands to a marauders' camp. | medium | Done as far as its own lands. The rest with the rival's mind, in Unity. |
| Bands choose marks and strike | Bands seldom live long enough to roam, and long marches are rare: on maps this size a softer mark is nearly always one land away. The far wilds' hosts do march. | small | Unity: it depends on map size. Port as is. |

## Drift, decrees, and the tavern as a town falls

Built as written (`drift.ts`, `driftintown.ts`, `decrees.ts`, `tavernfall.ts`).

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| The tavern shown by the house as the town falls | Its shape by day has two looks (plain and gaudy), not three. | small | Unity: art. |

## A visit; a town left to itself

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| A visit is about ten minutes of its season | A visit costs nothing and the season does not move for it. It is not offered on a land the marauders hold. | small | Unity: port as is. "Each town once a season" is kept. |
| It carries on with its last orders | The men in a town's queues go out as companies of the map's kinds, so a queue of swordsmen and one of clubmen both raise infantry. The four-company stop cannot be set. A rival's towns do not train by orders. | small | Unity: the map has five kinds of company by design. Port as is. |

## Stores

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Towns send food, goods and people to one another by road | The computer sends food and goods by convoy, never people. | small | Unity: port `convoys.ts` and give rivals the player's rule for sending families. |
| A market's trade by caravan | In a battle or a visit the Traders' markets still earn by rule; caravans run only on the map. | small | Unity: field work. |

## Armies belong to towns

Built (`armytown.ts`, `warhouse.ts`, `companyroll.ts`, `fieldcap.ts`). Only the hired men of no town,
listed above.

## A dead town

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Any rival nation or marauders that come for it can take it | The marauders walk in only if they hold the land beside it; a roaming band does not turn aside for a dead town. | small | Unity: port as is. |

## A town taken

The "Not yet" line is listed above.

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Sooner settled where they are ruled well | Rivals garrison a resentful town and learn Written Law, but do not build a Church or Farmland with its resentment in mind. A nation given back its last town by a rising is not brought back to life. | small | Unity: port as is. |

## Rivals live by the same rules

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| The same rules, the same losses | A rival's income is scaled by difficulty (the owner's choice: keep). The tales told every few turns are the player's only, and a rival is moved by a fixed step. | small | Unity: port as is. The scaling is the owner's choice. |
| A rival that thinks as a people | It weighs only the land next to its army. It does not plan a road, mass two armies for one assault, or weigh its towns' losses in choosing war. It takes no account of world events, named places or creed when it bargains. | large | Unity: the rival's mind is the largest open piece of the design. The weights it already uses (`rivalaim.ts`, `rivalrule.ts`, `rivalcaptives.ts`) port as they are. |

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
| The inner circle: a mood and a loyalty that can turn | Built. The confidant does not warn of the knife. **The war is done (19 November 2026, `feudwar.ts`):** a defied rival king may declare war as his feud begins, which ends the truce or alliance between them and bars a new truce while the feud runs. A raid on the court is not built. | small | Done for the war. Unity for the warning, which is a scene. |
| Nobles | Built (`nobles.ts`, `nobledeal.ts`, `nobleacts.ts`, `nobleweigh.ts`, `nobletemper.ts`). Only the plot story has a plot. | none | Unity: port as is. |
| Stories inside the story | All five are built, for the player and for rivals. They come onto the field only in a visit, not in a battle, and a killer's suspects can be questioned there but not accused or seized. | medium | Unity: field work. |
| Several campaigns | Built. Worlds are kept in this browser only, and a skirmish has one save. | small | Unity: saving is the engine's. |

## Meeting them face to face

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| The ones met shown as living 3D figures, the choices beside them | Built. The figures do not answer the choice (nobody bows, flees or is led away), and a band's men are dressed by kind, not as who they were. | small | Unity: the new engine's figures. |

## Buildings and research that answer the systems

| Promise | What is missing | Size | Recommendation |
| --- | --- | --- | --- |
| Each works on the map as well as in a town | The Noble's Manor is a building only in a town. Oaths of Fealty and Pilgrimage have no meaning in a town's streets (`studiesintown.ts`, by design). | small | Unity: port as is. The map is where they act. |
| A Fortress stands in the town as a stronghold against bands | The Fortress does not shoot and holds no soldiers of its own in a town, and no garrison is kept in it between seasons. | medium | Unity: the field's battle code is being rebuilt. Port the map's Fortress (`threats.ts`, `mapbattle.ts`) as is. |
| Feast Days and Pilgrimage | Feast Days is only a nation's study on the map: a Church in a town keeps no feast day. | small | Unity: field. |
| A Monastery or Convent | One building for both, a Convent only in its name and its people. On the map it keeps no count of who serves in it. | small | Unity: port as is. |
| Each people its own: one or two studies each | Fifteen nations with one study each, not one or two. | medium | Unity: fifteen more studies is design work best done once on the new engine. `ownstudies.ts` ports as the pattern. |
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
