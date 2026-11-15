# Porting the rules to Unity

The game is being rebuilt in Unity (C#, URP) by a session on the owner's own computer. Its project lives
apart from this repository. This page is how the two stay apart and still meet.

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
  depends on has been. `data`, `map`, `path`, `temper`, `folk` and `leaders` depend on nothing.
- **Hubs:** `game.ts` (a battle or visit) and `campaign.ts` (the map) tie the systems together. Port them
  in pieces as their systems arrive, rather than whole.
- **When a system here changes after it was ported,** its row says `changed since port`, with the commit,
  so the Unity side can follow.

## The systems

| Module | Lines | What it is | Depends on | Tests | Unity |
| --- | --- | --- | --- | --- | --- |
| `acts` | 173 | Acts of God on the map: a season of famine, plague and fire in every land that is held, falling on that land's town: its food, its people and its stores (docs/DESIGN.md). | campaign, creed, stores, township | acts.test.ts | not yet |
| `ageing` | 122 | A person ages only on the map, a season at a time (docs/DESIGN.md, "Time"). | campaign, data, township | ageing.test.ts | not yet |
| `ai` | 937 | Computer opponent. Plays by the same rules and commands as a human (but ignores fog of war). | besieger, birthonly, calamity, creed, data, game, keeper, map, muster, temper | ai-refounds.test.ts, ai-crowded.test.ts, ai-fires.test.ts | not yet |
| `armytown` | 133 | Armies belong to towns (docs/DESIGN.md): a company's men leave their town's record for the army's roll, the army's dead are struck from it, and the rest come home when it is sent home. | ageing, campaign, township | armytown.test.ts | not yet |
| `bandfight` | 197 | An army against a band: a battle the player can enter (a pending battle against no nation that takes no land, turned into a field battle), an army's own means when nobody is there, and the computer's peoples hunting bands in their lands. | armytown, campaign, data, threats | bandfight.test.ts | not yet |
| `bandhorde` | 109 | The marauders, the band that holds a land: one kind of band among the others, with its raids as strikes on a town that defends itself. Was `hordeTurn` in campaign.ts. | campaign, threats | bandhorde.test.ts | not yet |
| `bandroam` | 110 | Bands move: they flee strong armies, roam toward softer marks, settle as marauders and break up. | campaign, threats | bandroam.test.ts | not yet |
| `bandseason` | 22 | One season of the threats of men: the one call the campaign makes for all of it. | bandfight, bandhorde, bandroam, campaign, threats | threats.test.ts | not yet |
| `beaten` | 52 | When a people is beaten. A town used to stand until its last building fell, which left a won war to drag on | none | beaten.test.ts | not yet |
| `besieger` | 31 | A besieger assaults: the computer on the attacking side of a campaign siege forms up for a minute and goes in with what it brought. | game | besieger.test.ts | not yet |
| `birthonly` | 60 | People come only by birth (docs/DESIGN.md). | data, game | birthonly.test.ts | not yet |
| `calamity` | 179 | Fire that begins without an enemy, and a town that turns out to fight it. | contagion, famine, game, wrath | none of its own | not yet |
| `campaign` | 1844 | Conquest mode: a turn-based strategic map layered over the real-time battles. | acts, armytown, bandfight, bandseason, champion, conquered, convoys, country, court, creed, data, deadtown, drift, driftintown, dynasty, game, governor, harvest, hero, larder, leaders, naming, notableweight, orphans, powers, prices, rivalrule, seasonfolk, sieges, stores, story, temper, threats, townfaith, township | none of its own | not yet |
| `captivity` | 129 | What being held costs, by the owner's design (docs/DESIGN.md, "Captivity"). | ageing, data, game, nursery | captivity.test.ts | not yet |
| `champion` | 30 | Soldiers who make a name. Every soldier's kills are counted; one who has felled enough is known by name, and when | data, hero | champion.test.ts | not yet |
| `conquered` | 108 | A town taken (docs/DESIGN.md): resentment as a state on the town, easing under good rule, with a chance each season that it rises. | ageing, campaign, court, township | conquered.test.ts | not yet |
| `contagion` | 96 | Plague that comes from outside a town. | calamity, game | contagion.test.ts | not yet |
| `convoys` | 195 | Convoys by road between a people's own towns: food, goods or people, a season on the way, robbed by highwaymen (docs/DESIGN.md, "Stores"). | ageing, campaign, township | convoys.test.ts | not yet |
| `country` | 82 | Country that matters on the campaign map, and the works that open a closed border. | campaign, prices | country.test.ts | not yet |
| `court` | 166 | Where the leader is. A leader is one person in one place on the campaign map: a land of their people's, in its | campaign | court.test.ts | not yet |
| `creed` | 112 | Piety against decadence: one scale per people, moved by how they answer the dilemmas that come | data | none of its own | not yet |
| `data` | 1027 | Static game data: ages, units, buildings and technologies. | none | none of its own | not yet |
| `daylight` | 18 | How the hours run. A day is a set number of seconds, and the last three tenths of it are night; the player | none | daylight.test.ts | not yet |
| `deadtown` | 106 | A dead town (docs/DESIGN.md): a town with nobody in it stands open to any rival or band of marauders that comes for it. | armytown, campaign, township | deadtown.test.ts | not yet |
| `decrees` | 112 | Decrees (docs/DESIGN.md, "Decrees"). The leader rules a town by decree: a cost in supplies, some seasons, in person or half as strong by messenger; each bends how the town drifts. | campaign, court, township | decrees.test.ts | not yet |
| `drift` | 142 | Drift on the map (docs/DESIGN.md, step 5): a strained town's people drift a few a season, women to the tavern and men to the mines, kept as counts on its record; its standing falls, and with care they come back. Men at the mines leave the walls thin (`watchOf`). | campaign, court, creed, decrees, grief, notableweight, portrait, townfaith, township | drift.test.ts | not yet |
| `driftintown` | 168 | Drift inside a town (docs/DESIGN.md, step 5): the town turns out as the map left it, who works where shifts under pressure (low morale makes a raid weigh more), decrees are felt, the computer leaves the drifted be, and who is drifted at the end is written back. | campaign, data, decrees, drift, famine, game, grief, township | driftintown.test.ts | not yet |
| `dynasty` | 216 | Who leads a people when their leader falls. Every leader keeps a house: children are born to it as the turns go | ageing, campaign, champion, court, data, hero, leaders, naming, powers | dynasty.test.ts | not yet |
| `famine` | 185 | Famine: what happens to a town that has run out of food. | data, game, wrath | famine.test.ts | not yet |
| `folk` | 145 | What the common people say: villagers at every job and warriors of every arm, each in three tempers. A town that | none | none of its own | not yet |
| `game` | 3455 | Core simulation. No rendering or DOM access in here so it can run headless. | ageing, beaten, birthonly, calamity, captivity, champion, contagion, creed, data, daylight, driftintown, grief, hero, household, map, marauders, muster, notableweight, nursery, path, powers, rescue, tavernfall, temper, township, wrath | none of its own | not yet |
| `governor` | 152 | A town left to itself (docs/DESIGN.md): it carries on with its last orders, its people work where they were set (the shares harvest.ts splits a town's yield by), and a governor answers its wants out of its own stores. | campaign, data, seasonfolk, township | governor.test.ts | not yet |
| `grief` | 71 | Grief (docs/DESIGN.md, "Grief"). A home that loses its mother or its sons works more slowly for a time, most in a town of middling morals; a bereaved town grieves for seasons on the map. | game, notableweight, township | grief.test.ts | not yet |
| `harvest` | 93 | Income credited to the land that yields it, the only place a town earns: the land's yield as far as the town has hands, split by where its people work and what the land leans to (docs/DESIGN.md, "Stores"). | campaign, governor, stores, township | harvest.test.ts | not yet |
| `hero` | 102 | A nation's leader on the field: who they are, how they were made, and what the battles they live through do for them. | leaders | none of its own | not yet |
| `household` | 103 | A man at war is still of his house (docs/DESIGN.md). | game | household.test.ts | not yet |
| `keeper` | 19 | A town kept in peace: a campaign town kept by the computer with nobody hostile about raises no works of war (docs/DESIGN.md, "A visit"). | game | keeper.test.ts | not yet |
| `larder` | 97 | Towns eat their food on the map: each season a town's people eat from its food store, a town that cannot goes hungry, and one hungry long enough loses its grown people, never a child (docs/DESIGN.md, "Stores"). | campaign, drift, township | larder.test.ts | not yet |
| `leaders` | 547 | The leader of each civilisation and everything they say. | none | none of its own | not yet |
| `lessons` | 59 | Lessons for the moment they are needed: things a first battle's list of steps cannot teach in order, because | calamity, creed, data, famine, game | lessons.test.ts | not yet |
| `map` | 310 | Procedural, point-symmetric two-player map generation. | none | none of its own | not yet |
| `marauders` | 157 | The marauders over a long battle: they keep pace with the age, and a burnt camp is not the end of them. | game | marauders.test.ts | not yet |
| `muster` | 50 | A soldier costs a person (docs/DESIGN.md, step 1). | data, game | muster.test.ts | not yet |
| `naming` | 52 | Your own names: the name the player gives their people and their ruling house, made safe and kept, used where the game names them. | data | naming.test.ts | not yet |
| `notable` | 50 | Notable people: the few a nation knows by name. Nothing here decides who they are; it reads what the rules | champion, game, hero | notable.test.ts | not yet |
| `notableweight` | 113 | The weight of notable people: a home known for what it carries in, a veteran of their own town, and the grief and dip in standing a loss leaves (plain numbers for drift.ts to read). | game, township (types only) | notable-weight.test.ts | not yet |
| `nursery` | 51 | Children. A child is never a unit on the map: it is an entry in the record of the house it was born to (its | data | nursery.test.ts | not yet |
| `orphans` | 77 | Children taken in: a town left with no grown people sends its children, with their ages, to the nearest town of its own people, or of the nearest other people if it has none (docs/DESIGN.md, "Children are never shown"). | ageing, campaign, township | orphans.test.ts | not yet |
| `path` | 266 | Grid A* with rectangle goals and line-of-sight smoothing. | none | none of its own | not yet |
| `portrait` | 240 | Portraits: which woodblock icon stands beside a person, and which marks sit over it (docs/DESIGN.md, "Icons tell | campaign, champion, conquered, famine, game, grief, household, notableweight, township | portrait.test.ts | not yet |
| `powers` | 92 | What a leader learns as they rise. At three ranks of veterancy (Blooded, Veteran, Legend) a leader comes into one | data, hero | powers.test.ts | not yet |
| `prices` | 114 | Prices by kind: a thing bought on the map is paid in what it is made of, from the town where it is done first (docs/DESIGN.md, "Stores"). | stores, township | prices.test.ts | not yet |
| `primer` | 107 | Teaching the campaign: what a new player is told to do first, and the page that explains the rest. | beaten, campaign, champion, creed, hero, powers, story, visit | primer.test.ts | not yet |
| `raidnews` | 49 | The season's news of the bands as plain data, one entry point (`seasonNews`) for whatever shows it; and a campaign's tally. | campaign, threats | raidnews.test.ts | not yet |
| `rescue` | 130 | Getting captives back without burning the camp down, and what a camp's keeper should do about it. | creed, game, path | rescue.test.ts | not yet |
| `rivalrule` | 178 | Rivals live by the same rules (docs/DESIGN.md): a computer-led nation's towns on record, idle armies sent home, names made on the map, and garrisons where its towns need them. | armytown, campaign, conquered, data, seasonfolk, threats, township | rivalrule.test.ts | not yet |
| `scenario` | 415 | Scripted missions: a fixed set-up, a list of objectives and a win or lose condition. | creed, game, map, rescue | none of its own | not yet |
| `seasonfolk` | 95 | A town's people on the map, season by season (docs/DESIGN.md, "People come only by birth"). | ageing, campaign, creed, data, nursery, township | none of its own | not yet |
| `sieges` | 38 | A siege nobody watches: a walled, manned town's defence counts for more when the battle is settled on the map. | campaign, data, township | sieges.test.ts | not yet |
| `stores` | 94 | Stores replace supplies (docs/DESIGN.md, "Stores"): a nation's supplies are what its towns hold above their working stock, and every gain or loss on the map is carried into the towns. | campaign, township | stores.test.ts | not yet |
| `story` | 193 | The story of a campaign: places with names and a past, things that happen to the whole world, tales that are | campaign, creed | story.test.ts | not yet |
| `tavernfall` | 24 | The tavern as a town falls. As a town grows less moral its tavern keeps later hours and takes more gold; what is | creed | tavernfall.test.ts | not yet |
| `temper` | 127 | A leader's temperament, as answered by whoever plays them in the voice booth. It steers how the | none | none of its own | not yet |
| `threats` | 396 | Threats of men on the map (docs/DESIGN.md, step 4): bands that belong to no nation, choose a town and strike it: who the bands are, how a town struck defends itself, the report, and captives held and got back. | acts, ageing, campaign, creed, drift, stores, townfaith, township | threats.test.ts | not yet |
| `townfaith` | 84 | Faith is a town's (docs/DESIGN.md): every town's own standing between piety and decadence, and the nation's as the mean of its towns'. | campaign, story | townfaith.test.ts | not yet |
| `township` | 200 | Towns that keep their people and their stores (docs/DESIGN.md, step 2). | ageing, campaign, household, notableweight | township.test.ts | not yet |
| `visit` | 144 | A visit: from the campaign map the player enters a town of their own, with no enemy there, and plays a stretch | campaign, data, driftintown, game, governor, stores, townfaith, township | visit.test.ts | not yet |
| `wrath` | 29 | How hard acts of God fall on a people (docs/DESIGN.md, "Acts of God"). | game | wrath.test.ts | not yet |
