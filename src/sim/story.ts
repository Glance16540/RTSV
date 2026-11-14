// The story of a campaign: places with names and a past, things that happen to the whole world, tales that are
// put to the player to decide, and the chronicle that all of it is written into. Words and numbers only: the
// rules that use them are in campaign.ts.

import type { Campaign } from './campaign';
import { creedOf } from './creed';

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
/** What is told of each place by name. A place is given one of its own legends, never another's. */
export const LEGENDS: Record<string, string[]> = {
  'the Standing Stones': ['Older than any people now living; nobody will say who raised them.', 'On the shortest day the sun rises between the two tallest, and people come four lands to see it.'],
  'the Hermit\'s Well': ['A hermit lived beside it for sixty years and never once turned a traveller away.', 'The sick are carried here from four lands off to drink.'],
  'the White Chapel': ['It was limewashed by the first monks, and has been every spring since.', 'A light is kept here that has not gone out in living memory.'],
  'the Grove of Lamps': ['Every family that has lost someone hangs a lamp in its branches.', 'No axe has been laid to it, and nobody remembers who first forbade it.'],
  'the Old Ford': ['Every road in this country comes down to it sooner or later.', 'Whoever holds the crossing takes a share of all that crosses.'],
  'the Salt Fair': ['Salt comes up from the coast and is sold here by the block, as it always has been.', 'It is held twice a year, and prices in six lands are set by it.'],
  'the Four Roads': ['Traders met here before there were kings to tax them.', 'An inn has stood at the crossing longer than any of the roads has had a name.'],
  'the Weighing Stone': ['A bargain struck with a hand on the stone has never been broken, or so they swear.', 'Every measure in this country was first cut to match it.'],
  'the Broken Keep': ['Its builders are forgotten, but half its walls still turn an army.', 'It was broken once, from inside, and never since.'],
  'the Giant\'s Wall': ['No one living could lift its stones, which is how it got its name.', 'Three kings have died trying to take it.'],
  'the Watch on the Rock': ['From its top a man can see an army a day before it arrives.', 'It has never fallen to anyone who came at it from the front.'],
  'the Drowned Fort': ['The lake rose over its lower courts long ago; the towers still stand dry.', 'At low water the old gate shows, and the road that ran to it.'],
  'the Iron Hills': ['The hills are hollow with old workings.', 'Ore lies so near the surface here that ploughs turn it up.'],
  'the Smoking Pits': ['The charcoal burners\' smoke can be seen from two lands away.', 'Its smiths ask no questions of whoever pays.'],
  'the Red Diggings': ['The streams run red below them, and so do the men who work there.', 'Its blades are known wherever blades are used.'],
  'the Hammer Dale': ['A stranger can find it in the dark by the sound.', 'Every house in the dale has a forge behind it.'],
  'the House of Scrolls': ['Everything that has been found out is written down here, somewhere.', 'Its keepers serve whoever holds the land, and outlast them.'],
  'the Star Tower': ['Its watchers have marked every night\'s sky for longer than any people has kept a calendar.', 'Sailors and farmers both send to ask what it has seen.'],
  'the School on the Hill': ['Kings send their children here, and their spies.', 'Its masters have taught the sons of enemies on the same bench.'],
  'the Hall of Maps': ['Every coast and pass is drawn here, and some that nobody has found again.', 'A general who has studied here is said to be worth a thousand spears.'],
};

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
 * of the local tribes, `{place}` a named place the player holds (and `{land}` is then the land it stands in).
 */
