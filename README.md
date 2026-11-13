# Hearth & Empire (RTSV)

A browser real-time strategy game with a classic angled RTS camera. Raise a village from the
Stone Age to the Gunpowder Age, one family at a time, and destroy the rival nation.

Built with TypeScript, Three.js and Vite. All art is procedural, so there are no assets to download.

## Run it

```bash
npm install
npm run dev      # then open the printed URL
```

```bash
npm test         # headless simulation tests (includes an AI-vs-AI match)
npm run build    # type-check and build to dist/
```

Add `?seed=123` to the URL to replay a specific map.

## What is in the game

**Families.** Villagers are men and women. Train them at the Town Center, or build a House and
move one man and one woman in (right-click the house, or press *Find a couple*). A housed couple
raises new villagers on their own for half the usual food. Each child takes a little longer than
the last, and you can pause a family when the village is big enough. Newborns are children: small,
fragile and unable to work until they grow up, when they take up a parent's trade.

**Ages.** Stone Age → Bronze Age → Iron Age → Middle Ages → Gunpowder Age. Each age unlocks buildings, units and
technologies, and changes how your settlement looks.

**Play styles.** Each nation belongs to a group (raiders, builders, farmers, scholars, the faithful, traders,
warriors; see `STYLES` in `src/sim/data.ts`). The Norse and Mongols are raiders: they start as a war band with no
Town Center, settle when they choose, and their fighters carry off enemy villagers, who join the tribe.
Every group has one rule that is its own (`STYLE_RULES`): the builders' buildings mend themselves when the town is
left in peace, each farm of the farmers makes room for one more villager, the scholars gather faster for every
technology they learn, the faithful are healed and cured round their Church, the traders' Markets earn gold by
themselves, and a warrior strikes harder for every foe he has killed (every soldier's kills are shown on his panel).

**Thirteen nations.** Choose yours on the start screen; rivals take others. Any of them can turn out
pious or decadent: that is decided by how they are ruled, not by who they are.

| People | Bonuses | Only they train |
| --- | --- | --- |
| Romans | Buildings +25% health, 25% faster building, towers shoot further | Legionary: arrows do half damage; Trebuchet (Middle Ages): out-ranges every engine of its age |
| Mongols | Cavalry 15% cheaper and 10% faster | Lancer: a crushing first blow after a run-up; Horse Archer (Iron Age): shoots from the saddle |
| Franks | Farms +25%, children 25% sooner, bigger houses | Hearthguard: fights harder near its own houses; Herbwife (Iron Age): quick, cheap healer |
| Chinese | Research 30% faster and 15% cheaper, tougher siege | Fire Lancer: scorches a group and sets buildings alight; Organ Gun (Gunpowder Age): tears up packed infantry |
| Arameans | Cheaper priests, prophets and healers, faster faith, stronger healing | Zealot: mends itself with every blow; Temple Guard (Middle Ages): armoured horseman who does the same |
| Norse | Game, berries and fish gathered 50% faster, cheaper hounds and mammoths, wolves never attack them | Wolf Rider: fast raider on a great wolf; War Bear (Iron Age): strikes faster as it is wounded |
| Egyptians | Farms +20%, 15% faster building | Khopesh Guard: cuts down infantry; War Chariot (Iron Age): a heavy charge |
| Babylonians | Research 15% faster, buildings +15% health | Sapper: ruinous against buildings; Gate Guard (Iron Age): shrugs off missiles, fights harder at home |
| Persians | Villagers carry 3 more, war beasts 20% cheaper | Immortal (Iron Age): mends as it fights; War Elephant (Middle Ages): tramples and tears down buildings |
| Greeks | Research 20% cheaper, soldiers +1 armour | Hoplite: resists missiles and stops cavalry; Companion Cavalry (Iron Age): a crushing charge |
| English | Farms +10%, towers hit harder | Longbowman (Iron Age): out-ranges other archers; Billman (Middle Ages): bane of cavalry |
| Abbasids | Cavalry 10% faster, research 10% cheaper | Camel Rider: rides down cavalry; Mameluke (Middle Ages): strikes from a few paces off |
| Japanese | Soldiers +1 attack, villagers gather 5% faster | Samurai (Iron Age): quick, deadly to infantry; Ashigaru Gunner (Gunpowder Age): cheap matchlock |

**Generations.** Villagers grow old: after a long working life they slow down as elders and
eventually die, so a village lasts only as long as its families keep raising children. A child of
two gifted parents sometimes inherits both gifts, and a house that raises many children gains
renown: more room and quicker births.

**Names, families and traits.** Every villager has a name, and about a third are Strong (gather
faster), Swift, Hardy (more health) or Skilled (build faster). Children usually inherit a trait
from their mother or father and carry the family name of the house they were born in, so who you
house together matters.

**Church and tavern.** Good and evil here follow a biblical pattern: faithfulness is rewarded in
the family and in protection from calamity, and decadence pays in coin while it eats at the home
and at honest work. Two buildings pull your people opposite ways, and both run on villagers you
station inside them, who stop doing other work while they are there. Right-click the building with
villagers to station them (four to a building, eight counted in all); its buttons send them back
out.

- *In a Church* a man becomes a monk and a woman a nun. Each adds piety and brings the town's
  children sooner. Taking vows, they leave the house they shared.
- *What goes on at the tavern.* Hearts rise from a busy tavern in a Worldly or Decadent town, and from houses where a couple is at home. Almost nothing comes of it: the maids and patrons take care that it does not. Once in a very long while (tens of minutes, a little sooner in a Decadent town) a tavern with both has a child that belongs to no household, costs no food and needs no house.
- *In a Tavern* a woman becomes a milkmaid and a man a patron. A milkmaid brings in gold. A patron
  eats and drinks your food away, but soldiers are trained faster for every patron. Each adds
  decadence, the whole town gathers a little slower for the distraction, and a house with someone
  at the tavern raises no children until they come home.
- *Mercenaries.* With anyone in the tavern you can hire swords for gold alone, and they appear at
  once. They cost more than soldiers you raise yourself, want wages every minute, and walk away
  when the gold runs out.
- *Plague.* In a Worldly or Decadent town a crowded tavern is where plague breaks out, striking
  everyone nearby. It never starts in a town that has kept the faith.

What a town believes also decides what it will raise:

- *A holy town* (Devout or Righteous) trains no pagan units: no Shamans and no Berserkers. In
  their place the Church can call a **Priest**, who heals faster than a Shaman and cures plague.
  Nor will it train Slavers or build Work Camps.
- *A Decadent town* can train the **Slaver** at its Tavern and build the **Work Camp**. Right-click
  an enemy villager with a Slaver and he binds them in three seconds and leads them back to a camp
  with room. Every man held makes the whole town gather 10% faster; every woman held makes the
  camp turn out new villagers for its owners sooner. Kill the Slaver on the road, or break the camp, and the captives go
  home as they were, name and all.

Where your people stand on the scale between piety and decadence sets their creed:

- **Devout**, then **Righteous**: children come sooner and more of them live to grow up (one in
  ten is lost in an ordinary town, one in twenty among the Devout, one in fifty among the
  Righteous). Faith gathers faster, healing and morale
  are stronger. A plague passes among the Devout in half the time, and among the Righteous it does
  not take hold at all. They research more slowly and trade on worse terms.
- **Worldly**, then **Decadent**: soldiers are trained faster, gold is mined faster and the market
  pays more. But villagers are distracted from their work, children come later and
  fewer live to grow up (up to more than one in four lost), plagues last
  longer, and faith, healing and morale wither.

Hover over the creed in the top bar to see where you stand. Every few minutes a dilemma is also
put to you (strangers at the gate, a gambling den, a prophet calling a fast): the pious answer
usually costs something now and the worldly one usually pays, and either moves the scale. Rivals
choose for themselves: pious peoples staff a church, worldly ones build a tavern.

**Unit upgrades.** Research re-equips whole lines at once: Slingers become Bowmen, then
Crossbowmen, then Musketeers; Clubmen become Swordsmen; Scout Riders become Knights; Catapults
become Bombards. Existing units change on the spot and new ones are trained in the better form.

**A wide roster.** Thirty-odd unit types with distinct jobs, including Javelin Throwers that
pick off archers, War Hounds, Chariot Archers, Berserkers that strike faster as they are wounded,
Pikemen, Battering Rams that shrug off arrows but cannot fight units, Scorpions, Grenadiers,
Hussars, and a second hero, the Strategist, whose presence saps enemy damage and mends allies.

**Empire Earth-style touches.**
- *Morale:* up to five houses near a Town Center make its defenders take up to 25% less damage.
- *Hero:* one Warlord at a time; allies fighting near him deal +25% damage.
- *Counters:* spearmen beat cavalry and beasts, cavalry runs down archers and siege, archers wear
  down infantry, siege flattens buildings.

- *Prophets and calamities:* from the Iron Age, Prophets spend faith on Plague (sickens enemy
  troops and spreads between them), Earthquake (shatters buildings), Fire from Heaven (sets buildings alight) and
  Blight (empties a rival's farms for a minute). Fire spreads to buildings standing close by, whoever owns them,
  until it burns out or rain comes (`CALAMITY` in `src/sim/data.ts`). Farms yield more in rain and less in dust and snow.

**Unique units.** War Mammoth (tramples everything around its target), Shaman (heals and cures
plague), Prophet (calamities), Warlord (hero aura), Catapult (splash damage, helpless up close).

**Wildlife.** Deer graze near each base: send a villager to hunt one and it is carved up for
food. Wolf packs roam the wilds and attack anyone who strays close.

**Town bell.** Ring it at the Town Center and villagers run to shelter in Town Centers and Watch
Towers, safe from harm and adding to the arrow fire. Ring the all-clear and they return to work.

**Walls and gates.** Drag out lines of Palisade (Stone Age) or Stone Wall (Bronze Age). Each piece
is drawn reaching toward the walls, gates and towers next to it, so a line reads as one wall, with a
heavier post at corners and ends; a gate turns to stand across its wall. Walls
block everyone; a Gate lets only your own units through, so enemies have to break in.

**Garrison.** Alt+right-click a Town Center or Watch Tower to send foot units inside; each one
speeds up its arrow fire. On Normal and Hard the AI walls its base with a palisade and gates.

**Water and ships.** Choose the *Great lake* map and the middle of the world is water. A Dock,
built at the water's edge, launches Fishing Boats that work fish shoals and bring the catch home,
and War Galleys that sink boats and rake anything within bowshot of the shore. In the Gunpowder
Age galleys become Frigates whose broadsides break buildings. Transport Ships carry up to
eight land units across the water: right-click the ship to board at the shore, *Put ashore* to land;
if the ship sinks, everyone aboard is lost. Right-click dry land with a loaded transport and it
sails as close as it can and lands them there. The AI makes landings of its own when its dock is on
the same water as your shore. Ships never leave the water; foot
soldiers with blades cannot reach them, but archers and towers can. The AI fishes and builds a
small fleet too. A dock placed on water with no fish nearby earns a warning.

**Wonder.** In the Middle Ages you can build a Wonder. If it stands for five minutes you win, and
every rival is told the moment it is finished. Richer AIs build them too.

**Stances and patrol.** Soldiers can be Aggressive, Defensive or told to Hold ground, and can
patrol between two points.

**After the match.** The end screen charts every player's score over time and tallies what they
gathered, raised, trained, killed and lost.

**Market.** From the Bronze Age, sell surplus food, wood or stone for gold, or buy what you are
short of. The villager build menu has two pages, settlement and military.

**Rivals and map size.** One to three AI rivals and a Small, Medium or Large map, inland or around a great lake, chosen on the
start screen. With several rivals you choose the sides: a free-for-all, one rival fighting as
your ally, or all of them allied against you. Allies share sight, pass through each other's
gates and win together. An allied AI comes to your defence, joins your attacks, answers a call
(`L` over a spot) and shares a surplus; you can send it resources from a Market.

**Saving.** The 💾 button stores the game in your browser, and it autosaves every two minutes.
*Continue saved game* on the start screen picks it up again.

**Also:** fog of war, minimap, four resources, farms, storehouses, towers, blacksmith and church
research, control groups, rally points, synthesised sound, and an AI opponent with three
difficulty levels that plays by the same rules.

## Missions

*Missions* on the start screen offers three scripted scenarios with objectives shown as you play:

- **First Hearth** — a gentle tutorial: gather, found a family, grow, raise soldiers and drive off
  a wolf pack. Nobody attacks you.
- **Hold the Line** — defend a walled town against eight growing waves of raiders for ten minutes.
- **Race for the Wonder** — two rich kingdoms each try to build a Wonder and keep it standing.

The start screen also has **Settings** (volume, music, edge scrolling, scroll speed) and a switch
for whether villagers grow old.

## Conquest campaign

*Conquest campaign* is the main game. Every campaign is a newly generated world: the map has
anywhere from twelve to twenty-four territories, the capitals fall in different places, and each
faction is a different people led by its own leader. You choose your people, or let chance decide.

Each turn you collect supplies from the land you hold and spend them, then march armies into
neighbouring land.

- **Leaders.** Each rival is led by a named leader who speaks when you first meet, when armies
  march, when battles are won and lost, and when they fall. All 520 lines are written and shown
  on screen; recordings dropped into `public/assets/voice/` are played automatically. See
  [docs/VOICE_SCRIPT.md](docs/VOICE_SCRIPT.md) for every line, its filename and voice direction.
- **Three ways to fight.** A *field battle* is the two armies alone on open ground and is over in
  minutes. A *siege battle* is a full match with towns to build. Or auto-resolve. After a battle
  you fight yourself, your army on the map is whatever actually survived it.
- **Your own leader** speaks for your people when a campaign or match begins, when you win or
  lose, when your town is attacked and when you reach a new age.
- **Diplomacy.** Offer a rival a truce; whether they accept depends on their leader's temper,
  who is stronger and whether you have kept your word before. Rivals keep a truce. You may break
  one, but no leader will make another with an oathbreaker. A stronger, greedy neighbour may demand
  tribute: pay and be left alone for a while, or refuse and be attacked.
- **Alliances.** A rival you are at truce with may agree to an alliance. Allies never attack each
  other, each lends its neighbouring armies to the other's battles (they join a real-time battle
  on your side), and your ally goes first for whoever is at your borders. One alliance at a time;
  when only the two of you are left it ends, with a short truce. Betraying an ally is remembered
  twice over.
- **Gifts and calls for help.** Send any rival supplies to earn goodwill, which makes them readier
  to agree to a truce or an alliance. An ally who loses land asks you to strike at whoever took it
  and thanks you if you do, and an ally with full stores shares with you when yours run low.
- **Two ways to win.** Take every territory, or hold six in every ten for three turns running.
- **A living world map.** The campaign map is a country in three dimensions (`src/client/worldmap.ts`), grown
  from the campaign's seed: coastline, bays, lakes, mountain ranges, rivers, and six kinds of country (`BIOMES`,
  `climateAt`, `biomeOf` in `src/sim/campaign.ts`) laid out differently in every world. The ground is painted by
  what grows there and borders glow in their holder's colour. The sea runs, cloud drifts, birds wheel, ships pass,
  towns smoke, and armies march from land to land. A battle is fought in the country of the land (`BattleConfig.climate`).
  Mountains, rivers and open water bar a march (`terrainOf`, `raiseBarriers`, `Campaign.barriers`): lands whose
  straight road is crossed by one are not neighbours. Roads on the map show where an army can go.
  `?detail=low` draws it plainer (coarser ground, simpler trees, smaller textures) for a weak machine.
  Drag to move, wheel to zoom, click a land to choose it. The flat chart of `src/client/overworld.ts` is shown
  where 3D is not available or with `?map=2d`. Three
  weather fronts cross it turn by turn (`frontsOf`, `weatherAt` in `src/sim/campaign.ts`): an army attacking into
  rain, snow or dust fights at 85 to 90% strength, snow costs a land a supply, and the battle itself is fought in
  that weather. Events are marked where they happen. Unrest ends in revolt unless the holder has an army there
  when it comes to a head; a hoard pays whoever holds the land when it is dug up.
  A rival can win the same way, so a runaway neighbour has to be stopped.
