// The leader of each civilisation and everything they say.
//
// Every line has a stable key, `<civ>_<event>_<n>`, numbered from 1. A recording saved under
// that name in public/assets/voice/ (mp3, ogg, wav or m4a) is played when the line is shown;
// until then the line appears as text only. docs/VOICE_SCRIPT.md lists them all for recording.

export type LeaderEvent =
  | 'intro' // first meeting on the campaign map
  | 'attack' // they march on the player's land
  | 'defend' // the player marches on theirs
  | 'win' // they beat the player in battle
  | 'lose' // the player beats them in battle
  | 'eliminated' // their last land falls
  | 'battle' // a real-time match against them begins
  | 'ageup' // they advance an age
  | 'wonder'; // they complete a Wonder

export const LEADER_EVENTS: LeaderEvent[] = ['intro', 'attack', 'defend', 'win', 'lose', 'eliminated', 'battle', 'ageup', 'wonder'];
export const EVENT_NOTES: Record<LeaderEvent, string> = {
  intro: 'First meeting on the campaign map',
  attack: "Marching on the player's land",
  defend: 'The player marches on their land',
  win: 'After beating the player in battle',
  lose: 'After losing a battle to the player',
  eliminated: 'Their last territory falls',
  battle: 'A real-time battle against them begins',
  ageup: 'They advance to a new age',
  wonder: 'They complete a Wonder',
};

export interface Leader {
  civ: string;
  name: string;
  title: string;
  icon: string;
  /** Direction for whoever voices the part. */
  voice: string;
  lines: Record<LeaderEvent, string[]>;
}

