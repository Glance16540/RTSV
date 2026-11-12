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
| Stonekin | Buildings +25% health, 25% faster building, towers shoot further | Shieldbearer: arrows do half damage |
| Steppe Riders | Cavalry 15% cheaper and 10% faster | Lancer: a crushing first blow after a run-up |
| Hearthfolk | Farms +25%, children 25% sooner, bigger houses | Hearthguard: fights harder near its own houses |
| Forgeborn | Research 30% faster and 15% cheaper, tougher siege | Fire Thrower: scorches a group and sets buildings alight |
| Dawn Court | Cheaper Shamans and Prophets, faster faith, stronger healing | Zealot: mends itself with every blow |
| Wildborn | Game yields 50% more, cheaper hounds and mammoths, wolves never attack them | Wolf Rider: fast raider on a great wolf |

**Generations.** Villagers grow old: after a long working life they slow down as elders and
eventually die, so a village lasts only as long as its families keep raising children. A child of
two gifted parents sometimes inherits both gifts, and a house that raises many children gains
renown: more room and quicker births.

**Names, families and traits.** Every villager has a name, and about a third are Strong (gather
faster), Swift, Hardy (more health) or Skilled (build faster). Children usually inherit a trait
from their mother or father and carry the family name of the house they were born in, so who you
house together matters.

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

**Wonder.** In the Middle Ages you can build a Wonder. If it stands for five minutes you win, and
every rival is told the moment it is finished. Richer AIs build them too.

**Stances and patrol.** Soldiers can be Aggressive, Defensive or told to Hold ground, and can
patrol between two points.

**After the match.** The end screen charts every player's score over time and tallies what they
gathered, raised, trained, killed and lost.

**Market.** From the Bronze Age, sell surplus food, wood or stone for gold, or buy what you are
short of. The villager build menu has two pages, settlement and military.

**Rivals and map size.** One to three AI rivals and a Small, Medium or Large map, chosen on the
start screen. With several rivals you choose the sides: a free-for-all, one rival fighting as
your ally, or all of them allied against you. Allies share sight, pass through each other's
gates and win together. An allied AI comes to your defence, joins your attacks, answers a call
(`L` over a spot) and shares a surplus; you can send it resources from a Market.

**Saving.** The 💾 button stores the game in your browser, and it autosaves every two minutes.
*Continue saved game* on the start screen picks it up again.

**Also:** fog of war, minimap, four resources, farms, storehouses, towers, blacksmith and temple
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
  march, when battles are won and lost, and when they fall. All 108 lines are written and shown
  on screen; recordings dropped into `public/assets/voice/` are played automatically. See
  [docs/VOICE_SCRIPT.md](docs/VOICE_SCRIPT.md) for every line, its filename and voice direction.
- **Buildings.** Each territory has three slots (four in a capital): Farmland for income, a
  Barracks, Archery Range or Stable to raise troops there, and a Fortress for defence.
- **Armies** are made of companies of infantry, archers and cavalry, up to twelve. Cavalry
  rides down archers, archers wear down infantry, infantry stops cavalry. An army that wins a
  battle becomes veteran: stronger on the map and harder-hitting in real-time battles.
- **Special land.** Some territories have gold hills, rich soil, high ground or horse plains.
- **The Warlord** marches with one army and adds to its strength. If that army is destroyed he
  falls with it, and a new one can be summoned at your capital.
- **Battles.** When an army enters land held by someone else, fight it yourself as a real-time
  match or auto-resolve it; the map shows your odds first. In a real-time battle each side fields the troops it has on the map,
  Warlord included; a Fortress starts its defender in the Bronze Age with towers. Armies in
  neighbouring land add weight to the fight and join a real-time battle as allies.

Rivals take their turns after yours and fight each other too. Hold the last territory standing to
win. The campaign is saved in your browser after every action.

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