- **Each people plays differently on the map**, and each leader has a temperament: some are
  cautious builders, some raid at poor odds, some are quick to make peace.
- **Buildings.** Each territory has three slots (four in a capital): Farmland for income, a
  Barracks, Archery Range or Stable to raise troops there, a Church or a Tavern, and a Fortress for defence.
- **Faith on the map.** Your people stand somewhere between piety and decadence for the whole campaign (`FAITH`,
  `Faction.virtue` in `src/sim/campaign.ts`). A Church on a land makes them more pious every turn and a Tavern more
  decadent, while paying a supply. The pious hold their own land harder and the Righteous never lose one to unrest,
  but each new age costs them more; the worldly earn more from taverns; the Decadent hire every company for 1 less,
  defend badly, and lose a restless land unless two companies hold it. Your town begins every battle in that creed,
  and half of how far you move it in a battle you fight yourself goes home with your people. Rivals build what
  they believe in.
- **Story.** Every world has five to seven named places, each with a legend (a holy place, a meeting of roads, an
  old stronghold, iron in the ground, a house of learning); whoever holds the land has the good of it. Now and then
  something befalls every people at once: the Long Winter, Years of Plenty, the Season of Iron, a Comet, the Great
  Pestilence. Every four turns a tale is brought before you with a pious answer and a worldly one, each with its
  price; leave it and it settles itself. The 📜 Chronicle button shows the story so far and the places of note.
  The words and numbers are in `src/sim/story.ts`.
