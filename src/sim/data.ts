// Static game data: ages, units, buildings and technologies.

export type ResType = 'food' | 'wood' | 'gold' | 'stone';
export const RES_TYPES: ResType[] = ['food', 'wood', 'gold', 'stone'];
export type Cost = Partial<Record<ResType, number>>;

export type ArmorClass =
  | 'villager'
  | 'infantry'
  | 'ranged'
  | 'cavalry'
  | 'beast'
  | 'prey'
  | 'siege'
  | 'support'
  | 'hero'
  | 'building';

export interface AgeDef {
  name: string;
  cost: Cost;
  time: number;
}

export const AGES: AgeDef[] = [
  { name: 'Stone Age', cost: {}, time: 0 },
  { name: 'Bronze Age', cost: { food: 400, wood: 200 }, time: 45 },
  { name: 'Iron Age', cost: { food: 700, gold: 350 }, time: 60 },
  { name: 'Middle Ages', cost: { food: 1000, gold: 650, stone: 250 }, time: 75 },
  { name: 'Gunpowder Age', cost: { food: 1400, gold: 1000, stone: 400 }, time: 90 },
];

/** Per-player modifiers changed by technologies. */
export interface Mods {
  gather: number; // gather speed multiplier
  carry: number; // carry capacity
  atk: number; // flat attack bonus for military units
  armor: number; // flat armor bonus for military units
  birth: number; // house birth speed multiplier
  housePop: number; // extra population per house
  heal: number; // shaman heal multiplier
  towerAtk: number; // flat attack bonus for buildings
  // Civilisation traits:
  build: number; // construction speed multiplier
  buildingHp: number; // building health multiplier
  towerRange: number; // extra range for towers and town centres
  cavCost: number; // cavalry cost multiplier
  cavSpeed: number; // cavalry speed multiplier
  farm: number; // farm yield multiplier
  techTime: number; // research time multiplier
  techCost: number; // research cost multiplier
  siegeHp: number; // siege engine health multiplier
  faith: number; // prophet faith regeneration multiplier
  clergyCost: number; // shaman and prophet cost multiplier
  hunt: number; // yield multiplier when butchering game
  beastCost: number; // hound and mammoth cost multiplier
}

export const baseMods = (): Mods => ({
  gather: 1,
  carry: 10,
  atk: 0,
  armor: 0,
  birth: 1,
  housePop: 0,
  heal: 1,
  towerAtk: 0,
  build: 1,
  buildingHp: 1,
  towerRange: 0,
  cavCost: 1,
  cavSpeed: 1,
  farm: 1,
  techTime: 1,
  techCost: 1,
  siegeHp: 1,
  faith: 1,
  clergyCost: 1,
  hunt: 1,
  beastCost: 1,
});

export interface UnitDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: Cost;
  time: number;
  age: number;
  hp: number;
  atk: number;
  armor: number;
  /** Attack range in tiles. Melee units use ~0.5. */
  range: number;
  minRange?: number;
  speed: number;
  cooldown: number;
  sight: number;
  pop: number;
  cls: ArmorClass;
  radius: number;
  bonus?: Partial<Record<ArmorClass, number>>;
  splash?: number;
  /** HP healed per second on a nearby ally (support units). */
  heal?: number;
  /** Attack multiplier granted to allies within auraRange. */
  aura?: number;
  auraRange?: number;
  /** Max simultaneously alive per player. */
  limit?: number;
  /** Damage multiplier applied to enemies attacking within auraRange (a Strategist's presence). */
  weaken?: number;
  /** Only this civilisation can train it. */
  civ?: string;
  /** A ship: moves on water only. */
  naval?: boolean;
  /** A pagan unit: a town that keeps the faith (Devout or Righteous) will not train it. */
  pagan?: boolean;
  /** Only a holy town, or only a decadent one, can train it. */
  needs?: 'holy' | 'decadent';
  /** Can seize enemy villagers and lead them to a Work Camp. */
  slaver?: boolean;
  /** How many land units it can carry across water. */
  carry?: number;
  /** Can work fish shoals, bringing the catch to a Dock. */
  fisher?: boolean;
  /** Fraction of damage from arrows, stones and shot that is shrugged off. */
  rangedResist?: number;
  /** Attack multiplier on the first blow after a run of at least three tiles. */
  charge?: number;
  /** Attack multiplier while fighting near home (inside house morale range). */
  homeBonus?: number;
  /** Sets buildings alight: they keep burning after the attack. */
  burn?: boolean;
  /** Health regained with each blow struck. */
  drain?: number;
  /** Can only attack buildings. */
  siegeOnly?: boolean;
  /** Attacks faster the more wounded it is. */
  frenzy?: boolean;
  projectile?: 'arrow' | 'stone' | 'boulder' | 'shot';
  /** Harmless wild animal: never targeted automatically. */
  docile?: boolean;
  /** Maximum faith, spent on calamities (prophets). */
  mana?: number;
}

const U = (d: UnitDef) => d;

