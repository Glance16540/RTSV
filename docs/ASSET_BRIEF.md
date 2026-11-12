# Asset brief for Hearth & Empire

The game loads generated assets automatically. Drop files into `public/assets/` using the
exact names below and restart `npm run dev`. Anything missing keeps its built-in emoji icon
or procedural model, so assets can arrive in any order.

| Kind | Folder | Format |
| --- | --- | --- |
| Icons | `public/assets/icons/` | square PNG, 256×256, transparent or dark background |
| 3D models | `public/assets/models/` | `.glb`, static (no rig), textured, under ~15k triangles |
| Title art | `public/assets/art/title.jpg` | 16:9 |

If a model comes out facing the wrong way or the wrong size, add an entry to
`public/assets/tweaks.json`, for example `{ "knight": { "yaw": 3.14, "scale": 1.2, "y": 0 } }`.

## Prompt to paste into Claude Cowork

> I'm making a real-time strategy game set from the Stone Age to the Middle Ages. Use
> Higgsfield to generate the assets below with my free-trial generations. Keep one consistent
> style for everything: hand-painted, warm earthy palette, readable at small size, in the
> spirit of classic late-90s historical strategy games (no logos, no text, no existing game's
> characters). Save every file with the exact filename given, put them in a Google Drive
> folder called "RTSV assets" with subfolders `icons`, `models` and `art`, and tell me which
> ones failed.
>
> **1. Title art** — `art/title.jpg`, 16:9: a Stone Age village of thatched huts at dawn
> growing into a walled medieval town on the far hill, a family in the foreground.
>
> **2. Icons** — square PNG 256×256, one subject centred, painted, dark vignette background,
> no text. Filenames in `icons/`:
> - Units: `villager_m` (man farmer), `villager_f` (woman farmer), `clubman`, `slinger`,
>   `spearman`, `swordsman`, `bowman`, `crossbowman`, `rider` (light scout cavalry), `knight`,
>   `mammoth` (war mammoth with rider), `shaman`, `prophet` (hooded robed seer with staff),
>   `warlord` (crowned hero), `catapult`
> - Buildings: `towncenter`, `house`, `storehouse`, `farm`, `barracks`, `range` (archery
>   range), `stable`, `temple`, `blacksmith`, `workshop` (siege workshop), `tower`, `palisade` (log wall), `stonewall`, `gate`, `market` (trading stalls), `wonder` (great stepped monument)
> - Resources: `food` (meat), `wood` (logs), `gold` (coins), `stone` (cut stone),
>   `population` (group of people)
> - Map objects: `node_tree`, `node_berries`, `node_gold`, `node_stone`
> - Commands: `attackmove` (crossed swords), `stop` (raised hand), `ageup` (rising sun over
>   ruins), `couple` (man and woman holding hands), `births_pause` (empty cradle),
>   `births_resume` (cradle with baby), `evict` (open door), `plague` (green skull),
>   `quake` (cracked earth), `bell` (bronze town bell), `bell_clear` (white dove), `deer`, `wolf`,
>   `node_carcass` (haunch of meat)
> - Technologies: `stonetools`, `bronzetools`, `wheelbarrow`, `fertility` (fertility
>   idol), `extendedfamily` (large family), `herbalism` (herbs and mortar), `weapons1` (bronze
>   sword), `weapons2` (iron sword), `weapons3` (steel sword), `armor1` (hide armor), `armor2`
>   (scale armor), `armor3` (plate armor), `ballistics` (flaming arrows on a tower)
>
> - Leader portraits (head and shoulders, painted, facing slightly left): `leader_stonekin`
>   (grizzled bearded thane), `leader_steppe` (young horsewoman queen), `leader_hearth` (kind
>   older matriarch), `leader_forge` (sharp-eyed artificer with goggles), `leader_dawn` (serene
>   veiled seer), `leader_wild` (scarred hunter in wolf pelt)
>
> **3. 3D models** — GLB, textured, static (no rigging or animation), low-poly (about 10k
> triangles), one object per file, standing upright, front facing forward. For each one,
> first generate a clean reference image of the object alone on a plain background from a
> three-quarter top-down view, then convert it to 3D. Do buildings first. Filenames in
> `models/`:
> - Buildings (Stone Age look: mud walls, thatch): `house`, `towncenter`, `storehouse`,
>   `barracks`, `range`, `stable`, `temple` (stepped stone shrine), `blacksmith`, `workshop`,
>   `tower`, `farm` (flat square crop field)
> - Units (neutral standing pose): `villager_m`, `villager_f`, `clubman`, `slinger`,
>   `spearman`, `swordsman`, `bowman`, `crossbowman`, `rider`, `knight`, `mammoth`, `shaman`,
>   `prophet`, `warlord`, `catapult`, `musketeer`, `bombard` (cannon), `javelineer`, `hound` (war dog), `chariot`, `berserker`,
>   `pikeman`, `grenadier`, `ram` (battering ram), `scorpion` (bolt thrower), `hussar`, `strategist`, `shieldbearer`, `lancer`, `hearthguard`,
>   `firethrower`, `zealot`, `wolfrider`,
>   `deer`, `wolf`
> - If generations remain, later-age building variants named `<building>_1` (Bronze: timber),
>   `<building>_2` (Iron: stone and shingle), `<building>_3` (medieval: plaster and red tile),
>   starting with `house` and `towncenter`.
