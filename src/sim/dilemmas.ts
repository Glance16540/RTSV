// More dilemmas, and which comes when (docs/systems-board, "Piety and decadence": only nine dilemmas, so they repeated).
//
// Each is a question put to a town (a battle or a visit), with a pious answer `a` and a worldly one `b`, whose
// boons and banes are the same as the first nine's: a shift of the town's standing and goods given or taken
// (game.ts cmdDecide). Nothing here is a new rule.
//
// Most belong to a moment: a road to toll, a Manor's lord, the Hall, plague in the lanes, an Infirmary, the Tavern or
// the Church, people held in a camp, the season, a storm, the fighting, hunger. Such a one is only asked while its
// moment holds (`FITS`). Which is asked next is not drawn from the battle's dice: each people has an order of every
// dilemma set by the battle's seed, and is asked the first in it not yet asked whose moment holds, so it is asked
// each fitting one before any comes round again (`Player.asked`, kept with the battle).
//
// Content: no child is in any of them, nothing suggestive is said, people held are spoken of only as held, and
// anyone wed is grown.
import type { Dilemma } from './creed';
import type { Game } from './game';

declare module './game' {
  interface Player { /** The dilemmas this people has been asked in the round now going (dilemmas.ts). */ asked?: string[] }
}

export const MORE_DILEMMAS: Dilemma[] = [
  { id: 'toll', title: 'The road and the toll', text: 'Carts use the new road from dawn to dusk. The merchants\' guild offers to keep it up, for a toll at the gate.',
    a: { label: 'Keep the road free to all', virtue: 10, res: { wood: -60 }, result: 'The road is mended at the town\'s cost, and anyone may walk it.' },
    b: { label: 'Let the guild take its toll', virtue: -10, res: { gold: 120 }, result: 'A chain goes across the road, and coins pass over it.' } },
  { id: 'caravan', title: 'A caravan from the east', text: 'Its master offers silk and spice, and asks to sell on the feast day as well.',
    a: { label: 'Trade, but not on the feast day', virtue: 10, res: { gold: 40 }, result: 'The stalls are shut for the feast, and open the day after.' },
    b: { label: 'Open the market every day', virtue: -15, res: { gold: 140 }, result: 'The bells ring for church, and nobody hears them over the haggling.' } },
  { id: 'grain', title: 'The steward\'s grain', text: 'The steward has grain put by. The bakers want it sold dear while bread is short.',
    a: { label: 'Give it out at the church door', virtue: 20, res: { food: -120 }, result: 'Every household goes home with a loaf.' },
    b: { label: 'Sell it at the going price', virtue: -15, res: { food: -60, gold: 150 }, result: 'The bakers pay, and the price of bread does not fall.' } },
  { id: 'hunt', title: 'The lord\'s hunt', text: 'The lord of the Manor wants the common wood closed, so that he may hunt in it.',
    a: { label: 'Keep the wood open to the town', virtue: 10, res: { wood: 60 }, result: 'The woodcutters go on as before, and bless you for it.' },
    b: { label: 'Close it to all but the lord', virtue: -10, res: { gold: 100 }, result: 'The lord pays well for his game.' } },
  { id: 'lordtax', title: 'The lords ask to be spared', text: 'The lords of the Manor ask to pay no tax this year, and offer a gift instead.',
    a: { label: 'Tax them as the rest are taxed', virtue: 10, res: { gold: 80 }, result: 'The lords pay, and the people see them pay.' },
    b: { label: 'Spare them, and take the gift', virtue: -15, res: { gold: 150 }, result: 'The gift is generous. The people\'s tax is not lowered.' } },
  { id: 'mill', title: 'A case at the Hall', text: 'Two grown brothers quarrel over their late father\'s mill and bring it before the Hall.',
    a: { label: 'Judge by the old law: share it', virtue: 10, res: {}, result: 'Each takes half, and both grumble.' },
    b: { label: 'Give it to whoever pays the court', virtue: -20, res: { gold: 120 }, result: 'The richer brother pays, and the mill is his.' } },
  { id: 'lanes', title: 'Sickness in the lanes', text: 'The sick lie in their houses, and the healthy fear the next street.',
    a: { label: 'Open the church to nurse them', virtue: 15, res: { food: -80 }, result: 'The church fills with pallets, and the priests do not sleep.' },
    b: { label: 'Bar the sick lanes and post guards', virtue: -10, res: { wood: -40 }, result: 'The lanes are barred. Those inside are left to it.' } },
  { id: 'alms', title: 'The Infirmary asks for alms', text: 'Its wards are full and its stores are thin.',
    a: { label: 'Give from the town\'s stores', virtue: 15, res: { food: -60, gold: -30 }, result: 'Carts of bread and blankets go up to its door.' },
    b: { label: 'Let it charge those who can pay', virtue: -10, res: { gold: 80 }, result: 'The rich are nursed first, and pay for it.' } },
  { id: 'lamps', title: 'Lamps after dark', text: 'The tavern keeper asks leave to keep his lamps lit long after dusk.',
    a: { label: 'Shut at dusk, as the law says', virtue: 10, res: {}, result: 'The shutters go up at sunset.' },
    b: { label: 'Let him stay open, for a fee', virtue: -15, res: { gold: 120 }, result: 'The lamps burn till the small hours.' } },
  { id: 'watch', title: 'The watch was in the tavern', text: 'The night watch was found drinking while the gate stood open.',
    a: { label: 'A week of vigil at the church', virtue: 10, res: {}, result: 'The watchmen keep the vigil on their knees.' },
    b: { label: 'Fine the tavern and let it pass', virtue: -10, res: { gold: 70 }, result: 'The keeper pays, and the watch goes back to the gate.' } },
  { id: 'bell', title: 'A bell for the church', text: 'The priests want a great bell cast, to call the valley to prayer.',
    a: { label: 'Cast it', virtue: 15, res: { gold: -120 }, result: 'It is heard three valleys away.' },
    b: { label: 'Sell the bronze instead', virtue: -10, res: { gold: 60 }, result: 'The bronze is sold by weight.' } },
  { id: 'sanctuary', title: 'A man claims sanctuary', text: 'A grown man accused of theft has run into the church, and the guards wait outside.',
    a: { label: 'Respect the sanctuary', virtue: 15, res: {}, result: 'He stays in the church, and the guards go home.' },
    b: { label: 'Drag him out and fine him', virtue: -15, res: { gold: 60 }, result: 'He is fined, and the priests protest.' } },
  { id: 'pilgrims', title: 'Pilgrims on the road', text: 'A company of pilgrims asks for bread and a roof for the night.',
    a: { label: 'Lodge them in the church', virtue: 15, res: { food: -70 }, result: 'They sleep in the nave, and pray for the town at dawn.' },
    b: { label: 'Sell them lodging and charms', virtue: -15, res: { gold: 110 }, result: 'They leave lighter of purse.' } },
  { id: 'held', title: 'Those held in the camp', text: 'A merchant offers to buy those held in the camp and take them far away.',
    a: { label: 'Set them free on the road home', virtue: 20, res: { food: -60 }, result: 'They are given bread for the road, and the gate is opened.' },
    b: { label: 'Sell them to the merchant', virtue: -20, res: { gold: 150 }, result: 'They are led away by the merchant\'s men.' } },
  { id: 'frost', title: 'A hard frost', text: 'The frost is deep, and the poor have no wood for their fires.',
    a: { label: 'Give from the woodpiles', virtue: 15, res: { wood: -120 }, result: 'Smoke rises from every chimney.' },
    b: { label: 'Sell wood to those who can pay', virtue: -15, res: { wood: -60, gold: 100 }, result: 'Those who could pay are warm.' } },
  { id: 'seed', title: 'Seed for the sowing', text: 'The fields are ready, and the poorer farmers have eaten their seed corn.',
    a: { label: 'Lend them seed, and ask nothing', virtue: 15, res: { food: -100 }, result: 'The fields are green by summer.' },
    b: { label: 'Lend it at interest', virtue: -10, res: { food: -100, gold: 140 }, result: 'They will pay at harvest, and more besides.' } },
  { id: 'vintage', title: 'The new wine', text: 'The grapes are pressed, and the vintners want a fair.',
    a: { label: 'Bless the casks, and keep the fair short', virtue: 10, res: { gold: 40 }, result: 'One day of fair, and the casks go to the cellars.' },
    b: { label: 'A week of fair, with the taps open', virtue: -15, res: { food: -40, gold: 130 }, result: 'A week nobody will quite remember.' } },
  { id: 'omen', title: 'The storm is an omen', text: 'The priests say the storm is a warning, and call the town to walk in procession.',
    a: { label: 'Walk in the procession', virtue: 15, res: { food: -40 }, result: 'The whole town walks bareheaded in the rain.' },
    b: { label: 'Keep everyone at work', virtue: -10, res: { wood: 60 }, result: 'The saws go on in the wet.' } },
  { id: 'spoils', title: 'Spoils of the field', text: 'The soldiers bring what they took from the fallen enemy to the hall.',
    a: { label: 'Bury the dead and give the spoils to the church', virtue: 15, res: { gold: 30 }, result: 'Friend and foe are buried with prayers.' },
    b: { label: 'Share it out among the soldiers', virtue: -10, res: { gold: 120 }, result: 'The soldiers drink to you that night.' } },
  { id: 'masons', title: 'The masons\' guild', text: 'The masons ask to build their guildhall before the church tower.',
    a: { label: 'The tower first', virtue: 15, res: { stone: -100 }, result: 'The tower rises over the roofs.' },
    b: { label: 'The guildhall first', virtue: -10, res: { stone: -100, gold: 120 }, result: 'The guild pays for its hall, and the tower waits.' } },
  { id: 'wedding', title: 'A wedding in the hall', text: 'The steward is to wed a merchant\'s widow; both are long grown, and they ask for the hall.',
    a: { label: 'A quiet blessing at the church', virtue: 10, res: { food: -30 }, result: 'A small wedding, and a long prayer.' },
    b: { label: 'A great feast, at the merchant\'s cost', virtue: -10, res: { food: -60, gold: 120 }, result: 'The hall is full until dawn.' } },
];