export const UNITS: Record<string, UnitDef> = {
  villager: U({
    id: 'villager', name: 'Villager', icon: '🧑‍🌾',
    desc: 'Gathers resources and constructs buildings. A man and a woman sharing a house will raise new villagers.',
    cost: { food: 50 }, time: 16, age: 0, hp: 40, atk: 3, armor: 0, range: 0.5, speed: 2.1,
    cooldown: 1.5, sight: 6, pop: 1, cls: 'villager', radius: 0.28, bonus: { prey: 4 },
  }),
  deer: U({
    id: 'deer', name: 'Deer', icon: '🦌', desc: 'Wild game. Send a villager to hunt it for food.',
    cost: {}, time: 0, age: 0, hp: 20, atk: 0, armor: 0, range: 0.5, speed: 1.4, cooldown: 1, sight: 4, pop: 0,
    cls: 'prey', radius: 0.32, docile: true,
  }),
  wolf: U({
    id: 'wolf', name: 'Wolf', icon: '🐺', desc: 'Wild predator. Attacks anyone who strays too close.',
    cost: {}, time: 0, age: 0, hp: 45, atk: 6, armor: 0, range: 0.5, speed: 2.7, cooldown: 1.3, sight: 5.5, pop: 0,
    cls: 'beast', radius: 0.3,
  }),
  clubman: U({
    id: 'clubman', name: 'Clubman', icon: '🏏',
    desc: 'Cheap Stone Age infantry.',
    cost: { food: 50 }, time: 14, age: 0, hp: 60, atk: 6, armor: 0, range: 0.5, speed: 2.1,
    cooldown: 1.4, sight: 7, pop: 1, cls: 'infantry', radius: 0.3,
  }),
  slinger: U({
    id: 'slinger', name: 'Slinger', icon: '🪃',
    desc: 'Stone Age skirmisher. Weak but ranged.',
    cost: { food: 30, wood: 25 }, time: 15, age: 0, hp: 35, atk: 5, armor: 0, range: 5, speed: 2.1,
    cooldown: 1.9, sight: 8, pop: 1, cls: 'ranged', radius: 0.28, projectile: 'stone',
  }),
  javelineer: U({
    id: 'javelineer', name: 'Javelin Thrower', icon: '🎋',
    desc: 'Short-ranged skirmisher that picks off slingers and archers.',
    cost: { food: 30, wood: 20 }, time: 14, age: 0, hp: 42, atk: 5, armor: 0, range: 4, speed: 2.3,
    cooldown: 1.7, sight: 8, pop: 1, cls: 'ranged', radius: 0.28, projectile: 'arrow', bonus: { ranged: 2 },
  }),
  hound: U({
    id: 'hound', name: 'War Hound', icon: '🐕',
    desc: 'Cheap, fast and fragile. Hounds run down villagers and archers in packs.',
    cost: { food: 35 }, time: 10, age: 0, hp: 34, atk: 5, armor: 0, range: 0.5, speed: 3.3,
    cooldown: 1.0, sight: 8, pop: 1, cls: 'beast', radius: 0.26, bonus: { villager: 1.5, ranged: 1.4 },
  }),
  chariot: U({
    id: 'chariot', name: 'Chariot Archer', icon: '🛞',
    desc: 'A mobile firing platform: shoots like an archer, moves like cavalry.',
    cost: { food: 60, wood: 60 }, time: 20, age: 1, hp: 75, atk: 7, armor: 1, range: 5.5, speed: 3.2,
    cooldown: 1.9, sight: 9, pop: 2, cls: 'cavalry', radius: 0.48, projectile: 'arrow', bonus: { infantry: 1.3 },
  }),
  berserker: U({
    id: 'berserker', name: 'Berserker', icon: '🪓',
    desc: 'Unarmoured shock infantry. The more wounded a Berserker is, the faster it strikes. Pagan: a town that keeps the faith will not train him.', pagan: true,
    cost: { food: 70, gold: 25 }, time: 16, age: 2, hp: 95, atk: 12, armor: 0, range: 0.5, speed: 2.5,
    cooldown: 1.5, sight: 7, pop: 1, cls: 'infantry', radius: 0.3, frenzy: true,
  }),
  pikeman: U({
    id: 'pikeman', name: 'Pikeman', icon: '🔱',
    desc: 'Medieval pike infantry. A wall of points that stops any charge.',
    cost: { food: 50, wood: 35 }, time: 16, age: 3, hp: 120, atk: 10, armor: 2, range: 0.9, speed: 2.1,
    cooldown: 1.5, sight: 7, pop: 1, cls: 'infantry', radius: 0.3, bonus: { cavalry: 4, beast: 3.5 },
  }),
  grenadier: U({
    id: 'grenadier', name: 'Grenadier', icon: '🧨',
    desc: 'Lobs grenades a short way. Each one hurts everything near where it lands, walls included.',
    cost: { food: 60, gold: 50 }, time: 20, age: 4, hp: 80, atk: 20, armor: 1, range: 4.5, speed: 2.0,
    cooldown: 2.6, sight: 8, pop: 1, cls: 'infantry', radius: 0.3, projectile: 'stone', splash: 1.2, bonus: { building: 1.8 },
  }),
  ram: U({
    id: 'ram', name: 'Battering Ram', icon: '🐏',
    desc: 'Smashes buildings and walls, and shrugs off arrows. It cannot fight units at all.',
    cost: { wood: 180, gold: 40 }, time: 28, age: 2, hp: 240, atk: 30, armor: 6, range: 0.6, speed: 1.4,
    cooldown: 2.4, sight: 6, pop: 2, cls: 'siege', radius: 0.5, bonus: { building: 4 }, siegeOnly: true,
  }),
  scorpion: U({
    id: 'scorpion', name: 'Scorpion', icon: '🦂',
    desc: 'A giant crossbow on wheels. One bolt at a time, at long range: deadly to beasts, riders and heroes.',
    cost: { wood: 120, gold: 80 }, time: 26, age: 2, hp: 70, atk: 30, armor: 1, range: 9, minRange: 2,
    speed: 1.4, cooldown: 3.6, sight: 10, pop: 2, cls: 'siege', radius: 0.45, projectile: 'arrow',
    bonus: { beast: 2, cavalry: 1.5, hero: 1.5, building: 0.3 },
  }),
  hussar: U({
    id: 'hussar', name: 'Hussar', icon: '🏇',
    desc: 'The fastest horseman. Raids villagers, archers and siege guns, and is gone before help arrives.',
    cost: { food: 80, gold: 50 }, time: 20, age: 4, hp: 150, atk: 14, armor: 2, range: 0.6, speed: 3.9,
    cooldown: 1.2, sight: 10, pop: 1, cls: 'cavalry', radius: 0.42, bonus: { villager: 1.6, ranged: 1.6, siege: 2.5 },
  }),
  strategist: U({
    id: 'strategist', name: 'Strategist', icon: '📜',
    desc: 'Hero. Only one may live at a time. Enemies fighting near the Strategist deal 20% less damage, and nearby allies are slowly healed.',
    cost: { food: 150, gold: 200 }, time: 40, age: 2, hp: 300, atk: 6, armor: 2, range: 5, speed: 2.3,
    cooldown: 1.8, sight: 10, pop: 2, cls: 'hero', radius: 0.34, projectile: 'stone', weaken: 0.8, auraRange: 7, heal: 3, limit: 1,
  }),
  zealot: U({
    id: 'zealot', name: 'Zealot', icon: '☀️', civ: 'dawn',
    desc: 'Israelites only. Fast, fervent infantry that mends its own wounds with every blow it lands.',
    cost: { food: 55, gold: 20 }, time: 15, age: 1, hp: 85, atk: 9, armor: 1, range: 0.5, speed: 2.6,
    cooldown: 1.3, sight: 8, pop: 1, cls: 'infantry', radius: 0.3, drain: 4,
  }),
  wolfrider: U({
    id: 'wolfrider', name: 'Wolf Rider', icon: '🐺', civ: 'wild',
    desc: 'Norse only. A hunter on a great wolf: quick, savage against villagers and archers, and cheap to feed.',
    cost: { food: 75 }, time: 16, age: 1, hp: 95, atk: 10, armor: 0, range: 0.6, speed: 3.7,
    cooldown: 1.2, sight: 9, pop: 1, cls: 'cavalry', radius: 0.42, bonus: { villager: 1.6, ranged: 1.4 },
  }),
  shieldbearer: U({
    id: 'shieldbearer', name: 'Legionary', icon: '🛡️', civ: 'stonekin',
    desc: 'Romans only. Behind his great shield, arrows, stones and shot do half damage to him.',
    cost: { food: 55, wood: 30 }, time: 17, age: 1, hp: 120, atk: 7, armor: 3, range: 0.5, speed: 1.9,
    cooldown: 1.6, sight: 7, pop: 1, cls: 'infantry', radius: 0.32, rangedResist: 0.5,
  }),
  trebuchet: U({
    id: 'trebuchet', name: 'Trebuchet', icon: '🏗️', civ: 'stonekin',
    desc: 'Romans only. Hurls great stones further than any other engine of its age. Buildings only; helpless up close.',
    cost: { wood: 220, gold: 160 }, time: 36, age: 3, hp: 120, atk: 55, armor: 1, range: 13, minRange: 4,
    speed: 0.9, cooldown: 7, sight: 13, pop: 3, cls: 'siege', radius: 0.55, splash: 1.2,
    projectile: 'boulder', bonus: { building: 4 }, siegeOnly: true,
  }),
  horsearcher: U({
    id: 'horsearcher', name: 'Horse Archer', icon: '🏹', civ: 'steppe',
    desc: 'Mongols only. Shoots from the saddle and is gone before foot soldiers can close.',
    cost: { food: 70, gold: 45 }, time: 20, age: 2, hp: 85, atk: 8, armor: 0, range: 5.5, speed: 3.5,
    cooldown: 1.6, sight: 10, pop: 1, cls: 'cavalry', radius: 0.42, projectile: 'arrow', bonus: { infantry: 1.3 },
  }),
  herbwife: U({
    id: 'herbwife', name: 'Herbwife', icon: '🌿', civ: 'hearth',
    desc: 'Franks only. A quick, cheap healer who keeps up with the army and mends faster than a Shaman. Cannot attack.',
    cost: { food: 55 }, time: 16, age: 2, hp: 50, atk: 0, armor: 0, range: 5, speed: 2.6,
    cooldown: 1, sight: 8, pop: 1, cls: 'support', radius: 0.28, heal: 7,
  }),
  organgun: U({
    id: 'organgun', name: 'Organ Gun', icon: '🎹', civ: 'forge',
    desc: 'Chinese only. A rack of barrels fired together: tears up packed infantry and archers. Cannot fire at what is right beside it.',
    cost: { wood: 180, gold: 160 }, time: 32, age: 4, hp: 100, atk: 16, armor: 1, range: 7, minRange: 1.5,
    speed: 1.3, cooldown: 2.2, sight: 9, pop: 2, cls: 'siege', radius: 0.5, splash: 1.1,
    projectile: 'shot', bonus: { infantry: 1.8, ranged: 1.5 },
  }),
  templar: U({
    id: 'templar', name: 'Temple Guard', icon: '🌅', civ: 'dawn',
    desc: 'Israelites only. Armoured horseman who mends his own wounds with every blow.',
    cost: { food: 110, gold: 70 }, time: 26, age: 3, hp: 150, atk: 13, armor: 3, range: 0.7, speed: 3.2,
    cooldown: 1.5, sight: 9, pop: 2, cls: 'cavalry', radius: 0.45, drain: 5, bonus: { ranged: 1.3 },
  }),
  warbear: U({
    id: 'warbear', name: 'War Bear', icon: '🐻', civ: 'wild',
    desc: 'Norse only. A great beast that strikes faster and faster as it is wounded.',
    cost: { food: 130 }, time: 24, age: 2, hp: 230, atk: 14, armor: 1, range: 0.7, speed: 2.9,
    cooldown: 1.6, sight: 8, pop: 2, cls: 'beast', radius: 0.5, frenzy: true, bonus: { building: 1.3 },
  }),
  khopesh: U({
    id: 'khopesh', name: 'Khopesh Guard', icon: '🗡️', civ: 'egypt',
    desc: 'Egyptians only. Palace infantry whose sickle-swords cut down other foot soldiers.',
    cost: { food: 50, gold: 20 }, time: 15, age: 1, hp: 80, atk: 10, armor: 1, range: 0.5, speed: 2.3,
    cooldown: 1.4, sight: 8, pop: 1, cls: 'infantry', radius: 0.3, bonus: { infantry: 1.4 },
  }),
  warchariot: U({
    id: 'warchariot', name: 'War Chariot', icon: '🛞', civ: 'egypt',
    desc: 'Egyptians only. A heavy chariot: after a run-up its first blow lands with twice the force.',
    cost: { food: 90, wood: 60 }, time: 24, age: 2, hp: 140, atk: 12, armor: 2, range: 0.7, speed: 3.3,
    cooldown: 1.6, sight: 9, pop: 2, cls: 'cavalry', radius: 0.5, charge: 2,
  }),
  sapper: U({
    id: 'sapper', name: 'Sapper', icon: '⛏️', civ: 'babylon',
    desc: 'Babylonians only. Undermines walls and towers: weak in a fight, ruinous against buildings.',
    cost: { food: 45, wood: 30 }, time: 15, age: 1, hp: 70, atk: 6, armor: 0, range: 0.5, speed: 2.3,
    cooldown: 1.5, sight: 7, pop: 1, cls: 'infantry', radius: 0.3, bonus: { building: 3.5 },
  }),
  gateguard: U({
    id: 'gateguard', name: 'Gate Guard', icon: '🚪', civ: 'babylon',
    desc: 'Babylonians only. Heavy infantry of the city gates: shrugs off a third of all missiles and fights harder near its own houses.',
    cost: { food: 70, gold: 35 }, time: 20, age: 2, hp: 130, atk: 10, armor: 2, range: 0.5, speed: 2.0,
    cooldown: 1.5, sight: 8, pop: 1, cls: 'infantry', radius: 0.32, rangedResist: 0.35, homeBonus: 1.3,
  }),
  immortal: U({
    id: 'immortal', name: 'Immortal', icon: '♾️', civ: 'persia',
    desc: 'Persians only. The king\'s own guard: its ranks close up after every blow, mending its wounds as it fights.',
    cost: { food: 65, gold: 30 }, time: 18, age: 2, hp: 105, atk: 11, armor: 2, range: 0.5, speed: 2.3,
    cooldown: 1.4, sight: 8, pop: 1, cls: 'infantry', radius: 0.3, drain: 3,
  }),
  warelephant: U({
    id: 'warelephant', name: 'War Elephant', icon: '🐘', civ: 'persia',
    desc: 'Persians only. Slow and enormous. Tramples everything around its target and tears down buildings.',
    cost: { food: 180, gold: 90 }, time: 36, age: 3, hp: 420, atk: 22, armor: 2, range: 0.9, speed: 1.9,
    cooldown: 2.0, sight: 8, pop: 3, cls: 'beast', radius: 0.7, splash: 1.2, bonus: { building: 1.5 },
  }),
  hoplite: U({
    id: 'hoplite', name: 'Hoplite', icon: '🛡️', civ: 'greece',
    desc: 'Greeks only. A wall of bronze shields and long spears: missiles do a third less, and cavalry breaks on it.',
    cost: { food: 55, gold: 20 }, time: 16, age: 1, hp: 95, atk: 8, armor: 2, range: 0.6, speed: 2.0,
    cooldown: 1.5, sight: 8, pop: 1, cls: 'infantry', radius: 0.3, rangedResist: 0.35, bonus: { cavalry: 2 },
  }),
  companion: U({
    id: 'companion', name: 'Companion Cavalry', icon: '🏇', civ: 'greece',
    desc: 'Greeks only. Shock horsemen who ride in a wedge: a crushing first blow after a run-up.',
    cost: { food: 95, gold: 60 }, time: 24, age: 2, hp: 135, atk: 12, armor: 2, range: 0.7, speed: 3.5,
    cooldown: 1.5, sight: 9, pop: 2, cls: 'cavalry', radius: 0.45, charge: 2.2,
  }),
  longbowman: U({
    id: 'longbowman', name: 'Longbowman', icon: '🏹', civ: 'england',
    desc: 'English only. Out-ranges every other archer of his age.',
    cost: { food: 45, wood: 45 }, time: 18, age: 2, hp: 50, atk: 9, armor: 0, range: 8.5, speed: 2.1,
    cooldown: 1.8, sight: 10, pop: 1, cls: 'ranged', radius: 0.28, projectile: 'arrow',
  }),
  billman: U({
    id: 'billman', name: 'Billman', icon: '🪝', civ: 'england',
    desc: 'English only. His hooked bill drags riders from the saddle: the bane of cavalry.',
    cost: { food: 60, wood: 30 }, time: 17, age: 3, hp: 110, atk: 11, armor: 1, range: 0.7, speed: 2.2,
    cooldown: 1.5, sight: 8, pop: 1, cls: 'infantry', radius: 0.3, bonus: { cavalry: 3.5 },
  }),
  camelrider: U({
    id: 'camelrider', name: 'Camel Rider', icon: '🐪', civ: 'arabs',
    desc: 'Arabs only. Horses shy from camels: he rides down other cavalry.',
    cost: { food: 70, gold: 25 }, time: 18, age: 1, hp: 110, atk: 8, armor: 1, range: 0.7, speed: 3.3,
    cooldown: 1.5, sight: 9, pop: 1, cls: 'cavalry', radius: 0.42, bonus: { cavalry: 2.5 },
  }),
  mameluke: U({
    id: 'mameluke', name: 'Mameluke', icon: '⚔️', civ: 'arabs',
    desc: 'Arabs only. Elite horseman who strikes from a few paces off, and is deadly to other riders.',
    cost: { food: 85, gold: 75 }, time: 24, age: 3, hp: 110, atk: 11, armor: 1, range: 3.5, speed: 3.4,
    cooldown: 1.5, sight: 9, pop: 2, cls: 'cavalry', radius: 0.42, projectile: 'arrow', bonus: { cavalry: 1.6 },
  }),
  samurai: U({
    id: 'samurai', name: 'Samurai', icon: '🎌', civ: 'japan',
    desc: 'Japanese only. A swordsman of rare skill who strikes quickly and cuts down other foot soldiers.',
    cost: { food: 70, gold: 40 }, time: 20, age: 2, hp: 110, atk: 13, armor: 2, range: 0.5, speed: 2.4,
    cooldown: 1.2, sight: 8, pop: 1, cls: 'infantry', radius: 0.3, bonus: { infantry: 1.4 },
  }),
  ashigaru: U({
    id: 'ashigaru', name: 'Ashigaru Gunner', icon: '🔫', civ: 'japan',
    desc: 'Japanese only. A cheap foot soldier with a matchlock: a slow, heavy shot.',
    cost: { food: 50, gold: 35 }, time: 18, age: 4, hp: 55, atk: 20, armor: 0, range: 6.5, speed: 2.1,
    cooldown: 2.6, sight: 9, pop: 1, cls: 'ranged', radius: 0.28, projectile: 'shot',
  }),
  lancer: U({
    id: 'lancer', name: 'Lancer', icon: '🏇', civ: 'steppe',
    desc: 'Mongols only. After a run-up of three tiles its first blow lands with two and a half times the force.',
    cost: { food: 75, gold: 35 }, time: 18, age: 1, hp: 105, atk: 9, armor: 1, range: 0.7, speed: 3.6,
    cooldown: 1.5, sight: 9, pop: 1, cls: 'cavalry', radius: 0.42, charge: 2.5, bonus: { ranged: 1.3 },
  }),
  hearthguard: U({
    id: 'hearthguard', name: 'Hearthguard', icon: '🔥', civ: 'hearth',
    desc: 'Franks only. Cheap infantry that fights half again as hard near its own houses.',
    cost: { food: 45 }, time: 12, age: 0, hp: 65, atk: 6, armor: 1, range: 0.5, speed: 2.1,
    cooldown: 1.4, sight: 7, pop: 1, cls: 'infantry', radius: 0.3, homeBonus: 1.5,
  }),
  firethrower: U({
    id: 'firethrower', name: 'Fire Lancer', icon: '🔥', civ: 'forge',
    desc: 'Chinese only. A short jet of flame that scorches everything around its target and leaves buildings burning.',
    cost: { food: 60, gold: 70 }, time: 22, age: 2, hp: 85, atk: 9, armor: 1, range: 2.2, speed: 1.9,
    cooldown: 0.8, sight: 7, pop: 2, cls: 'infantry', radius: 0.32, splash: 1.3, burn: true, bonus: { building: 1.5 },
  }),
  spearman: U({
    id: 'spearman', name: 'Spearman', icon: '🔱',
    desc: 'Infantry that skewers cavalry and beasts.',
    cost: { food: 40, wood: 25 }, time: 15, age: 1, hp: 70, atk: 6, armor: 1, range: 0.7, speed: 2.1,
    cooldown: 1.5, sight: 7, pop: 1, cls: 'infantry', radius: 0.3,
    bonus: { cavalry: 2.6, beast: 3 },
  }),
  swordsman: U({
    id: 'swordsman', name: 'Swordsman', icon: '⚔️',
    desc: 'Heavy Iron Age infantry. Strong against buildings and other infantry.',
    cost: { food: 60, gold: 35 }, time: 17, age: 2, hp: 115, atk: 13, armor: 2, range: 0.5, speed: 2.1,
    cooldown: 1.4, sight: 7, pop: 1, cls: 'infantry', radius: 0.3,
    bonus: { building: 1.5 },
  }),
  bowman: U({
    id: 'bowman', name: 'Bowman', icon: '🏹',
    desc: 'Ranged unit. Good against infantry, weak against cavalry.',
    cost: { food: 30, wood: 40 }, time: 16, age: 1, hp: 42, atk: 7, armor: 0, range: 6.5, speed: 2.1,
    cooldown: 1.8, sight: 9, pop: 1, cls: 'ranged', radius: 0.28, projectile: 'arrow',
    bonus: { infantry: 1.3 },
  }),
  crossbowman: U({
    id: 'crossbowman', name: 'Crossbowman', icon: '🎯',
    desc: 'Powerful medieval ranged unit.',
    cost: { food: 40, gold: 45 }, time: 18, age: 3, hp: 58, atk: 13, armor: 1, range: 7.5, speed: 2.1,
    cooldown: 2.1, sight: 10, pop: 1, cls: 'ranged', radius: 0.28, projectile: 'arrow',
    bonus: { infantry: 1.3 },
  }),
  musketeer: U({
    id: 'musketeer', name: 'Musketeer', icon: '🔫',
    desc: 'Gunpowder infantry. Slow to reload, but each shot hits hard at range.',
    cost: { food: 50, gold: 60 }, time: 20, age: 4, hp: 70, atk: 24, armor: 1, range: 7.5, speed: 2.0,
    cooldown: 3.2, sight: 10, pop: 1, cls: 'ranged', radius: 0.28, projectile: 'shot',
  }),
  fishboat: U({
    id: 'fishboat', name: 'Fishing Boat', icon: '🛶',
    desc: 'Works fish shoals and brings the catch to a Dock. Carries twice what a villager can.',
    cost: { wood: 60 }, time: 18, age: 0, hp: 60, atk: 0, armor: 0, range: 0, speed: 2.2,
    cooldown: 1, sight: 7, pop: 1, cls: 'siege', radius: 0.42, naval: true, fisher: true,
  }),
  transport: U({
    id: 'transport', name: 'Transport Ship', icon: '🚤',
    desc: 'Carries up to eight land units across water. Right-click it with them to board at the shore; unload at any shore. If it sinks, all aboard are lost.',
    cost: { wood: 110 }, time: 24, age: 1, hp: 200, atk: 0, armor: 1, range: 0, speed: 2.4,
    cooldown: 1, sight: 8, pop: 1, cls: 'siege', radius: 0.5, naval: true, carry: 8,
  }),
  galley: U({
    id: 'galley', name: 'War Galley', icon: '⛵',
    desc: 'Warship. Sinks boats, and rakes anything within bowshot of the water.',
    cost: { wood: 90, gold: 40 }, time: 26, age: 1, hp: 140, atk: 9, armor: 1, range: 6, speed: 2.6,
    cooldown: 2, sight: 9, pop: 2, cls: 'siege', radius: 0.5, naval: true, projectile: 'arrow', bonus: { siege: 1.6 },
  }),
  frigate: U({
    id: 'frigate', name: 'Frigate', icon: '🚢',
    desc: 'Gunpowder warship. Its broadside reaches far inland and breaks buildings.',
    cost: { wood: 160, gold: 110 }, time: 34, age: 4, hp: 260, atk: 24, armor: 2, range: 8, speed: 2.4,
    cooldown: 3, sight: 11, pop: 3, cls: 'siege', radius: 0.55, naval: true, projectile: 'shot', splash: 0.8, bonus: { building: 2, siege: 1.4 },
  }),
  bombard: U({
    id: 'bombard', name: 'Bombard', icon: '💣',
    desc: 'Gunpowder siege gun. Outranges everything and levels buildings. Helpless up close.',
    cost: { wood: 200, gold: 220 }, time: 38, age: 4, hp: 110, atk: 70, armor: 2, range: 11.5, minRange: 3,
    speed: 1.1, cooldown: 6, sight: 12, pop: 3, cls: 'siege', radius: 0.5, splash: 1.6,
    projectile: 'boulder', bonus: { building: 3.5 },
  }),
  rider: U({
    id: 'rider', name: 'Scout Rider', icon: '🐎',
    desc: 'Fast cavalry. Runs down ranged units and siege engines.',
    cost: { food: 70, gold: 30 }, time: 18, age: 1, hp: 95, atk: 8, armor: 1, range: 0.6, speed: 3.5,
    cooldown: 1.4, sight: 9, pop: 1, cls: 'cavalry', radius: 0.42,
    bonus: { ranged: 1.6, siege: 2.2, villager: 1.3 },
  }),
  knight: U({
    id: 'knight', name: 'Knight', icon: '🛡️',
    desc: 'Armored medieval heavy cavalry.',
    cost: { food: 90, gold: 80 }, time: 24, age: 3, hp: 190, atk: 16, armor: 4, range: 0.6, speed: 3.1,
    cooldown: 1.4, sight: 8, pop: 2, cls: 'cavalry', radius: 0.45,
    bonus: { ranged: 1.5, siege: 2 },
  }),
  mammoth: U({
    id: 'mammoth', name: 'War Mammoth', icon: '🦣',
    desc: 'Unique beast. Slow and costly, but tramples everything near its target and smashes buildings.',
    cost: { food: 160, gold: 80 }, time: 30, age: 1, hp: 380, atk: 18, armor: 2, range: 0.8, speed: 1.55,
    cooldown: 2.2, sight: 7, pop: 3, cls: 'beast', radius: 0.7, splash: 1.3,
    bonus: { building: 2.2 },
  }),
  shaman: U({
    id: 'shaman', name: 'Shaman', icon: '🪄',
    desc: 'Heals wounded allies nearby and cures plague. Cannot attack. Pagan: a town that keeps the faith will not train him.', pagan: true,
    cost: { food: 40, gold: 60 }, time: 22, age: 1, hp: 40, atk: 0, armor: 0, range: 5, speed: 2.0,
    cooldown: 1, sight: 8, pop: 1, cls: 'support', radius: 0.28, heal: 5,
  }),
  priest: U({
    id: 'priest', name: 'Priest', icon: '✝️',
    desc: 'Only a Devout or Righteous town can call him. Heals the wounded faster than a Shaman and cures plague. Cannot attack.',
    cost: { food: 50, gold: 40 }, time: 20, age: 1, hp: 50, atk: 0, armor: 0, range: 5.5, speed: 2.1,
    cooldown: 1, sight: 8, pop: 1, cls: 'support', radius: 0.28, heal: 7, needs: 'holy',
  }),
  slaver: U({
    id: 'slaver', name: 'Slaver', icon: '⛓️',
    desc: 'Only a Decadent town will train him. Right-click an enemy villager to seize him and lead him back to a Work Camp. If the Slaver is killed on the way, the captive goes free.',
    cost: { food: 60, gold: 60 }, time: 20, age: 1, hp: 75, atk: 4, armor: 0, range: 0.5, speed: 2.6,
    cooldown: 1.5, sight: 8, pop: 1, cls: 'infantry', radius: 0.3, needs: 'decadent', slaver: true,
  }),
  prophet: U({
    id: 'prophet', name: 'Prophet', icon: '🔮',
    desc: 'Unique. Spends faith to call down calamities: Plague sickens enemy troops and spreads between them, Earthquake shatters buildings. Cannot attack.',
    cost: { food: 100, gold: 150 }, time: 35, age: 2, hp: 50, atk: 0, armor: 0, range: 9, speed: 1.9,
    cooldown: 1, sight: 10, pop: 2, cls: 'support', radius: 0.3, limit: 2, mana: 100,
  }),
  warlord: U({
    id: 'warlord', name: 'Warlord', icon: '👑',
    desc: 'Hero. Only one may live at a time. Allies fighting near the Warlord deal +25% damage.',
    cost: { food: 200, gold: 150 }, time: 40, age: 1, hp: 450, atk: 18, armor: 3, range: 0.6, speed: 2.4,
    cooldown: 1.3, sight: 10, pop: 2, cls: 'hero', radius: 0.38, aura: 1.25, auraRange: 7, limit: 1,
  }),
  catapult: U({
    id: 'catapult', name: 'Catapult', icon: '☄️',
    desc: 'Siege engine. Hurls boulders that devastate buildings and clumped troops. Helpless up close.',
    cost: { wood: 160, gold: 120 }, time: 32, age: 2, hp: 85, atk: 42, armor: 1, range: 9.5, minRange: 2.5,
    speed: 1.25, cooldown: 5, sight: 10, pop: 2, cls: 'siege', radius: 0.5, splash: 1.5,
    projectile: 'boulder', bonus: { building: 3 },
  }),
};