- **Armies** are made of companies of infantry, archers and cavalry, up to twelve. Cavalry
  rides down archers, archers wear down infantry, infantry stops cavalry. An army that wins a
  battle becomes veteran: stronger on the map and harder-hitting in real-time battles.
- **Ages.** Spend supplies to bring your whole people into the next age. Every age makes your
  armies a tenth stronger on the map, and your real-time battles begin in that age with its weapons
  already in hand (swordsmen in place of clubmen, and so on). Rivals advance too.
- **Special land.** Some territories have gold hills, rich soil, high ground or horse plains.
  Land on the rim of the map may be coast: it pays a little more, and a siege battle there is
  fought around a great lake with docks and ships. Build a Harbour on a coast or at a sea crossing and an army
  there can sail to any other coast in one march; troops landing from the sea fight at four-fifths
  strength. Rivals build harbours and make landings too. Harbours are marked ⚓ on the map, and a coast of
  yours within reach of a rival's harbour says so.
- **The Warlord** marches with one army and adds to its strength. If that army is destroyed he
  falls with it, and a new one can be summoned at your capital.
- **Battles.** When an army enters land held by someone else, fight it yourself as a real-time
  match or auto-resolve it; the map shows your odds first. In a real-time battle each side fields the troops it has on the map,
  Warlord included; a Fortress starts its defender in the Bronze Age with towers. Armies in
  neighbouring land add weight to the fight and join a real-time battle as allies.