export interface TaleChoice {
  label: string; result: string; virtue: number; supplies: number;
  /** Goodwill gained or lost with the rival in the tale. */
  favor?: number;
  /** A company of infantry joins the army in the player's chief town. */
  company?: boolean;
  /** The tribe's defenders stand down by one (never below one). */
  militia?: number;
  /** The tribe's land comes under the player's rule without a blow. */
  join?: boolean;
}
export interface Tale {
  id: string; title: string; text: string; needs?: 'rival' | 'tribe'; a: TaleChoice; b: TaleChoice;
  /** Told only to whoever holds a named place of this kind, and about that place. */
  place?: PlaceKind;
  /**
   * What an earlier answer led to: told once, at the next telling after that answer was given, about the same
   * land, rival and tribe. If that rival has fallen or the tribe's land has been taken, the thread is dropped.
   */
  after?: { id: string; choice: 'a' | 'b' };
}
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
  // ---- Tales of the named places: told to whoever holds one. ----
  { id: 'vigil', title: 'The keepers\' peace', place: 'shrine', text: 'The keepers of {place} ask you to swear that no blood will be shed in {land} for a season, and that their table will be kept.',
    a: { label: 'Swear it, and keep their table', virtue: 10, supplies: -1, result: 'The oath is sworn on the threshold of {place}. The keepers\' table is kept.' },
    b: { label: 'Swear nothing, and tax the pilgrims', virtue: -10, supplies: 3, result: 'A toll booth goes up on the road to {place}. The keepers look through you.' } },
  { id: 'weights', title: 'False weights', place: 'fair', text: 'At {place} the buyers complain of false weights. The men who use them offer you a share to look away.',
    a: { label: 'Break the false weights in public', virtue: 8, supplies: -1, result: 'The weights are broken on the ground at {place} with the whole market watching.' },
    b: { label: 'Take the share', virtue: -10, supplies: 4, result: 'Your share comes monthly from {place}, in a plain bag.' } },
  { id: 'bones', title: 'The last defenders', place: 'keep', text: 'Under {place} the diggers have found its last defenders where they fell, still in their mail.',
    a: { label: 'Bury them with honour', virtue: 8, supplies: -2, result: 'They are laid in one grave under the wall of {place}, and a stone is cut for them.' },
    b: { label: 'Strip the mail for your own men', virtue: -8, supplies: -1, company: true, result: 'The mail is scoured and handed out. The bones go back in the ditch.' } },
  { id: 'bellows', title: 'The men at the bellows', place: 'forge', text: 'The smiths of {place} keep bound men at the bellows, and offer you blades at half price if you ask nothing about it.',
    a: { label: 'Free the bound men', virtue: 10, supplies: -2, result: 'The chains are struck off at {place}. Blades cost what they cost.' },
    b: { label: 'Ask nothing', virtue: -10, supplies: 3, result: 'The blades from {place} are cheap and good. You do not go to see them made.' } },
  { id: 'book', title: 'The closed book', place: 'library', text: 'The keepers of {place} hold a book they will not open and say should be burned. Your captains say it describes engines of war, and that others would pay for copies.',
    a: { label: 'Burn it unread', virtue: 8, supplies: 0, result: 'It burns in the yard of {place}. Nobody now knows what was in it.' },
    b: { label: 'Have it copied and sold', virtue: -8, supplies: 3, result: 'The copyists of {place} work through the winter. The copies sell.' } },
  // ---- What an earlier answer led to. ----
  { id: 'exile_home', title: 'The exile goes home', after: { id: 'exile', choice: 'a' }, needs: 'rival', text: 'The prince you sheltered in {land} has gathered those who still love him. He asks your blessing to go home and take back what {rival} took, or your spears to help him do it.',
    a: { label: 'Bless him, and let him go with his own', virtue: 6, supplies: 0, result: 'He goes over the border with forty men of his own. Whatever comes of it, he will speak your name kindly.' },
    b: { label: 'Send your spears with him, for a share', virtue: -8, supplies: 3, favor: -1, result: 'Your men come back with carts. {rival} know whose spears they were.' } },
  { id: 'exile_debt', title: 'A name cut in the door', after: { id: 'exile', choice: 'b' }, text: 'Followers of the prince you sold have burned a barn in {land} and left his name cut in the door.',
    a: { label: 'Pay his kin the blood price', virtue: 8, supplies: -3, result: 'The price is paid to his sister. The burnings stop.' },
    b: { label: 'Hunt them down', virtue: -8, supplies: 0, result: 'Six men hang at the crossroads of {land}. The name is planed off the door.' } },
  { id: 'tribe_comes', title: 'The grain remembered', after: { id: 'hunger', choice: 'a' }, needs: 'tribe', text: 'The elders of {tribe} have not forgotten the grain. They come to ask whether their people may live under your law.',
    a: { label: 'Take them in as your own', virtue: 6, supplies: 0, join: true, result: 'The elders of {tribe} put their hands between yours. No spear is lifted.' },
    b: { label: 'Take them in, and a tithe for it', virtue: -8, supplies: 3, join: true, result: '{tribe} comes under your rule and pays for the privilege.' } },
  { id: 'tribe_grudge', title: 'Cattle in the night', after: { id: 'hunger', choice: 'b' }, needs: 'tribe', text: 'Men of {tribe}, who paid your price for grain, have driven off cattle from {land} in the night.',
    a: { label: 'Let it lie: they were owed something', virtue: 8, supplies: -2, result: 'The cattle are written off. In {tribe} they say the account is square.' },
    b: { label: 'Burn their huts for it', virtue: -10, supplies: 2, militia: -1, result: 'Your riders come back with the cattle and more. {tribe} has fewer men to send next time.' } },
  { id: 'wages', title: 'Winter pay', after: { id: 'sellswords', choice: 'b' }, text: 'The sellswords you took on want their winter pay doubled, and remark that a village in {land} would cover it nicely.',
    a: { label: 'Pay them from your own stores', virtue: 6, supplies: -3, result: 'They are paid, and the village in {land} never knows how near it came.' },
    b: { label: 'Let them collect it', virtue: -10, supplies: 2, result: 'They collect, and bring you a share. The village in {land} is quieter now.' } },
  { id: 'cure', title: 'A child walks', after: { id: 'relics', choice: 'a' }, text: 'A child was carried into the shrine you built in {land} and walked out of it. Now the roads are full of the sick and those who sell to them.',
    a: { label: 'Keep the door open to all', virtue: 8, supplies: -1, result: 'Nobody is turned from the shrine in {land}, and nobody is charged.' },
    b: { label: 'Charge at the door', virtue: -10, supplies: 4, result: 'A price is set at the shrine door. The rich are cured first.' } },
];
/** How many matters the player has settled each way, for the telling at the end. */
export interface Answer { id: string; choice: 'a' | 'b'; turn: number; land: number; rival: number; tribe: number }
export const TALE_FROM = 3; // the first tale comes on this turn
export const TALE_EVERY = 4; // and another every so many turns after
/** How far a rival people moves along the scale each time it answers a tale of its own. */
export const TALE_RIVAL = 6;

