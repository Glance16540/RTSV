// Piety against decadence: one scale per people, moved by how they answer the dilemmas that come
// up and by their habits. Each end of the scale has boons and banes.

import type { ResType } from './data';

/**
 * What one villager stationed in a church or tavern does. In a church a man is a monk and a woman a
 * nun; in a tavern a woman is a milkmaid and a man a patron.
 */
export const CLERGY_VIRTUE = 3; // piety per minute, each
export const CLERGY_BIRTH = 0.08; // children come this much sooner, each
export const MAID_VIRTUE = 3; // decadence per minute, each
export const MAID_GOLD = 0.35; // gold a second, each
export const MAID_DISTRACTION = 0.025; // everyone gathers this much slower, each
export const PATRON_FOOD = 0.15; // food a second a patron drinks and eats away
export const PATRON_MUSTER = 0.04; // soldiers are trained this much faster, per patron
/** Swords for hire at a tavern: gold only, at this multiple of the unit's whole cost, and on the spot. */
export const MERC_PRICE = 1.6;
export const MERC_WAGE = 0.06; // gold a second each; unpaid, they walk away
export const MERC_TYPES = ['clubman', 'slinger', 'spearman', 'rider'];
/** Chance each second, per person in the tavern, that plague breaks out in a worldly town (doubled in a decadent one). */
export const TAVERN_PLAGUE = 0.0012;
/**
 * Seconds for a maid and a patron of a worldly town's tavern to add a child no household owns to. Long: they
 * take care that it does not happen, and it almost never does. A decadent town's take two thirds as long, and no
 * more than two couples count.
 */
export const TAVERN_BIRTH = 3000;
/** A holy town is Devout or better; a town given over to decadence is Decadent. */
export const isHoly = (virtue: number): boolean => virtue >= 30;
export const isDecadent = (virtue: number): boolean => virtue <= -70;
export const CAPTURE_TIME = 3; // seconds a Slaver needs to bind a villager
export const CAPTIVE_WORK = 0.1; // the whole town gathers this much faster, per man held
export const GUARD_DRIVE = 0.25; // each Slaver posted at a camp makes its men's work count this much more
export const CAPTIVE_VIRTUE = 2; // decadence a minute, per captive
export const CAMP_BIRTH = 110; // seconds for one woman held to add a villager; more women, sooner
export const CAPTIVE_CAP = 16; // captives beyond this add nothing
export const STAFF_CAP = 8; // more than this many clergy or maids add nothing

export interface Creed {
  id: string; name: string; icon: string; desc: string;
  boons: string[]; banes: string[];
  /** Multipliers. `research` and `train` are on time taken (lower is faster). */
  faith: number; heal: number; morale: number; research: number; train: number; gold: number; trade: number; birth: number;
  /** How long a plague lasts among them, as a multiple; 0 means no plague takes hold at all. */
  plague: number;
  /** How hard villagers work at gathering. */
  work: number;
  /** The share of children who do not live to grow up. */
  childLoss: number;
}

const base = { faith: 1, heal: 1, morale: 1, research: 1, train: 1, gold: 1, trade: 1, birth: 1, plague: 1, work: 1, childLoss: 0.1 };
export const CREEDS: Creed[] = [
  { ...base, id: 'zealous', name: 'Righteous', icon: '🕯️', desc: 'A people who keep the faith in all they do.', plague: 0, childLoss: 0.02, faith: 1.6, heal: 1.4, morale: 1.3, birth: 1.3, research: 1.25, gold: 0.85, trade: 0.85,
    boons: ['Almost every child lives to grow up (1 in 50 lost)', 'No plague takes hold among them', 'Children come 30% sooner', 'Faith gathers 60% faster', 'Healing 40% stronger', 'Morale near the Town Center 30% stronger'], banes: ['Research takes 25% longer', 'Gold is mined 15% slower', 'The market pays 15% less'] },
  { ...base, id: 'devout', name: 'Devout', icon: '🙏', desc: 'A god-fearing people.', plague: 0.5, childLoss: 0.05, faith: 1.3, heal: 1.2, morale: 1.15, birth: 1.15, research: 1.1, trade: 0.95,
    boons: ['Children are more likely to grow up (1 in 20 lost, against 1 in 10)', 'Plagues pass in half the time', 'Children come 15% sooner', 'Faith gathers 30% faster', 'Healing 20% stronger', 'Morale 15% stronger'], banes: ['Research takes 10% longer', 'The market pays 5% less'] },
  { ...base, id: 'temperate', name: 'Temperate', icon: '⚖️', desc: 'Neither saints nor sinners.', boons: [], banes: [] },
  { ...base, id: 'worldly', name: 'Worldly', icon: '🍷', desc: 'They like their comforts.', plague: 1.25, childLoss: 0.18, work: 0.95, train: 0.9, gold: 1.1, trade: 1.15, faith: 0.8, morale: 0.9, birth: 0.9,
    boons: ['Soldiers are trained 10% faster', 'Gold is mined 10% faster', 'The market pays 15% more'], banes: ['Nearly 1 child in 5 does not live to grow up', 'Villagers are distracted: gathering 5% slower', 'Plagues last a quarter longer', 'Children come 10% later', 'Faith gathers 20% slower', 'Morale 10% weaker'] },
  { ...base, id: 'decadent', name: 'Decadent', icon: '🎭', desc: 'Anything can be bought here.', plague: 1.5, childLoss: 0.28, work: 0.9, train: 0.8, gold: 1.2, trade: 1.3, birth: 0.75, faith: 0.5, heal: 0.8, morale: 0.6,
    boons: ['Soldiers are trained 20% faster', 'Gold is mined 20% faster', 'The market pays 30% more'], banes: ['More than 1 child in 4 does not live to grow up', 'Villagers are distracted: gathering 10% slower', 'Plagues last half as long again', 'Children come 25% later', 'Faith gathers at half speed', 'Healing 20% weaker', 'Morale 40% weaker'] },
];