Rivals take their turns after yours and fight each other too. The campaign is saved in your browser after every action.

## Controls

| Input | Action |
| --- | --- |
| Left-click / drag | Select (double-click selects all of a type on screen) |
| Right-click | Move, gather, build, repair, attack, move into a house, set rally point |
| Alt + right-click | Send units inside a Town Center or Watch Tower |
| Shift + right-click | Queue an order after the current one |
| Arrow keys / screen edge | Scroll |
| Mouse wheel / middle-drag | Zoom / pan |
| `Q W E R T` `A S D F G` `Z X C V B` | Command card buttons, by position |
| `H` `.` `,` `Space` | Town Center, next idle villager, whole army, centre on selection |
| `Ctrl+1-9` / `1-9` | Set / recall control group |
| `Shift`-click while placing | Place several buildings |
| `L` | Call allies to the spot under the cursor |
| `Del` `Esc` `P` `M` | Destroy selected, cancel, pause, mute |

## Hills, mountains and icons

Skirmishes and campaign battles are fought over hills and mountain ranges (`?flat=1` gives level
ground; missions stay flat). A blow struck from clearly higher ground lands a quarter harder and one
struck uphill lands softer; archers and engines above their target reach one tile farther. Mountains
cannot be crossed or built on, and a pass is always left between the homes. Buildings need nearly
level ground.

