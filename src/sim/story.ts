// The story of a campaign: places with names and a past, things that happen to the whole world, tales that are
// put to the player to decide, and the chronicle that all of it is written into. Words and numbers only: the
// rules that use them are in campaign.ts.

/** A place with a name of its own, standing in one land of the map. Whoever holds the land has the good of it. */
export type PlaceKind = 'shrine' | 'fair' | 'keep' | 'forge' | 'library';
export interface PlaceDef {
  kind: string; icon: string; desc: string; names: string[]; legends: string[];
  /** Piety a turn, supplies a turn, defence, supplies off each company raised here, supplies off the next age. */
  virtue?: number; supplies?: number; defence?: number; raise?: number; age?: number;
}
export const PLACES: Record<PlaceKind, PlaceDef> = {
  shrine: {
    kind: 'A holy place', icon: '🗿', virtue: 3, desc: 'Its holder\'s people grow more pious by 3 every turn.',
    names: ['the Standing Stones', 'the Hermit\'s Well', 'the White Chapel', 'the Grove of Lamps'],
    legends: ['Older than any people now living; nobody will say who raised it.', 'The sick are carried here from four lands away.', 'A light is kept here that has not gone out in living memory.'],
  },
  fair: {
    kind: 'A meeting of roads', icon: '🎪', supplies: 2, desc: 'Its holder gains 2 supplies every turn.',
    names: ['the Old Ford', 'the Salt Fair', 'the Four Roads', 'the Weighing Stone'],
    legends: ['Every road in this country comes here sooner or later.', 'Whoever holds the crossing takes a share of all that crosses.', 'Traders met here before there were kings to tax them.'],
  },
  keep: {
    kind: 'An old stronghold', icon: '🏚️', defence: 2, desc: 'The land is 2 harder to take.',
    names: ['the Broken Keep', 'the Giant\'s Wall', 'the Watch on the Rock', 'the Drowned Fort'],
    legends: ['Its builders are forgotten, but their walls still turn an army.', 'Three kings have died trying to take it.', 'It has never fallen to anyone who came at it from the front.'],
  },
  forge: {
    kind: 'Iron in the ground', icon: '⚒️', raise: 1, desc: 'Every company raised in this land costs 1 less.',
    names: ['the Iron Hills', 'the Smoking Pits', 'the Red Diggings', 'the Hammer Dale'],
    legends: ['The smiths here ask no questions of whoever pays.', 'The hills are hollow with old workings.', 'Its blades are known wherever blades are used.'],
  },
  library: {
    kind: 'A house of learning', icon: '📚', age: 2, desc: 'Its holder\'s next age costs 2 less.',
    names: ['the House of Scrolls', 'the Star Tower', 'the School on the Hill', 'the Hall of Maps'],
    legends: ['Everything that has been found out is written down here, somewhere.', 'Its keepers serve whoever holds the land, and outlast them.', 'Kings send their children here, and their spies.'],
  },
};
export interface Place { at: number; kind: PlaceKind; name: string; legend: string }

/** Something that befalls every people at once. `turns` 0 means it strikes once and is over. */
export type WorldKind = 'winter' | 'plenty' | 'iron' | 'comet' | 'pestilence';
export interface WorldDef { name: string; icon: string; turns: number; desc: string; tell: string }
export const WORLD_EVENTS: Record<WorldKind, WorldDef> = {
  winter: { name: 'The Long Winter', icon: '❄️', turns: 3, desc: 'Every land yields 1 supply less.', tell: 'The snow came early and did not go. They called it the Long Winter.' },
  plenty: { name: 'Years of Plenty', icon: '🌾', turns: 3, desc: 'Every Farmland yields 1 supply more.', tell: 'The rains were kind and the barns were full: the Years of Plenty.' },
  iron: { name: 'The Season of Iron', icon: '⚔️', turns: 3, desc: 'Every company costs 1 supply less to raise.', tell: 'Every smith was at his forge and every idle hand found a spear: the Season of Iron.' },
  comet: { name: 'A Comet', icon: '☄️', turns: 0, desc: 'Every people grows more pious by 10.', tell: 'A comet hung over the world for a month, and in every land the churches filled.' },
  pestilence: { name: 'The Great Pestilence', icon: '☠️', turns: 0, desc: 'Every army of three companies or more loses one. The Righteous are spared.', tell: 'The Great Pestilence went from camp to camp and spared only those who kept the faith.' },
};
export const WORLD_FROM = 4; // no world event before this turn
export const WORLD_REST = 3; // quiet turns after one is over
export const WORLD_CHANCE = 0.35; // each turn, once the world is quiet again
export const COMET_VIRTUE = 10;

