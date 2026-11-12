# Hearth & Empire (RTSV)

A browser real-time strategy game with a classic angled RTS camera. Raise a village from the
Stone Age to the Middle Ages, one family at a time, and destroy the rival tribe.

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

**Ages.** Stone Age → Bronze Age → Iron Age → Middle Ages. Each age unlocks buildings, units and
technologies, and changes how your settlement looks.

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

**Market.** From the Bronze Age, sell surplus food, wood or stone for gold, or buy what you are
short of. The villager build menu has two pages, settlement and military.

**Rivals and map size.** One to three AI rivals and a Small, Medium or Large map, chosen on the
start screen. With several rivals it is a free-for-all: they fight each other as well as you.

**Saving.** The 💾 button stores the game in your browser, and it autosaves every two minutes.
*Continue saved game* on the start screen picks it up again.

**Also:** fog of war, minimap, four resources, farms, storehouses, towers, blacksmith and temple
research, control groups, rally points, synthesised sound, and an AI opponent with three
difficulty levels that plays by the same rules.

## Conquest campaign

*Conquest campaign* on the start screen opens a turn-based map of fifteen territories. Each turn
you collect supplies from the land you hold and spend them to raise armies, reinforce them or
develop territories, then march armies into neighbouring land. When an army enters land held by
someone else there is a battle: fight it yourself as a real-time match, or auto-resolve it.

In a real-time battle each side starts with soldiers and resources in proportion to its strength
on the map, and a developed territory gives its defender a head start. Rivals take their turns
after yours and fight each other too. Hold the last territory standing to win. The campaign is
saved in your browser after every action.

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
| `H` `.` `Space` | Town Center, next idle villager, centre on selection |
| `Ctrl+1-9` / `1-9` | Set / recall control group |
| `Shift`-click while placing | Place several buildings |
| `Del` `Esc` `P` `M` | Destroy selected, cancel, pause, mute |

## Generated art

The game runs with built-in procedural models and emoji icons. To replace them, drop icons,
`.glb` models or title art into `public/assets/` — see [docs/ASSET_BRIEF.md](docs/ASSET_BRIEF.md)
for filenames and a ready-made generation prompt.

## Code layout

- `src/sim/campaign.ts` — Conquest rules: territories, armies, turns, battle set-up
- `src/client/overworld.ts` — the Conquest map screen
- `src/sim/` — the game simulation. No DOM or rendering, runs headless at 20 ticks per second.
  - `data.ts` — every unit, building, technology and balance number
  - `game.ts` — entities, orders, economy, combat, families
  - `map.ts`, `path.ts` — map generation and A* pathfinding
  - `ai.ts` — computer opponent
- `src/client/` — Three.js renderer, procedural models, HUD and input
- `tests/` — simulation tests
