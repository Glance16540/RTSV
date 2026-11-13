// What the common people say: villagers at every job and warriors of every arm, each in three tempers. A town that
// has turned to the church speaks one way, a town that has turned to the tavern another, and a town between them
// plainly. The words here are the script; a recording named by `folkKey` in public/assets/voice/ is played when one
// of them is chosen, sent to work or to war, or caught in a raid. Until a recording exists they say nothing.

export type Lean = 'pious' | 'plain' | 'decadent';
export const LEANS: Lean[] = ['pious', 'plain', 'decadent'];
export const LEAN_NOTES: Record<Lean, string> = {
  pious: 'In a holy town: caring, kind and devout',
  plain: 'In an ordinary town: brisk and matter-of-fact',
  decadent: 'In a decadent town: corrupt, greedy, lewd, out for themselves',
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
  /** Where a woman at this work is another person altogether (the barmaid, not the tavern-keeper): her name, who she is, and her own lines. */
  herName?: string;
  herAbout?: string;
  her?: Partial<Record<FolkMoment, [string, string, string]>>;
}
/** A role as a man or as a woman plays it. */
export const folkAs = (r: FolkRole, sex: 'm' | 'f'): { name: string; about: string; lines: FolkRole['lines'] } =>
  sex === 'f' && r.her ? { name: r.herName ?? r.name, about: r.herAbout ?? r.about, lines: r.her } : { name: r.name, about: r.about, lines: r.lines };

