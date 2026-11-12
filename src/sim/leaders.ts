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
  | 'wonder' // they complete a Wonder
  | 'truce' // they accept the player's offer of a truce
  | 'refuse' // they turn a truce down
  | 'demand' // they demand tribute from the player
  | 'betray' // the player breaks a truce with them
  // Spoken to the player by their own leader:
  | 'p_start' // a campaign or match begins
  | 'p_win' // the player wins a battle
  | 'p_loss' // the player loses a battle
  | 'p_alert' // the player's town is attacked
  | 'p_ageup'; // the player advances an age

export const LEADER_EVENTS: LeaderEvent[] = ['intro', 'attack', 'defend', 'win', 'lose', 'eliminated', 'battle', 'ageup', 'wonder', 'truce', 'refuse', 'demand', 'betray', 'p_start', 'p_win', 'p_loss', 'p_alert', 'p_ageup'];
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
  truce: "They accept the player's offer of a truce",
  refuse: 'They turn down a truce',
  demand: 'They demand tribute from the player',
  betray: 'The player breaks a truce with them',
  p_start: 'As the player\'s own leader: a campaign or match begins',
  p_win: 'As the player\'s own leader: a battle is won',
  p_loss: 'As the player\'s own leader: a battle is lost',
  p_alert: 'As the player\'s own leader: the town is under attack',
  p_ageup: 'As the player\'s own leader: a new age is reached',
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
      truce: ['A wall between us, and peace on both sides of it. Agreed.', 'Good fences. I have always said so.'],
      refuse: ['No. I have not yet decided what you are.', 'Peace is built slowly. You are in too much of a hurry.'],
      demand: ['You are building on my doorstep. Pay for the stone, and I will overlook it.', 'A toll. Everyone who crosses my land pays one.'],
      betray: ['You gave your word. I had it carved. Now I shall have to break the stone.', 'I do not forget. Ask the mountains.'],
      p_start: ['We begin as we always have. One stone, then the next.', 'The ground is good. Let us build on it.'],
      p_win: ['Good. Now mend what was broken.', 'They broke on us like water on rock.'],
      p_loss: ['We have lost ground before. We took it back.', 'Count the dead. Then count the stones we still hold.'],
      p_alert: ['They are at the walls. Good. That is what walls are for.', 'To the gates. Calmly.'],
      p_ageup: ['We have earned this, slowly, as we earn everything.', 'A new age. See that we build it to last.'],
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
      truce: ['Why not? There are slower people to rob.', 'A truce! How tame of us. Very well.'],
      refuse: ['Peace? I have only just saddled up.', 'Ask me again when you can catch me.'],
      demand: ['Your herds are fat. Send me some and I ride past.', 'Pay me, and my riders will have somewhere else to be.'],
      betray: ['Oh, well played. Now run.', 'You broke faith first. Remember that when you hear the hooves.'],
      p_start: ['The grass is high and the day is young. Ride!', 'New country! I can smell it. Mount up.'],
      p_win: ['Ha! Did you see them run?', 'That is how it is done. Water the horses.'],
      p_loss: ['We lost that one. We will lose them next time, in the hills.', 'Scatter, regroup, return. It is what we do.'],
      p_alert: ['Raiders in our camp! The cheek of it. After them!', 'They have come to us. How thoughtful. Ride them down.'],
      p_ageup: ['Faster. Always faster. I approve.', 'A new age, and we are first into it.'],
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
      truce: ['Thank you, dear. Let the children grow up without this.', 'Peace. Come and eat with us, then.'],
      refuse: ['Not while my people are still burying theirs.', 'I would like to, dear. I do not trust you yet.'],
      demand: ['We have had a hard winter and you have had a soft one. Share.', 'A little grain for my little ones. I am asking nicely.'],
      betray: ['I fed your people at my table. Shame on you.', 'You looked me in the eye and promised. Remember this, all of you.'],
      p_start: ['Here we are, then. Let us make it a home.', 'Light the first fire, dear. The rest follows.'],
      p_win: ['Well done, all of you. Now come in and eat.', 'They are gone. Is everyone accounted for?'],
      p_loss: ['Oh, my dears. We will mourn tonight and plant tomorrow.', 'We have lost good people. Hold the rest close.'],
      p_alert: ['They are in the village! Ring the bell, get the children inside!', 'To your homes, and then to your spears.'],
      p_ageup: ['Look how far we have come from that first fire.', 'A better world for the little ones. Good.'],
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
      truce: ['Agreed. I have experiments that war keeps interrupting.', 'A sensible arrangement. Sign here. And here.'],
      refuse: ['The numbers do not favour it. For you, I mean.', 'No. I need to see how the engines perform against you.'],
      demand: ['I require materials. You have them. This need not be complicated.', 'Consider it funding. You will benefit eventually. Probably.'],
      betray: ['Dishonest. And worse, unpredictable. I shall correct for it.', 'I had you filed under reliable. My error.'],
      p_start: ['Right. Let us see what can be made of this place.', 'An untouched site. Excellent. Begin measuring.'],
      p_win: ['As designed. Note what worked.', 'Efficient. I am almost pleased.'],
      p_loss: ['Unacceptable. I want to know exactly what failed.', 'We will rebuild it. Better, this time.'],
      p_alert: ['They are attacking the works! Mind the furnaces!', 'Intruders. Somebody do something practical about it.'],
      p_ageup: ['At last, proper tools.', 'Progress. Throw out the old drawings.'],
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
      truce: ['Yes. I saw us at peace, for a while.', 'The dawn smiles on this. So do I.'],
      refuse: ['I have seen where that road leads. No.', 'It is not written. Not yet.'],
      demand: ['An offering is due. The dawn has shown me exactly how much.', 'Give, and be spared. I have seen what happens otherwise.'],
      betray: ['I saw this as well. I prayed I was mistaken.', 'Oathbreaker. Even the sun will turn its face from you.'],
      p_start: ['The dawn brought us here. Let us learn why.', 'I have seen what we become. Come, it starts now.'],
      p_win: ['It unfolded as I saw it.', 'The light was with us. Give thanks.'],
      p_loss: ['This, too, was in the vision. It is not the last page.', 'A dark hour. They do not last. I have checked.'],
      p_alert: ['Shadows at the threshold. Stand firm, the sun is rising.', 'They come, as foretold. We are ready, as foretold.'],
      p_ageup: ['A new light rises on our people.', 'The age turns. We turn with it.'],
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
      truce: ['Fine. The pack hunts elsewhere. For now.', 'We do not bite the hand. This season.'],
      refuse: ['Wolves do not make treaties with sheep.', 'No. I like you better afraid.'],
      demand: ['Leave meat at the forest edge. Or become it.', 'The pack takes a share. You may choose which.'],
      betray: ['You bared your throat and then bit. I respect it. I will still kill you.', 'Now it is a blood debt. The wolves keep count.'],
      p_start: ['Good country. Much game. We stay.', 'Mark the borders. Let the others smell it.'],
      p_win: ['A clean kill.', 'The pack feeds tonight.'],
      p_loss: ['We bled. We are not dead. Remember the difference.', 'Lick the wounds. Then we hunt them.'],
      p_alert: ['Something in the den. Kill it.', 'They hunt us? Here? Show them their mistake.'],
      p_ageup: ['We grow. Good. Stay hungry anyway.', 'New claws. Use them.'],
    },
  },
};

/** The key a line is recorded under, e.g. `steppe_attack_2`. */
export const lineKey = (civ: string, event: LeaderEvent, index: number): string => `${civ}_${event}_${index + 1}`;

export interface Speech { civ: string; event: LeaderEvent; index: number }
export const speechText = (s: Speech): string => LEADERS[s.civ]?.lines[s.event][s.index] ?? '';
