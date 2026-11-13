// What the common people say: villagers at every job and warriors of every arm, each in three tempers. A town that
// has turned to the church speaks one way, a town that has turned to the tavern another, and a town between them
// plainly. The words here are the script; a recording named by `folkKey` in public/assets/voice/ is played when one
// of them is chosen, sent to work or to war, or caught in a raid. Until a recording exists they say nothing.

export type Lean = 'pious' | 'plain' | 'decadent';
export const LEANS: Lean[] = ['pious', 'plain', 'decadent'];
export const LEAN_NOTES: Record<Lean, string> = {
  pious: 'In a holy town: devout, earnest, glad of the work',
  plain: 'In an ordinary town: brisk and matter-of-fact',
  decadent: 'In a decadent town: lazy, greedy, looking out for themselves',
};

export type FolkMoment = 'ready' | 'go' | 'fear' | 'march' | 'charge' | 'hurt';
export const MOMENT_NOTES: Record<FolkMoment, string> = {
  ready: 'When you click on them',
  go: 'When you send them to their work',
  fear: 'When the town is attacked',
  march: 'When you order them to move',
  charge: 'When you order them to attack',
  hurt: 'When they are badly wounded',
};

export interface FolkRole {
  id: string;
  name: string;
  kind: 'villager' | 'warrior';
  /** Who they are, for whoever is voicing them. */
  about: string;
  /** For each moment: the pious line, the plain line, the decadent line. */
  lines: Partial<Record<FolkMoment, [string, string, string]>>;
}