The interface icons are woodcut-style pictures in `public/assets/icons/`, cut from generated sheets.
`scripts/icon-sheets.json` lists every icon and the prompt used; `node scripts/slice-icons.cjs <folder>`
cuts new sheets (`sheet0.png` … `sheet8.png`) into icons.

## Your leader

*Your leader* on the menu (and on the campaign map) opens the hero creator: name them, choose a man or a
woman, a calling (Warlord or Strategist), where six points go (Might, Guard, Vigour), what veterancy
hardens (strength, armour, or both by turns) and how they look. One leader is kept per nation on your
device. In battle the first hero of that calling you raise is your leader: enemies felled near them are
their deeds, and deeds raise them through five ranks. A holy town's leader lends armour to those near;
a decadent town's leader binds enemy villagers for the Work Camp and makes the camp fill the town
faster. They are still flesh: a blow always tells, and one who falls comes back a rank lower. The rules
are in `src/sim/hero.ts`.

## Systems board

[docs/systems-board.html](docs/systems-board.html) shows every system in the game, how far along it
is and what it still lacks, first as a whiteboard of clouds and bubbles and then as cards, with rosters of nations, units, buildings and research read from the
game's data. What each system has and lacks is written in `scripts/systems.mjs`; edit it and run
`npm run board` to regenerate the page.

