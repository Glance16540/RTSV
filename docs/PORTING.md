# Porting the rules to Unity

The game is being rebuilt in Unity (C#, URP) by a session on the owner's own computer. Its project lives
apart from this repository. This page is how the two stay apart and still meet.

## How to port a system

For the Unity session. Short on purpose; the three generated sections at the foot of this page hold the lists.

**1. The order.** Follow [The order to port in](#the-order-to-port-in-generated): layers worked out from the
"Depends on" column. Layer 0 depends on nothing; a module can be ported once every module in the layers above
its own has been. Within a layer take first the modules most others wait on (they are named first). Before
layer 0, declare the *shapes* the table under the layers lists: above all the records of `campaign`
(`Campaign`, `Territory`, `Faction`, `Army`) and of `game` (`Game`'s fields, `Unit`, `Building`, `Player`), as
plain data classes with no rules in them. Nearly every module reads those records and only two or three call
the hubs themselves. A module adds its own fields to them (`declare module './campaign' { interface Territory { ... } }`):
in C# add the field to the record when you port the module that declares it.

**2. One module at a time.** For each: read its header comment (it says what the rule is and what it reads and
writes); port its constants under the same names ([Where the constants live](#where-the-constants-live-generated));
port the functions line for line; port the tests named in its row, unchanged in meaning; mark the row `ported`.
If [The tests](#the-tests-generated) lists the module as light, few, or tested only through another, its own
tests will not catch a wrong port: lean on the fingerprint and the health report for it (below).

**3. The hubs, piece by piece.** `game.ts` (a battle or a visit to a town) and `campaign.ts` (the map and its
seasons) are in the last layers because they call everything. Do not wait for them and do not port them whole.
- Start each as a shell: the record, the seeded run of chances (`rng` / `rand`, below), and the empty turn of
  the clock (`Game.step`; `endTurn` and its season).
- Each system is called from its hub by an import and a call or two. `node scripts/porting-check.mjs --hubs`
  lists every module each hub touches and how often; most are one call. When you port a system, add its call
  to your hub at the same place in the same order: the order of calls within a tick and within a season is
  part of the rules (the bands strike before the convoys come in, for one).
- Some systems are told of things by a hook instead of an import, so that nothing imports upward:
  `campaignbase.ts` `HUB` (what the map's systems may ask the hub to do), `campaign.ts` `BATTLE_HOOKS` (what
  runs when a battle on the map is settled), `intriguebase.ts` `ENDINGS`. Port the hook as a list of delegates
  and register in the same order the modules are imported here.
- What is left in a hub when its systems are out is its own: `game.ts` keeps the unit's second (move, fight,
  gather, build), `campaign.ts` the making of the world, armies marching and the settling of a battle. Port
  those last, with `sim.test.ts` (neither hub has tests of its own: each system it calls has).

**4. Chance, and the arithmetic that must match.** Nothing in `src/sim` calls `Math.random`. A battle draws
from `Game.rng` and the map from `rand(c)` (the same 32-bit generator, state saved with the game), and many
rules draw from a hash of the seed, the season and a number of their own (`chance(c, salt)`, `hash(...)`),
so that the same world gives the same answer whenever it is asked. To match:
- `Math.imul`, `>>>`, `^`, `|` are 32-bit: use `uint`/`int` in `unchecked` code. Everything else is a 64-bit
  float: use `double`, never `float`, in the rules.
- `Math.round(x)` rounds a half up (`Math.Floor(x + 0.5)`), not to even as C#'s `Math.Round` does.
- `Array.sort` is stable; `List<T>.Sort` is not. Use a stable sort (`OrderBy`), with the same tie-breaks.
- Lists are walked in the order they were filled, and a record's keys in the order they were added: use
  lists and insertion-ordered dictionaries where a rule walks them.
- `%` keeps the sign of the left side in both languages; `| 0` and `Math.trunc` cut toward zero; `Math.floor` does not.
- `Math.hypot`, `sin`, `cos`, `atan2`, `pow` may differ in the last bit between the two runtimes. A battle
  that differs only there drifts apart slowly; see the fingerprint below for how to tell.

**5. The fingerprint: for battles.** `fingerprint.txt` is a fixed set of seeded battles (skirmishes, campaign
sieges, leader drills, marauder camps), every side played by the computer, with the whole saved state
(`Game.serialize()`) hashed every two minutes and at the end
(`FINGERPRINT=1 OUT=out.txt npx vitest run scripts/fingerprint.test.ts`). Here it proves a change to battle
code changed no battle. For the port:
- The hashes are of this side's JSON text, so a C# hash will not equal them. Compare what the lines also say
  in plain words first: at each `end` line the tick, the winner, and the counts of units and buildings.
- To compare states, write both sides out the same way: on this side `Game.serialize()` is JSON; on the C#
  side emit the same fields in the same order with numbers printed as the shortest round-trip form, then diff.
  Do it at tick 0, then at one second, then at each two-minute mark of one skirmish. The first field that
  differs names the system that is ported wrong.
- If everything matches for some minutes and then positions differ in the last decimals, that is the
  transcendental functions (step 4), not a wrong rule. Either accept it and judge the battle by the health
  report's siege figures, or use one shared implementation of those functions on both sides.

**6. The health report: for the map.** `docs/TUNING.md` says what the numbers should produce, as bands;
`scripts/health.test.ts` plays hundreds of computer-played campaigns from fixed seeds and writes each figure
against its band to `docs/health-report.md` (`npm run health`, or
`HEALTH=1 SIEGES=0 CAMPAIGNS=384 OUT=file npx vitest run scripts/health.test.ts`; `STORIES=answer` is the
second course). For the port:
- First exact: a campaign is seeded too. Play seed 1 for ten seasons on both sides and compare the log
  (`c.log`) line for line, then each land's owner and people. It should be identical; where it first differs
  is the module to look at.
- Then by the bands: port the report's player (`season` in `scripts/health.test.ts`: `playForPlayer`,
  `sensibleDecrees`, `endTurn`, `continueAI`) and run the same seeds. With an exact port every row is
  identical to this side's, character for character, as it is here between two branches that change no rule.
  If exactness was given up in battles (step 5), the map's rows still should be, with `SIEGES=0`.
- A row out of its band that is in its band here is a wrong port, not a tuning matter: do not tune the C#
  numbers to bring it back.

**7. Where the constants live.** In the module that owns the rule, as a named bag at its top
(`export const THREATS = { ... }`, `WATCH`, `CONVOYS`, `RIM`), every number with a comment.
[The generated list](#where-the-constants-live-generated) names each bag and its module. The widest:
`data.ts` (every unit, building, study and people: costs, strengths, ages), `campaignbase.ts` (the map's
size and its common numbers), `threatsbase.ts` and `threats.ts` (bands), `township.ts` (`TOWN_SCALE`, what a
town is), `ageing.ts` (`SEASONS_A_YEAR`, ages), `intrigue.ts` (`INTRIGUE`, the stories), `creed.ts` (what a
people's standing does). Keep the names: `docs/TUNING.md` and every commit that tunes a number speak of them
by name.

## How the two sides work

- **This repository keeps finishing the systems.** Every system's rules live in `src/sim`, in a module of
  their own: no DOM, no three.js, nothing from `src/client`. They talk through plain data (numbers,
  strings, arrays, plain objects), so each can be rewritten in C# line for line.
- **Every system has its own tests** in `tests/<module>.test.ts`. The Unity session ports the tests with
  the module, and the C# version must pass them unchanged in meaning.
- **Nothing here is pushed into the Unity project.** The Unity session pulls a system when it is ready for
  it, ports it, and marks the row below `ported` (it may push that one-word change here, or tell the
  gathering session to). Until then a system keeps being built and changed here.
- **Order of porting** follows the dependencies column: a module can be ported once everything it
  depends on has been. The layers are worked out by script at the foot of this page
  ([The order to port in](#the-order-to-port-in-generated)).
- **Hubs:** `game.ts` (a battle or visit) and `campaign.ts` (the map) tie the systems together. Port them
  in pieces as their systems arrive, rather than whole.
- **The table below is kept true by a script.** `npm run check` runs `scripts/porting-check.mjs`, which fails if a
  module in `src/sim` has no row or two, if a row names a module or a test file that is not there, if a module
  imports from `src/client` or three.js or reaches for the DOM, if a row's dependencies are not what the module
  imports, or if a module joins an import cycle. `npm run porting` writes the line counts and dependencies as they are (and `npm run sync` does so after
  a merge); the words, the tests named and the Unity column are written by hand.
- **Three sections at the foot are generated** by `scripts/porting-order.mjs` (run by `npm run porting` and
  `npm run sync`): the order to port in, the state of the tests, and where the constants live. They are
  rewritten whole between their marks; do not edit them, and settle a clash in them by running `npm run porting`.
- **Import cycles.** A module that calls another which calls it back cannot be ported alone. Imports of types alone
  do not count. There are none among the rules modules, and `npm run check` fails on any. A system that must be told
  of something another does takes a hook from below (as `campaignbase.ts` lends `HUB`, and `intriguebase.ts` keeps
  `ENDINGS`) in place of importing it.
- **When a system here changes after it was ported,** its row says `changed since port`, with the commit,
  so the Unity side can follow.

## The systems

| Module | Lines | What it is | Depends on | Tests | Unity |
| --- | --- | --- | --- | --- | --- |
| `acts` | 203 | Acts of God on the map: a season of famine, plague and fire in every land that is held, falling on that land's town: its food, its people and its stores (docs/DESIGN.md). | campaign (types only), campaignbase, creed, croprotation, decrees, granary, infirmary, larder, ledger, naming, physicians, plaguenamed, quarantine, stores, townfaith, township, well | acts.test.ts | not yet |
| `aftermath` | 204 | What a story inside the story leaves behind for years: a town warmed, soured, eased or resentful (its nobles' moods and its own faith), a feud with a defied rival, a bought-off rival who comes back, a marriage alliance that can be called on once, a pardoned plotter who turns loyal or plots again. `Mark`s on the campaign with the town, noble or people each is about; `marksAt`/`marksOfNoble`/`marksWith` for whoever shows them; `callOn`. Run from intrigue's season. | armytown, campaign (types only), campaignbase, chroniclethreads, court, courtstory, feudwar, intriguebase, kin, nobles, townfaith | aftermath.test.ts | not yet |
| `ageing` | 137 | A person ages only on the map, a season at a time (docs/DESIGN.md, "Time"). | campaign (types only), data, township (types only) | ageing.test.ts | not yet |
| `ai` | 1014 | Computer opponent. Plays by the same rules and commands as a human (but ignores fog of war). | aicare, aiground, aisiting, aiward, aiworks, besieger, birthonly, calamity, creed, darkarts, data, game, keeper, map, muster, ownstudies, plainhealer, siegecamp, styleplay, temper | ai.test.ts, ai-refounds.test.ts, ai-crowded.test.ts, ai-fires.test.ts | not yet |
| `aicare` | 56 | What the computer player does for its own people and its allies': posts its idle Slavers as guards over unwatched captives, feeds an ally going hungry and buys food when its own go hungry, and sends idle soldiers to free its people held in a rival's camp when it has enough to beat the guard. Called once a second from ai.ts. | aicaptives, famine, game (types only), rescue | aicare.test.ts | not yet |
| `aicaptives` | 64 | The computer knows captivity is on a clock, in a town: its rescue goes first to the camp where its people have least time left and, in their last two minutes, whatever it is doing; a rescue at a camp of its own is met by its idle soldiers. No sale is made: the sale comes by itself. | captivity, game (types only), rescue | aicaptives.test.ts | not yet |
| `aiward` | 61 | What a computer-played town does about the marauders in a battle: gets its women indoors while a raiding party is near (marauders' `partyNear`, `hideWomen`) and lets them out when it is gone, and sends its fastest idle soldier round the places a camp could be (`scoutSpots`) while the camp is unfound, the town is at peace and it has soldiers to spare. Called once a second from ai.ts. | game (types only), marauders | aiward.test.ts | not yet |
| `aiworks` | 95 | What the computer builds for its town inside a battle besides its works of war: the newer buildings, each when the town has a use for it (in need, or out of plenty), by the building's own rules; and which studies it queues behind a busy building. | data, game (types only) | aiworks.test.ts | not yet |
| `armytown` | 387 | Armies belong to towns (docs/DESIGN.md): a company's men leave their town's record for the army's roll, the army's dead are struck from it, and the rest come home when it is sent home. | ageing, campaign (types only), companyroll, hiredhome, ledger, soldiernames, township, veteranhome, warhouse | armytown.test.ts | not yet |
| `bandborn` | 60 | Children born in captivity on the map: a woman held by a band may bear one; with slavers, pirates, highwaymen or marauders the child is hers and comes home with her (threats' `bringHome`), with raiders it is the band's own. Counts on the record only, never shown. One call a season. | campaign (types only), threats (types only) | bandborn.test.ts | not yet |
| `bandcaravan` | 52 | A band falls on a caravan: raiders, slavers or marauders standing on a land a caravan's road crosses may fall on one a season (`caravanSeason`), by caravans.ts's `fallOnCaravan`. It keeps nothing of its own. | campaign (types only), caravans, threats | bandcaravan.test.ts | not yet |
| `bandfight` | 313 | An army against a band: a battle the player can enter (a pending battle against no nation that takes no land, turned into a field battle), an army's own means when nobody is there, the computer's peoples hunting bands in their lands, and a band falling on a weak army or one seeing a convoy along the road. | armytown, bandmarch, campaign (types only), campaignbase, data, dynasty, hero, naming, rim, rivalcaptives, roadclash, threats, warhouse, winter | bandfight.test.ts, bandleader.test.ts | not yet |
| `bandhorde` | 119 | The marauders, the band that holds a land: one kind of band among the others, with its raids as strikes on a town that defends itself. Was `hordeTurn` in campaign.ts. | campaign (types only), campaignbase, rim, stores, threats | bandhorde.test.ts | not yet |
| `bandmarch` | 145 | Bands on the march and the armies they meet: farther along a road, drawn by riches, daring a tired or lonely army, seen by the armies they pass. | armytown, campaign (types only), founding, heralds, rim, township | bandmarch.test.ts | not yet |
| `bandmeet` | 89 | A band coming for a town of the player's, put to them once when an army can meet it: go out, send the army, or let them come. | bandfight, campaign (types only), campaignbase, threats, threatsbase | bandmeet.test.ts | not yet |
| `bandroam` | 219 | Bands move: they flee strong armies, plan a way of a few lands toward softer marks, settle as marauders and break up. | bandhorde, bandmarch, campaign (types only), campaignbase, rim, threats | bandroam.test.ts | not yet |
| `bandseason` | 41 | One season of the threats of men: the one call the campaign makes for all of it. | bandborn, bandcaravan, bandfight, bandhorde, bandmarch, bandroam, bandwilds, campaign (types only), carriedoff, inn, nocarry, raidfought, raidnews, threats | threats.test.ts | not yet |
| `battlecard` | 132 | What a campaign battle or a visit says of itself: the briefing before it (what it is, whom the player leads, what winning means, that no villager is bought), the count of both sides as it is fought, and words the size of what happened. | data, game (types only) | battlecard.test.ts | not yet |
| `battlefolk` | 99 | A town's people in a battle, out of the battle hub: its own people set down on the field at the ages its record has them (`peopled`), its children set on its roofs' records (`cradled`), and the count of a side's town a battle hands back to the campaign (`censusOf`, which `Game.census` is). | ageing, data, game (types only), household, notableweight, orphantown, township, widowtown, writeguard | battlefolk.test.ts, persistfolk.test.ts, ageing.test.ts | not yet |
| `battleleader` | 119 | The leader in a battle, out of the battle hub: who a people's leader is, how their powers are fitted to the hero they are built on, the deeds that raise them through the ranks, the powers they learn, and the call they raise. Game keeps a one-line method of the same name for each. | champion, data, game (types only), hero, powers | battleleader.test.ts, leader-play.test.ts, leader-rise.test.ts, powers.test.ts | not yet |
| `atwork` | 77 | A town at work from its first second: as a visit or a siege defended begins, the player's villagers are set to food, wood, gold and stone by the shares the town works by on the map, each to the nearest of its kind; what they were set to is remembered, so that only work the player changed is written back as orders. | data (types only), game (types only) | atwork.test.ts | not yet |
| `battlehooks` | 80 | The phases of a battle on the map (set up, settled, written back) and the table of systems registered for each, so that the battle functions in campaign.ts name no system. | campaign (types only), mapbattle (types only) | battlehooks.test.ts | not yet |
| `battletales` | 57 | A battle fought out on the map read for its panel: where and when, who led, rounds and who broke, losses by kind, walls, who scattered, the named fallen and the man who stood. | campaign (types only), campaignbase, mapbattle (types only), naming | battletales.test.ts | not yet |
| `beaten` | 52 | When a people is beaten. A town used to stand until its last building fell, which left a won war to drag on | none | beaten.test.ts | not yet |
| `besieger` | 31 | A besieger assaults: the computer on the attacking side of a campaign siege forms up for a minute and goes in with what it brought. | game (types only) | besieger.test.ts | not yet |
| `dominion` | 30 | A dip does not undo dominion: the count of turns a people has held most of the land rises a turn each season it holds the share, falls two for a season under it, and is gone only when nothing is left; another people coming to the share begins its own. | none | dominion.test.ts | not yet |
| `floods` | 82 | Flood on the map where a river runs by a town, by its standing: food spoilt, the town worn, farmland washed away when struck hard; nobody drowns; the Flood Calendar halves it. | acts, campaign (types only), campaignbase, ownstudies, township | floods.test.ts | not yet |
| `fleets` | 69 | Each people's own warships in the two hulls' roles: four families (longships, galleys, dhows, junks), each a kind for the War Galley and one for the Frigate, stats a sixth off at most; `fleetKind` is Game.trainedAs's last step, `hullOf` the hull a kind stands for. | data | fleets.test.ts | not yet |
| `givenorders` | 43 | Which of a field's work is the leader's orders: the field says how many hands the town had there, and its work is orders only when half of them were at it; otherwise the town keeps the work it was last given, or its governor's shares. | governor (types only), township (types only) | givenorders.test.ts | not yet |
| `handroads` | 134 | Roads laid and lifted by hand: `roadBar` (why not here), `roadLine`, `cmdLayRoad` and `cmdLiftRoad`; kept in Game.roadOf under keys below zero, kept from visit to visit on the town's record (`handRoadsOut`, `keepRoads`, `roadsFor`, `handRoadsTick`). | campaign (types only), game (types only) | handroads.test.ts | not yet |
| `placebar` | 50 | Why a building cannot be placed on a spot (`placeBar`): Game.canPlace's tests in its order, each with its reason. | data, game (types only), map | placebar.test.ts | not yet |
| `reckon` | 26 | Who is a neighbour to reckon with: a land that is not a people's own and has somebody on it (not empty, not wilderness). A rival's front, its border towns, its armies deep in its own country and its walk to the border all ask this, so an empty or a wild land is no frontier. | campaign (types only), founding, wilds | reckon.test.ts | not yet |
| `roofs` | 113 | Every household under its roof, the field's side: as a sitting begins the households kept from the last are seated in their own houses by name, the wives of men away alone under their husbands' families' roofs, then couples as many as the town has married; as it ends, who lives where by place, name and age. | ageing, game (types only) | roofs.test.ts | not yet |
| `roofsmap` | 70 | Every household under its roof, the map's side: the households kept on a town's record (each a season older a season), its married couples and its men away handed to the field, and who lived where written back when the sitting ends. | campaign (types only), data, marriage, roofs (types only), township (types only), warhouse | roofs.test.ts | not yet |
| `siegelift` | 86 | A siege is lifted when the besieging army is spent: fewer than four fighters and nothing to raise more with, for a minute, and the besieger has lost. | besieger, data, game (types only) | siegelift.test.ts | not yet |
| `soldiernames` | 144 | Which soldier is which man: an army's companies on the field are led by the men of its roll, by name and house, and those whose soldiers went down are the ones the map counts lost. | campaign (types only), campaignbase, game (types only), warhouse (types only), warrecord | soldiernames.test.ts | not yet |
| `namesakes` | 53 | A town's people go by different given names where the town can: the lot draws a free name, and villagers still under the lot's name who share one are given free ones. | game (types only), peoplenames | namesakes.test.ts | not yet |
| `downedmap` | 64 | The men the field saw fall are the map's dead: after a battle in person is reckoned, any man seen to fall still on his army's roll is taken off it as fallen, and his broken company struck. | armytown, campaign (types only), ledger, warhouse | downedmap.test.ts | not yet |
| `townwater` | 77 | A town's water read off the campaign map for its ground (`waterOf`): the sea round it and on which side (a coastal town always has a shore), islands where the sea is wide, a river that runs near and how it runs. | campaign (types only), campaignbase, waterlay (types only) | water.test.ts | not yet |
| `waterlay` | 93 | The water of a battle's ground as its land has it (`layWater`, called by map.ts): a shore from the town's corner, islands in a wide sea, a winding river with fords; the homes in use kept dry. | none | water.test.ts | not yet |
| `workwords` | 31 | What a town will really work by, in words: the season's shares as the governor sets them (four in five to the fields when food is short, hands off the fields when the granary is full), with why where they are not the orders' shares. Words only. | campaign (types only), data, governor, township (types only) | workwords.test.ts | not yet |
| `writeguard` | 35 | A town is not written off by a field it was never on: a census of a side whose people were never set on the field is marked, and the town's record is kept as it was. | campaign (types only), game (types only), township (types only) | writeguard.test.ts | not yet |
| `birthonly` | 62 | People come only by birth (docs/DESIGN.md). | data, game (types only) | birthonly.test.ts | not yet |
| `calamity` | 204 | Fire that begins without an enemy, and a town that turns out to fight it. | contagion, data, famine, game (types only), leanwild, wrath | fire-fighting.test.ts, town-burns.test.ts, ai-fires.test.ts | not yet |
| `bandwilds` | 109 | Bands from the far wilds: where a new camp is born far from any town (a rim land with a long way in first, `comesFrom`), the way it takes in, drawn by the richest mark within eight lands and not the nearest (`deepWay`), its gathering in sight of the towns below, and its setting out. | bandmarch, bandroam, campaign (types only), threats | bandwilds.test.ts | not yet |
| `campaign` | 1763 | Conquest mode: a turn-based strategic map layered over the real-time battles. | acts, ailing, aiplague, armytown, askedhere, bandfight, bandseason, battlecarried, battlehooks, battlescars, battletales, bothhouses, campaignbase, caravans, carriedoff, champion, chancecreed, chroniclethreads, churchtavern, claimantcaptain, claimantrising, companyroll, conquered, convoys, country, court, courtcall (types only), creed, data, deadtown, dominion, downedmap, drift, driftintown, dynasty, emptied, faithsites, feudwar, fieldcaravan, floods, founding, freetown, furloughmap, game (types only), governor, governworks, hallcases, harvest, hero, intrigue, kin, larder, leaders, mapbattle, marriage, migration, militia, militiatoll, naming, nationcolours, nobleacts, nobles, nobletemper, nobleweigh, notableweight, oldfolk, orphans, ownstudies, pacts, petitions, places, powers, prices, queueddrill, raidfought, reckon, rim, rivalaim, rivalcaptives, rivalhunt, rivalrule, rivalstock, rivalstories, roofsmap, royalmarriage, ruin, rule, seasonfolk, seasongain, seasonreport, seasonsky, sentfor, settlersfrom, siegeretreat, sieges, soldiernames, stores, storyturn, studies, suitors, tavernrumour, temper, townfaith, township, townwater, tradedeal, tribes, uniquecompany, unrest, veteranhome, warhouse, warrecord, warspoils, widowhood, wifetaken (types only), wilds, winter | sim.test.ts (the hub: none of its own; each system it calls has its own) | not yet |
| `caravans` | 204 | Caravans on the roads: a town with a Market trades by road with the nearest market town in reach (`partnerOf`), sends a caravan each season (`sendCaravans`) that comes home with gold (`caravansHome`, met by highwaymen and pirates through convoys' `waylay`); a band may fall on one (`caravansThrough`, `fallOnCaravan`); governors raise Markets out of plenty (`governMarkets`). One call a season (`caravansSeason`). | campaign (types only), campaignbase, convoys, data, governor, pacts, plenty, roadclash, roads, studies, threats (types only), township, townworks | caravans.test.ts | not yet |
| `fieldcaravan` | 149 | A Market's caravan on the field: in a campaign battle or visit at a town whose caravan is on the road this season, a trade cart walks from the Market to the field's edge on its partner's side, is away a while, and comes home with the gold the map's caravan brings; caught on the way home, its gold goes to whoever caught it. The battle hands back how it went and the campaign settles the season's caravan by it, so the map's figures stay the same. | campaign (types only), caravans, data, game (types only) | fieldcaravan.test.ts | not yet |
| `campaignbase` | 364 | What the map's systems share, below all of them: the constants and small helpers they used to import from campaign.ts (an army's size and strength, a company's price, how a people stands, a land's country). It imports no system; campaign.ts re-exports it. | campaign (types only), creed, hero (types only), pacts, powers, uniquecompany, winter | campaignbase.test.ts | not yet |
| `captivity` | 268 | What being held costs, by the owner's design (docs/DESIGN.md, "Captivity"). | ageing, creed, data, game (types only), hero, nursery, peoplenames, rescue | captivity.test.ts | not yet |
| `carriedoff` | 136 | A dissolute or depraved rival nation that takes a town leads a share of its grown people away to a land of its own (the bands' `Held` record). Got back if that land is taken within four seasons; after that they are on the holding town's record as the taker's people. Children born meanwhile are the taker's. `townFell` where a town changes hands, `carriedSeason` once a season. | ageing, bandborn, campaign (types only), carriedhome, carriednamed, creed, nocarry (types only), threats, township | carriedoff.test.ts, playercarries.test.ts | not yet |
| `carriednamed` | 51 | A known person among those a nation leads away from a town it takes is marked carried off by name (as likely as the known are among the grown of that sex), listed with the held, mourned, and known again if got back. | campaign (types only), carriedoff (types only), plaguenamed, township | carriednamed.test.ts | not yet |
| `carriedout` | 32 | As a battle ends, a side's people held by those who seized them (a raider leading them, a work camp, the lair), by name, house, gender, age and children borne in the camp, for the census (`Census.carried`). | ageing, game (types only), township (types only) | battlecarried.test.ts | not yet |
| `battlecarried` | 109 | Those carried off in a battle fought in person are held on the map in a land of the attacker's, by name and house (`Held.who`), on carriedoff.ts's clock; a known person is marked carried off; the player is told. Also strikes from the written-back town those a nation led away as it fell (`retake`). | ageing, campaign (types only), carriedoff, carriedout (types only), threats, township | battlecarried.test.ts | not yet |
| `carriedhome` | 37 | Those a battle carried off, got back, go under their own house's roof on the town's record where it has room. | campaign (types only), roofs (types only), threats (types only) | carriedhome.test.ts, battlecarried.test.ts | not yet |
| `warspoils` | 71 | What a man wins at war counts to his house's output: the spoils looted from a town his army took, and each man's deed in a town taken or an attack thrown back, as goods carried in on the house's record and its known mother's. | campaign (types only), township, warhouse (types only) | warspoils.test.ts | not yet |
| `warrecord` | 158 | A man's record at war (battles, felled, wounded, the last five) kept on his house's record while he serves, handed to his soldier as a battle is laid out, shown on his panel, and added to by every battle, in person or on the map. | campaign (types only), game (types only), soldiernames (types only), warhouse (types only) | warrecord.test.ts | not yet |
| `pickman` | 98 | Who goes to arms, seen and chosen: where a villager called to arms is going, who each soldier's place in a queue is to be made from (or that it waits), and the player sending a villager of their choosing. | data, game (types only), muster | pickman.test.ts | not yet |
| `levynext` | 31 | Who a company raised in a town now would take, by name and house, from the same rule warhouse.ts enlists by, on a copy of the town's record. | armytown, campaign (types only), warhouse | pickman.test.ts | not yet |
| `uniquecompany` | 54 | Each people's own foot, bow and horse soldiers as a kind of company on the map: of the family of the plain kind it fights as, raised by that people from the soldier's age, as strong and as dear as the unit is worth against the plain soldier of its family at that age (1 to 1.5 times), fielded as two of those soldiers. | data | uniquecompany.test.ts | not yet |
| `petitions` | 227 | A noble's petition to the ruler (a post, an estate, a match between grown children, help for a town in want, a pardon for a kinsman): one open at a time, granted or refused or left to lapse, each moving the noble's mood with a bond; a computer-led ruler answers as a careful one would. | campaign (types only), dynasty, larder, nobleacts, nobledeal, nobles, nobletemper, peoplenames, prices, stores | petitions.test.ts | not yet |
| `pacts` | 43 | What binds two peoples beyond a truce: royal marriages and trade deals between any two peoples, the peace a marriage keeps (read by campaignbase.ts atTruce), markets open by a deal, broken when one marches on the other. | campaign (types only) | royalmarriage.test.ts, tradedeal.test.ts | not yet |
| `royalmarriage` | 160 | Royal marriages between houses: grown, unwed children of the other sex, offered and answered by rulers; binds the peoples in peace (a truce for the player), a child of both houses in time with a claim on both thrones once grown; rivals offer to one another and to the player. | ageing, campaign (types only), campaignbase, dynasty, pacts, peoplenames | royalmarriage.test.ts | not yet |
| `bothhouses` | 112 | A claimant of both houses: a royal marriage's grown child comes to a failing throne before a captain or a stranger; passed over, the other house presses the claim by war. | ageing, campaign (types only), pacts, powers | bothhouses.test.ts | not yet |
| `tradedeal` | 86 | Trade deals: two peoples at peace open their markets to each other's caravans for a term, with gold to each chief town; offered and answered by rulers, rivals by the same rules. | campaign (types only), campaignbase, dynasty, pacts, royalmarriage, township | tradedeal.test.ts | not yet |
| `seatedleader` | 27 | A leader sitting alone in an ungarrisoned town leads its defence when the battle is settled on the map, at their rank, as an army's leader does. | campaign (types only), court | seatedleader.test.ts | not yet |
| `settlersfrom` | 61 | A town taken empty (in a battle, or a dead town a nation takes) is settled by the taker's own: couples its nearest towns can spare set out by road, and nobody comes from nowhere. | campaign (types only), convoys, township | settlersfrom.test.ts | not yet |
| `siegecamp` | 75 | A siege camp has no people from nowhere: the besieging side starts with no villagers, its foot soldiers build its workshop and storehouse and crew its engines, it is not held to a roof's room, and the computer raises its workshop and rams with soldiers. | besieger, data, game (types only) | siegecamp.test.ts | not yet |
| `hallfield` | 65 | Judgement at the Hall, in the town: the cases handed in from the map are before a standing Hall of Judgement, the player rules on each with one of its answers, and the rulings go back as the sitting ends. | game (types only) | hallcases.test.ts | not yet |
| `hallcases` | 70 | The cases a town's Hall hears in person (a thief held for judgement, a plotter laid bare, a noble's petition), handed to a visit or a battle for the town, and the rulings given back by the map's own rules. | campaign (types only), hall, hallfield (types only), intrigue, intriguebase (types only), nobles, petitions | hallcases.test.ts | not yet |
| `studiesintown` | 52 | The studies of rule, law, nobles and faith in a town of the nation: Stewardship builds works begun before the sitting faster, Written Law takes a thief sooner, Spymasters show the great true sooner, Feast Days bring the drifted back more readily; Couriers act already, Oaths and Pilgrimage have no meaning there. | game (types only) | studiesintown.test.ts | not yet |
| `chancecreed` | 46 | The older chance events of a turn by creed: fever in the camp and a hard season pass a pious town by, by its measure, and fall harder on a dissolute one (a hard season's cost in supplies; a second company to the fever). By the town's own standing (acts `wrathAt`), with a run of chances of its own. | acts, campaign (types only) | chancecreed.test.ts | not yet |
| `champion` | 30 | Soldiers who make a name. Every soldier's kills are counted; one who has felled enough is known by name, and when | hero, peoplenames | champion.test.ts | not yet |
| `conquered` | 124 | A town taken (docs/DESIGN.md): resentment as a state on the town, easing under good rule, with a chance each season that it rises. | ageing, campaign (types only), campaignbase, court, creed, ownstudies, townfaith, township, writtenlaw | conquered.test.ts | not yet |
| `firstlay` | 71 | A town met in person for the first time, kept until then only as a coarse record (rivalrule.ts): its buildings laid on the field around the hall, as the record counts them, looking further for room when the near ground is full, so it stands as big as it is. | data, game (types only), unlaid | firstlay.test.ts | not yet |
| `furlough` | 110 | A soldier home inside one sitting, the field's side: a man of the town with the army lays down his arms and is a villager again, his company leaving with him; a man home takes up arms again. Knows nothing of the map. | ageing, game (types only), leavehome, soldiernames | furlough.test.ts | not yet |
| `furloughmap` | 83 | The map's side of a soldier home inside one sitting: the town's men with the army there handed to the field, and those home when it ends taken off the roll and their houses' records of the away. | ageing, armytown, campaign (types only), campaignbase, furlough (types only), townmuster, warhouse | furlough.test.ts | not yet |
| `lastperson` | 21 | A side with no people left, where none can be bought, is beaten: it does not hold a battle open with a hall and nobody in it. | game (types only) | lastperson.test.ts | not yet |
| `dyingout` | 88 | A side with no villager left, grown or child, has died out: it is told so and beaten when its last soldier falls or after a grace, not held open by its soldiers. | besieger, game (types only), reservecamp | dyingout.test.ts | not yet |
| `leanwild` | 48 | A lean season in a town with no farm, by a failed harvest's chance and the creed's measure: its hunters and fishers bring in half for the barren time. | famine, game (types only), wrath | leanwild.test.ts | not yet |
| `leavehome` | 58 | A man home on leave comes home to his own door: the house of his family's name (its man where it has none, taking back a place the field gave another under his name; its son where it has one), else the nearest empty house, never a woman's alone; he walks there by the field's own move-in order. | game (types only), peoplenames | leavehome.test.ts | not yet |
| `militia` | 42 | A town's own men in its defence against a nation on the map: the men at home turn out by bands, each worth half a company, up to what a wall has room for; with no army in the town they are its companies on foot in the fight. | campaign (types only), leaderstay, township, tribes | militia.test.ts | not yet |
| `militiatoll` | 75 | What a town's own men lose in a battle on the map that nobody watched: the men in the fight (its bands, as many as the walls have room for), and how many of them fell, by the share of the companies' strength lost where they were the town's companies and by the works beaten down where they stood behind an army; half of a band lost is dead. A tribe's town is counted the same way by its own bands (`tribeFell`). | campaign (types only), campaignbase, mapbattle (types only), militia, township, tribes | militiatoll.test.ts | not yet |
| `oldfolk` | 73 | A taken town's old people: counted by the people they were, becoming the holder's as resentment eases and by marriage, and costing building while they resent it. | campaign (types only), oldmarks, township | oldfolk.test.ts | not yet |
| `queueddrill` | 139 | The map's side of the men in a town's queues: kept with its orders, and each sent out the season after as the man of a company of his own kind, that same man off the town's record. | ageing, armytown, campaign (types only), campaignbase, data, governor (types only), queuedmen, townmuster, township | queuedmen.test.ts | not yet |
| `queuedmen` | 54 | The men in a town's training queues as the player leaves it, read off the field: each by name, house, age and what he was being made into. The field's side; knows nothing of the map. | ageing, game (types only) | queuedmen.test.ts | not yet |
| `veteranhome` | 117 | A veteran is of his own house: the man of his army's roll who bears his name (or one drawn by lot), of that man's town and house; falling with the army on the map, he is lost as the veteran he was. | campaign (types only), campaignbase, champion (types only), township | veteranhome.test.ts | not yet |
| `feudwar` | 55 | A defied rival king may declare war as his feud with the player begins: the truce or alliance between them ends by his act, he hears of no truce while the feud runs, and it is told and chronicled. Called where a feud begins (aftermath) and where a truce is offered (campaign). | aftermath (types only), campaign (types only), intriguebase | feudwar.test.ts | not yet |
| `fieldcap` | 108 | How many of a town's people stand on the field at once: at most FIELD_CAP of its grown (the named, the widowed, the drifted and the men in arms always; the old in their share; couples, then singles, the youngest first; every child), the rest held on the record by age and joined back as the town is written back. | ageing, township (types only) | fieldcap.test.ts | not yet |
| `fieldstory` | 145 | A story afoot in a town, on the field of a visit there: a thief's robbed households marked on their houses (or the town's works), a soldier on guard by one taking the thief; a killer's suspects named among the town's grown villagers of their sex, each questioned once (`cmdQuestion`), an innocent maybe cleared and the guilty never. `storyOut` for the map. Nobody harmed; no child in it. | game (types only), studiesintown | fieldstory.test.ts | not yet |
| `tendintown` | 21 | The church's tending inside a town, as on the map: the sick and the grieving weigh less on its strain (driftintown.ts) and plague wears the sick down slower (game.ts); grain bought abroad acts there by being in the town's stores. | decrees, driftintown, game (types only) | tendintown.test.ts | not yet |
| `townlean` | 37 | Every town its own faith: each land's town leans a step a season up or down in standing, fixed by the seed and the land; a town far from its nation's standing is drawn back the harder (`pullFor`, read by townfaith.ts). | campaign (types only) | townlean.test.ts | not yet |
| `companyroll` | 130 | Each man of an army's roll is of a company by kind: the men of the companies lost on the map are the dead, last raised first; what an army fells is counted to the men who stood, by their kind's weight. | armytown (types only), campaign (types only), campaignbase, warhouse (types only) | companyroll.test.ts | not yet |
| `oldmarks` | 145 | A taken town's old people by name: the named of the town marked at its taking, the rest a count; who becomes the holder's drawn among them; on the field the named by name and the rest's share by lot, and the marked who live handed back by name. | campaign (types only), game (types only), naming, township (types only) | oldmarks.test.ts | not yet |
| `contagion` | 97 | Plague that comes from outside a town. | game (types only), quarantine, wrath | contagion.test.ts | not yet |
| `convoys` | 343 | Convoys by road between a people's own towns, or over a sea lane from a Harbour: food, goods or people, a season on the way, robbed by highwaymen on the road and pirates at sea (docs/DESIGN.md, "Stores"). | ageing, campaign (types only), campaignbase, founding, householdmove, larder, leaderstay, ownstudies, roadclash, roads, threats (types only), township | convoys.test.ts | not yet |
| `country` | 94 | Country that matters on the campaign map, and the works that open a closed border. | campaign (types only), campaignbase, ownstudies, prices | country.test.ts | not yet |
| `couriers` | 8 | Couriers, a study: decrees by messenger at three-quarters strength, not half. | campaign (types only), studies | couriers.test.ts | not yet |
| `court` | 228 | Where the leader is. A leader is one person in one place on the campaign map: a land of their people's, in its | campaign (types only), campaignbase | court.test.ts | not yet |
| `courtcall` | 84 | The leader's call and the leader's road, the rules court cannot ask for itself: an army holding a town that needs it is not called unless by name; a called army may cross a sworn ally's land without stopping; and a leader travelling alone by a road highwaymen sit on may be set upon, turned back and wounded. Registers itself with court's `CALLING` when loaded. | campaign (types only), court, rivalrule | courtcall.test.ts | not yet |
| `courtfield` | 178 | A story of the leader's house on the field of a visit to the court's town: who waits at the hall and the answers that may be given there (`cmdAnswer`), the great spoken of in a plot shown as grown villagers and watched by a soldier kept near (`courtTick`), and what came of it (`courtOut`). Nobody is spawned or harmed; no child is in it. | game (types only), studiesintown | courtfield.test.ts | not yet |
| `hallguests` | 47 | Who stands at the hall in a court visit: a rival's envoy and a suitor while unanswered, the daughter once asked; figures for the eye, no units. | courtfield, game (types only) | hallguests.test.ts | not yet |
| `noblefaith` | 40 | A noble's faith is his town's creed; one whose creed is not the nation's is of another faith than the leader, is six times as likely to be the angry noble who plots, and his plot is marked a plot over faith. | campaign (types only), creed, intriguebase (types only), nobles (types only), townfaith | claimants.test.ts | not yet |
| `wifetaken` | 152 | A lord plotting over faith may take the leader's wife into his house: told as the plain fact, it names him and becomes a stage of the plot with its own choices (demand her back with gifts, take him with an army standing in his town), a child that may be born there as a record only, and how it ends if nothing is done. | bandborn, campaign (types only), campaignbase, claimants, courtstory, intriguebase, kin, nobles, prices | claimants.test.ts | not yet |
| `courtstory` | 437 | Stories of the leader's own house, run through intrigue's plumbing: a rival ruler who wants the leader dead and the spouse for their own (threat, demand, a knife), a suitor for a grown daughter (ask her, give, decline, insult), and a noble plotting for the throne (whispers, clues, accuse, gifts, judgement, or a rising). Reads the household (kin, with the confidant's warning), the heirs (dynasty) and the nobles. | campaign (types only), campaignbase, court, dynasty, hall, intriguebase, kin, noblefaith, nobles, peoplenames, prices, spymasters, townfaith, township | courtstory.test.ts | not yet |
| `courtvisit` | 81 | The map side of courtfield: `courtForVisit` hands a visit the player's rival king, suitor or plot where the court is kept; `courtFromVisit` gives the answer by the map's own rule and shows the great true, checking each before believing it. | campaign (types only), campaignbase, courtfield, courtstory, intrigue, intriguebase (types only) | courtfield.test.ts | not yet |
| `creed` | 114 | Moral standing: one scale per people, moved by how they answer the dilemmas that come | data (types only), dilemmas | towncreed.test.ts, pagan.test.ts, sim.test.ts | not yet |
| `dilemmas` | 140 | More dilemmas, and which comes when: the moment each belongs to, and an order asked through without repeats. | creed (types only), game (types only) | dilemmas.test.ts | not yet |
| `visitguide` | 25 | A visit's own guide: what a visit is for, that the season waits, what goes home, how to leave. | atwork, game (types only), raiderguide (types only) | visitguide.test.ts | not yet |
| `askedhere` | 31 | The dilemmas a town has been asked, kept on its record from visit to visit and battle to battle. | campaign (types only), creed, game (types only) | askedhere.test.ts | not yet |
| `dilemmaacts` | 26 | What an answer to a dilemma does beyond goods and standing, through rules that exist: those held in a camp freed or sold on. | captivity, game (types only) | dilemmaacts.test.ts | not yet |
| `croprotation` | 18 | Crop Rotation, a study: harvests fail less often, on the map and in a town. | campaign (types only), game (types only), studies | foodstudies.test.ts | not yet |
| `data` | 1230 | Static game data: ages, units, buildings and technologies. | none | sim.test.ts (tables: none of its own) | not yet |
| `daylight` | 18 | How the hours run. A day is a set number of seconds, and the last three tenths of it are night; the player | none | daylight.test.ts | not yet |
| `deadtown` | 106 | A dead town (docs/DESIGN.md): a town with nobody in it stands open to any rival or band of marauders that comes for it. | armytown, campaign (types only), campaignbase, settlersfrom, township | deadtown.test.ts | not yet |
| `emptied` | 38 | A land a war or a band has emptied becomes an empty land: an open town nobody has come for, with no army of its people in it, is let go after a wait, and settlers of any people may found on it. A trial. | campaign (types only), deadtown | householdmove.test.ts | not yet |
| `decrees` | 164 | Decrees (docs/DESIGN.md, "Decrees"). The leader rules a town by decree: a cost in supplies, some seasons, in person or half as strong by messenger; each bends how the town drifts. | campaign (types only), couriers, court, grain, hall, nobles, nobleweigh, township | decrees.test.ts | not yet |
| `faithsites` | 39 | A Church or a Tavern built in a town (a battle fought in person, or a visit) is raised as the map's site of that kind, where the land has room and has none, so that it moves the town's faith. One table and one function, called where a battle's and a visit's buildings are kept. | campaign (types only), campaignbase | faithsites.test.ts | not yet |
| `faithhouse` | 54 | A people's house of faith in its own faith, by name, sign and kind of building: a Church under the cross, a Mosque (domed, or mud-brick for Mali), a Temple of the gods under a laurel wreath for Greece and Rome, a Temple of the Nile, a Ziggurat Shrine, a Fire Temple, a Shrine, an Ancestral Hall, a Sacred Cairn, a Hof, the Judges' Temple; the church's site, decrees and field name told in the people's own words. Only the look: the rules' building is the church everywhere. | none | faithhouse.test.ts, faithhouses.test.ts | not yet |
| `founding` | 117 | Settlers found a new town on an empty land: what an empty land is, and claiming it when the settlers come in. | campaign (types only), township, wilds | founding.test.ts | not yet |
| `claimants` | 104 | The record of children who may one day claim a throne: born to the leader's wife in a lord's house or among a band that holds her, never named or shown until of age (HEIR_AGE); a child comes home with a wife got back from a band and claims nothing. | bandborn, campaign (types only), chroniclethreads, dynasty, peoplenames | claimants.test.ts | not yet |
| `claimantjudged` | 94 | When the seat of a claimant's rising is retaken, whoever led it waits on the leader's judgement as a plotter found does, as a stage of a plot with one name in it: a grown claimant, or the lord who proclaimed a child (never the child, never a band); pardon, banishment or death, each with what it does to the lord, the creed and the other nobles. | campaign (types only), campaignbase, claimants (types only), courtstory, intriguebase, nobles, townfaith | claimants.test.ts | not yet |
| `claimantrising` | 190 | Risings for a claimant to the throne: whoever holds a recorded child (the lord, or the band) proclaims it heir from half a year after the birth and raises the town it is in with the towns beside it of another creed that are not held down (a third of the people's towns at most, never the capital) as free towns marked the claim's; of age, the claimant is named and leads that rising or raises their own; a rising ends put down, fallen to others, lapsed after ten years, or with a grown claimant on the throne where the leader is dead with no heir of age. | campaign (types only), campaignbase, chroniclethreads, claimantjudged, claimants, court, creed, dynasty, freetown, noblefaith, nobles, townfaith | claimants.test.ts | not yet |
| `claimantcaptain` | 69 | The one who leads a claimant's rising on the field by name: a turned-out soldier of the risen town (or one more before its hall) is the grown claimant, the lord who proclaimed the child, or the band's chief; the child never. | campaign (types only), claimantrising, game (types only) | claimantcaptain.test.ts | not yet |
| `freetown` | 137 | Free towns: a town that rises is nobody's with its people in it, can be taken by force, and may come back by treaty to the people it left. | campaign (types only), prices, township | freetown.test.ts | not yet |
| `grain` | 78 | Grain bought abroad: the food decree's new food from outside the nation, paid in gold, dearer in a famine year; the computer buys only out of plenty. | campaign (types only), larder, plenty, township | grain.test.ts | not yet |
| `drift` | 174 | Drift on the map (docs/DESIGN.md, step 5): a strained town's people drift a few a season, women to the tavern and men to the mines, kept as counts on its record; its standing falls, and with care they come back. Men at the mines leave the walls thin (`watchOf`). | campaign (types only), churchtavern, court, creed, decrees, grief, infirmary, leaderstay, monastery, nobles, notableweight, portrait, townfaith, township | drift.test.ts | not yet |
| `driftintown` | 174 | Drift inside a town (docs/DESIGN.md, step 5): the town turns out as the map left it, who works where shifts under pressure (low morale makes a raid weigh more), decrees are felt, the computer leaves the drifted be, and who is drifted at the end is written back. | campaign (types only), churchtavern, data, decrees, drift, famine, game (types only), grief, studiesintown, township | driftintown.test.ts | not yet |
| `dynasty` | 232 | Who leads a people when their leader falls. Every leader keeps a house: children are born to it as the turns go | ageing, bothhouses, campaign (types only), champion, court, hero, kin, leaders, naming, peoplenames, powers | dynasty.test.ts | not yet |
| `encounter` | 103 | Meeting them face to face (docs/DESIGN.md): who stands in the window over the map when an army meets a band (its leader, some of his men by its strength, a few of its captives seated and covered, never a child) or a story waits on the leader's word (a suitor, a rival's envoy, a plotter found, a thief caught), and how each is dressed. Read only. | campaign (types only), intriguebase (types only), threats (types only) | encounter.test.ts | not yet |
| `famine` | 188 | Famine: what happens to a town that has run out of food. | croprotation, data, game (types only), granary, salting, wrath | famine.test.ts | not yet |
| `feastdays` | 19 | Feast Days, a study: once a year every town of the nation is lifted toward the holy way. | ageing, campaign (types only), studies, townfaith | feastdays.test.ts | not yet |
| `folk` | 145 | What the common people say: villagers at every job and warriors of every arm, each in three tempers. A town that | none | sim.test.ts (none of its own) | not yet |
| `folkfaith` | 197 | The common people's lines that speak of faith, in each people's own (the One God, God as Muslims pray to Him, the gods of the Nile, Babylon, Greece, Rome and the North, the Wise Lord and the sacred fire, the kami and the Buddha, Heaven and the ancestors, the Eternal Blue Sky), each recorded under the script's name with the faith after it. | folk (types only) | folkfaith.test.ts | not yet |
| `fieldwork` | 28 | A farmer works in among the rows of the field, from place to place as the loads come in, not at its fence; the yield is unchanged. | none | fieldwork.test.ts | not yet |
| `stylesigns` | 49 | Tells the field, as a plain event, where a play style's rule acts (a Builder's building mending, the Faithful healed, a Trader's market earning, a Farmer's farm finished, a Scholar's study, a Warrior's kill that counts, a Raider's villager carried off), at most once in a while for one spot; the sign each shows. | data (types only) | stylesigns.test.ts | not yet |
| `game` | 3286 | Core simulation. No rendering or DOM access in here so it can run headless. | ailing, atwork, battlefolk, battleleader, beaten, bereft, birthonly, calamity, captivity, carriedout, champion, churchtavern, claimantcaptain, clergywork, contagion, courtfield, creed, darkarts, data, daylight, dilemmaacts, dilemmas, driftintown, dyingout, fieldcaravan, fieldstory, fieldwork, firstlay, fleets, formations, furlough, grief, hallfield, handroads, hero, household, infirmary, lastperson, leanwild, map, marauders, midwifery, mill, muster, namesakes, notableweight, nursery, oldmarks, orphantown, ownstudies, path, peoplenames, pickman, placebar, plainhealer, queuedmen, raidertown, roofs, seasonsky (types only), siegecamp, siegelift, slopes, soldiernames, steward, studiesintown, stylesigns, tavernfall, temper, tendintown, township, tribenames, tribes, unlaid, warrecord, waterlay (types only), well, widowtown, wrath | sim.test.ts (the hub: none of its own; each system it calls has its own) | not yet |
| `fortkeep` | 52 | A Fortress's garrison on the map: up to two companies of the town's own men, as many as it can spare, standing as foot when a band strikes where no army holds the town; and a Fortress with anyone to hold it is a stronghold, raided but never taken. Read by threats (`defenceOf`, `strike`) and through the defence's record by raidclash. | armytown, campaign (types only), fortress, township | fortkeep.test.ts | not yet |
| `fortress` | 30 | The Fortress as a stronghold: the land's own work or one standing in the town; its people shelter in it when a band strikes (half as many die, half as many are carried off). Reads only the land's works and what stands in the town. | campaign (types only), studies | fortress.test.ts | not yet |
| `governor` | 196 | A town left to itself (docs/DESIGN.md): it carries on with its last orders, its people work where they were set (the shares harvest.ts splits a town's yield by), and a governor answers its wants out of its own stores. | acts, campaign (types only), campaignbase, data, givenorders, granary, infirmary, larder, leaderstay, mill, oldfolk, ownstudies, plenty, seasonfolk, stewardship, townorders, township, well | governor.test.ts | not yet |
| `governworks` | 80 | The player's governor and the works of rule and faith: a Hall, a Manor or a Monastery raised, and studies learned, by the town's standing orders, out of plenty only. | campaign (types only), creed, data, manor, plenty, studies, townfaith, townorders, township, townworks | governworks.test.ts | not yet |
| `grief` | 73 | Grief (docs/DESIGN.md, "Grief"). A home that loses its mother or its sons works more slowly for a time, most in a town of middling morals; a bereaved town grieves for seasons on the map. | game (types only), infirmary, notableweight, township (types only) | grief.test.ts | not yet |
| `hall` | 28 | The Hall of Judgement, the leader's seat in a town: a decree to its town has full strength, its plotters and killers are found as with the court there, the nation's nobles cool faster and an angry lord there keeps his watch; rivals raise one in their chief town. | campaign (types only), court, studies | hall.test.ts | not yet |
| `harvest` | 103 | Income credited to the land that yields it, the only place a town earns: the land's yield as far as the town has hands, split by where its people work and what the land leans to (docs/DESIGN.md, "Stores"). | campaign (types only), campaignbase, governor, larderwatch, leaderstay, mapgrief, mill, nobles, stores, township, winter | harvest.test.ts | not yet |
| `heralds` | 30 | Heralds, a study taught at the Watch House: the record of which towns were warned of a band a season before, and the half company a warned town adds to its defence. The season's telling is raidnews' `heraldSeason`. | campaign (types only), studies | heralds.test.ts | not yet |
| `hero` | 102 | A nation's leader on the field: who they are, how they were made, and what the battles they live through do for them. | leaders | herolook.test.ts, leader-play.test.ts, leader-rise.test.ts | not yet |
| `housekeep` | 33 | A house once named on the map is kept by name with everyone home while its town has a home for it (one to each woman), the houses longest from war going first. | township (types only), warhouse (types only) | housekeep.test.ts | not yet |
| `household` | 103 | A man at war is still of his house (docs/DESIGN.md). | game (types only) | household.test.ts | not yet |
| `hiredhome` | 37 | Men of no town in an army sent home settle in its chief town (or where it stands), as grown men at the middle age of its townsmen, where they used to vanish. | ageing, campaign (types only), township | hiredhome.test.ts | not yet |
| `inn` | 46 | The Inn, one of the buildings raised on a town's record: where the studies of the road are taught, and begun by a town's governor, out of plenty, when highwaymen sit on its road. | campaign (types only), data, governor, plenty, townworks | roads.test.ts | not yet |
| `intrigue` | 387 | Stories inside the story (docs/DESIGN.md, Relationships): personal matters that come by chance, run over seasons, have a choice or a search, and leave a mark on the record. The plumbing, and the two stories of a town: a thief who keeps robbing the same houses and a killer found by clues. The stories of the leader's house are run through it (courtstory). One call a season (`intrigueSeason`), `choicesFor`/`choose` for the player, `intrigueNews` for the report. `culprit` is the sim's own: never shown. | aftermath, ageing, campaign (types only), court, courtstory, hall, intriguebase, larder, peoplenames, townfaith, township, townwatch, watchhouse, watchtally | intrigue.test.ts | not yet |
| `granary` | 55 | The Granary: food kept from spoiling longer and a failed harvest drawing less on the map; a bare store lasting longer in a town (docs/DESIGN.md, "Buildings and research that answer the systems"). | campaign (types only), game (types only), townrecord, township | granary.test.ts | not yet |
| `infirmary` | 52 | The Infirmary: plague takes fewer and grief passes sooner, on the map and in a town. | campaign (types only), game (types only), townrecord, township | infirmary.test.ts | not yet |
| `tavernrumour` | 79 | Rumours heard in the player's Taverns: a true line about a rival town near, told with the season's news, rarer in an honest house. | campaign (types only), tavernfall, townfaith | tavernrumour.test.ts | not yet |
| `clergywork` | 43 | Monks and nuns at their work in a town: nuns nurse the sick where an Infirmary stands, monks speed research. | game (types only) | clergywork.test.ts | not yet |
| `churchtavern` | 54 | A Church beside a Tavern tempers it: less of the standing drawn down, fewer drifting to drink, on the map and in a town. | campaign (types only), campaignbase, game (types only) | churchtavern.test.ts | not yet |
| `inyears` | 13 | How long until something, said as a person would: "in 14 years", "next season". | ageing | inyears.test.ts | not yet |
| `keeper` | 18 | A town kept in peace: a campaign town kept by the computer with nobody hostile about raises no works of war (docs/DESIGN.md, "A visit"). | game (types only) | keeper.test.ts | not yet |
| `intriguebase` | 89 | What every story inside the story is made of: the record of a story, its people and notes, and the four things every kind does (take its own chance, begin, say something, end, with those who must be told of an ending). Below the stories, so that they do not import one another in a ring. | campaign (types only) | intrigue.test.ts, courtstory.test.ts, aftermath.test.ts | not yet |
| `kin` | 256 | The leader's household and inner circle: a husband or wife (the heirs' other parent, held like any captive when carried off), and up to four close to the leader with loyalty and mood, each post doing a little by loyalty (docs/DESIGN.md, "Relationships"). | campaign (types only), campaignbase, larder, peoplenames, portrait (types only), threatsbase, townfaith, township | kin.test.ts, kinposts.test.ts | not yet |
| `larder` | 121 | Towns eat their food on the map: each season a town's people eat from its food store, a town that cannot goes hungry, and one hungry long enough loses its grown people, never a child (docs/DESIGN.md, "Stores"). | campaign (types only), granary, ledger, salting, township | larder.test.ts | not yet |
| `larderwatch` | 61 | A warning before a town's granary empties: what the town eats against what its land brought in at the last harvest (noted by harvest.ts), with food on the road to it counted, gives the seasons until it cannot eat in full; the towns within two seasons of it, and the warning in words for the season's report and the land's panel. | campaign (types only), larder, township | larderwatch.test.ts | not yet |
| `leaderstay` | 84 | The leader's stay in a town, by calling: every leader draws it toward its nation's standing; a Steward's work, building and grief, a Warlord's strain, unrest beside it and the town's men, a Strategist's roads and readiness against a band, each the same weight. Readers for townfaith.ts, harvest.ts, governor.ts, drift.ts, unrest.ts, militia.ts, threats.ts and convoys.ts. | campaign (types only), campaignbase, court, hero (types only) | leaderstay.test.ts | not yet |
| `leaders` | 547 | The leader of each civilisation and everything they say. | none | powers.test.ts, sim.test.ts | not yet |
| `ledger` | 26 | The season's ledger: born, came of age, died of age or hunger, fell with the army, noted by town as the season's systems do it, for the season's report. | campaign (types only) | seasonreport.test.ts | not yet |
| `lessons` | 68 | Lessons for the moment they are needed: things a first battle's list of steps cannot teach in order, because | calamity, creed, data, famine, game (types only), hazardlessons, powers | lessons.test.ts | not yet |
| `aiground` | 52 | The computer and the ground, the night and the weather in a battle: high ground to gather on, holding back while weaker. | game | aiground.test.ts | not yet |
| `aisiting` | 101 | Where the computer sets its buildings down: off its roads, fields on good level ground, towers and its palisade on rising ground, nothing on steep ground. | game (types only), map | aisiting.test.ts | not yet |
| `ailing` | 53 | A town comes to a battle or a visit as sick and as hungry as the map has it, through the setup bag: plague in the land sends a few of its grown in sick, hunger or a failed harvest that season sends its people in hungry. | campaign (types only), contagion, famine, game (types only), township | ailing.test.ts | not yet |
| `aiplague` | 30 | The computer's armies and plague on the map: sick lands last, out of a sick land, not through one. | campaign (types only) | aiplague.test.ts | not yet |
| `siegeretreat` | 63 | A besieger thrown back falls back with what the assault left of it: companies counted from a battle's survivors, to its own land, with its leader if they lived. | armytown, campaign (types only), campaignbase, data | siegeretreat.test.ts | not yet |
| `formations` | 78 | A group in a line, a column or a loose order: each man's place laid out facing the way it goes, the slowest man's pace, facing that way on arriving. | none | formations.test.ts | not yet |
| `slopes` | 21 | A march uphill slower by the grade, downhill a little quicker. | none | slopes.test.ts | not yet |
| `battlescars` | 109 | What a battle settled on the map leaves on a town (works beaten down, houses scorched) and the governors finishing half-built works out of the towns' stores. | campaign (types only), data, game (types only), intriguebase, mapbattle (types only), township | battlescars.test.ts | not yet |
| `chroniclethreads` | 81 | The chronicle read as one story: lines dated by year and season, rivals' great battles heard of, a story's later lines saying when it began. | ageing, battlehooks (types only), campaign (types only) | chroniclethreads.test.ts | not yet |
| `missionstory` | 64 | A thread through the missions: three tied by the riders of the steppe, each with a line before and after, and the next offered. | none | missionstory.test.ts | not yet |
| `hazardlessons` | 84 | Lessons for what befalls a battle from outside: a rival's Wonder, plague, marauders, a storm, the leader's first power. Told once each, in a field battle too. | captivity, champion, data, game (types only), hero, lessons (types only), powers, rescue, well | hazardlessons.test.ts | not yet |
| `raiderguide` | 44 | The first-steps guide for a war band in the open: take people alive, put the band to work, settle when you choose. | data, game (types only) | raiderguide.test.ts | not yet |
| `manor` | 29 | The Noble's Manor: in a town of twelve grown or more, its lord grows more content each season but every decree moves him twice as far. | campaign (types only), data, studies, township | manor.test.ts | not yet |
| `map` | 316 | Procedural, point-symmetric two-player map generation. | waterlay | sim.test.ts, missions.test.ts (none of its own) | not yet |
| `mapbattle` | 378 | A battle on the map that nobody watches, fought out and not summed: rounds by kind of company and what beats what, a town's works, when a side breaks (veterans, leaders, walls, creed), the rout, losses by kind, where the beaten go, the account of it, and the same fight on an even day for whoever chooses where to march. | armytown, campaign (types only), campaignbase, creed, dynasty, militia, naming, seatedleader, sieges, townfaith, warhouse | mapbattle.test.ts, mapbattlecampaign.test.ts | not yet |
| `mapgrief` | 33 | Grief in a town's season of work on the map: the homes grieving a fresh loss (a man or son fallen with the army, a known person lost) while the town grieves, their share of its homes worked GRIEF_SLOW more slowly, as grief.ts in a town; read once by harvest.ts. | campaign (types only), grief, townfaith, township, warhouse | mapgrief.test.ts | not yet |
| `marauders` | 218 | The marauders over a long battle: they keep pace with the age, and a burnt camp is not the end of them. | captivity, data, game (types only) | marauders.test.ts | not yet |
| `midwifery` | 18 | Midwifery, a study: fewer of the births that are due fail to come, on the map and in a town. | campaign (types only), game (types only), studies | foodstudies.test.ts | not yet |
| `migration` | 233 | People moving between towns by road of their own accord: families leave a crowded, hungry, sick, raided or grieving town for one of their people with room and bread. | campaign (types only), convoys, founding, householdmove, plenty, seasonfolk, townorders, township, wilds | migration.test.ts | not yet |
| `householdmove` | 73 | A household leaves a town together: the couple, their children (as counts) and one of the old; a known woman's house goes whole, her man staying with the army if he is away; as it comes in, its record of men at war and their places on the armies' rolls move to its new town. | campaign (types only), township | householdmove.test.ts | not yet |
| `mill` | 45 | The Mill: a farmed land yields more food on the map; farms are worked faster in a town. | campaign (types only), game (types only), townrecord, township | mill.test.ts | not yet |
| `monastery` | 26 | The Monastery or Convent, the Virtuous town's great house: on the map it draws its town toward the holy way, cares for it and tends its sick and bereaved. | campaign (types only), studies | monastery.test.ts | not yet |
| `muster` | 51 | A soldier costs a person (docs/DESIGN.md, step 1). | data (types only), game (types only), siegecamp | muster.test.ts | not yet |
| `naming` | 113 | Your own names: the name the player gives their people and their ruling house, made safe and kept, used where the game names them. | campaign (types only), data, leaders | naming.test.ts | not yet |
| `peoplenames` | 111 | Each people names its own: forty given names a sex and thirty houses for each of the fifteen peoples, and the band folk's. | none | peoplenames.test.ts | not yet |
| `nationcolours` | 26 | The colour each people wears: its own, unless another in the same world wears one too like it, when it takes a spare colour clear of all. | none | nationcolours.test.ts | not yet |
| `nextage` | 30 | What the next age opens: the works raised on the map and the studies a nation may learn in it, told beside the age button so that saving for it is a choice the player can see. | campaign (types only), campaignbase, data | nextage.test.ts | not yet |
| `nobles` | 253 | Nobles (docs/DESIGN.md, "Relationships"): the inner circle, each town's famous captain and matron, and a lord for a town of a size, each with a leaning and a mood; a decree pleases or angers them, and an angry noble's town works slacker, drifts readier and keeps a thinner watch while the leader is away. | campaign (types only), court, decrees (types only), hall, kin, manor, oaths, ownstudies, peoplenames, township | nobles.test.ts | not yet |
| `nocarry` | 70 | The decree that forbids carrying people off: a law of the whole nation, given once and standing until lifted, under which its armies lead nobody away from a town they take (carriedoff reads `Faction.noCarry`). Over a people whose standing would have them carry off, the worldly and martial lords resent it a little each season and the pious and kindly warm to it. | campaign (types only), carriedoff, creed, nobles | nocarry.test.ts | not yet |
| `nobledeal` | 165 | The leader's dealings with a noble: summon, gift, post, marriage into the house, stripping of lands; each costs, moves the mood and lasts. | campaign (types only), dynasty, nobles, nobletemper, prices, township | nobledeal.test.ts | not yet |
| `nobleacts` | 122 | Nobles who act: a content lord sends men to a struck town or gold for a war, an angry one withholds his due or joins a plot afoot. | ageing, campaign (types only), nobles, rivalrule, township | nobleacts.test.ts | not yet |
| `nobleweigh` | 55 | Rulers who weigh their nobles: angry lords make a computer-led ruler warier of marching and readier for a truce; it leaves out decrees that would anger a lord, and deals with its angriest. | campaign (types only), decrees (types only), nobledeal, nobles, plenty, stores | nobleweigh.test.ts | not yet |
| `nobletemper` | 110 | What a noble remembers: war, their town struck or quiet, the leader's heed or neglect, taxes; a temper that sets where their mood settles and fades over years. | campaign (types only), court, nobles, township | nobletemper.test.ts | not yet |
| `notable` | 50 | Notable people: the few a nation knows by name. Nothing here decides who they are; it reads what the rules | champion, game (types only), hero | notable.test.ts | not yet |
| `notableweight` | 118 | The weight of notable people: a home known for what it carries in, a veteran of their own town, and the grief and dip in standing a loss leaves (plain numbers for drift.ts to read). | game (types only), township (types only) | notable-weight.test.ts | not yet |
| `nursery` | 52 | Children. A child is never a unit on the map: it is an entry in the record of the house it was born to (its | ageing, data | nursery.test.ts | not yet |
| `oaths` | 8 | Oaths of Fealty, a study: the nation's nobles' moods swing less, for decrees and hard seasons alike. | campaign (types only), studies | oaths.test.ts | not yet |
| `orphans` | 77 | Children taken in: a town left with no grown people sends its children, with their ages, to the nearest town of its own people, or of the nearest other people if it has none (docs/DESIGN.md, "Children are never shown"). | ageing, campaign (types only), township | orphans.test.ts | not yet |
| `ownstudies` | 111 | Each people its own (docs/DESIGN.md): the one study each nation alone can learn (a study of studies.ts's, marked with its nation), who may learn it, and what it is worth on the map to the system it answers (births, resentment, unrest, stores, defence, governors, convoys, nobles, faith, country). | campaign (types only), data, studies, township | ownstudies.test.ts | not yet |
| `path` | 266 | Grid A* with rectangle goals and line-of-sight smoothing. | none | path.test.ts, sim.test.ts (through game: none of its own) | not yet |
| `physicians` | 17 | Physicians, a study after Herbalism: plague takes fewer on the map; healers heal faster in a town. | campaign (types only), studies | foodstudies.test.ts | not yet |
| `pilgrimage` | 8 | Pilgrimage, a study: the nation's towns are drawn toward its faith the faster. | campaign (types only), studies | pilgrimage.test.ts | not yet |
| `places` | 58 | The named places of a world and what is befalling the whole world, out of the campaign hub: `placesOf`, `placeAt`, `placeGood`, `placeWorth`, `worldNow`. Chosen and named by the seed, the same in every telling. | campaign (types only), campaignbase, story | places.test.ts, story.test.ts, sim.test.ts | not yet |
| `plaguenamed` | 52 | The dead of plague on the map by name where they are known: each one dead is a known person of the town at home as likely as the known are among its grown, the one known longest taken, marked lost to plague, told and chronicled. | campaign (types only), township | plaguenamed.test.ts | not yet |
| `plenty` | 80 | What a town or a nation may spend on a work or a study and what it must keep: one rule for every governor's and rival's purchase. | campaign (types only), township | plenty.test.ts | not yet |
| `portrait` | 257 | Portraits: which woodblock icon stands beside a person, and which marks sit over it (docs/DESIGN.md, "Icons tell | campaign (types only), champion, conquered, faces, famine, game (types only), grief, household, notableweight, township | portrait.test.ts | not yet |
| `faces` | 129 | A face of one's own: a plain description of a grown person's face (colouring, hair, beard, lines, shape, headgear by station, feeling), seeded by who they are; src/client/facedraw.ts draws it. | portrait (types only) | faces.test.ts | not yet |
| `powers` | 95 | What a leader learns as they rise. At three ranks of veterancy (Blooded, Veteran, Legend) a leader comes into one | data, hero, steward | powers.test.ts | not yet |
| `prices` | 214 | Prices by kind: a thing bought on the map is paid in what it is made of, from the town where it is done; what it lacks comes by road from the nation's other towns at a cost, or is made up in other goods traded at a loss, or the work waits (docs/DESIGN.md, "Stores"). | campaign (types only), convoys, larder, plenty, sentfor, stores, township | prices.test.ts | not yet |
| `sentfor` | 99 | Goods sent for: a thing bought at a town (a building, a company, a leader, an age, a work across a border) whose town lacks the goods waits for them to come in by road as convoys, a season on the way and robbable, the town's own share set aside meanwhile; when they are in it is done, if the town can pay. Keeps what waits and sends the convoys; campaign.ts says how to do each thing. | campaign (types only), convoys, township | sentfor.test.ts | not yet |
| `primer` | 117 | Teaching the campaign: what a new player is told to do first, and the page that explains the rest. | beaten, campaign, campaignbase, champion, creed, data, dominion, hero, nextage, powers, story, townworks, visit | primer.test.ts | not yet |
| `quarantine` | 20 | Quarantine, a study: plague crosses between towns less on the map, and from strangers less in a town. | campaign (types only), game (types only), studies | foodstudies.test.ts | not yet |
| `raidclash` | 145 | A raid fought out a round at a time with the map's clash: the band against the town as it turns out (its own men as militia bands beside any army, its works, walls and guard as the place), read as held, raided or taken by who broke and how cheaply. It decides a strike on a town (threats.ts), a garrison pressed in it loses companies, and the town's dead are what its bands lost. The fight as it was before (the town one weight) is kept for the report. | mapbattle | raidclash.test.ts | not yet |
| `raidfought` | 160 | A band's strike on a town of the player's as a battle the player may enter: the strike waits as a pending battle (`Pending.raid`), left to the town it falls by threats' `strike` as always, and fought in person it is the town as battleConfig lays it against the band's companies alone, written back by the strike's own rule (held, raided or taken by what the fight cost the band; captives, spoils, the garrison's companies, the leader). Passed to threats' `strikeSeason` by bandseason; called by campaign (`battleConfig`, `resolvePending`, `finishBattle`). | bandmarch, campaign (types only), campaignbase, court, data, dynasty, hero, mapbattle, raidclash, threats | raidfought.test.ts | not yet |
| `raidertown` | 28 | A raiding people at home: a side handed a town of the map begins as a town, with its hall and its people, and not as a war band. | none | raidertown.test.ts | not yet |
| `raidnews` | 70 | The season's news of the bands as plain data, one entry point (`seasonNews`) for whatever shows it; and a campaign's tally. | campaign (types only), heralds, threats | raidnews.test.ts | not yet |
| `rescue` | 130 | Getting captives back without burning the camp down, and what a camp's keeper should do about it. | creed, game (types only), path | rescue.test.ts | not yet |
| `reservecamp` | 20 | A reserve army joining a campaign siege is marked in its set-up: its camp is laid with no villagers (siegecamp.ts) and it is not counted as died out (dyingout.ts). | game (types only) | reservecamp.test.ts | not yet |
| `rivalaim` | 71 | Where a rival marches (docs/DESIGN.md): the lands in reach ordered by the defence to be met, weighed by the country's march and yield and by how far the town's faith stands from the nation's. | campaign (types only), campaignbase, country, townfaith | rivalaim.test.ts | not yet |
| `rivalcaptives` | 47 | A rival whose people are held weighs the clock on the map: the land holding its carried-off goes first in its march in their last seasons, and it goes after a band holding its own at odds that shorten as their seasons run out. | campaign (types only), carriedoff, threats (types only), threatsbase | rivalcaptives.test.ts | not yet |
| `rivalhunt` | 132 | A computer people marches to hunt a band: one that holds its people (if an army can be there before their time is up) or has its place in its land, a land a season through its own lands to where the season's hunt gives battle; and it puts first, of the lands it could march on, a camp of the marauders that holds its people or has struck its towns. | bandfight, campaign (types only), campaignbase, reckon, rim, rivalcaptives, threats (types only), threatsbase | rivalhunt.test.ts | not yet |
| `rivalrule` | 382 | Rivals live by the same rules (docs/DESIGN.md): a computer-led nation's towns on record, idle armies sent home, names made on the map, garrisons where its towns need them, and an age lived in before the next is taken. | armytown, campaign (types only), campaignbase, conquered, founding, peoplenames, places, reckon, seasonfolk, stores, threats, township, uniquecompany, veteranhome | rivalrule.test.ts, rivalages.test.ts, poormuster.test.ts | not yet |
| `rivalstock` | 115 | A rival's foresight with its stores: a season before it enters its next age or opens the border it has chosen, it sends what the paying town lacks of the price ahead by convoy from its towns with most to spare; and it raises a house of its faith or a harbour in the town that can pay out of its own stores. | campaign (types only), convoys, country, prices, rivalrule, township | rivalstock.test.ts | not yet |
| `rivalstories` | 130 | Stories inside the story for rival rulers: the thief and the killer begin in their towns by the player's chances, are judged by the ruler's lights, and are told to the player only where he could hear of them. | campaign (types only), courtstory, creed, intrigue, intriguebase, townfaith, township, townwatch | rivalstories.test.ts | not yet |
| `roadclash` | 132 | A band meets soldiers on the road, fought out with the map's clash: the band as in a raid, the soldiers as their own companies at the strength the map gives them (and, at a road's end, the wayfarers as the place); who broke, what each lost, and what the band comes away with. It decides an army's fight with a band (bandfight.ts), an escort's for a convoy or a caravan (`escortFight`, called by convoys.ts and caravans.ts) and a strike at a road's end (threats.ts); the old rule is tallied beside it for the report. | armytown, campaign (types only), campaignbase, mapbattle, raidclash | roadclash.test.ts | not yet |
| `roads` | 37 | What an Inn and two studies do for a convoy: an Inn on its road halves the chance a band meets it, Escorts halve what a band takes, Paved Roads bring it in at once. Readers for convoys; reads only studies. | campaign (types only), studies | roads.test.ts | not yet |
| `roll` | 93 | The roll of a people for the "Your people" screen: leader and house, heirs, the known by name town by town, men away, captives, the lost; children only counted. Read only. | aftermath, ageing, armytown, campaign (types only), campaignbase, carriedoff, dynasty, hero, kin, naming, nobles, portrait (types only), threats, township | roll.test.ts | not yet |
| `rim` | 114 | A rim of true wilderness: a few new lands added at the map's edge when the world is made, empty and nobody's for good; drawn from the seed by its own hash, so no land the world had is changed. A rim land is nobody's neighbour (`adj` empty): it has `down`, the lands it looks down on, read through `outOf` by the bands' rules alone. `landsWithin` counts the lands that are not of it. | campaign (types only), campaignbase | rim.test.ts | not yet |
| `ruin` | 124 | A world that ends in ruin (docs/DESIGN.md, the owner's word): twenty years with no people gaining ground while the bands hold much of the map, and the campaign is over with no winner. | campaign (types only), wilds | ruin.test.ts | not yet |
| `rule` | 95 | The season's turn for the works of rule, law, nobles and faith: what a rival nation raises of them (hall.ts and the rest). | campaign (types only), creed, data, feastdays, manor, plenty, townfaith, township, townworks | hall.test.ts | not yet |
| `salting` | 20 | Salting and Smoking, a study: stored food spoils slower on the map; a bare store lasts longer in a town. | campaign (types only), game (types only), studies | foodstudies.test.ts | not yet |
| `scenario` | 439 | Scripted missions: a fixed set-up, a list of objectives and a win or lose condition. | creed, game (types only), map (types only), raiderguide, rescue | missions.test.ts | not yet |
| `seasongain` | 31 | What a season truly added to what the player has to spend, for the map's bar: the figure as the turn ends against the figure as the next opens (`turnLeft`, `turnOpened`, `lastGain`), so eating, spoilage, upkeep and the governors' building are in it and the player's own spending is not. | campaign (types only) | seasongain.test.ts | not yet |
| `seasonsky` | 89 | The season a battle is fought in, as a look (ground, leaves, snow), and when thunder strikes and how loud the weather is. | ageing | seasonsky.test.ts | not yet |
| `winter` | 61 | Winter felt on the map, where a land has one (not the desert): an army that marches in winter is snowbound the season after and marches once that season; fields yield less; rivers freeze, so lands a river parts border one another that season (read by campaignbase.ts reach). | campaign (types only), seasonsky | winter.test.ts | not yet |
| `seasonfolk` | 121 | A town's people on the map, season by season (docs/DESIGN.md, "People come only by birth"). | ageing, campaign (types only), creed, data, ledger, midwifery, ownstudies, townfaith, township | births.test.ts, persistfolk.test.ts | not yet |
| `seasonreport` | 191 | The season's report: what changed in the player's nation in a season and for whom (people, captives, raids, drift, towns, notable people, the leader's household), from a snapshot and the ledger. | campaign (types only), campaignbase, carriedoff (types only), deadtown, intrigue (types only), kin, larderwatch, ledger, migration, ruin, threats, township | seasonreport.test.ts | not yet |
| `sieges` | 36 | A siege nobody watches: a walled, manned town's defence counts for more when the battle is settled on the map. | campaign (types only), data, township | sieges.test.ts | not yet |
| `slots` | 107 | Several campaigns: worlds kept side by side in the browser's storage (the old `rtsv-campaign` key is the first), which one is played, a new one begun without losing the rest, one deleted. Works on anything shaped like storage. | armytown, campaign (types only), campaignbase, naming | slots.test.ts | not yet |
| `spymasters` | 7 | Spymasters, a study: a plot against the leader is found the sooner. | campaign (types only), studies | spymasters.test.ts | not yet |
| `stewardship` | 8 | Stewardship, a study: a better governor, who finishes what he has begun half again as fast. | campaign (types only), studies | stewardship.test.ts | not yet |
| `styleplay` | 120 | The battle's computer player plays to its people's rule: what the rule makes worth building ahead of the common order (traders' markets, the Faithful's church, builders' towers), a farm for room where others raise a house (farmers), nothing kept back for a technology (scholars), who is sent out of the fight and where (the Faithful's hurt to their church, a warrior people's hurt veterans home), and how the rule shapes the war (builders sit out a siege, scholars time an attack to an age, warriors field fewer and better men). Answers only; ai.ts gives the orders. | data, game (types only) | styleplay.test.ts | not yet |
| `storypolicy` | 67 | A plain way of answering the stories inside the story for a player the computer plays (`sensibleAnswers`): watch, accuse only when one is left, defy and guard, ask the daughter, informers and a pardon; a tale as the people lean, when the supplies can be spared. Never reads who the culprit is. Used by the health report (STORIES=answer). | aftermath, campaign (types only), campaignbase, creed, intrigue, petitions, royalmarriage, storyturn, temper, tradedeal | storypolicy.test.ts | not yet |
| `stores` | 107 | Stores replace supplies (docs/DESIGN.md, "Stores"): a nation's supplies are what its towns hold above their working stock, and every gain or loss on the map is carried into the towns. | campaign (types only), township | stores.test.ts | not yet |
| `steward` | 62 | The Steward, a third calling for the leader: a hero whose presence makes villagers near them gather and build faster, whose call (Man the walls) spares buildings near them harm, and their three pairs of powers. Read by powers.ts (calls and powers) and game.ts (work and harm). | data, game (types only) | steward.test.ts | not yet |
| `epilogues` | 144 | A campaign's own ending, on the last page once it is over: how each thread of tales ended (its fate), was left unfinished or was still open; what became of the people of note (the ruler and the line, the husband or wife, grown heirs, the circle, lords and any plotter, grown claimants, the most renowned of the towns, living and lost); and the houses (the ruling house, the houses it married into, the great houses of the towns). Only the grown are named. Puts itself on `story.LAST_PAGE`. | campaign (types only), chroniclethreads, dynasty, kin, nobles, story, talethreads | epilogues.test.ts | not yet |
| `story` | 213 | The story of a campaign: places with names and a past, things that happen to the whole world, tales that are | campaign (types only), creed, ruin, threadtales, worldtales | story.test.ts | not yet |
| `storyturn` | 151 | The story's turn, out of the campaign hub: what befalls the whole world, the tales put before the player and how an answer is carried out (`taleNow`, `taleText`, `canAnswer`, `answerTale`), and how each rival answers its own. One call a season (`storyTurn`). | armytown, campaign (types only), campaignbase, chroniclethreads, creed, epilogues (types only), places, prices, stores, story, talethreads, temper, threadstarts, townfaith, tribes | storyturn.test.ts, story.test.ts, sim.test.ts | not yet |
| `talethreads` | 105 | A thread of tales told whole: when an answer leads nowhere further, the chronicle tells the thread from the year it began (what was done at each step, and how it ended for those in it); a thread dropped for a fallen rival or a tribe no longer free is told as left unfinished. Every end is kept (`threadEnds`) for the last page. Words only. | campaign (types only), chroniclethreads, places, story, threadtales, worldtales | talethreads.test.ts | not yet |
| `threadtales` | 106 | The longer threads of the tales as data: tales that later answers lead to, so each thread runs three to five tellings and every answer picks the road; each answer's few words (`told`) and an ending answer's `fate`. | story (types only) | talethreads.test.ts | not yet |
| `threadstarts` | 101 | What befalls the player that begins a thread of tales, noticed each season from the campaign as it stands: a land lost to a rival, a leader's fall, a plague, a royal marriage, a hungry winter, a claimant's rising. Each waits for the next telling behind any thread under way (`threadSeeds`), begins once a campaign, and is let go after `STARTS.wait` seasons. | campaign (types only), campaignbase, seasonsky, story | threadstarts.test.ts | not yet |
| `worldtales` | 192 | The threads the world begins, as data: a first tale for each kind of thing that befalls the player (`opens`), never told at random, and the tales each answer leads to, three tellings on every road. | story (types only) | threadstarts.test.ts | not yet |
| `storyvisit` | 45 | The map side of fieldstory: `storyForVisit` hands a visit the player's thief or killer in the town; `storyFromVisit` writes back what came of it (the thief taken, for judgement; suspects cleared, each with a clue), not believing the field blindly. | campaign (types only), fieldstory (types only), intrigue, intriguebase | fieldstory.test.ts | not yet |
| `strengthwords` | 19 | Strengths as a player reads them: whole numbers with a word (weak, strong), and totals that say "about" when rounded parts would not add up. | none | strengthwords.test.ts | not yet |
| `studies` | 153 | A nation's studies on the map: a tech that says what it `answers` is the nation's, learned in a town where the building that teaches it stands (paid in goods from that town first), known in a visit and brought home from one; rival nations learn the one answering what presses on them. | campaign (types only), campaignbase, data, plenty, township | studies.test.ts | not yet |
| `suitors` | 94 | Going to marry (docs/DESIGN.md): a town with grown people of one sex only, or badly short of one, draws the unmarried of its people's other towns, by road as a convoy goes. | armytown, campaign (types only), convoys, township | suitors.test.ts | not yet |
| `tavernfall` | 24 | The tavern as a town falls. As a town grows less moral its tavern keeps later hours and takes more gold; what is | creed | tavernfall.test.ts | not yet |
| `temper` | 127 | A leader's temperament, as answered by whoever plays them in the voice booth. It steers how the | none | sim.test.ts (none of its own) | not yet |
| `threatsbase` | 47 | The numbers of the threats of men, apart from the rules that use them, so that a system below those rules can read one without a ring of imports. | none | threatsbase.test.ts, threats.test.ts | not yet |
| `threats` | 481 | Threats of men on the map (docs/DESIGN.md, step 4): bands that belong to no nation, choose a town and strike it: who the bands are, how a town struck defends itself, the report, and captives held and got back. | acts, ageing, armytown, campaign (types only), campaignbase, creed, drift, fortkeep, fortress, heralds, larder, leaderstay, militia, militiatoll, naming, oldfolk, ownstudies, raidclash, rim, roadclash, stores, strengthwords, threatsbase, townfaith, township, townwatch, watchtally | threats.test.ts | not yet |
| `townfaith` | 126 | Faith is a town's (docs/DESIGN.md): every town's own moral standing, and the nation's as the mean of its towns'. | campaign (types only), campaignbase, churchtavern, creed, leaderstay, ownstudies, pilgrimage, places, story, townlean, townlife | townfaith.test.ts | not yet |
| `townlife` | 78 | A town's own life moves its faith: hunger and plague down in standing, a long peace with full stores up (raids move it already, threats.ts). | campaign (types only), larder, township | townlife.test.ts | not yet |
| `townorders` | 93 | A governor's standing orders from the player: what to put first, what not to build, how much to keep, whether people may leave; the governor and migration read them. | campaign (types only), township (types only) | townorders.test.ts | not yet |
| `townmuster` | 113 | A town left to itself keeps training (docs/DESIGN.md): each season a town of the player's with a training order raises one company from its own men and its own stores, within what a town keeps of both. | armytown, campaign (types only), campaignbase, data, governor, places, stores, township | townmuster.test.ts | not yet |
| `townrecord` | 9 | What stands on a town's record, read with nothing else imported: for rules modules that ask after a building of theirs without a cycle. | campaign (types only) | townrecord.test.ts, granary.test.ts | not yet |
| `townwatch` | 30 | Town Watch, a study taught at the Watch House: a town with a Watch House stands a company stronger against a band, and fewer thieves and killers begin among the people. Reads only the nation's studies and what stands in the town. | campaign (types only), studies | townwatch.test.ts | not yet |
| `township` | 238 | Towns that keep their people and their stores (docs/DESIGN.md, step 2). | ageing, campaign (types only), fieldcap, household, ledger, notableweight, oldmarks, orphantown, widowtown, writeguard | township.test.ts | not yet |
| `townworks` | 58 | Buildings raised on the map: any building marked `onMap` is begun on a town's record at a free plot, out of the town's own stores, and the governor finishes it. | campaign (types only), campaignbase, creed, data, governor, rivalrule, studies, townfaith, township | studies.test.ts | not yet |
| `tribenames` | 18 | A tribe's people have names of their own on a battlefield, and no two on its side share one while a name is left unused. | none | tribenames.test.ts | not yet |
| `tribes` | 217 | Nobody fights from nowhere: a tribe's bands are its town's grown men, its losses are men of that town, and whoever turns out of a land's town to a battle, in the town or in the open, is its own men in arms, counted back after. | ageing, campaign (types only), game (types only), larder, township | tribes.test.ts | not yet |
| `unlaid` | 45 | The buildings of a town that find no room on the field: kept on its record with no place (`[type, -1, -1]`), counted with the rest, handed back with what stands when the field is written back, and tried again at the next sitting (firstlay.ts layKept), so a first visit never costs a town its roofs. A building of a real record that cannot stand where it stood (the ground changed, another camp on it) is laid where there is room in the same way, or kept; a wall is not moved. | game (types only) | unlaid.test.ts | not yet |
| `unrest` | 128 | Unrest is a town's own matter (docs/DESIGN.md): each town's chance of unrest each season by its own state (hunger, church and tavern, how long held, its nobles' mood), not one draw for the whole world. | campaign (types only), campaignbase, court, creed, leaderstay, nobles, ownstudies, townfaith, township, writtenlaw | unrest.test.ts | not yet |
| `visit` | 290 | A visit: from the campaign map the player enters a town of their own, with no enemy there, and plays a stretch | ailing, armytown, askedhere, campaign, campaignbase, courtvisit, data, driftintown, faithsites, fieldcaravan, furloughmap, game (types only), governor, hallcases, handroads, naming, queueddrill, roofsmap, seasonfolk, seasonsky, soldiernames, stores, storyvisit, studies, townfaith, townmuster, township, townwater | visit.test.ts, visitarms.test.ts | not yet |
| `well` | 44 | The Well: a crowded town counts as less crowded for plague on the map; plague passes less readily among a people's own in a town. | campaign (types only), game (types only), townrecord, township | well.test.ts | not yet |
| `watchhouse` | 80 | The Watch House, one of the buildings raised on a town's record (townworks): a thief is taken sooner, a killer's clues found faster and fewer die; a town's governor begins one after a thief or a killer. In the town the watch calls villagers to a fire (calamity). | campaign (types only), data, governor, plenty, studies, townworks | watchhouse.test.ts | not yet |
| `watchtally` | 31 | Report only: what the Watch House and Town Watch did, read like for like. Each time one of their rules is applied (a thief taken, a clue found, a killing, a thief or killer beginning, a band's strike held), it counts what happened beside what the same draw would have come to without the rule. Decides nothing; only the health report reads it. | campaign (types only) | watchtally.test.ts | not yet |
| `widowhood` | 130 | Widows, widowers and orphans on the map: a husband fallen with the army leaves a widow, a notable mother who dies a widower; after mourning they marry again in the town or go to another town of their people that has someone for them; a widow who dies leaves her house's children to another named house of the town. | ageing, campaign (types only), orphans, peoplenames, township, warhouse | widowhood.test.ts | not yet |
| `widowtown` | 83 | A widow known on the map is the same widow in the town: carried in with the town's people and housed alone, carried back with its census. | bereft, game (types only), township (types only), widowhood (types only) | widowtown.test.ts | not yet |
| `orphantown` | 87 | The map's orphans are the town's taken-in children: carried in with the town's people onto the house that keeps them, carried back with its census. | game (types only), township (types only), widowhood (types only) | orphantown.test.ts | not yet |
| `bereft` | 65 | Widows, widowers and orphans in a town: a widow keeps her house; a fallen couple's children are taken in by a named house. | game (types only), nursery (types only) | bereft.test.ts | not yet |
| `marriage` | 102 | Marriages on the map: a town's married couples (births come of them); the unmarried marry, or go to a town beside to marry. | ageing, campaign (types only), convoys, township | marriage.test.ts | not yet |
| `wilds` | 87 | The wild lands: a share of the far and poor lands (snow, desert, the map's edge) start with no tribe and no town, for settlers and the far-wilds bands. | campaign (types only), campaignbase | wilds.test.ts | not yet |
| `warhouse` | 322 | A man at war is still of his house, on the map (docs/DESIGN.md): every man a town has with the armies has a name and a house on the town's record; an unmarried son goes before a husband, a man who falls is his house's loss and the town's grief, and he is home again when the army is. | campaign (types only), companyroll, grief, housekeep, peoplenames, soldiernames, township, veteranhome, warrecord | warhouse.test.ts, warhousearmy.test.ts | not yet |
| `plainhealer` | 32 | Every town has a plain healer: which healer a people's standing gives its army (a Priest in a town of good standing, a Shaman in one of low, the plain Healer in the middle), how many the computer keeps, and that the plain one binds wounds but does not cure plague. | data, game (types only) | plainhealer.test.ts | not yet |
| `darkarts` | 89 | The Shaman's dark calamities and his mirror with the Prophet: who casts what (the Prophet's four, the Shaman's curse, blight and sickness), the bottom two steps of standing that train a Shaman, a curse that makes soldiers strike weaker for a time and a sickness shorter than plague, each by the standing of those struck (wrath), faith that returns faster the lower his town, and what the computer's Shaman casts and where. | data, game (types only), wrath | darkarts.test.ts | not yet |
| `wrath` | 33 | How hard acts of God fall on a people (docs/DESIGN.md, "Acts of God"). | game (types only) | wrath.test.ts, prophetcreed.test.ts | not yet |
| `writtenlaw` | 12 | Written Law, a study: unrest is less likely, and a taken town's resentment eases the faster. | campaign (types only), studies | writtenlaw.test.ts | not yet |

## Behaviour pinned as it is

Some tests hold the game to what it does now in a place a reader might take for a bug. Each is meant, or at least
accepted: port it as it is, and change the test on purpose if the Unity side should differ.

- **The computer does not call home an army already attacking when its own town is struck.** Only its idle soldiers
  go to the blow; the only recall is the beaten one (below). `tests/ai.test.ts`, "does not call back an army already
  marching when its own town is struck". Port as is.
- **The computer calls an attack home only when it is beaten:** under 35% of those who set out, at Normal or above,
  and only in the first 30 minutes. `tests/ai.test.ts`, "an attack that has lost most of its men is called home; one
  still strong fights on". Port as is.
- **The computer's storehouse at ten villagers is the next work of its order, not a gate:** storehouses beside far
  resources are laid from nine as well. `tests/ai.test.ts`, "raises a barracks first, once it has eight villagers, and
  a storehouse next at ten" checks the order only. Port as is.
- **A drifted villager may be brought back by the town's own care while the computer never sets them back.** The care
  roll (driftintown.ts) is the town's, not the computer's. `tests/driftintown.test.ts`, "the computer does not set a
  drifted villager back to its own work". Port as is.
- **A man carried home is older by the seasons since the record last counted, not since he was taken.** The record
  adds its own seasons when it is written. `tests/carriedhome.test.ts`, "the seasons the record has not yet counted
  are not counted twice". Port as is.
- **The season changes nothing in a battle.** It is a look only; a battle with a season and one without play out
  alike. `tests/seasonsky.test.ts`, "is kept with a battle when it is saved, and moves nothing in it". Port as is.
- **The dilemmas a town was asked are kept only for a town of the player's;** a battle over a rival's town starts a
  round of its own. `tests/askedhere.test.ts`, "keeps only names of dilemmas there are, only for a town of the
  player's, and at most a round". Port as is.
- **Freeing or selling those held answers for the people's own work camps only;** a marauders' lair is never touched.
  `tests/dilemmaacts.test.ts`, both answers. Port as is.
- **A war of succession between two rivals is only the end of their peace;** neither presses the claim by arms, and a
  claimant of both houses rules one throne at most. `tests/bothhouses.test.ts`, "passed over on the player's throne"
  (the player's case is the only one pressed). Port as is.

Fixed rather than pinned: a rival leader rising in rank now names the power it learnt ("X is now Blooded and has
learnt ..."); the words were made before it chose. `tests/battleleader.test.ts`, "a rival's leader chooses for
themself, at once".

<!-- generated:order -->
## The order to port in (generated)

Written by `scripts/porting-order.mjs` (`npm run porting`). Do not edit by hand.

293 modules, 37,062 lines, in 31 layers. A module can be ported once every module in the layers above its own has been; within a layer the order is free, and the modules most others wait on are named first. "Ported" is the Unity column of the table: 0 so far.

| Layer | Modules | Lines | Which (lines; how many modules call it) |
| --- | --- | --- | --- |
| 0 | 58 | 5,665 | `data` (1230; 55), `peoplenames` (111; 16), `intriguebase` (89; 9), `ledger` (26; 7), `notableweight` (118; 7), `pacts` (43; 6), `wrath` (33; 6), `temper` (127; 5), `threatsbase` (47; 5), `bandborn` (60; 4), `besieger` (31; 4), `household` (103; 4), `leaders` (547; 4), `studiesintown` (52; 4), `townrecord` (9; 4), `warrecord` (158; 4), `orphantown` (87; 3), `townorders` (93; 3), `atwork` (77; 2), `beaten` (52; 2), `bereft` (65; 2), `dilemmas` (140; 2), `dominion` (30; 2), `handroads` (134; 2), `path` (266; 2), `threadtales` (106; 2), `unlaid` (45; 2), `watchtally` (31; 2), `worldtales` (192; 2), `writeguard` (35; 2), `aiplague` (30; 1), `battlehooks` (80; 1), `carriedhome` (37; 1), `clergywork` (43; 1), `daylight` (18; 1), `faces` (129; 1), `fieldwork` (28; 1), `formations` (78; 1), `givenorders` (43; 1), `hallfield` (65; 1), `housekeep` (33; 1), `keeper` (18; 1), `lastperson` (21; 1), `nationcolours` (26; 1), `raidertown` (28; 1), `reservecamp` (20; 1), `seasongain` (31; 1), `slopes` (21; 1), `strengthwords` (19; 1), `stylesigns` (49; 1), `townlean` (37; 1), `tribenames` (18; 1), `waterlay` (93; 1), `encounter` (103), `faithhouse` (54), `folk` (145), `folkfaith` (197), `missionstory` (64) |
| 1 | 26 | 2,458 | `ageing` (137; 33), `creed` (114; 30), `hero` (102; 13), `naming` (113; 11), `map` (316; 4), `courtfield` (178; 3), `siegecamp` (75; 3), `uniquecompany` (54; 3), `widowtown` (83; 3), `birthonly` (62; 2), `darkarts` (89; 2), `feudwar` (55; 2), `plainhealer` (32; 2), `steward` (62; 2), `aiworks` (95; 1), `dyingout` (88; 1), `fieldstory` (145; 1), `firstlay` (71; 1), `fleets` (69; 1), `leavehome` (58; 1), `namesakes` (53; 1), `raiderguide` (44; 1), `siegelift` (86; 1), `styleplay` (120; 1), `battlecard` (132), `visitguide` (25) |
| 2 | 18 | 1,246 | `champion` (30; 8), `powers` (95; 8), `chroniclethreads` (81; 7), `rescue` (130; 5), `seasonsky` (89; 4), `muster` (51; 3), `oldmarks` (145; 3), `askedhere` (31; 2), `nursery` (52; 2), `queuedmen` (54; 2), `tavernfall` (24; 2), `aisiting` (101; 1), `carriedout` (32; 1), `fieldcap` (108; 1), `placebar` (50; 1), `roofs` (113; 1), `hallguests` (47), `inyears` (13) |
| 3 | 8 | 1,385 | `township` (238; 80), `captivity` (268; 5), `winter` (61; 4), `bothhouses` (112; 2), `battleleader` (119; 1), `pickman` (98; 1), `notable` (50), `scenario` (439) |
| 4 | 19 | 1,682 | `campaignbase` (364; 60), `stores` (107; 12), `plenty` (80; 11), `infirmary` (52; 5), `granary` (55; 4), `well` (44; 4), `mill` (45; 3), `oldfolk` (73; 3), `householdmove` (73; 2), `marauders` (218; 2), `orphans` (77; 2), `plaguenamed` (52; 2), `sieges` (36; 2), `aicaptives` (64; 1), `battlefolk` (99; 1), `battlescars` (109; 1), `dilemmaacts` (26; 1), `hiredhome` (37; 1), `warspoils` (71; 1) |
| 5 | 16 | 1,499 | `studies` (153; 26), `court` (228; 17), `rim` (114; 7), `grief` (73; 6), `soldiernames` (144; 6), `churchtavern` (54; 5), `wilds` (87; 5), `veteranhome` (117; 4), `companyroll` (130; 3), `faithsites` (39; 2), `townwater` (77; 2), `aiward` (61; 1), `battletales` (57; 1), `carriednamed` (51; 1), `hazardlessons` (84; 1), `nextage` (30; 1) |
| 6 | 25 | 1,249 | `ownstudies` (111; 13), `warhouse` (322; 10), `leaderstay` (84; 8), `founding` (117; 6), `hall` (28; 5), `heralds` (30; 3), `manor` (29; 3), `ruin` (124; 3), `townwatch` (30; 3), `croprotation` (18; 2), `fortress` (30; 2), `midwifery` (18; 2), `quarantine` (20; 2), `roads` (37; 2), `salting` (20; 2), `writtenlaw` (12; 2), `couriers` (8; 1), `furlough` (110; 1), `monastery` (26; 1), `oaths` (8; 1), `physicians` (17; 1), `pilgrimage` (8; 1), `seatedleader` (27; 1), `spymasters` (7; 1), `stewardship` (8; 1) |
| 7 | 7 | 1,162 | `armytown` (387; 21), `larder` (121; 13), `famine` (188; 7), `story` (213; 7), `contagion` (97; 3), `reckon` (26; 3), `widowhood` (130; 1) |
| 8 | 15 | 1,212 | `places` (58; 6), `bandmarch` (145; 5), `tribes` (217; 5), `ailing` (53; 3), `larderwatch` (61; 2), `leanwild` (48; 2), `aicare` (56; 1), `downedmap` (64; 1), `fortkeep` (52; 1), `grain` (78; 1), `siegeretreat` (63; 1), `threadstarts` (101; 1), `townlife` (78; 1), `levynext` (31), `slots` (107) |
| 9 | 4 | 477 | `townfaith` (126; 25), `militia` (42; 4), `calamity` (204; 3), `talethreads` (105; 2) |
| 10 | 9 | 815 | `kin` (256; 9), `seasonfolk` (121; 5), `conquered` (124; 3), `militiatoll` (75; 2), `noblefaith` (40; 2), `feastdays` (19; 1), `mapgrief` (33; 1), `tavernrumour` (79; 1), `lessons` (68) |
| 11 | 3 | 742 | `nobles` (253; 19), `dynasty` (232; 13), `portrait` (257; 1) |
| 12 | 6 | 1,024 | `mapbattle` (378; 4), `nobletemper` (110; 3), `royalmarriage` (160; 3), `claimants` (104; 2), `unrest` (128; 1), `epilogues` (144) |
| 13 | 2 | 231 | `raidclash` (145; 3), `tradedeal` (86; 2) |
| 14 | 1 | 132 | `roadclash` (132; 4) |
| 15 | 1 | 343 | `convoys` (343; 9) |
| 16 | 5 | 589 | `marriage` (102; 2), `migration` (233; 2), `sentfor` (99; 2), `settlersfrom` (61; 2), `suitors` (94; 1) |
| 17 | 3 | 390 | `prices` (214; 9), `deadtown` (106; 3), `roofsmap` (70; 2) |
| 18 | 6 | 1,022 | `courtstory` (437; 6), `country` (94; 3), `freetown` (137; 2), `nobledeal` (165; 2), `storyturn` (151; 2), `emptied` (38; 1) |
| 19 | 5 | 576 | `aftermath` (204; 3), `nobleweigh` (55; 2), `claimantjudged` (94; 1), `rivalaim` (71; 1), `wifetaken` (152) |
| 20 | 2 | 354 | `decrees` (164; 4), `claimantrising` (190; 2) |
| 21 | 3 | 446 | `acts` (203; 5), `drift` (174; 3), `claimantcaptain` (69; 2) |
| 22 | 5 | 979 | `threats` (481; 14), `governor` (196; 9), `driftintown` (174; 4), `chancecreed` (46; 1), `floods` (82; 1) |
| 23 | 10 | 1,326 | `carriedoff` (136; 6), `rivalrule` (382; 5), `townmuster` (113; 3), `bandhorde` (119; 2), `raidfought` (160; 2), `harvest` (103; 1), `raidnews` (70; 1), `seasonreport` (191; 1), `tendintown` (21; 1), `workwords` (31) |
| 24 | 11 | 1,139 | `townworks` (58; 6), `rivalcaptives` (47; 3), `bandroam` (219; 2), `furloughmap` (83; 2), `nobleacts` (122; 2), `queueddrill` (139; 2), `battlecarried` (109; 1), `nocarry` (70; 1), `rivalstock` (115; 1), `courtcall` (84), `roll` (93) |
| 25 | 8 | 1,154 | `bandfight` (313; 4), `caravans` (204; 3), `petitions` (227; 3), `bandwilds` (109; 1), `governworks` (80; 1), `inn` (46; 1), `rule` (95; 1), `watchhouse` (80; 1) |
| 26 | 5 | 809 | `intrigue` (387; 6), `fieldcaravan` (149; 3), `bandcaravan` (52; 1), `rivalhunt` (132; 1), `bandmeet` (89) |
| 27 | 7 | 3,720 | `game` (3286; 2), `hallcases` (70; 2), `bandseason` (41; 1), `courtvisit` (81; 1), `rivalstories` (130; 1), `storyvisit` (45; 1), `storypolicy` (67) |
| 28 | 2 | 1,815 | `campaign` (1763; 2), `aiground` (52; 1) |
| 29 | 2 | 1,304 | `visit` (290; 1), `ai` (1014) |
| 30 | 1 | 117 | `primer` (117) |

**Shapes to declare first.** A dependency of types alone does not hold a module back, but the C# side still needs the shape (the fields of the record) declared before the module that reads it. These are declared in a module of a later layer than a module that needs them, so write the record as plain data at the layer given, and the rules of its own module when its layer comes:

| Shapes from | Needed by | From layer | Its own layer |
| --- | --- | --- | --- |
| `campaign` | 186 modules | 0 | 28 |
| `game` | 83 modules | 0 | 27 |
| `township` | 11 modules | 0 | 3 |
| `warhouse` | 5 modules | 0 | 6 |
| `mapbattle` | 4 modules | 0 | 12 |
| `threats` | 4 modules | 0 | 22 |
| `portrait` | 2 modules | 0 | 11 |
| `story` | 2 modules | 0 | 7 |
| `widowhood` | 2 modules | 0 | 7 |
| `creed` | 1 module | 0 | 1 |
| `governor` | 1 module | 0 | 22 |
| `nursery` | 1 module | 0 | 2 |
| `roofs` | 1 module | 0 | 2 |
| `soldiernames` | 1 module | 0 | 5 |
| `aftermath` | 1 module | 1 | 19 |
| `armytown` | 1 module | 5 | 7 |
| `carriedoff` | 1 module | 5 | 23 |
| `lessons` | 1 module | 5 | 10 |
| `nobles` | 1 module | 10 | 11 |
| `decrees` | 2 modules | 11 | 20 |
| `intrigue` | 1 module | 23 | 26 |
| `nocarry` | 1 module | 23 | 24 |
<!-- /generated:order -->
<!-- generated:tests -->
## The tests (generated)

Written by `scripts/porting-order.mjs` (`npm run porting`). Do not edit by hand.

Every module names its tests in the table, and `npm run check` fails if one named is not there. As this was written: 293 modules, 0 naming no test, 0 naming a test file that is missing; 4,053 cases in the files named (a file named by two modules is counted for each).

**Thin: a module of 150 lines or more with 2 cases or fewer in the tests it names.** Port these with more care than their tests ask: a C# version can pass them and still be wrong.

None.

**Light: a module of 150 lines or more with fewer than one case for every 60 lines.** These are also exercised through other modules' tests, the fingerprint and the health report; the count here is only of the tests named for them.

None.

**Few: a smaller module (50 to 149 lines) with 2 cases or fewer.**

None.

**Tested only through another module: none of the tests named takes anything from the module itself.** Its rules are reached by way of a hub or a neighbour, so the cases counted for it are not all about it; when it is ported, the test that proves it is the neighbour's.

None.
<!-- /generated:tests -->
<!-- generated:constants -->
## Where the constants live (generated)

Written by `scripts/porting-order.mjs` (`npm run porting`). Do not edit by hand.

The numbers a rule goes by are kept in named constants at the top of the module that owns the rule (`export const NAME`), each with a comment saying what it does. 540 of them in 226 modules. Port each with its module, under the same name, so that a number tuned here can be found there. The hubs (`game`, `campaign`) hold few: most of what was theirs is in `data`, `campaignbase` and the systems' own modules.

| Module | Constants |
| --- | --- |
| `acts` | `ACTS` |
| `aftermath` | `AFTER` |
| `ageing` | `SEASONS_A_YEAR`, `GROWN_YEARS`, `OLD_YEARS`, `CHILD_SEASONS`, `CHILD_PACE`, `GROWN_SEASON`, `OLD_SEASON`, `DEATH_AT_60`, `DEATH_A_YEAR`, `LAST_SEASON` |
| `aicare` | `AICARE` |
| `aicaptives` | `AICLOCK` |
| `aiward` | `WARD` |
| `aiworks` | `WORKS`, `NEEDED`, `OF_PLENTY` |
| `armytown` | `ARMY_REST`, `MEN`, `MEN_A_COMPANY`, `FOUNDING` |
| `bandborn` | `BORN`, `TAKES_IN` |
| `bandcaravan` | `BANDCARAVAN` |
| `bandfight` | `FIGHT`, `AMBUSH` |
| `bandhorde` | `HORDE` |
| `bandmarch` | `MARCH`, `WILDS` |
| `bandroam` | `ROAM` |
| `atwork` | `ATWORK` |
| `battlehooks` | `BATTLE_PHASES` |
| `beaten` | `HALL_GRACE`, `ROUT_GRACE`, `RAZED_GRACE`, `HALL_WARNINGS` |
| `besieger` | `BESIEGE` |
| `dominion` | `DOMINION_DIP` |
| `floods` | `FLOOD` |
| `fleets` | `FLEETS`, `RAM` |
| `givenorders` | `GIVEN` |
| `handroads` | `HAND_ROADS` |
| `placebar` | `LEVEL` |
| `roofsmap` | `MAX_ROOFS` |
| `siegelift` | `LIFT` |
| `townwater` | `TOWN_WATER`, `RIVER_NAME` |
| `waterlay` | `WATER_LAY` |
| `birthonly` | `TOWN_BIRTH`, `BORN_ONLY` |
| `calamity` | `FIRE` |
| `campaign` | `HERO_COST`, `TRAITS`, `COAST`, `CAMPAIGN_EDGE`, `PERSONA`, `GIFT_COST`, `AGE_COST`, `AGE_EDGE`, `TOWN_MEND`, `EVENTS`, `UNREST_TURNS`, `HOARD_TURNS`, `HOARD_PRIZE`, `WORLD_SHAPES`, `LAND_STEP`, `BARRIERS`, `LOCALS`, `BATTLE_HOOKS`, `BATTLE_ANSWERS` |
| `caravans` | `CARAVANS` |
| `fieldcaravan` | `FIELD_CARAVAN` |
| `campaignbase` | `MAP_W`, `MAP_H`, `CAMPAIGN_VERSION`, `MAX_ARMY`, `HERO_STRENGTH`, `HERO_RANK_STRENGTH`, `COMPANIES`, `SITES`, `CHURCH_VIRTUE`, `TAVERN_VIRTUE`, `BATTLE_VIRTUE`, `FAITH`, `BEATS`, `MAX_VETERAN`, `TRUCE_COST`, `TRUCE_TURNS`, `ALLIANCE_COST`, `MAX_FAVOR`, `DOMINION_SHARE`, `DOMINION_TURNS`, `SITE_BUILDING`, `HORDE_TURN`, `HORDE_MAX`, `HORDE_SPREAD`, `HORDE_PRIZE`, `BIOMES`, `SEA_LANDING`, `WEATHER`, `HUB` |
| `captivity` | `CAPTIVE_HOLD`, `CAPTIVE_WARN`, `YEARS_MAN`, `YEARS_WOMAN`, `LIFE_YEARS`, `CHILD_WORK`, `SOLD_GOLD` |
| `carriedoff` | `CARRY` |
| `warspoils` | `WAR_SPOILS` |
| `warrecord` | `RECORD` |
| `uniquecompany` | `UNIQUE` |
| `petitions` | `PETITION` |
| `pacts` | `PACT_KEEP` |
| `royalmarriage` | `MARRY` |
| `bothhouses` | `SUCCESSION` |
| `tradedeal` | `TRADE`, `OFFER_WAITS` |
| `settlersfrom` | `SETTLE_FROM` |
| `siegecamp` | `CAMP` |
| `studiesintown` | `STUDY_TOWN` |
| `chancecreed` | `CHANCE_CREED` |
| `champion` | `CHAMPION_KILLS` |
| `conquered` | `YOKE` |
| `firstlay` | `FIRSTLAY` |
| `dyingout` | `DIE_OUT` |
| `leanwild` | `LEAN_WILD` |
| `militia` | `MILITIA` |
| `militiatoll` | `FELL` |
| `oldfolk` | `OLD` |
| `queueddrill` | `QUEUED`, `RECORD_PLACES` |
| `queuedmen` | `QUEUED_MOST` |
| `veteranhome` | `NAMED` |
| `feudwar` | `FEUDWAR` |
| `fieldcap` | `FIELD_CAP` |
| `fieldstory` | `FIELD_STORY` |
| `townlean` | `LEAN` |
| `contagion` | `CONTAGION` |
| `convoys` | `CONVOYS` |
| `country` | `COUNTRY`, `WORKS` |
| `couriers` | `COURIERS` |
| `court` | `CALLING` |
| `courtcall` | `LEADER_ROAD` |
| `courtfield` | `FIELD_COURT`, `FIELD_ANSWERS` |
| `noblefaith` | `OTHER` |
| `wifetaken` | `WIFE` |
| `courtstory` | `COURT`, `PLOT_STAGES` |
| `creed` | `CLERGY_VIRTUE`, `CLERGY_BIRTH`, `MAID_VIRTUE`, `MAID_GOLD`, `MAID_DISTRACTION`, `PATRON_FOOD`, `PATRON_MUSTER`, `MERC_PRICE`, `MERC_WAGE`, `MERC_TYPES`, `TAVERN_PLAGUE`, `TAVERN_BIRTH`, `CAPTURE_TIME`, `CAPTIVE_WORK`, `GUARD_WATCH`, `ESCAPE_TIME`, `REVOLT_MEN`, `REVOLT_TIME`, `GUARD_DRIVE`, `CAPTIVE_VIRTUE`, `CAMP_BIRTH`, `CAPTIVE_CAP`, `STAFF_CAP`, `CREEDS`, `DILEMMAS`, `LEANING` |
| `dilemmas` | `MORE_DILEMMAS`, `FITS` |
| `dilemmaacts` | `ACTS` |
| `croprotation` | `ROTATION` |
| `data` | `RES_TYPES`, `AGES`, `UNITS`, `BUILDINGS`, `BUILD_PAGES`, `TRADE`, `TECHS`, `CIVS`, `CIV_IDS`, `STYLES`, `CIV_STYLE`, `STYLE_RULES`, `BAND`, `CIV_COLOR`, `ABILITIES`, `CALAMITY`, `VILLAGER_TRAITS`, `NAMES_M`, `NAMES_F`, `FAMILY_NAMES`, `POP_LIMIT`, `WONDER_TIME`, `BIRTH_TIME`, `GROW_TIME`, `BIRTH_COST`, `LIFESPAN`, `ELDER_AT`, `RENOWN_CHILDREN`, `MORALE_RADIUS`, `MORALE_PER_HOUSE`, `MORALE_MAX_HOUSES`, `RESOURCE_AMOUNT`, `RESOURCE_KIND`, `GATHER_RATE`, `RES_ICON`, `LAIR_AT`, `LAIR_BIRTH`, `LAIR_RAID`, `LAIR_MAX` |
| `daylight` | `DAY_LENGTHS`, `DUSK` |
| `deadtown` | `DEAD` |
| `emptied` | `EMPTIED` |
| `decrees` | `DECREES`, `DECREE_KINDS`, `MESSENGER`, `TAVERN_WOMEN_GOLD`, `CHURCH_CARE`, `GUARDS_EASE`, `TAVERN_WOMEN_SWAY`, `CLOSED_ANGER`, `ALMS_A_SEASON`, `TEND_GOLD`, `TEND_EASE`, `TEND_PLAGUE`, `FORESIGHT` |
| `faithsites` | `FAITH_SITES` |
| `faithhouse` | `FAITH_SIGN`, `HOUSE_OF`, `HOUSES` |
| `founding` | `FOUNDING` |
| `claimants` | `CLAIM` |
| `claimantrising` | `RISING` |
| `freetown` | `FREE` |
| `grain` | `GRAIN` |
| `drift` | `STRAIN`, `NEWLY_TAKEN`, `GO_MOST`, `BACK_MOST`, `MILD`, `SHARE`, `TAVERN_SWAY`, `NATION_DIP`, `FALL`, `RISE`, `LEAN_FOOD`, `FED_FOOD`, `MINE_GOLD`, `TAVERN_GOLD` |
| `driftintown` | `STRAIN`, `DRIFT_RATE`, `HOLY_RATE` |
| `dynasty` | `HEIR_AGE`, `FIRST_HEIR_AGE`, `HEIR_EVERY`, `MAX_HEIRS`, `CAPTAIN_VET` |
| `encounter` | `ENCOUNTER`, `BAND_DRESS` |
| `famine` | `FAMINE` |
| `feastdays` | `FEAST_DAYS` |
| `folk` | `LEANS`, `LEAN_NOTES`, `MOMENT_NOTES`, `FOLK`, `FOLK_VOICES` |
| `folkfaith` | `BELIEF_OF`, `BELIEF_NOTES`, `FAITH_LINES` |
| `fieldwork` | `FIELD` |
| `stylesigns` | `SIGN_EVERY`, `STYLE_SIGN` |
| `game` | `DT`, `SAVE_VERSION`, `HIGH_GROUND`, `DAY_LENGTH`, `NIGHT_SIGHT` |
| `fortkeep` | `KEEP` |
| `fortress` | `FORT` |
| `governor` | `GOVERN` |
| `governworks` | `GOVERN_WORKS` |
| `grief` | `GRIEF_SECONDS`, `GRIEF_SLOW`, `GRIEF_SEASONS` |
| `hall` | `HALL` |
| `harvest` | `HANDS_FULL` |
| `heralds` | `HERALDS` |
| `hero` | `HERO_POINTS`, `MAX_RANK`, `RANK_XP`, `RANK_NAMES`, `MIGHT_ATK`, `GUARD_ARMOR`, `VIGOUR_HP`, `RANK_ATK`, `RANK_ARMOR`, `RANK_HP`, `HERO_MIN_HURT`, `HOLY_GUARD`, `TYRANT_BIND`, `TYRANT_BIRTH` |
| `household` | `WAR_RENOWN` |
| `hiredhome` | `HIRED_HOME` |
| `inn` | `INN` |
| `intrigue` | `INTRIGUE` |
| `granary` | `GRANARY` |
| `infirmary` | `INFIRMARY` |
| `tavernrumour` | `RUMOUR` |
| `clergywork` | `NUNS`, `MONKS` |
| `churchtavern` | `TEMPER` |
| `keeper` | `MILITARY_WORKS` |
| `intriguebase` | `KEEP`, `ENDINGS`, `TOWN_KINDS` |
| `kin` | `POST_NAMES`, `KIN` |
| `larder` | `EAT`, `STARVE_AFTER`, `STARVE_SHARE`, `KEEP_SEASONS`, `ROT`, `FOOD_KEEP` |
| `larderwatch` | `LARDER_WARN` |
| `leaderstay` | `LEADER_STAY`, `LEAN_WEIGHT` |
| `leaders` | `LEADER_EVENTS`, `EVENT_NOTES`, `LEADERS`, `CHARACTER_LIMITS` |
| `ledger` | `LEDGER_SEASONS` |
| `lessons` | `GLUT`, `FRESH` |
| `aiground` | `AIGROUND` |
| `aisiting` | `SITING` |
| `ailing` | `AILING` |
| `formations` | `FORMATIONS`, `FORM`, `FORM_WORDS` |
| `slopes` | `SLOPE` |
| `battlescars` | `SCARS` |
| `chroniclethreads` | `GREAT`, `HEARD_REACH` |
| `missionstory` | `THREADS`, `RIDER` |
| `hazardlessons` | `MARAUDER_NEAR`, `PROPHET_NEAR` |
| `manor` | `MANOR` |
| `map` | `T_GRASS`, `T_WATER`, `T_DIRT`, `T_ROCK`, `T_SAND`, `T_MARSH`, `T_SNOW`, `HILL_HEIGHT` |
| `mapbattle` | `CLASH`, `TALES` |
| `marauders` | `MARAUDER_HP`, `MARAUDER_ATK`, `LAIR_AGAIN`, `LAIR_AWAY`, `PARTY_NEAR` |
| `midwifery` | `MIDWIFERY` |
| `migration` | `MIGRATE` |
| `householdmove` | `HOUSEHOLD` |
| `mill` | `MILL` |
| `monastery` | `MONASTERY` |
| `muster` | `WOMAN_ATK` |
| `naming` | `MAX_NAME` |
| `peoplenames` | `PEOPLE_NAMES`, `BAND_NAMES` |
| `nationcolours` | `SPARE_COLOURS`, `TOO_ALIKE` |
| `nobles` | `LEANINGS`, `RANK_NAMES`, `NOBLES`, `LIKES` |
| `nocarry` | `NOCARRY` |
| `nobledeal` | `DEAL_KINDS`, `DEALS`, `TITLES` |
| `nobleacts` | `ACTS` |
| `nobleweigh` | `WEIGH` |
| `nobletemper` | `TEMPER` |
| `notableweight` | `MADE_RENOWN`, `FIELD_WEIGHT`, `GRIEF_SEASONS`, `GRIEF_MAX`, `GRIEF_PER_FAME`, `NATION_PER_FAME`, `NATION_MAX`, `GRIEF_LONGER` |
| `nursery` | `GROWN_AT` |
| `oaths` | `OATHS` |
| `ownstudies` | `OWN`, `STUDY_HALL` |
| `physicians` | `PHYSICIANS` |
| `pilgrimage` | `PILGRIMAGE` |
| `plaguenamed` | `PLAGUE_HOW` |
| `plenty` | `PLENTY` |
| `portrait` | `NATIONS`, `MARK_ORDER`, `MARK_WORDS`, `FEELING_WORDS`, `STANDING_WORDS`, `CONQUERED_FOR`, `RAID_NEAR` |
| `powers` | `POWER_RANKS`, `POWERS`, `CALL_RANK`, `CALL_LASTS`, `CALL_REST`, `CALLS` |
| `prices` | `CARRY`, `SHORT_RATE`, `MADE_OF` |
| `quarantine` | `QUARANTINE` |
| `raidclash` | `RAID` |
| `raidfought` | `STAND` |
| `rescue` | `RESCUE_REACH`, `RESCUE_GUARD`, `RESCUE_TIME` |
| `rivalaim` | `AIM`, `REDEPLOY` |
| `rivalcaptives` | `RIVAL_CLOCK` |
| `rivalhunt` | `HUNT` |
| `rivalrule` | `RIVAL` |
| `rivalstock` | `RIVAL_STOCK` |
| `rivalstories` | `RIVAL_STORIES` |
| `roadclash` | `ROAD` |
| `roads` | `ROADS` |
| `roll` | `RECENT` |
| `rim` | `RIM` |
| `ruin` | `RUIN`, `RUIN_WARN` |
| `salting` | `SALTING` |
| `scenario` | `MISSIONS` |
| `seasonsky` | `SEASONS`, `STORM`, `THUNDER` |
| `winter` | `WINTER` |
| `seasonfolk` | `MAP_BIRTH`, `LEAN_BIRTH`, `YOUNG_SEASONS`, `GROWN_SEASONS`, `HOUSE_ROOM`, `HALL_ROOM` |
| `seasonreport` | `PAST_SEASONS` |
| `sieges` | `SIEGE` |
| `slots` | `FIRST_KEY`, `ACTIVE_KEY`, `MAX_SLOTS` |
| `spymasters` | `SPYMASTERS` |
| `stewardship` | `STEWARDSHIP` |
| `styleplay` | `STYLE_PLAY`, `STYLE_FIGHT` |
| `storypolicy` | `STORE_LOW` |
| `stores` | `SUPPLY`, `SUPPLY_UNITS`, `KEEP` |
| `steward` | `STEWARD`, `STEWARD_CALL`, `STEWARD_POWERS` |
| `epilogues` | `EPILOGUE` |
| `story` | `PLACES`, `LEGENDS`, `WORLD_EVENTS`, `WORLD_FROM`, `WORLD_REST`, `WORLD_CHANCE`, `COMET_VIRTUE`, `TALES`, `TALE_FROM`, `TALE_EVERY`, `TALE_SPREAD`, `TALE_RIVAL`, `LAST_PAGE` |
| `threadtales` | `THREAD_NAMES`, `THREAD_TALES` |
| `threadstarts` | `STARTS` |
| `worldtales` | `WORLD_THREAD_NAMES`, `WORLD_TALES` |
| `studies` | `TRADE_SHORT`, `STUDY_KEEP` |
| `suitors` | `SUIT` |
| `tavernfall` | `TAVERN` |
| `temper` | `TEMPER_AXES`, `TEMPER_QUESTIONS`, `TEMPER_WORDS` |
| `threatsbase` | `THREATS` |
| `threats` | `BANDS` |
| `townfaith` | `PULL` |
| `townlife` | `LIFE` |
| `townorders` | `FOCUS`, `FOCI`, `KEEP_TIMES`, `KEEP_WORDS`, `LEAVE_WORDS`, `NEVER_CHOICES` |
| `townmuster` | `DRILL` |
| `townwatch` | `TOWNWATCH` |
| `township` | `STORE_KINDS`, `TOWN_SCALE`, `MAX_KIND`, `MAX_STORE`, `MOTHER_KIDS`, `TOLL`, `MAX_NOTABLES` |
| `tribenames` | `TRIBE_NAMES_M`, `TRIBE_NAMES_F` |
| `tribes` | `TRIBE` |
| `unlaid` | `NO_PLACE` |
| `unrest` | `UNREST` |
| `visit` | `VISIT_SECONDS` |
| `well` | `WELL` |
| `watchhouse` | `WATCH` |
| `widowhood` | `WIDOW` |
| `marriage` | `MARRY` |
| `wilds` | `WILD` |
| `warhouse` | `WARHOUSE` |
| `plainhealer` | `HEALERS`, `HEALERS_KEPT` |
| `darkarts` | `DARK`, `PROPHET_CASTS`, `SHAMAN_CASTS` |
| `writtenlaw` | `WRITTEN_LAW` |
<!-- /generated:constants -->