export interface BuildingDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: Cost;
  /** Seconds for a single villager to construct. */
  time: number;
  age: number;
  hp: number;
  size: number;
  pop: number;
  sight: number;
  trains: string[];
  techs: string[];
  /** Wall segment or gate: placed in lines, ignored for victory. */
  wall?: boolean;
  /** Only the owner's units may walk through. */
  gate?: boolean;
  /** How many villagers can shelter inside when the town bell rings. */
  shelter?: number;
  dropoff?: boolean;
  walkable?: boolean;
  /** Only a decadent town can build it. */
  needs?: 'decadent';
  /** A work camp: how many captives it holds. */
  camp?: number;
  /** How many villagers can be stationed inside to work there (clergy in a church, maids in a tavern). */
  staff?: number;
  /** Slavers that can be posted here as guards (a work camp). They are kept in the building's `staff` like other stationed people. */
  guards?: number;
  atk?: number;
  range?: number;
  cooldown?: number;
}

const B = (d: BuildingDef) => d;

export const BUILDINGS: Record<string, BuildingDef> = {
  towncenter: B({
    id: 'towncenter', name: 'Town Center', icon: '🏛️',
    desc: 'Heart of your settlement. Trains villagers, advances ages and accepts all resources. Houses built nearby raise the morale of defenders.',
    cost: { wood: 300, stone: 200 }, time: 90, age: 1, hp: 2200, size: 4, pop: 10, sight: 10,
    trains: ['villager', 'warlord', 'strategist'], techs: [], dropoff: true, atk: 7, range: 7, cooldown: 2, shelter: 12,
  }),
  house: B({
    id: 'house', name: 'House', icon: '🏠',
    desc: '+5 population. Move a man and a woman in and the family will raise new villagers for half the usual food.',
    cost: { wood: 30 }, time: 14, age: 0, hp: 450, size: 2, pop: 5, sight: 4,
    trains: [], techs: [],
  }),
  storehouse: B({
    id: 'storehouse', name: 'Storehouse', icon: '📦',
    desc: 'Drop-off point for all resources. Researches gathering tools.',
    cost: { wood: 60 }, time: 18, age: 0, hp: 500, size: 2, pop: 0, sight: 5,
    trains: [], techs: ['stonetools', 'bronzetools', 'wheelbarrow'], dropoff: true,
  }),
  dock: B({
    id: 'dock', name: 'Dock', icon: '⚓',
    desc: 'Must stand at the water\'s edge. Builds boats and takes in their catch.',
    cost: { wood: 120 }, time: 28, age: 0, hp: 700, size: 3, pop: 0, sight: 7,
    trains: ['fishboat', 'transport', 'galley'], techs: ['up_frigate'], dropoff: true,
  }),
  farm: B({
    id: 'farm', name: 'Farm', icon: '🌾',
    desc: 'Endless but slow source of food for one villager.',
    cost: { wood: 50 }, time: 10, age: 0, hp: 250, size: 3, pop: 0, sight: 3,
    trains: [], techs: [], walkable: true,
  }),
  barracks: B({
    id: 'barracks', name: 'Barracks', icon: '🗡️',
    desc: 'Trains infantry.',
    cost: { wood: 120 }, time: 28, age: 0, hp: 1000, size: 3, pop: 0, sight: 6,
    trains: ['clubman', 'hearthguard', 'shieldbearer', 'zealot', 'slinger', 'javelineer', 'hound', 'spearman', 'swordsman', 'berserker', 'pikeman', 'grenadier', 'khopesh', 'sapper', 'gateguard', 'immortal', 'hoplite', 'billman', 'samurai'], techs: ['up_bowman', 'up_swordsman', 'up_pike'],
  }),
  range: B({
    id: 'range', name: 'Archery Range', icon: '🏹',
    desc: 'Trains archers.',
    cost: { wood: 140 }, time: 28, age: 1, hp: 900, size: 3, pop: 0, sight: 6,
    trains: ['bowman', 'crossbowman', 'musketeer', 'longbowman', 'ashigaru'], techs: ['up_crossbow', 'up_musket'],
  }),
  stable: B({
    id: 'stable', name: 'Stable', icon: '🐴',
    desc: 'Trains cavalry and war beasts.',
    cost: { wood: 150 }, time: 30, age: 1, hp: 900, size: 3, pop: 0, sight: 6,
    trains: ['rider', 'lancer', 'wolfrider', 'chariot', 'mammoth', 'knight', 'hussar', 'horsearcher', 'templar', 'warbear', 'warchariot', 'warelephant', 'companion', 'camelrider', 'mameluke'], techs: ['up_knight'],
  }),
  temple: B({
    id: 'temple', name: 'Church', icon: '⛪',
    desc: 'Station up to four villagers here as monks (men) and nuns (women): each makes your people more pious and brings the town\'s children sooner. Those who enter leave their own house. Also trains shamans and prophets and researches blessings.',
    cost: { wood: 100, stone: 80 }, time: 32, age: 1, hp: 800, size: 3, pop: 0, sight: 6,
    trains: ['shaman', 'priest', 'prophet', 'herbwife'], techs: ['fertility', 'extendedfamily', 'herbalism'], staff: 4,
  }),
  tavern: B({
    id: 'tavern', name: 'Tavern', icon: '🍺',
    desc: 'Station up to four villagers here. Milkmaids (women) bring in gold; patrons (men) drink your food away but speed up the training of soldiers. With anyone inside you can hire mercenaries for gold. All of it makes your people more decadent, slows the town\'s work, empties their own cradles, and in a worldly town invites plague.',
    cost: { wood: 110 }, time: 26, age: 1, hp: 600, size: 3, pop: 0, sight: 5,
    trains: ['slaver'], techs: [], staff: 4,
  }),
  workcamp: B({
    id: 'workcamp', name: 'Work Camp', icon: '⛓️',
    desc: 'Only a Decadent town can build it. Holds up to eight captives seized by Slavers, in two rooms: a workroom where the women are kept by day, and a bunkhouse the men go out to labour from and everyone is shut into at night. Every man held makes the whole town gather faster, and faster still for each Slaver posted as a guard (up to four). Every woman held makes the camp turn out new villagers sooner. If it falls, the captives go home.',
    cost: { wood: 180 }, time: 34, age: 1, hp: 850, size: 4, pop: 0, sight: 5,
    trains: [], techs: [], needs: 'decadent', camp: 8, guards: 4,
  }),
  blacksmith: B({
    id: 'blacksmith', name: 'Blacksmith', icon: '⚒️',
    desc: 'Researches weapons and armor.',
    cost: { wood: 130, gold: 40 }, time: 28, age: 1, hp: 900, size: 3, pop: 0, sight: 6,
    trains: [], techs: ['weapons1', 'weapons2', 'weapons3', 'armor1', 'armor2', 'armor3', 'ballistics'],
  }),
  workshop: B({
    id: 'workshop', name: 'Siege Workshop', icon: '🛠️',
    desc: 'Builds siege engines.',
    cost: { wood: 180, gold: 80 }, time: 34, age: 2, hp: 900, size: 3, pop: 0, sight: 6,
    trains: ['firethrower', 'ram', 'scorpion', 'catapult', 'bombard', 'trebuchet', 'organgun'], techs: ['up_bombard'],
  }),
  wonder: B({
    id: 'wonder', name: 'Wonder', icon: '🗿',
    desc: 'A monument for the ages. If it stands for five minutes after completion, you win. Everyone will know you have built it.',
    cost: { food: 600, wood: 1000, gold: 800, stone: 800 }, time: 240, age: 3, hp: 3200, size: 4, pop: 0, sight: 8, trains: [], techs: [],
  }),
  market: B({
    id: 'market', name: 'Market', icon: '⚖️',
    desc: 'Trade food, wood and stone for gold, or gold for what you are short of.',
    cost: { wood: 150 }, time: 26, age: 1, hp: 800, size: 3, pop: 0, sight: 6, trains: [], techs: [],
  }),
  palisade: B({
    id: 'palisade', name: 'Palisade', icon: '🪵',
    desc: 'Cheap wooden wall. Drag to build a line. Blocks everyone, so leave a gate.',
    cost: { wood: 4 }, time: 4, age: 0, hp: 260, size: 1, pop: 0, sight: 2, trains: [], techs: [], wall: true,
  }),
  stonewall: B({
    id: 'stonewall', name: 'Stone Wall', icon: '🧱',
    desc: 'Strong wall. Drag to build a line. Blocks everyone, so leave a gate.',
    cost: { stone: 6 }, time: 7, age: 1, hp: 1100, size: 1, pop: 0, sight: 2, trains: [], techs: [], wall: true,
  }),
  gate: B({
    id: 'gate', name: 'Gate', icon: '🚪',
    desc: 'A wall segment your own units can walk through. Enemies must break it down.',
    cost: { wood: 30 }, time: 10, age: 0, hp: 600, size: 1, pop: 0, sight: 3, trains: [], techs: [], wall: true, gate: true,
  }),
  tower: B({
    id: 'tower', name: 'Watch Tower', icon: '🗼',
    desc: 'Defensive tower that fires at enemies. Holds four units (Alt+right-click, or the town bell), each speeding up its fire.',
    cost: { wood: 40, stone: 110 }, time: 26, age: 1, hp: 700, size: 2, pop: 0, sight: 10,
    trains: [], techs: [], atk: 9, range: 8, cooldown: 1.8, shelter: 4,
  }),
};