/**
 * A tale: something brought before the player to decide. As with a town's dilemmas, `a` is the pious answer and
 * `b` the worldly one. `{land}` is a land of the player's, `{rival}` a rival people, `{tribe}` a neighbouring land
 * of the local tribes.
 */
export interface TaleChoice {
  label: string; result: string; virtue: number; supplies: number;
  /** Goodwill gained or lost with the rival in the tale. */
  favor?: number;
  /** A company of infantry joins the army in the player's chief town. */
  company?: boolean;
  /** The tribe's defenders stand down by one (never below one). */
  militia?: number;
}
export interface Tale { id: string; title: string; text: string; needs?: 'rival' | 'tribe'; a: TaleChoice; b: TaleChoice }
export const TALES: Tale[] = [
  { id: 'pilgrims', title: 'Pilgrims on the road', text: 'A long column of pilgrims asks leave to cross {land}. They have little, and they are many.',
    a: { label: 'Feed them and see them safely through', virtue: 10, supplies: -2, result: 'They go on singing, and speak well of you in every land they pass.' },
    b: { label: 'Charge a toll at every bridge', virtue: -10, supplies: 3, result: 'They pay, because they must. The bridges do well out of it.' } },
  { id: 'exile', title: 'An exile at the gate', needs: 'rival', text: 'A prince driven out by {rival} begs shelter in {land}. Their envoys are a day behind him, with gold.',
    a: { label: 'Give him shelter', virtue: 10, supplies: 0, favor: -1, result: 'He is given a house and a guard. {rival} will not forget it.' },
    b: { label: 'Hand him over for the gold', virtue: -12, supplies: 4, favor: 1, result: 'He is led away in the morning. {rival} pay as they promised.' } },
  { id: 'hunger', title: 'Hunger over the border', needs: 'tribe', text: 'The harvest has failed in {tribe}, and its people are at your border asking for grain.',
    a: { label: 'Send them grain', virtue: 10, supplies: -3, militia: -1, result: 'The carts go over the border. In {tribe} fewer men will take up a spear against you.' },
    b: { label: 'Sell it to them, at a hungry man\'s price', virtue: -12, supplies: 4, result: 'They pay with everything they have. They will remember the price.' } },
  { id: 'sellswords', title: 'Swords for hire', text: 'A company of sellswords, lately in someone else\'s pay and not particular, offers to winter in {land}.',
    a: { label: 'Send them on their way', virtue: 6, supplies: 0, result: 'They ride on, looking for a master with fewer scruples.' },
    b: { label: 'Take them on', virtue: -8, supplies: -2, company: true, result: 'They take your coin and their place in the line.' } },
  { id: 'relics', title: 'The saint\'s bones', text: 'The priests of {land} have found what they say are the bones of a saint, and want a shrine built over them. A merchant offers a good price for the lot.',
    a: { label: 'Build the shrine', virtue: 12, supplies: -3, result: 'The shrine is raised, and the sick begin to come.' },
    b: { label: 'Sell them', virtue: -12, supplies: 4, result: 'The bones go south in a locked chest. The priests say nothing in your hearing.' } },
  { id: 'spy', title: 'A spy is taken', needs: 'rival', text: 'A man of {rival} is caught counting your spears in {land}. Your captains want him hanged; his masters would pay to have him back.',
    a: { label: 'Send him home unharmed', virtue: 8, supplies: 0, favor: 1, result: 'He is put over the border with his boots and his life. {rival} take note of it.' },
    b: { label: 'Ransom him', virtue: -8, supplies: 3, result: 'The price is paid at the border. Nobody shakes hands.' } },
  { id: 'debts', title: 'The year of debts', text: 'Half the farmers of {land} owe the other half more than they can pay, and the lenders ask you to enforce it.',
    a: { label: 'Forgive the debts', virtue: 10, supplies: -2, result: 'The tally sticks are burned in the square. The lenders are paid a little from your stores.' },
    b: { label: 'Enforce them, and take your share', virtue: -10, supplies: 3, result: 'Farms change hands. Your share is delivered promptly.' } },
];
export const TALE_FROM = 3; // the first tale comes on this turn
export const TALE_EVERY = 4; // and another every so many turns after
/** How far a rival people moves along the scale each time it answers a tale of its own. */
export const TALE_RIVAL = 6;