## Voicing the leaders

Send [docs/voice-booth.html](docs/voice-booth.html) to whoever is voicing a leader. It is one
self-contained file: they open it in a browser, pick a leader, record each line with their
microphone (listening back and redoing any they like), and download a single zip. Nothing is
uploaded anywhere.

The common people speak too (`src/sim/folk.ts`): ten villager jobs and six kinds of warrior, every line written
for a holy town, an ordinary one and a decadent one. The booth's "Or speak for the people" section records them,
three voices to a part; a recording named by `folkKey` in `public/assets/voice/` is played when one of them is
clicked on, ordered, or caught in a raid (`bark` in `src/client/voice.ts`).

Every nation offers two leaders, a man and a woman, each with a full set of lines of their own.
The booth lists both, and the zip records which was voiced, so
the game is led by whichever leader your friend played.

The leader is only a starting point. In the booth your friend can rename them, give them a new
title and a portrait (one of 30 stock museum portraits, credited in
[docs/PORTRAIT_CREDITS.md](docs/PORTRAIT_CREDITS.md), or any picture of their own), and rewrite any line in their own words; the zip then carries a
`character_<nation>.json` and the campaign shows and speaks the character they made. Anything
they leave alone stays as written. The nation, and whether the leader is a man or a woman, come
from the leader they picked. They can also send a character with no recordings at all: the booth is laid out in three steps (who
they are, how they rule, words and voice), any of which can be sent on its own, and a saved file can
be opened in the booth again to carry on later.

The booth also asks eight questions about how the leader rules. The answers make a temperament
(warlike or peaceable, pious or worldly, digs in or roams, grasping or open-handed) that travels in
the same file. When the computer plays that nation it follows it: when it first attacks and with
how many, whether it walls its town, whether its people turn to the church or the tavern, and on
the campaign map how it bargains, fortifies and picks its fights. The questions and what each
answer means are in `src/sim/temper.ts`.

Unzip what they send back into `public/assets/voice/` and restart the game. The recordings play
whenever those lines appear, and if they gave their name the leader is shown as "voiced by" them.
Run `npm run voice-booth` to regenerate the page after changing any lines.

## Generated art

The game runs with built-in procedural models and emoji icons. To replace them, drop icons,
`.glb` models or title art into `public/assets/` — see [docs/ASSET_BRIEF.md](docs/ASSET_BRIEF.md)
for filenames and a ready-made generation prompt.

## Code layout

- `src/sim/scenario.ts` — scripted missions and their objectives
- `src/sim/leaders.ts` — each people's leader and their lines
- `src/sim/campaign.ts` — Conquest rules: territories, armies, turns, battle set-up
- `src/sim/story.ts` — named places, world events and tales of the campaign
- `src/client/overworld.ts` — the Conquest map screen
- `src/sim/` — the game simulation. No DOM or rendering, runs headless at 20 ticks per second.
  - `data.ts` — every unit, building, technology and balance number
  - `game.ts` — entities, orders, economy, combat, families
  - `map.ts`, `path.ts` — map generation and A* pathfinding
  - `ai.ts` — computer opponent
- `src/client/` — Three.js renderer, procedural models, HUD and input
- `tests/` — simulation tests

## The drawn look, motion and destruction

- `src/client/shapes.ts` holds the look: banded shade with an ink outline, painted surfaces, and the hand-shaped
  buildings. Add `?outline=0` to the address to turn the outline off.
- Every person is drawn from one rigged human figure with recorded motions, and animals from rigged four-legged
  figures (`src/client/person.ts`, `src/client/beast.ts`; the files are in `public/models/`, all public domain, CC0).
  The camel, the elephant, the mammoth and the bear are made over from the alpaca, the bull and the wolf. The older
  figures built of blocks are gone; until the figure files arrive, people are simply not drawn.