/** The creed a people lives by at a given point on the scale (-100 decadent to +100 pious). */
export function creedOf(virtue: number): Creed {
  return CREEDS[virtue >= 70 ? 0 : virtue >= 30 ? 1 : virtue > -30 ? 2 : virtue > -70 ? 3 : 4];
}

export interface Choice { label: string; virtue: number; res: Partial<Record<ResType, number>>; result: string }
export interface Dilemma { id: string; title: string; text: string; a: Choice; b: Choice }

/** In each, `a` is the pious answer and `b` the worldly one. */
export const DILEMMAS: Dilemma[] = [
  { id: 'harvest', title: 'The harvest is in', text: 'The granaries are full and the people want to mark it.',
    a: { label: 'Offer the first fruits at the church', virtue: 15, res: { food: -80 }, result: 'The first sheaves are burned on the altar.' },
    b: { label: 'Feast and dance; invite the traders', virtue: -15, res: { food: -40, gold: 100 }, result: 'Three days of revels, and the traders paid well for their pitch.' } },
  { id: 'strangers', title: 'Strangers at the gate', text: 'A sick and hungry band begs to be let in. They carry a few goods.',
    a: { label: 'Take them in and tend them', virtue: 20, res: { food: -100 }, result: 'They are fed and nursed. The town talks of it for a year.' },
    b: { label: 'Turn them away and keep their goods', virtue: -20, res: { gold: 80 }, result: 'The gate stays shut. Their bundles fetch a fair price.' } },
  { id: 'den', title: 'The gambling den', text: 'A house of dice and drink has opened by the market.',
    a: { label: 'Close it', virtue: 10, res: { gold: -50 }, result: 'The owner is paid off and the door nailed shut.' },
    b: { label: 'Tax it', virtue: -15, res: { gold: 150 }, result: 'The treasury takes its share of every throw.' } },
  { id: 'fast', title: 'The prophet calls a fast', text: 'A holy man says the people must put down their tools and pray for three days.',
    a: { label: 'Keep the fast', virtue: 15, res: { wood: -100 }, result: 'The saws fall silent. The church is full.' },
    b: { label: 'Send him on his way', virtue: -10, res: {}, result: 'He leaves cursing. Work goes on.' } },
  { id: 'widow', title: 'A rich widow dies', text: 'She has no heirs. Her fortune is yours to dispose of.',
    a: { label: 'Endow a shrine in her name', virtue: 20, res: {}, result: 'Her name is carved over the shrine door.' },
    b: { label: 'Into the treasury', virtue: -20, res: { gold: 200 }, result: 'The chests are carried up to the hall.' } },
  { id: 'deserter', title: 'A deserter is caught', text: 'He ran from the line. The soldiers want an example made.',
    a: { label: 'Mercy, and a year of penance', virtue: 10, res: { food: -30 }, result: 'He sweeps the church steps and is fed for it.' },
    b: { label: 'Sell him to the slavers', virtue: -20, res: { gold: 100 }, result: 'He is led off in a rope. Nobody watches.' } },
  { id: 'masks', title: 'The festival of masks', text: 'The young want a night when nobody knows anybody.',
    a: { label: 'Forbid it', virtue: 10, res: {}, result: 'The masks are burned in the square.' },
    b: { label: 'Allow it, and charge the visitors', virtue: -15, res: { food: -60, gold: 120 }, result: 'Half the valley comes. Nobody remembers much.' } },
  { id: 'relic', title: 'A pedlar with a relic', text: 'He carries a relic he says belonged to a holy man. He also sells strong wine by the cart.',
    a: { label: 'Buy the relic for the church', virtue: 15, res: { gold: -80 }, result: 'It is laid under the altar with reverence.' },
    b: { label: 'Buy the wine and sell it on', virtue: -15, res: { gold: 90 }, result: 'The carts are empty by nightfall, at a profit.' } },
  { id: 'tithe', title: 'The priests ask for a tithe', text: 'A tenth of the stone quarried, for the church walls.',
    a: { label: 'Grant it', virtue: 15, res: { stone: -80 }, result: 'The church wall rises another course.' },
    b: { label: 'Refuse, and tax the church instead', virtue: -15, res: { gold: 70 }, result: 'The priests pay, and say nothing.' } },
];

/** Which way each people leans when left to decide for itself (chance of the pious answer). */
export const LEANING: Record<string, number> = { stonekin: 0.5, steppe: 0.3, hearth: 0.7, forge: 0.45, dawn: 0.85, wild: 0.3, egypt: 0.45, babylon: 0.4, persia: 0.5, greece: 0.5, england: 0.65, arabs: 0.6, japan: 0.55 };
