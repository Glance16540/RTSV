# Hearth & Empire (RTSV)

A browser real-time strategy game with a classic angled RTS camera. Raise a village from the
Stone Age to the Gunpowder Age, one family at a time, and destroy the rival tribe.

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

**Six peoples.** Choose yours on the start screen; rivals take others.

| People | Bonuses | Only they train |
| --- | --- | --- |
| Stonekin | Buildings +25% health, 25% faster building, towers shoot further | Shieldbearer: arrows do half damage; Trebuchet (Middle Ages): out-ranges every engine of its age |
| Steppe Riders | Cavalry 15% cheaper and 10% faster | Lancer: a crushing first blow after a run-up; Horse Archer (Iron Age): shoots from the saddle |
| Hearthfolk | Farms +25%, children 25% sooner, bigger houses | Hearthguard: fights harder near its own houses; Herbwife (Iron Age): quick, cheap healer |
| Forgeborn | Research 30% faster and 15% cheaper, tougher siege | Fire Thrower: scorches a group and sets buildings alight; Organ Gun (Gunpowder Age): tears up packed infantry |
| Dawn Court | Cheaper Shamans and Prophets, faster faith, stronger healing | Zealot: mends itself with every blow; Dawn Templar (Middle Ages): armoured horseman who does the same |
| Wildborn | Game yields 50% more, cheaper hounds and mammoths, wolves never attack them | Wolf Rider: fast raider on a great wolf; War Bear (Iron Age): strikes faster as it is wounded |

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
- *In a Tavern* a woman becomes a milkmaid and a man a patron. A milkmaid brings in gold. A patron
  eats and drinks your food away, but soldiers are trained faster for every patron. Each adds
  decadence, the whole town gathers a little slower for the distraction, and a house with someone
  at the tavern raises no children until they come home.
- *Mercenaries.* With anyone in the tavern you can hire swords for gold alone, and they appear at
  once. They cost more than soldiers you raise yourself, want wages every minute, and walk away
  when the gold runs out.
- *Plague.* In a Worldly or Decadent town a crowded tavern is where plague breaks out, striking
  everyone nearby. It never starts in a town that has kept the faith.

Where your people stand on the scale between piety and decadence sets their creed:

- **Devout**, then **Righteous**: children come sooner, faith gathers faster, healing and morale
  are stronger. A plague passes among the Devout in half the time, and among the Righteous it does
  not take hold at all. They research more slowly and trade on worse terms.
- **Worldly**, then **Decadent**: soldiers are trained faster, gold is mined faster and the market
  pays more. But villagers are distracted from their work, children come later, plagues last
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
  troops and spreads between them) and Earthquake (shatters buildings).

**Unique units.** War Mammoth (tramples everything around its target), Shaman (heals and cures
plague), Prophet (calamities), Warlord (hero aura), Catapult (splash damage, helpless up close).

**Wildlife.** Deer graze near each base: send a villager to hunt one and it is carved up for
food. Wolf packs roam the wilds and attack anyone who strays close.

**Town bell.** Ring it at the Town Center and villagers run to shelter in Town Centers and Watch
Towers, safe from harm and adding to the arrow fire. Ring the all-clear and they return to work.

**Walls and gates.** Drag out lines of Palisade (Stone Age) or Stone Wall (Bronze Age). Walls
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
  march, when battles are won and lost, and when they fall. All 240 lines are written and shown
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
  A rival can win the same way, so a runaway neighbour has to be stopped.
- **Each people plays differently on the map**, and each leader has a temperament: some are
  cautious builders, some raid at poor odds, some are quick to make peace.
- **Buildings.** Each territory has three slots (four in a capital): Farmland for income, a
  Barracks, Archery Range or Stable to raise troops there, and a Fortress for defence.
- **Armies** are made of companies of infantry, archers and cavalry, up to twelve. Cavalry
  rides down archers, archers wear down infantry, infantry stops cavalry. An army that wins a
  battle becomes veteran: stronger on the map and harder-hitting in real-time battles.
- **Ages.** Spend supplies to bring your whole people into the next age. Every age makes your
  armies a tenth stronger on the map, and your real-time battles begin in that age with its weapons
  already in hand (swordsmen in place of clubmen, and so on). Rivals advance too.
- **Special land.** Some territories have gold hills, rich soil, high ground or horse plains.
  Land on the rim of the map may be coast: it pays a little more, and a siege battle there is
  fought around a great lake with docks and ships. Build a Harbour on a coast and an army
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

## Generated art

The game runs with built-in procedural models and emoji icons. To replace them, drop icons,
`.glb` models or title art into `public/assets/` — see [docs/ASSET_BRIEF.md](docs/ASSET_BRIEF.md)
for filenames and a ready-made generation prompt.

## Code layout

- `src/sim/scenario.ts` — scripted missions and their objectives
- `src/sim/leaders.ts` — each people's leader and their lines
- `src/sim/campaign.ts` — Conquest rules: territories, armies, turns, battle set-up
- `src/client/overworld.ts` — the Conquest map screen
- `src/sim/` — the game simulation. No DOM or rendering, runs headless at 20 ticks per second.
  - `data.ts` — every unit, building, technology and balance number
  - `game.ts` — entities, orders, economy, combat, families
  - `map.ts`, `path.ts` — map generation and A* pathfinding
  - `ai.ts` — computer opponent
- `src/client/` — Three.js renderer, procedural models, HUD and input
- `tests/` — simulation tests