- Buildings shed pieces as they are damaged and fall apart when destroyed.
- Blows draw blood and make a figure flinch. Wounds show (`wounds` in `src/client/person.ts`): below two thirds
  strength a fighter is cut and bloodied and has lost a shield or a helmet, below one third the rest of the armour
  is gone; villagers' clothes tear. Healing puts it all back. The fallen drop with a recorded death; engines fly
  apart and ships sink. `?gore=0` turns the blood and the torn clothes off.

## Marauders and people's records

- Every villager carries a record (`kids`, `captiveKids`, `story` on a unit in `src/sim/game.ts`): children had at
  home, being carried off, children borne in captivity, being freed. It is shown on their panel.
- Marauders are a third party that belongs to no people (`Game.marauders`, `stepLair`). Four minutes in they make
  camp in the wilds, raid the nearest town for women, and grow for every woman they hold. Destroy the camp
  (`lair`) and everyone held goes free; a woman who was held bears no more children but works a quarter harder.
  They are on in skirmishes and sieges; `?marauders=0` leaves them out.
- Computer players hunt the camp (`hunt`, `knowsLair` in `src/sim/ai.ts`): one learns of it by losing a woman or
  coming in sight of it, marches when its army outweighs the band, and comes home once it burns. Idle soldiers
  run down a raiding party near their town.
- On the campaign map (`hordeTurn` in `src/sim/campaign.ts`) marauders take root in a tribal land, grow each turn,
  carry off women from the lands around (costing those lands supplies) and overrun neighbours. Taking their land
  breaks the camp.

## Trial games

`npm run trials` plays computer players against each other and writes `trials.txt`: who won and when, how much of
the time units stood stuck with somewhere to go, and the slowest second. Set `PAIRS=wild:hearth:5,greece:dawn:13`
(people:people:seed) and `MIN=40` to choose the games. It is how the pathing and the computer player are measured.

## Roads, rough ground and the country

- A building is joined to its owner's nearest town centre by a road as soon as it is placed (`layRoad` in
  `src/sim/game.ts`). Units move faster along a road and their routes prefer one.
- Every tile has a cost to cross (`game.moveCost`): sand, snow, marsh and slopes are slower. Routes weigh it,
  so units go round a bog instead of through it.
- A map has a country (`Climate` in `src/sim/map.ts`): green (woods, marsh, beaches), desert, steppe or the
  snowy north. In a skirmish it is chosen in the menu or follows your people's homeland; `?climate=desert`.
- Weather belongs to the match (`Game.stepWeather`), on its own seeded run of chances, and only in a country (the plain maps have none). While it is heavy, rain takes a tile off bows and guns and puts fires out, snow slows everyone off the roads, and a dust storm cuts sight by two tiles and takes a tile off bows and guns. `src/client/weather.ts` draws it; `?weather=rain|snow|dust|clear` holds one kind on screen without changing the match.
- A day is five minutes (`DAY_LENGTH`), the last three tenths of it night (`Game.night`). The sun crosses the sky from dawn to dusk, low and red at either end with long shadows; by night the light is dim and blue, buildings show a lamp and a pool of warm light, and the top bar names the hour. In the dark units see two tiles less (`NIGHT_SIGHT`); buildings see as far as ever. Night also matters to the work camp, which is also drawn living by it: women in the workroom and men breaking stone by day, everyone shut in the bunkhouse at dusk.
- *A Decadent town grows by what it takes.* Its own households are dying out: children come less than half as often as in a temperate town and half of them do not live to grow up, and a villager takes twice as long to raise at the Town Center. What keeps such a town alive is its Work Camp (now twelve captives), whose women still bring villagers at the old pace. Worldly towns are untouched. The computer opponent on Normal or Hard empties its tavern at -60 so as not to end up there; if it does, it builds a camp and sends Slavers.
- *Holding people has a cost.* Each guard watches three captives through the night (`GUARD_WATCH`). A camp with anyone unwatched loses about one a night: they slip out and run for their own Town Center, and can be run down again on the way. A camp with four or more men unwatched may rise instead (`REVOLT_TIME`): the stockade burns, loses a quarter of its strength, and half of everyone held breaks out at once. Nothing gets out by day.
- A Slaver with no captive, right-clicked on his own Work Camp, is posted there as a guard (up to four, `GUARD_DRIVE`): each makes the men held there count a quarter more toward the town's gathering.
- `?fog=0` shows the whole map with no fog of war, for looking at the game rather than playing it.