const has = (g: Game, pid: number, type: string): boolean => g.buildings.some((b) => b.owner === pid && b.type === type && b.complete && !b.dead);
const recently = (g: Game, pid: number): boolean => { const hit = g.players[pid]?.lastAttacked; return !!hit && g.time - hit.t < 180; };

/** When each dilemma's moment holds. One with no entry here may be asked at any time. */
export const FITS: Record<string, (g: Game, pid: number) => boolean> = {
  toll: (g) => g.road.some((n) => n > 0),
  caravan: (g, pid) => has(g, pid, 'market'),
  grain: (g, pid) => (g.players[pid]?.hunger ?? 0) > 0 || g.season === 'winter', // going short (famine.ts keeps the count), or winter
  hunt: (g, pid) => has(g, pid, 'manor'),
  lordtax: (g, pid) => has(g, pid, 'manor'),
  mill: (g, pid) => has(g, pid, 'hall'),
  lanes: (g, pid) => g.units.some((u) => u.owner === pid && !u.dead && u.plagueT > 0),
  alms: (g, pid) => has(g, pid, 'infirmary'),
  lamps: (g, pid) => has(g, pid, 'tavern'),
  watch: (g, pid) => has(g, pid, 'tavern'),
  bell: (g, pid) => has(g, pid, 'temple'),
  sanctuary: (g, pid) => has(g, pid, 'temple'),
  pilgrims: (g, pid) => has(g, pid, 'temple') || has(g, pid, 'monastery'),
  masons: (g, pid) => has(g, pid, 'temple'),
  held: (g, pid) => g.buildings.some((b) => b.owner === pid && !b.dead && (b.captives?.length ?? 0) > 0),
  frost: (g) => g.season === 'winter' || g.foul === 'snow',
  seed: (g) => g.season === 'spring',
  vintage: (g) => g.season === 'autumn',
  omen: (g) => g.foul !== '',
  spoils: recently, deserter: recently,
};

/** A steady number for a battle, a people and a step. */
const hash = (a: number, b: number, k: number): number => {
  let h = (Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35) ^ Math.imul(k + 0x1b87, 0x27d4eb2f)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
  return h >>> 0;
};
/** The order a people of this battle is asked the dilemmas in: every one once, shuffled by the seed. */
export function askOrder(seed: number, pid: number, all: readonly Dilemma[]): string[] {
  const ids = all.map((d) => d.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = hash(seed, pid, i) % (i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids;
}
/**
 * The next dilemma to put to a people, and it is marked asked: the first in its order not yet asked whose moment
 * holds now. When every one whose moment holds has been asked, the round begins again. Without the battle's dice.
 */
export function nextDilemma(g: Game, pid: number, all: readonly Dilemma[]): string {
  const p = g.players[pid], order = askOrder(g.seed, pid, all), asked = new Set(p.asked ?? []);
  const fitting = order.filter((id) => !FITS[id] || FITS[id](g, pid));
  let id = fitting.find((x) => !asked.has(x));
  if (!id) { p.asked = []; id = fitting[0] ?? order[0]; } // all asked: a new round
  (p.asked ??= []).push(id);
  return id;
}
