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

**Also:** fog of war, minimap, four resources, farms, storehouses, towers, blacksmith and temple
research, control groups, rally points, synthesised sound, and an AI opponent with three
difficulty levels that plays by the same rules.

## Controls

| Input | Action |
| --- | --- |
| Left-click / drag | Select (double-click selects all of a type on screen) |
| Right-click | Move, gather, build, repair, attack, move into a house, set rally point |
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

- `src/sim/` — the game simulation. No DOM or rendering, runs headless at 20 ticks per second.
  - `data.ts` — every unit, building, technology and balance number
  - `game.ts` — entities, orders, economy, combat, families
  - `map.ts`, `path.ts` — map generation and A* pathfinding
  - `ai.ts` — computer opponent
- `src/client/` — Three.js renderer, procedural models, HUD and input
- `tests/` — simulation tests