/** Order in which buildings appear in the villager build menu. */
/** Villager build menu, in two pages: settlement and military. */
export const BUILD_PAGES = [
  ['house', 'storehouse', 'farm', 'dock', 'market', 'towncenter', 'temple', 'tavern', 'blacksmith', 'palisade', 'gate', 'stonewall', 'wonder'],
  ['barracks', 'range', 'stable', 'workshop', 'tower', 'workcamp'],
];

/** Market prices for 100 of a resource, in gold. */
export const TRADE: Partial<Record<ResType, { sell: number; buy: number }>> = {
  food: { sell: 45, buy: 85 },
  wood: { sell: 40, buy: 80 },
  stone: { sell: 60, buy: 115 },
};

export interface TechDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: Cost;
  time: number;
  age: number;
  requires?: string;
  /** Re-equips every unit of the first type as the second, now and in future training. */
  upgrade?: [string, string];
  apply: (m: Mods) => void;
}

const T = (d: TechDef) => d;

export const TECHS: Record<string, TechDef> = {
  stonetools: T({
    id: 'stonetools', name: 'Flint Tools', icon: '🪓', desc: 'Villagers gather 15% faster.',
    cost: { food: 80, wood: 60 }, time: 25, age: 0, apply: (m) => { m.gather += 0.15; },
  }),
  bronzetools: T({
    id: 'bronzetools', name: 'Bronze Tools', icon: '⛏️', desc: 'Villagers gather a further 15% faster.',
    cost: { food: 150, gold: 80 }, time: 35, age: 1, requires: 'stonetools', apply: (m) => { m.gather += 0.15; },
  }),
  wheelbarrow: T({
    id: 'wheelbarrow', name: 'Wheelbarrow', icon: '🛒', desc: 'Villagers carry +8 resources per trip.',
    cost: { food: 200, wood: 150 }, time: 40, age: 2, apply: (m) => { m.carry += 8; },
  }),
  fertility: T({
    id: 'fertility', name: 'Fertility Rites', icon: '🍼', desc: 'Families raise children 35% faster.',
    cost: { food: 150, gold: 60 }, time: 35, age: 1, apply: (m) => { m.birth += 0.35; },
  }),
  extendedfamily: T({
    id: 'extendedfamily', name: 'Extended Family', icon: '👨‍👩‍👧‍👦', desc: 'Each house supports +2 population.',
    cost: { wood: 200, stone: 100 }, time: 40, age: 2, apply: (m) => { m.housePop += 2; },
  }),
  herbalism: T({
    id: 'herbalism', name: 'Herbalism', icon: '🌿', desc: 'Shamans heal 60% faster.',
    cost: { food: 120, gold: 100 }, time: 30, age: 1, apply: (m) => { m.heal += 0.6; },
  }),
  weapons1: T({
    id: 'weapons1', name: 'Bronze Weapons', icon: '🗡️', desc: 'Military units +2 attack.',
    cost: { food: 120, gold: 80 }, time: 35, age: 1, apply: (m) => { m.atk += 2; },
  }),
  weapons2: T({
    id: 'weapons2', name: 'Iron Weapons', icon: '🗡️', desc: 'Military units +2 attack.',
    cost: { food: 220, gold: 160 }, time: 45, age: 2, requires: 'weapons1', apply: (m) => { m.atk += 2; },
  }),
  weapons3: T({
    id: 'weapons3', name: 'Steel Weapons', icon: '🗡️', desc: 'Military units +3 attack.',
    cost: { food: 350, gold: 280 }, time: 55, age: 3, requires: 'weapons2', apply: (m) => { m.atk += 3; },
  }),
  armor1: T({
    id: 'armor1', name: 'Hide Armor', icon: '🦺', desc: 'Military units +1 armor.',
    cost: { food: 120, gold: 60 }, time: 35, age: 1, apply: (m) => { m.armor += 1; },
  }),
  armor2: T({
    id: 'armor2', name: 'Scale Armor', icon: '🦺', desc: 'Military units +1 armor.',
    cost: { food: 220, gold: 140 }, time: 45, age: 2, requires: 'armor1', apply: (m) => { m.armor += 1; },
  }),
  armor3: T({
    id: 'armor3', name: 'Plate Armor', icon: '🦺', desc: 'Military units +2 armor.',
    cost: { food: 350, gold: 260 }, time: 55, age: 3, requires: 'armor2', apply: (m) => { m.armor += 2; },
  }),
  ballistics: T({
    id: 'ballistics', name: 'Fortified Arrows', icon: '🏰', desc: 'Towers and Town Centers +4 attack.',
    cost: { wood: 150, stone: 100 }, time: 35, age: 2, apply: (m) => { m.towerAtk += 4; },
  }),
  up_frigate: T({
    id: 'up_frigate', name: 'Ships of the Line', icon: '🚢', desc: 'All War Galleys become Frigates, and Galleys are built as Frigates from now on.',
    cost: { wood: 300, gold: 250 }, time: 50, age: 4, upgrade: ['galley', 'frigate'], apply: () => {},
  }),
  up_bowman: T({
    id: 'up_bowman', name: 'Bows for Slingers', icon: '🏹', desc: 'All Slingers become Bowmen, and Slingers are trained as Bowmen from now on.',
    cost: { food: 120, wood: 100 }, time: 30, age: 1, upgrade: ['slinger', 'bowman'], apply: () => {},
  }),
  up_swordsman: T({
    id: 'up_swordsman', name: 'Swords for Clubmen', icon: '⚔️', desc: 'All Clubmen become Swordsmen, and Clubmen are trained as Swordsmen from now on.',
    cost: { food: 200, gold: 120 }, time: 40, age: 2, upgrade: ['clubman', 'swordsman'], apply: () => {},
  }),
  up_pike: T({
    id: 'up_pike', name: 'Pike Drill', icon: '🔱', desc: 'All Spearmen become Pikemen.',
    cost: { food: 250, wood: 150 }, time: 45, age: 3, upgrade: ['spearman', 'pikeman'], apply: () => {},
  }),
  up_crossbow: T({
    id: 'up_crossbow', name: 'Crossbows', icon: '🎯', desc: 'All Bowmen become Crossbowmen.',
    cost: { food: 250, gold: 200 }, time: 45, age: 3, upgrade: ['bowman', 'crossbowman'], apply: () => {},
  }),
  up_knight: T({
    id: 'up_knight', name: 'Knighthood', icon: '🛡️', desc: 'All Scout Riders become Knights.',
    cost: { food: 300, gold: 250 }, time: 50, age: 3, upgrade: ['rider', 'knight'], apply: () => {},
  }),
  up_musket: T({
    id: 'up_musket', name: 'Matchlocks', icon: '🔫', desc: 'All Crossbowmen become Musketeers.',
    cost: { food: 350, gold: 300 }, time: 55, age: 4, upgrade: ['crossbowman', 'musketeer'], apply: () => {},
  }),
  up_bombard: T({
    id: 'up_bombard', name: 'Cannon Founding', icon: '💣', desc: 'All Catapults become Bombards.',
    cost: { wood: 300, gold: 300 }, time: 55, age: 4, upgrade: ['catapult', 'bombard'], apply: () => {},
  }),
};