export const FOLK: FolkRole[] = [
  // ---- villagers, by the work they do ----
  { id: 'townsfolk', name: 'Townsfolk', kind: 'villager', about: 'A villager with no task yet, waiting to be told.', lines: {
    ready: ['Here am I. Send me.', 'What do you need?', 'Can it wait till after supper?'],
    go: ['As you will, and as He wills.', 'On my way.', 'If I must.'],
    fear: ['Ring the bell! Pray!', 'Ring the bell! Get inside!', 'Save yourselves!'],
  } },
  { id: 'woodcutter', name: 'Woodcutter', kind: 'villager', about: 'Fells trees and hauls timber.', lines: {
    ready: ['God give me strength for the axe.', 'Axe is sharp. What needs felling?', 'Trees, again? My head is splitting.'],
    go: ['Every tree a gift. I take it gladly.', 'Timber it is.', 'Fine. Wood. Then wine.'],
    fear: ['Lord, shield us!', 'Raiders! To the hall!', 'Not my hide! Run!'],
  } },
  { id: 'farmer', name: 'Farmer', kind: 'villager', about: 'Works the fields.', lines: {
    ready: ['He sends the rain; I bring the plough.', "Fields won't tend themselves.", "Sun's too high for this."],
    go: ['We sow in faith.', 'Off to the furrows.', "I'll plough it. Crooked, but I'll plough it."],
    fear: ['Mercy on our harvest!', "They're burning the fields!", 'Let them have the turnips!'],
  } },
  { id: 'forager', name: 'Forager', kind: 'villager', about: 'Gathers berries and whatever grows wild.', lines: {
    ready: ["He feeds the sparrows. He'll feed us.", "Basket's empty. Where to?", 'Berries make good wine, you know.'],
    go: ["I'll gather what is given.", 'To the bushes.', 'Picking. Half for the basket.'],
    fear: ['Hide me, O Lord!', "Someone's in the brush!", 'Drop the basket! Go!'],
  } },
  { id: 'hunter', name: 'Hunter', kind: 'villager', about: 'Brings down game for the pot.', lines: {
    ready: ['I take only what we need.', "Bow's strung.", 'Something fat and slow, I hope.'],
    go: ['Bless the beast that feeds us.', 'On the trail.', 'Meat tonight. The good cuts are mine.'],
    fear: ['The hunters are hunted. God help us!', "That's no deer!", "I hunt things that don't hit back!"],
  } },
  { id: 'fisher', name: 'Fisher', kind: 'villager', about: 'Works the nets from the shore or a boat.', lines: {
    ready: ['The first fishers were holy men.', 'Nets are mended.', "Fish don't mind if I'm late."],
    go: ['Cast the net and trust.', 'Out on the water.', "I'll fish. Where it's shady."],
    fear: ['Save us from the deep and the sword!', 'Ships! Row for shore!', 'Take the catch! Take the boat!'],
  } },
  { id: 'miner', name: 'Miner', kind: 'villager', about: 'Cuts stone and digs gold.', lines: {
    ready: ['Even the stones cry out His name.', "Pick's ready.", 'Gold, is it? Now you have my ear.'],
    go: ['I dig for the house of God.', 'Down the pit.', 'Some for the town. Some for my pocket.'],
    fear: ['Rock of ages, hide me!', 'Out of the pit! Out!', 'They can have the stone. Not the gold!'],
  } },
  { id: 'builder', name: 'Builder', kind: 'villager', about: 'Raises houses, walls and everything else.', lines: {
    ready: ['Unless He builds the house, we toil for nothing.', "Hammer and line. What's the job?", "It'll stand. Mostly."],
    go: ['Stone on stone, to His glory.', "I'll raise it.", "Built by sundown. Don't lean on it."],
    fear: ['Our walls are in His hands!', 'Drop the tools! To the walls!', 'I built the back door for this!'],
  } },
  { id: 'cleric', name: 'Cleric', kind: 'villager', about: 'A villager who serves in the church: the holy end of town.', lines: {
    ready: ['Peace be on this house.', 'The church doors are open.', 'The collection plate first, if you please.'],
    go: ['I go to tend the flock.', 'To the altar.', "Indulgences won't sell themselves."],
    fear: ['Sanctuary! Sanctuary!', 'To the church, all of you!', 'Save the silver!'],
  } },
  { id: 'taverner', name: 'Tavern-keeper', kind: 'villager', about: 'A villager who serves in the tavern: the low end of town.', lines: {
    ready: ['Water for the weary, and a kind word.', "What'll it be?", "First cup's free. The rest never are."],
    go: ["I'll keep an honest house.", 'Back to the taps.', 'More wine! More dice! More coin!'],
    fear: ['Let them not find us drunk!', 'Bar the door!', 'Hide the good barrels!'],
  } },
  // ---- warriors, by how they fight ----
  { id: 'footman', name: 'Foot soldier', kind: 'warrior', about: 'Club, spear or sword: the line of battle.', lines: {
    ready: ['My shield is my faith.', 'Ready.', 'Is there pay in it?'],
    march: ['Where He leads, I follow.', 'Moving out.', 'Marching. Slowly.'],
    charge: ['For God and home!', 'Charge!', 'First to their purses!'],
    hurt: ['Into Thy hands!', "I'm hit!", 'Not worth the wage!'],
  } },
  { id: 'archer', name: 'Archer', kind: 'warrior', about: 'Sling, bow, crossbow or gun: fights from a distance.', lines: {
    ready: ['Guide my arrow true.', "String's dry.", 'I shoot better with a drink.'],
    march: ['We go with a blessing.', 'On the move.', 'Point me at something.'],
    charge: ['Loose, in His name!', 'Loose!', 'Ten coin says I drop him!'],
    hurt: ['Forgive me!', 'Arrow in me!', 'They shoot back?!'],
  } },
  { id: 'rider', name: 'Rider', kind: 'warrior', about: 'Fights from horse, camel or elephant.', lines: {
    ready: ['My horse and I are His.', 'In the saddle.', 'Fastest horse, first to the spoils.'],
    march: ['We ride with the dawn.', 'Riding.', "Ride on. The inn's that way."],
    charge: ['Ride them down, for the Lord!', 'Run them down!', 'Trample them! Take everything!'],
    hurt: ['Carry me home, old friend!', 'Horse is down!', 'My good saddle!'],
  } },
  { id: 'engineer', name: 'Siege crew', kind: 'warrior', about: 'Hauls and works the rams, catapults and guns.', lines: {
    ready: ['Walls fall to the faithful.', "Engine's ready.", 'Costly thing. Pay me before it breaks.'],
    march: ['Haul, brothers, and sing.', 'Hauling.', 'Push it yourself. Fine, fine.'],
    charge: ['Let the stones judge them!', 'Let fly!', "Knock it down! We'll loot the rubble!"],
    hurt: ['The engine! God preserve it!', "We're exposed!", 'Leave it! Run!'],
  } },
  { id: 'healer', name: 'Priest or shaman', kind: 'warrior', about: 'Marches with the army to heal, bless and curse.', lines: {
    ready: ['Bring me the wounded.', 'I am here.', 'Healing has its price.'],
    march: ['I walk among the fallen.', 'Coming.', "Coming. Don't rush a holy man."],
    charge: ['Be whole, and sin no more.', 'Hold still.', 'This will cost you.'],
    hurt: ['Father, receive me.', 'I am struck!', "Me? You'd strike me?"],
  } },
  { id: 'sailor', name: 'Sailor', kind: 'warrior', about: 'Crews the fishing boats, transports and warships.', lines: {
    ready: ['He stills the waters.', 'Decks are clear.', 'Rum first, then rowing.'],
    march: ['We sail by His stars.', 'Making way.', 'Wherever the plunder is.'],
    charge: ['Ram them, and God defend the right!', 'Ram them!', 'Board her! Take the cargo!'],
    hurt: ['The sea take me to Him!', "We're holed!", 'Abandon ship! Me first!'],
  } },
];

export const folkRole = (id: string): FolkRole | undefined => FOLK.find((r) => r.id === id);
/** How many voices can share a line: the game picks one of those recorded each time. */
export const FOLK_VOICES = ['a', 'b', 'c'];
/** The name of a recording: role, temper, moment, then whose voice (m or f) and which of up to three voices. */
export const folkKey = (role: string, lean: Lean, moment: FolkMoment, sex: 'm' | 'f', voice = 'a'): string => `folk_${role}_${lean}_${moment}_${sex}${voice}`;
/** The temper of a town by its standing between church and tavern (the same line the icons turn at). */
export const leanOf = (virtue: number): Lean => (virtue >= 30 ? 'pious' : virtue <= -30 ? 'decadent' : 'plain');
