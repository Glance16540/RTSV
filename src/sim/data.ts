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
  projectile?: 'arrow' | 'stone' | 'boulder';
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
    desc: 'Unique support unit. Heals wounded allies nearby and cures plague. Cannot attack.',
    cost: { food: 40, gold: 60 }, time: 22, age: 1, hp: 40, atk: 0, armor: 0, range: 5, speed: 2.0,
    cooldown: 1, sight: 8, pop: 1, cls: 'support', radius: 0.28, heal: 5,
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
    trains: ['villager', 'warlord'], techs: [], dropoff: true, atk: 7, range: 7, cooldown: 2, shelter: 12,
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
    trains: ['clubman', 'slinger', 'spearman', 'swordsman'], techs: [],
  }),
  range: B({
    id: 'range', name: 'Archery Range', icon: '🏹',
    desc: 'Trains archers.',
    cost: { wood: 140 }, time: 28, age: 1, hp: 900, size: 3, pop: 0, sight: 6,
    trains: ['bowman', 'crossbowman'], techs: [],
  }),
  stable: B({
    id: 'stable', name: 'Stable', icon: '🐴',
    desc: 'Trains cavalry and war beasts.',
    cost: { wood: 150 }, time: 30, age: 1, hp: 900, size: 3, pop: 0, sight: 6,
    trains: ['rider', 'mammoth', 'knight'], techs: [],
  }),
  temple: B({
    id: 'temple', name: 'Temple', icon: '⛩️',
    desc: 'Trains shamans and prophets, and researches blessings for your families.',
    cost: { wood: 100, stone: 80 }, time: 32, age: 1, hp: 800, size: 3, pop: 0, sight: 6,
    trains: ['shaman', 'prophet'], techs: ['fertility', 'extendedfamily', 'herbalism'],
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
    trains: ['catapult'], techs: [],
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
  ['house', 'storehouse', 'farm', 'market', 'towncenter', 'temple', 'blacksmith', 'palisade', 'gate', 'stonewall', 'wonder'],
  ['barracks', 'range', 'stable', 'workshop', 'tower'],
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
};

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

// ---- Tunable constants ----
export const POP_LIMIT = 150;
export const WONDER_TIME = 300; // seconds a Wonder must stand to win
export const BIRTH_TIME = 32; // seconds until a housed couple has a child
export const GROW_TIME = 25; // seconds before a child is old enough to work
export const BIRTH_COST = 25; // food
export const MORALE_RADIUS = 12; // tiles around a town center
export const MORALE_PER_HOUSE = 0.05; // damage reduction per nearby house
export const MORALE_MAX_HOUSES = 5;

export const RESOURCE_AMOUNT: Record<string, number> = { tree: 120, berries: 220, gold: 1000, stone: 800, carcass: 130 };
export const RESOURCE_KIND: Record<string, ResType> = { tree: 'wood', berries: 'food', gold: 'gold', stone: 'stone', carcass: 'food' };
export const GATHER_RATE: Record<string, number> = { tree: 0.75, berries: 0.8, gold: 0.7, stone: 0.65, farm: 0.62, carcass: 1.0 };

export const RES_ICON: Record<ResType, string> = { food: '🍖', wood: '🪵', gold: '🪙', stone: '🪨' };

export function costText(c: Cost): string {
  return RES_TYPES.filter((r) => c[r]).map((r) => `${RES_ICON[r]}${c[r]}`).join(' ');
}