const list = (xs: string[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/**
 * The last page of the chronicle, written when a campaign is over: how it ended and how long it took, what kind
 * of people the player's had become, which named places they held, and how they settled what was brought to them.
 */
export function epilogue(c: Campaign): string[] {
  const me = c.factions[0], out: string[] = [];
  const left = c.factions.filter((f) => f.alive && f.id > 0);
  if (c.phase !== 'over') return out;
  out.push(c.winner === 0
    ? (left.length ? `After ${c.turn} turns your people held so much of the land that no one could challenge them.` : `After ${c.turn} turns your people were the only ones left in the land.`)
    : `After ${c.turn} turns the ${c.factions[c.winner]?.name ?? 'others'} ruled, and your people did not.`);
  const creed = creedOf(me.virtue ?? 0);
  out.push(`They ended it ${creed.name}: ${creed.desc[0].toLowerCase()}${creed.desc.slice(1)}`);
  const held = (c.places ?? []).filter((p) => c.territories[p.at]?.owner === 0).map((p) => p.name);
  if (held.length) out.push(`${held.length === (c.places ?? []).length ? 'Every place of note was theirs' : 'They held'}${held.length === (c.places ?? []).length ? ': ' : ' '}${list(held)}.`);
  else if (c.places?.length) out.push('They held none of the places of note.');
  const ans = c.answers ?? [], pious = ans.filter((a) => a.choice === 'a').length;
  if (ans.length) out.push(`${ans.length === 1 ? 'One matter was' : `${ans.length} matters were`} brought before you. You gave the pious answer ${pious === ans.length ? 'every time' : pious === 0 ? 'never' : `${pious} time${pious > 1 ? 's' : ''} and the worldly one ${ans.length - pious}`}.`);
  return out;
}