/** Civilisations: each has standing bonuses and one unit nobody else can train. */
export interface CivDef { id: string; name: string; icon: string; desc: string; bonuses: string[]; unique: string; /** A second unit of their own, reached in a later age. */ unique2: string; apply: (m: Mods) => void }
export const CIVS: Record<string, CivDef> = {
  stonekin: {
    id: 'stonekin', name: 'Romans', icon: '🏛️', desc: 'Builders and engineers who are hard to dislodge.', unique: 'shieldbearer', unique2: 'trebuchet',
    bonuses: ['Buildings have 25% more health', 'Villagers build 25% faster', 'Towers and Town Centers shoot 1 tile further'],
    apply: (m) => { m.buildingHp = 1.25; m.build = 1.25; m.towerRange = 1; },
  },
  steppe: {
    id: 'steppe', name: 'Mongols', icon: '🐎', desc: 'Horsemen of the steppe, born in the saddle.', unique: 'lancer', unique2: 'horsearcher',
    bonuses: ['Cavalry costs 15% less', 'Cavalry moves 10% faster'],
    apply: (m) => { m.cavCost = 0.85; m.cavSpeed = 1.1; },
  },
  hearth: {
    id: 'hearth', name: 'Franks', icon: '⚜️', desc: 'Farmers and freeholders whose strength is their families.', unique: 'hearthguard', unique2: 'herbwife',
    bonuses: ['Farms yield 25% more', 'Families raise children 25% faster', 'Houses hold 1 more person'],
    apply: (m) => { m.farm = 1.25; m.birth += 0.25; m.housePop += 1; },
  },
  forge: {
    id: 'forge', name: 'Chinese', icon: '🐉', desc: 'Scholars, makers and masters of fire and powder.', unique: 'firethrower', unique2: 'organgun',
    bonuses: ['Research is 30% faster and 15% cheaper', 'Siege engines have 25% more health'],
    apply: (m) => { m.techTime = 0.7; m.techCost = 0.85; m.siegeHp = 1.25; },
  },
  egypt: {
    id: 'egypt', name: 'Egyptians', icon: '🔺', desc: 'A kingdom of the river, fed by its fields and famous for what it builds.', unique: 'khopesh', unique2: 'warchariot',
    bonuses: ['Farms yield 20% more', 'Villagers build 15% faster'],
    apply: (m) => { m.farm = 1.2; m.build = 1.15; },
  },
  babylon: {
    id: 'babylon', name: 'Babylonians', icon: '🧱', desc: 'Lawgivers and star-readers behind great brick walls.', unique: 'sapper', unique2: 'gateguard',
    bonuses: ['Research is 15% faster', 'Buildings have 15% more health'],
    apply: (m) => { m.techTime = 0.85; m.buildingHp = 1.15; },
  },
  persia: {
    id: 'persia', name: 'Persians', icon: '🦁', desc: 'An empire of many peoples, rich in goods and beasts of war.', unique: 'immortal', unique2: 'warelephant',
    bonuses: ['Villagers carry 3 more', 'War beasts cost 20% less'],
    apply: (m) => { m.carry += 3; m.beastCost = 0.8; },
  },
  greece: {
    id: 'greece', name: 'Greeks', icon: '🏺', desc: 'Free cities of citizen-soldiers and thinkers.', unique: 'hoplite', unique2: 'companion',
    bonuses: ['Research costs 20% less', 'Soldiers have 1 more armour'],
    apply: (m) => { m.techCost = 0.8; m.armor += 1; },
  },
  england: {
    id: 'england', name: 'English', icon: '🌹', desc: 'Yeoman farmers and bowmen of a green island.', unique: 'longbowman', unique2: 'billman',
    bonuses: ['Farms yield 10% more', 'Towers and Town Centers hit harder'],
    apply: (m) => { m.farm = 1.1; m.towerAtk += 3; },
  },
  arabs: {
    id: 'arabs', name: 'Arabs', icon: '🌙', desc: 'Traders, scholars and riders of the desert.', unique: 'camelrider', unique2: 'mameluke',
    bonuses: ['Cavalry moves 10% faster', 'Research costs 10% less'],
    apply: (m) => { m.cavSpeed = 1.1; m.techCost = 0.9; },
  },
  japan: {
    id: 'japan', name: 'Japanese', icon: '⛩️', desc: 'An island realm of disciplined warriors and careful craft.', unique: 'samurai', unique2: 'ashigaru',
    bonuses: ['Soldiers have 1 more attack', 'Villagers gather 5% faster'],
    apply: (m) => { m.atk += 1; m.gather *= 1.05; },
  },
};
Object.assign(CIVS, {
  dawn: {
    id: 'dawn', name: 'Israelites', icon: '🕎', desc: 'A people of priests and prophets.', unique: 'zealot', unique2: 'templar',
    bonuses: ['Priests, Prophets and other healers cost 25% less', 'Prophets regain faith 50% faster', 'Healers mend 30% faster'],
    apply: (m: Mods) => { m.clergyCost = 0.75; m.faith = 1.5; m.heal += 0.3; },
  },
  wild: {
    id: 'wild', name: 'Norse', icon: '🪓', desc: 'Hunters and sea-raiders of the north.', unique: 'wolfrider', unique2: 'warbear',
    bonuses: ['Game yields 50% more food', 'War Hounds and Mammoths cost 25% less', 'Wild wolves never attack them'],
    apply: (m: Mods) => { m.hunt = 1.5; m.beastCost = 0.75; },
  },
} satisfies Record<string, CivDef>);
export const CIV_IDS = Object.keys(CIVS);
/** Banner colour of each people on the campaign map and in battle. */
export const CIV_COLOR: Record<string, number> = { stonekin: 0x6f8fb0, steppe: 0xe0452f, hearth: 0x3aa648, forge: 0xe0902a, dawn: 0xe0c020, wild: 0x8a5ad0, egypt: 0xd8b46a, babylon: 0x3a8fa8, persia: 0xb03a6a, greece: 0x4a78d8, england: 0xc83a3a, arabs: 0x2f9a6a, japan: 0xd8d8e8 };