export const LEADERS: Record<string, Leader> = {
  stonekin: {
    civ: 'stonekin', name: 'Thane Brannoch Ironroot', title: 'Thane of the Stonekin', icon: '🧔',
    voice: 'Male, sixties. Deep, slow, gravelly. Never raises his voice; every word is laid like a foundation stone.',
    lines: {
      intro: ['I am Brannoch. My fathers built these halls, and their fathers before them. Mind where you tread.', 'Stone remembers, stranger. Give it something good to remember you by.'],
      attack: ['I do not hurry to war. But I have arrived.', 'You built on ground that was not yours. I have come to correct it.'],
      defend: ['You come against Stonekin walls? Bring more ladders.', 'Knock all you like. The door is thicker than your patience.'],
      win: ['That is what comes of haste.', 'Go home and build something. It will do you more good.'],
      lose: ['A wall has fallen. I have others.', 'Well struck. I will remember the place and the hour.'],
      eliminated: ['So the last stone is turned. Build well upon it. It was good stone.', 'My halls are yours. They will outlast you too.'],
      battle: ['Mark the lines and raise the walls. We are in no hurry.', 'Let them come to us. They always do.'],
      ageup: ['Slowly, slowly. And yet here we are.', 'A new age. The same stone.'],
      wonder: ['There. Let the centuries argue with that.', 'It is finished. It will be standing when your name is forgotten.'],
    },
  },
  steppe: {
    civ: 'steppe', name: 'Khatun Sarnai', title: 'Khatun of the Long Grass', icon: '👸',
    voice: 'Female, thirties. Quick, bright, amused. Speaks as if already riding away.',
    lines: {
      intro: ['I am Sarnai. Everything the wind touches is my road. You are standing on it.', 'New faces! I do hope you ride better than the last ones.'],
      attack: ['Did you hear hooves? No? You will.', 'I was passing, and your fields looked so unguarded.'],
      defend: ['You came all this way on foot? How brave. How slow.', 'Chase me if you like. You will tire first.'],
      win: ['Too slow. You were always going to be too slow.', 'Keep the dust. I am taking the rest.'],
      lose: ['Ha! You caught me. Do not expect it twice.', 'A horse stumbles. The herd runs on.'],
      eliminated: ['So the grass ends here. It was a fine ride.', 'You have my tents. You will never have my horizon.'],
      battle: ['Saddle up. I want to be home by dusk.', 'Ride them down before they have finished counting us.'],
      ageup: ['Faster horses, sharper lances. Keep up.', 'The world changes. We simply get there first.'],
      wonder: ['Even riders want one thing that stays where it is put.', 'Look at that. I may never leave.'],
    },
  },
  hearth: {
    civ: 'hearth', name: 'Mother Elowen Marsh', title: 'Hearthmother of the Hearthfolk', icon: '👵',
    voice: 'Female, fifties. Warm, unhurried, kind on the surface. The steel shows only when she is crossed.',
    lines: {
      intro: ['Welcome, dear. I am Elowen. There is room at our fire for those who come in peace.', 'Sit, eat. And then tell me honestly what you want with my valley.'],
      attack: ['I did not want this. But my children need the land, and you have it.', 'Every one of these is somebody\'s son. See that you make it worth his while.'],
      defend: ['You would march on families at their supper? Then come and meet them.', 'Shame on you. And mind the step, it is the last thing you will see.'],
      win: ['Go home, dear. Somebody there is missing you.', 'I take no joy in it. I do take the field.'],
      lose: ['You have hurt my people. I will not forget which of you did it.', 'A hard day. We have buried harder.'],
      eliminated: ['The fire is out. Be kind to those who are left. That is all I ask.', 'You have the houses. You will find they were never the point.'],
      battle: ['Stay close to home and close to each other. That is how we win.', 'Bar the doors, light the fires. Nobody stands alone today.'],
      ageup: ['Look how the little ones have grown.', 'A better age for our grandchildren. That was always the work.'],
      wonder: ['Every family put a stone in that. Every one.', 'There now. Something for the children to be proud of.'],
    },
  },
  forge: {
    civ: 'forge', name: 'Master Vex Calder', title: 'First Artificer of the Forgeborn', icon: '🧑‍🔬',
    voice: 'Male, forties. Fast, precise, distracted. Sounds as though war is interrupting something more interesting.',
    lines: {
      intro: ['Calder. First Artificer. Yes, yes, a pleasure. Do not touch anything.', 'Ah, neighbours. I had calculated you would arrive later. No matter.'],
      attack: ['I need your hills for the ore. Nothing personal. Stand clear of the engines.', 'This is a field test. You are the field.'],
      defend: ['You brought swords? To this? How quaint.', 'Careful. Half of what you are walking on is flammable.'],
      win: ['As predicted. Within a margin of error.', 'Fascinating. Write down how long they lasted.'],
      lose: ['Hm. That was not in the model. I shall have to revise.', 'A setback. I learn more from those than you do from victories.'],
      eliminated: ['All my notes. You will not even be able to read them.', 'Shut down the furnaces. Somebody will light them again. Somebody always does.'],
      battle: ['Engines to the front. Try to bring some of them back.', 'Begin. And somebody keep a tally, I want numbers afterwards.'],
      ageup: ['Finally. I have been waiting for the rest of you to catch up.', 'New methods. Discard the old ones, they were embarrassing.'],
      wonder: ['It works. Of course it works.', 'Observe. That is what thinking looks like when it is finished.'],
    },
  },
  dawn: {
    civ: 'dawn', name: 'High Seer Amaris', title: 'Voice of the Dawn Court', icon: '🧙‍♀️',
    voice: 'Female, ageless. Calm, soft, certain. Speaks of the future in the past tense.',
    lines: {
      intro: ['I am Amaris. I have seen this meeting. You were taller in the vision.', 'The dawn showed me your face long ago. It did not show me how this ends for you.'],
      attack: ['It is written. I am only turning the page.', 'Do not be afraid. This has already happened.'],
      defend: ['You come to put out the sun with spears. I pity you.', 'I watched you arrive in a dream. I watched you leave, too. Fewer.'],
      win: ['As it was shown.', 'Take comfort. You could not have done otherwise.'],
      lose: ['The vision was clouded. That is rare. I will look again.', 'So. The thread runs another way. Interesting.'],
      eliminated: ['The light goes out. It has gone out before. It returns.', 'I saw this too. I had hoped I was wrong.'],
      battle: ['Kneel, then rise. The dawn is with us.', 'Go forward without fear. I have seen who is standing at dusk.'],
      ageup: ['A new sun rises on us.', 'The age turns, as I said it would.'],
      wonder: ['A house for the dawn itself. Now it will never leave us.', 'Look up. This is the shape of what is coming.'],
    },
  },
  wild: {
    civ: 'wild', name: 'Hroth Wolf-Father', title: 'First Hunter of the Wildborn', icon: '🧔‍♂️',
    voice: 'Male, forties. Low, rough, close to a growl. Few words, long pauses. Laughs rarely and suddenly.',
    lines: {
      intro: ['Hroth. The wolves know me. They will know you, soon.', 'You smell of smoke and fences. This is not that kind of country.'],
      attack: ['The pack is hungry. You are near.', 'I gave you a season to leave. The season is over.'],
      defend: ['You hunt in my woods? Good. I like it when the meat comes to me.', 'Listen. That howling. They are saying your name.'],
      win: ['Run. It is better sport.', 'The strong eat. It was never complicated.'],
      lose: ['You bit back. Good. I was growing bored.', 'A wound. It will make a fine scar.'],
      eliminated: ['So. You are the wolf now. See how long you like the cold.', 'Bury me shallow. The pack will want to find me.'],
      battle: ['Loose the hounds. Follow the blood.', 'No walls. No waiting. Hunt.'],
      ageup: ['Sharper teeth.', 'The world grows. The hunt grows with it.'],
      wonder: ['A den for all the packs. Even I am surprised.', 'We built that. Do not tell the wolves, they will think us soft.'],
    },
  },
};

/** The key a line is recorded under, e.g. `steppe_attack_2`. */
export const lineKey = (civ: string, event: LeaderEvent, index: number): string => `${civ}_${event}_${index + 1}`;

export interface Speech { civ: string; event: LeaderEvent; index: number }
export const speechText = (s: Speech): string => LEADERS[s.civ]?.lines[s.event][s.index] ?? '';