export const FOLK: FolkRole[] = [
  // ---- villagers, by the work they do ----
  { id: 'townsfolk', name: 'Townsfolk', kind: 'villager', about: 'A villager with no task yet, waiting to be told.', lines: {
    ready: ['How can I help, friend?', 'What do you need?', "What's it worth to you?"],
    go: ['Gladly. Many hands make light work.', 'On my way.', 'Fine. But you owe me.'],
    fear: ["Get the children inside! I'll stay with the old ones!", 'Ring the bell! Get inside!', 'Save yourselves!'],
  } },
  { id: 'woodcutter', name: 'Woodcutter', kind: 'villager', about: 'Fells trees and hauls timber.', lines: {
    ready: ['Strength for the axe, and thanks for the day.', 'Axe is sharp. What needs felling?', "Trees, again? My head's still full of last night."],
    go: ["I'll cut enough for the widow's hearth too.", 'Timber it is.', 'Fine. Wood. Then wine and women.'],
    fear: ['Behind me, all of you!', 'Raiders! To the hall!', 'Not my hide! Run!'],
  } },
  { id: 'farmer', name: 'Farmer', kind: 'villager', about: 'Works the fields.', lines: {
    ready: ['He sends the rain; I bring the plough.', "Fields won't tend themselves.", "Sun's too high, and I'm too sore."],
    go: ['A tenth for the poor, the rest for the barn.', 'Off to the furrows.', "I'll plough it. Crooked, like everything here."],
    fear: ['Take my hand, little one. Run with me!', "They're burning the fields!", 'Let them have the turnips!'],
  } },
  { id: 'forager', name: 'Forager', kind: 'villager', about: 'Gathers berries and whatever grows wild.', lines: {
    ready: ["He feeds the sparrows. He'll feed us.", "Basket's empty. Where to?", 'Berries make strong wine. Ask me how I know.'],
    go: ['The first basket goes to the sick house.', 'To the bushes.', 'Picking. Half for the basket, half for the still.'],
    fear: ['Stay close. I know where to hide us!', "Someone's in the brush!", 'Drop the basket! Go!'],
  } },
  { id: 'hunter', name: 'Hunter', kind: 'villager', about: 'Brings down game for the pot.', lines: {
    ready: ['I take only what we need.', "Bow's strung.", 'Something fat and slow. Like the magistrate.'],
    go: ['Bless the beast that feeds us.', 'On the trail.', 'Meat tonight. The good cuts are mine.'],
    fear: ["I'll draw them off. Get the others home!", "That's no deer!", "I hunt things that don't hit back!"],
  } },
  { id: 'fisher', name: 'Fisher', kind: 'villager', about: 'Works the nets from the shore or a boat.', lines: {
    ready: ['The first fishers were holy men.', 'Nets are mended.', "Fish don't mind if I'm late. Or drunk."],
    go: ["Cast the net and trust. There's enough for all.", 'Out on the water.', "I'll fish. Where it's shady, with a jug."],
    fear: ['Into my boat, quickly, all of you!', 'Ships! Row for shore!', 'Take the catch! Take the boat!'],
  } },
  { id: 'miner', name: 'Miner', kind: 'villager', about: 'Cuts stone and digs gold.', lines: {
    ready: ['Even the stones cry out His name.', "Pick's ready.", 'Gold, is it? Now you have my ear.'],
    go: ["I dig for God's house and my neighbour's roof.", 'Down the pit.', 'Some for the town. More for my pocket.'],
    fear: ['Give me your arm, brother. Up we go!', 'Out of the pit! Out!', 'They can have the stone. Not my gold!'],
  } },
  { id: 'builder', name: 'Builder', kind: 'villager', about: 'Raises houses, walls and everything else.', lines: {
    ready: ['Unless He builds the house, we toil for nothing.', "Hammer and line. What's the job?", "It'll stand. Long enough to get paid."],
    go: ['A sound roof for every family.', "I'll raise it.", "Built by sundown. Don't lean on it."],
    fear: ["Inside the walls, everyone! I'll hold the gate!", 'Drop the tools! To the walls!', 'I built the back door for this!'],
  } },
  { id: 'cleric', name: 'Cleric', kind: 'villager', about: 'A villager who serves in the church. In a holy town a gentle shepherd; in a decadent one a seller of pardons.', lines: {
    ready: ['Peace be on you, child. What troubles you?', 'The church doors are open.', 'Coin in the plate first, sinner.'],
    go: ['I go to sit with the sick and the dying.', 'To the altar.', 'Sins forgiven! Prices are on the door.'],
    fear: ['Come, all of you. No one is turned away.', 'To the church, all of you!', 'Save the silver! Leave the relics!'],
  } },
  { id: 'taverner', name: 'Tavern-keeper', kind: 'villager', about: 'A man who keeps the tavern. In a holy town a kindly host; in a decadent one he owns half the town in debts.',
    herName: 'Barmaid', herAbout: 'A woman who serves in the tavern. In a holy town she is caring and kind, a mother to every traveller; in an ordinary one brisk and cheerful; in a decadent one flirtatious and downright salacious. Play that one broad and teasing.',
    lines: {
      ready: ['Sit, friend. Bread and a warm fire, no charge.', "What'll it be?", "First cup's free. After that I own you."],
      go: ["I'll keep an honest house.", 'Back to the taps.', 'More wine! More dice! More girls!'],
      fear: ["Down to the cellar! There's room for everyone!", 'Bar the door!', 'Hide the good barrels!'],
    },
    her: {
      ready: ['Sit down, love, you look worn through. Let me fetch you some soup.', "What'll it be, then?", 'Well, hello, handsome. See anything you like?'],
      go: ["I'll see every traveller fed and safe abed.", 'Back to the tables.', "A coin, and I pour. Two, and I'll warm your lap."],
      fear: ['Hush now, sweet ones. Stay close by me.', 'Bar the door!', "Not the face! It's my living!"],
    } },
  // ---- warriors, by how they fight: in a holy town they guard the innocent, in a decadent one they thirst for blood ----
  { id: 'footman', name: 'Foot soldier', kind: 'warrior', about: 'Club, spear or sword: the line of battle. Holy, he is a shield for the helpless; decadent, he lives for the killing.', lines: {
    ready: ['I stand between harm and the helpless.', 'Ready.', "My blade's thirsty. Who dies today?"],
    march: ['We march so the children may sleep.', 'Moving out.', 'Find me something to kill.'],
    charge: ['Shield the innocent! Spare those who yield!', 'Charge!', 'Blood! Leave none breathing!'],
    hurt: ['Hold the line. Get the people out!', "I'm hit!", "I'll gut one more before I go!"],
  } },
  { id: 'archer', name: 'Archer', kind: 'warrior', about: 'Sling, bow, crossbow or gun: fights from a distance. Holy, he shoots to protect; decadent, for sport.', lines: {
    ready: ['Guide my arrow, and keep it from the innocent.', "String's dry.", 'I like it when they run. Better sport.'],
    march: ['I watch over those who cannot fight.', 'On the move.', 'Show me something that bleeds.'],
    charge: ['Aim for those who bear arms, no other!', 'Loose!', 'Feather them! Hear them squeal!'],
    hurt: ['Keep shooting. Cover the villagers!', 'Arrow in me!', 'Mine! That one is mine to kill!'],
  } },
  { id: 'rider', name: 'Rider', kind: 'warrior', about: 'Fights from horse, camel or elephant. Holy, he rides to the rescue; decadent, he rides men down for the joy of it.', lines: {
    ready: ['We ride to the aid of the weak.', 'In the saddle.', 'Let me ride them down. I love the crunch.'],
    march: ['Hold on, good people. We are coming.', 'Riding.', 'The smell of blood is on the wind.'],
    charge: ['Drive them off! Harm no one who flees!', 'Run them down!', 'Trample them! Paint the grass red!'],
    hurt: ['Carry me home, old friend. They are safe.', 'Horse is down!', 'Drag me to them! I can still cut!'],
  } },
  { id: 'engineer', name: 'Siege crew', kind: 'warrior', about: 'Hauls and works the rams, catapults and guns. Holy, he breaks walls and spares homes; decadent, he wants the whole town to burn.', lines: {
    ready: ['We break walls, not homes.', "Engine's ready.", 'Let me burn something. Anything.'],
    march: ['Haul, brothers. Mind the fields we cross.', 'Hauling.', 'Faster! I want to hear them scream.'],
    charge: ['Strike the gate! Keep clear of the houses!', 'Let fly!', 'Bring it all down on their heads!'],
    hurt: ['Stand fast. No one behind us is harmed.', "We're exposed!", 'One more shot! Into the thick of them!'],
  } },
  { id: 'healer', name: 'Priest or shaman', kind: 'warrior', about: 'Marches with the army to heal, bless and curse. Holy, he tends friend and foe alike; decadent, he blesses the slaughter.', lines: {
    ready: ['Bring me the wounded, friend or foe.', 'I am here.', 'The gods are hungry. Feed them.'],
    march: ['I walk among the fallen, and leave none.', 'Coming.', 'I come to bless the killing.'],
    charge: ['Be whole. Go, and do no cruelty.', 'Hold still.', 'Rise and kill again!'],
    hurt: ['Tend the others first.', 'I am struck!', 'My blood for theirs! Avenge me!'],
  } },
  { id: 'sailor', name: 'Sailor', kind: 'warrior', about: 'Crews the fishing boats, transports and warships. Holy, he pulls the drowning from the sea; decadent, he gives no quarter.', lines: {
    ready: ['We guard the shore and all who live on it.', 'Decks are clear.', 'The sea wants bodies. So do I.'],
    march: ['We sail to bring them safely home.', 'Making way.', 'Find me a ship to bleed.'],
    charge: ['Take the ship! Pull the drowning aboard!', 'Ram them!', 'No quarter! Feed them to the fish!'],
    hurt: ['Save the passengers first!', "We're holed!", "If I drown, I'm dragging them down!"],
  } },
];

export const folkRole = (id: string): FolkRole | undefined => FOLK.find((r) => r.id === id);
/** How many voices can share a line: the game picks one of those recorded each time. */
export const FOLK_VOICES = ['a', 'b', 'c'];
/** The name of a recording: role, temper, moment, then whose voice (m or f) and which of up to three voices. */
export const folkKey = (role: string, lean: Lean, moment: FolkMoment, sex: 'm' | 'f', voice = 'a'): string => `folk_${role}_${lean}_${moment}_${sex}${voice}`;
/** The temper of a town by its standing between church and tavern (the same line the icons turn at). */
export const leanOf = (virtue: number): Lean => (virtue >= 30 ? 'pious' : virtue <= -30 ? 'decadent' : 'plain');