export interface AbilityDef { id: string; name: string; icon: string; desc: string; cost: number; radius: number }
export const ABILITIES: Record<string, AbilityDef> = {
  plague: {
    id: 'plague', name: 'Plague', icon: '☠️', cost: 60, radius: 3,
    desc: 'Enemy units in the area sicken, lose health for 20 seconds and infect others standing close. Shamans cure it.',
  },
  quake: {
    id: 'quake', name: 'Earthquake', icon: '🌋', cost: 100, radius: 4,
    desc: 'The ground shakes for 5 seconds, heavily damaging enemy buildings in the area.',
  },
};

/** Traits a villager can be born with. Children tend to inherit one from a parent. */
export interface VillagerTrait { name: string; icon: string; desc: string }
export const VILLAGER_TRAITS: Record<string, VillagerTrait> = {
  strong: { name: 'Strong', icon: '💪', desc: 'Gathers 25% faster.' },
  swift: { name: 'Swift', icon: '🏃', desc: 'Moves 20% faster.' },
  hardy: { name: 'Hardy', icon: '❤️', desc: 'Has 50% more health.' },
  skilled: { name: 'Skilled', icon: '🔨', desc: 'Builds 60% faster.' },
};
export const NAMES_M = ['Alder', 'Bram', 'Corin', 'Dunn', 'Edric', 'Fenn', 'Garrick', 'Holt', 'Ivo', 'Joss', 'Kell', 'Loric', 'Marn', 'Ned', 'Osric', 'Perrin', 'Rolf', 'Soren', 'Tam', 'Wend'];
export const NAMES_F = ['Ada', 'Brea', 'Cyra', 'Dara', 'Elin', 'Faye', 'Gwen', 'Hild', 'Isa', 'Jora', 'Kira', 'Lena', 'Mira', 'Nell', 'Orla', 'Pia', 'Rhea', 'Sela', 'Tess', 'Wyn'];
export const FAMILY_NAMES = ['Ashdown', 'Barrow', 'Coldwell', 'Dunmere', 'Elmsley', 'Fairwind', 'Greyfell', 'Harrow', 'Ironwood', 'Kestrel', 'Longmeadow', 'Marsh', 'Northcott', 'Oakes', 'Pike', 'Redfern', 'Stoneham', 'Thorne', 'Underhill', 'Wolfe'];

// ---- Tunable constants ----
export const POP_LIMIT = 150;
export const WONDER_TIME = 300; // seconds a Wonder must stand to win
export const BIRTH_TIME = 32; // seconds until a housed couple has a child
export const GROW_TIME = 25; // seconds before a child is old enough to work
export const BIRTH_COST = 25; // food
export const LIFESPAN: [number, number] = [16 * 60, 22 * 60]; // seconds of adult life before a villager dies of old age
export const ELDER_AT = 0.7; // fraction of a lifespan after which a villager slows down
export const RENOWN_CHILDREN = 3; // children raised per rank of family renown (up to three ranks)
export const MORALE_RADIUS = 12; // tiles around a town center
export const MORALE_PER_HOUSE = 0.05; // damage reduction per nearby house
export const MORALE_MAX_HOUSES = 5;

export const RESOURCE_AMOUNT: Record<string, number> = { tree: 120, berries: 220, gold: 1000, stone: 800, carcass: 130, fish: 450 };
export const RESOURCE_KIND: Record<string, ResType> = { tree: 'wood', berries: 'food', gold: 'gold', stone: 'stone', carcass: 'food', fish: 'food' };
export const GATHER_RATE: Record<string, number> = { tree: 0.75, berries: 0.8, gold: 0.7, stone: 0.65, farm: 0.62, carcass: 1.0, fish: 0.95 };

export const RES_ICON: Record<ResType, string> = { food: '🍖', wood: '🪵', gold: '🪙', stone: '🪨' };

export function costText(c: Cost): string {
  return RES_TYPES.filter((r) => c[r]).map((r) => `${RES_ICON[r]}${c[r]}`).join(' ');
}
