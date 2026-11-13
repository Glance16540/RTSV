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
  | 'ally' // they accept an alliance with the player
  | 'rivalry' // the alliance ends: only they and the player are left
  // Spoken to the player by their own leader:
  | 'p_start' // a campaign or match begins
  | 'p_win' // the player wins a battle
  | 'p_loss' // the player loses a battle
  | 'p_alert' // the player's town is attacked
  | 'p_ageup'; // the player advances an age

export const LEADER_EVENTS: LeaderEvent[] = ['intro', 'attack', 'defend', 'win', 'lose', 'eliminated', 'battle', 'ageup', 'wonder', 'truce', 'refuse', 'demand', 'betray', 'ally', 'rivalry', 'p_start', 'p_win', 'p_loss', 'p_alert', 'p_ageup'];
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
  ally: 'They accept an alliance with the player',
  rivalry: 'The alliance ends because only they and the player are left; regretful, not hostile yet',
  p_start: 'As the player\'s own leader: a campaign or match begins',
  p_win: 'As the player\'s own leader: a battle is won',
  p_loss: 'As the player\'s own leader: a battle is lost',
  p_alert: 'As the player\'s own leader: the town is under attack',
  p_ageup: 'As the player\'s own leader: a new age is reached',
};

/** Who a nation's leader is: the name, the face and how the part is played. */
export interface Persona {
  name: string;
  title: string;
  icon: string;
  female: boolean;
  /** Direction for whoever voices the part. */
  voice: string;
}

export interface Leader extends Persona {
  civ: string;
  lines: Record<LeaderEvent, string[]>;
  /**
   * The same leader as a person of the other sex, where a nation has one, so that more people can voice it. They speak
   * the same lines, except the first line of any event given here (lines that name the leader).
   */
  alt?: Persona & { lines: Partial<Record<LeaderEvent, string[]>> };
}

export const LEADERS: Record<string, Leader> = {
  stonekin: {
    civ: 'stonekin', female: false, name: 'Consul Marcus Valerius Saxa', title: 'Consul of Rome', icon: '🧔',
    voice: 'Male, sixties. Deep, slow, gravelly. Never raises his voice; every word is laid like a foundation stone.',
    alt: { name: "Augusta Livia Valeria Saxa", title: "Augusta of Rome", icon: '👩', female: true, voice: "Female, fifties. Low, slow, patrician. Never raises her voice; every word is laid like a foundation stone.", lines: {"intro": ["I am Livia Valeria. My fathers built these walls, and their fathers before them. Mind where you tread.", "Seven generations of my house are buried under this road. You may walk on it. Politely."], "attack": ["My grandmother taught me to finish what the men begin. I am here to finish it.", "Rome has been patient with you. I have not her patience."], "defend": ["You are standing in my family's garden. Wipe your feet, or be buried in it.", "These stones were laid by better men than you. They will not move for you."], "win": ["Clear the field. Then send masons; something should be built here.", "My ancestors are satisfied. They are not easily satisfied."], "lose": ["We have lost before. We kept the records, and learned from each one.", "A stone is chipped. The house stands."], "eliminated": ["Break the statues if you like. You will be digging them up to admire in a thousand years.", "So ends my house. See that the tomb is kept; it will outlast yours."], "battle": ["Shields together. You are a wall, and I have never built a poor one.", "Advance at the walk. Let them watch us come."], "ageup": ["A new age. Carve the date where our grandchildren will find it.", "We do not change. We are added to."], "wonder": ["Let them look at it from a long way off, and understand.", "Finished. My father began it; my daughter will repair it."], "truce": ["Very well. A treaty is only another kind of wall.", "Peace. Have it cut in stone, both copies."], "refuse": ["No. And I do not say things twice.", "Rome does not bargain on her own doorstep."], "demand": ["There is a tax for living beside us. It is due.", "You will send tribute. Good stone, if you have any."], "betray": ["You gave your word in my house. I shall have it chiselled over your gate.", "Faithless. My family has outlived a great many faithless men."], "ally": ["Then our houses are joined. See that yours is worthy of it.", "An alliance. I shall have your name added to the arch."], "rivalry": ["Two houses on one hill. The older one will remain.", "You were a good ally. You will be remembered so, on your monument."], "p_start": ["Here. Dig the foundations deep; we are staying.", "Begin with the walls. Everything else follows from walls."], "p_win": ["Well built, and well fought. Rome is larger tonight.", "It is done. See to the dead, then the roads."], "p_loss": ["A wall is down. Bring me the mason, not the excuses.", "We bury them with honour, and we lay the next course."], "p_alert": ["They are inside the wall. Every citizen to the gate.", "The alarm. Stand to, and hold what your fathers built."], "p_ageup": ["The city grows. So must we.", "A new age, laid on the old one, as it should be."]} },
    lines: {
      intro: ['I am Marcus Valerius. My fathers built these walls, and their fathers before them. Mind where you tread.', 'Stone remembers, stranger. Give it something good to remember you by.'],
      attack: ['I do not hurry to war. But I have arrived.', 'You built on ground that was not yours. I have come to correct it.'],
      defend: ['You come against Roman walls? Bring more ladders.', 'Knock all you like. The door is thicker than your patience.'],
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
      ally: ["Then we build one wall, you and I, and stand on it together.", "My hall is your hall. My shield is in front of you."],
      rivalry: ["We built well together. But a hall has one high seat.", "No quarrel, friend. Only the last stone, and one of us must lay it."],
      p_start: ['We begin as we always have. One stone, then the next.', 'The ground is good. Let us build on it.'],
      p_win: ['Good. Now mend what was broken.', 'They broke on us like water on rock.'],
      p_loss: ['We have lost ground before. We took it back.', 'Count the dead. Then count the stones we still hold.'],
      p_alert: ['They are at the walls. Good. That is what walls are for.', 'To the gates. Calmly.'],
      p_ageup: ['We have earned this, slowly, as we earn everything.', 'A new age. See that we build it to last.'],
    },
  },
  steppe: {
    civ: 'steppe', female: true, name: 'Khatun Sarnai', title: 'Khatun of the Long Grass', icon: '👸',
    voice: 'Female, thirties. Quick, bright, amused. Speaks as if already riding away.',
    alt: { name: "Khan Temur", title: "Khan of the Long Grass", icon: '🧔🏻', female: false, voice: "Male, thirties. Quick, bright, amused. Speaks as if already riding away.", lines: {"intro": ["I am Temur. Everything the wind touches is my road. You are standing on it.", "Ho, strangers! Nice walls. Do they come with you when you run?"], "attack": ["I bet my brother I would be in your tent by nightfall. I hate to lose a bet.", "Good morning! We are the dust on your horizon."], "defend": ["You came all this way on foot? I am almost sorry for you.", "Catch us, then! No? Then we will come to you."], "win": ["Ha! Was that all? I have barely tired the horse.", "A fine ride. Take their herds, leave them their boots."], "lose": ["Well ridden! I did not think you had it in you.", "I fell off. It happens. I will be back in the saddle before you finish cheering."], "eliminated": ["The grass will grow over all of it. Yours too, friend.", "No more horses. Ah. Then that is that."], "battle": ["Ride them down! Last man to the river buys the drink!", "Loose, wheel, loose again. You know the dance."], "ageup": ["New bows, new saddles! Let us go and try them on someone.", "The world gets bigger. Good. I was running out of it."], "wonder": ["Look at that! And we did not even have to steal it.", "A thing that does not move. Strange. I like it anyway."], "truce": ["Peace? Fine, fine. The horses could use the rest.", "Agreed! Now, do you race?"], "refuse": ["No. I like you better as a target.", "Peace is for people with slow horses."], "demand": ["I could take it. I am asking instead. See how polite I have become?", "Send horses. Good ones. I will know."], "betray": ["You broke your word? Ha! I should have done it first.", "Now I am allowed to chase you. Thank you."], "ally": ["Brothers, then! Try to keep up.", "Good! You hold them, we ride round behind."], "rivalry": ["It was a good ride together. Now we race for the lot.", "Only one khan under one sky. Draw."], "p_start": ["Good grass! Pitch the tents, turn the horses loose.", "Here will do. Until it does not."], "p_win": ["Ha! Did you see them run? Tell it at every fire.", "Ours! Round up the herds."], "p_loss": ["A bad fall. Up, up. The grass is still ours.", "We lost some good riders. Drink to them, then mount."], "p_alert": ["They are in the camp! Mount, mount!", "Someone is stealing from us! That is our trade!"], "p_ageup": ["Better bows! Who wants to go visiting?", "We have learned something new. Let us go and show the neighbours."]} },
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
      ally: ["Ride with us, then! Try to keep up.", "Two herds, one thunder. I like it."],
      rivalry: ["Nobody left to chase but you. Pity. Good hunting, friend.", "We rode well together. Now let us see who rides faster."],
      p_start: ['The grass is high and the day is young. Ride!', 'New country! I can smell it. Mount up.'],
      p_win: ['Ha! Did you see them run?', 'That is how it is done. Water the horses.'],
      p_loss: ['We lost that one. We will lose them next time, in the hills.', 'Scatter, regroup, return. It is what we do.'],
      p_alert: ['Raiders in our camp! The cheek of it. After them!', 'They have come to us. How thoughtful. Ride them down.'],
      p_ageup: ['Faster. Always faster. I approve.', 'A new age, and we are first into it.'],
    },
  },
  hearth: {
    civ: 'hearth', female: true, name: 'Lady Aldegund of the Marches', title: 'Lady of the Franks', icon: '👵',
    voice: 'Female, fifties. Warm, unhurried, kind on the surface. The steel shows only when she is crossed.',
    alt: { name: "Count Odo of the Marches", title: "Count of the Franks", icon: '👴', female: false, voice: "Male, sixties. Warm, unhurried, grandfatherly on the surface. The steel shows only when he is crossed.", lines: {"intro": ["Welcome, friend. I am Odo. There is room at our fire for those who come in peace.", "Come in out of the weather. You can tell me your intentions over the soup."], "attack": ["I am too old to enjoy this. I am not too old to do it.", "I planted this quarrel with patience. Now I must harvest it."], "defend": ["I fought on this hill when your father was a boy. It has not moved.", "You have frightened my grandchildren. That was a mistake."], "win": ["There. Now go home, lad, and do not come back.", "Bury them decently. They were somebody's sons."], "lose": ["I have lost before. I am still here, you will notice.", "A hard day. The orchard will still want pruning tomorrow."], "eliminated": ["Leave the apple trees standing, at least. They did you no harm.", "I am tired. Let the young ones pick it up after me."], "battle": ["Stand together, lads. Nobody runs, and everybody goes home.", "Steady. I have done this before; follow the old man."], "ageup": ["Well, well. I did not think I would live to see this.", "New ways. Keep the best of the old ones, mind."], "wonder": ["My grandfather dreamed of this. I shall tell him at his grave.", "Built by the whole valley. Every one of you, be proud."], "truce": ["Good. Let us put the swords away and broach a cask.", "Peace. That is the best news an old man hears."], "refuse": ["No, lad. I have seen that trick before you were born.", "I will not. And do not ask me again at my own table."], "demand": ["A neighbour pays his share. Yours is overdue.", "Send grain, and we will say no more about it."], "betray": ["I broke bread with you. That meant something, where I come from.", "You have shamed yourself. I will see you pay for it."], "ally": ["Shake on it, lad. My word has held for sixty years.", "Then your trouble is mine. I have a few good fights left in me."], "rivalry": ["I had hoped to die your friend. It seems one of us must go first.", "Old friends make the saddest enemies. Come, then."], "p_start": ["Good soil. Good water. We could grow old here.", "Right, lads. Houses first, then the barn."], "p_win": ["Well done, all of you. First round is mine.", "They are gone. Count heads, then light the fires."], "p_loss": ["We have buried good folk today. We will plant again in spring.", "A sore loss. Lean on each other; that is what a village is for."], "p_alert": ["They are in the village! Get the little ones to the church!", "Ring the bell! Every man who can hold a pitchfork!"], "p_ageup": ["Look how far we have come. Your grandfathers would not know the place.", "A better age for the children. That will do me."]} },
    lines: {
      intro: ['Welcome, dear. I am Aldegund. There is room at our fire for those who come in peace.', 'Sit, eat. And then tell me honestly what you want with my valley.'],
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
      ally: ["Then you are family, and we look after family.", "Pull up a chair, dear. Your enemies are ours now."],
      rivalry: ["Oh, my dear. There is only one table left, and we cannot both sit at the head.", "I had hoped it would not come to us. Go gently, and so will I."],
      p_start: ['Here we are, then. Let us make it a home.', 'Light the first fire, dear. The rest follows.'],
      p_win: ['Well done, all of you. Now come in and eat.', 'They are gone. Is everyone accounted for?'],
      p_loss: ['Oh, my dears. We will mourn tonight and plant tomorrow.', 'We have lost good people. Hold the rest close.'],
      p_alert: ['They are in the village! Ring the bell, get the children inside!', 'To your homes, and then to your spears.'],
      p_ageup: ['Look how far we have come from that first fire.', 'A better world for the little ones. Good.'],
    },
  },
  forge: {
    civ: 'forge', female: false, name: 'Master Lu Wen', title: 'First Artificer of the Imperial Workshops', icon: '🧑‍🔬',
    voice: 'Male, forties. Fast, precise, distracted. Sounds as though war is interrupting something more interesting.',
    alt: { name: "Lady Shen Yue", title: "First Artificer of the Imperial Workshops", icon: '👩‍🔬', female: true, voice: "Female, forties. Fast, precise, distracted. Sounds as though war is interrupting something more interesting.", lines: {"intro": ["Shen Yue. First Artificer. Yes, yes, a pleasure. Do not touch anything.", "You are standing on a test range. No, do not move. Moving is worse."], "attack": ["I have a new powder and nothing large enough to try it on. Until now.", "This will be quick. I have a furnace cooling."], "defend": ["You are trampling six months of work. I am going to be very precise about this.", "Oh, good. Volunteers."], "win": ["It worked. Note the mixture; double it next time.", "Remarkable. They lasted longer than the test dummies."], "lose": ["The fuse was damp. It will not be damp twice.", "Wrong proportions. Mine, not yours. Do not look so pleased."], "eliminated": ["Do not open the red jars. No, I will not tell you why.", "My apprentices have the drawings. You have won a building."], "battle": ["Light it and stand well back. Further. Further.", "Engines forward. And count your fingers afterwards."], "ageup": ["At last. Do you know how long I have had this drawn?", "A breakthrough. Clear the bench."], "wonder": ["Finished, and nothing exploded. A good day.", "There. Now nobody may say it could not be built."], "truce": ["Yes, fine. I have had no quiet to think in months.", "Peace. Good. Close the door on your way out."], "refuse": ["No. I am in the middle of something, and it is you.", "I ran the figures. They say no."], "demand": ["I need saltpetre and I need it now. You have some.", "Call it a contribution to learning. Mine."], "betray": ["You lied? How tedious. Now I must redo all my reckoning.", "I shall name the next engine after you. It also fails."], "ally": ["Good. You bring the ore, I bring the brains.", "Allies. Do try not to stand in front of anything."], "rivalry": ["Only two left. A clean trial at last.", "You were useful. I mean that as high praise."], "p_start": ["Clay, ore, running water. Yes. This will serve.", "Workshop first. We can sleep in it."], "p_win": ["It performed as built. I am nearly pleased.", "Good. Collect the pieces; I want to see what broke."], "p_loss": ["Something failed, and I will have it on my bench by dawn.", "A bad result. We learn, we rebuild, we add more powder."], "p_alert": ["They are in the workshops! Not the kilns, not the kilns!", "Intruders! Somebody light something!"], "p_ageup": ["New tools. Burn the old drawings.", "Now we can build it properly."]} },
    lines: {
      intro: ['Lu Wen. First Artificer. Yes, yes, a pleasure. Do not touch anything.', 'Ah, neighbours. I had calculated you would arrive later. No matter.'],
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
      ally: ["Agreed. Our combined output will be remarkable.", "An alliance. I have drawn up a schedule. You are on it."],
      rivalry: ["The variables have reduced to two. You and I. Regrettable, but clear.", "Our partnership has served its purpose. I shall dismantle it carefully."],
      p_start: ['Right. Let us see what can be made of this place.', 'An untouched site. Excellent. Begin measuring.'],
      p_win: ['As designed. Note what worked.', 'Efficient. I am almost pleased.'],
      p_loss: ['Unacceptable. I want to know exactly what failed.', 'We will rebuild it. Better, this time.'],
      p_alert: ['They are attacking the works! Mind the furnaces!', 'Intruders. Somebody do something practical about it.'],
      p_ageup: ['At last, proper tools.', 'Progress. Throw out the old drawings.'],
    },
  },
  dawn: {
    civ: 'dawn', female: false, name: 'Eliab the Seer', title: 'Judge of the Tribes', icon: '🧔🏽‍♂️',
    voice: 'Male, ageless. Calm, soft, certain. Speaks of the future in the past tense.',
    alt: { name: "Marta the Seer", title: "Judge of the Tribes", icon: '🧕🏽', female: true, voice: "Female, ageless. Warm, grave, motherly; a judge who already knows the verdict and is sorry about it. Speaks of the future in the past tense.", lines: {"intro": ["I am Marta. I have seen this meeting. You were taller in the vision.", "Sit. I judged your case before you were born. I would still like to hear you plead it."], "attack": ["The verdict was given long ago. Today I only carry it out.", "I wept for you last night. This morning I sharpened the spears."], "defend": ["You have walked into a judgment, child, not a battle.", "I dreamed your campfires. I counted them going out, one by one."], "win": ["It is finished, as I was shown. Bury them gently.", "Do not hate yourself. The scales were set before you came."], "lose": ["The vision showed me a door. I did not see that it was shut.", "So I am to be humbled. Good. A seer should be, now and then."], "eliminated": ["My tribes scatter like seed. Seed is patient.", "I saw this ending. I walked to it anyway. That is what faith is."], "battle": ["Stand, my children. I have seen your faces at sundown, and they were smiling.", "Pray first. Then strike once, and strike true."], "ageup": ["A new morning. I told you it would come.", "The old age closes like a scroll. Open the next."], "wonder": ["Stone enough to hold a promise. Let the dawn come and live in it.", "Our daughters' daughters will pray here. I have heard them."], "truce": ["Peace, then. I saw it in the water this morning.", "Let the spears rest. Even judges are glad to adjourn."], "refuse": ["No. I have seen what that bargain costs, and who pays it.", "The answer was written before you asked. It is no."], "demand": ["A tithe is owed. Pay it and sleep soundly.", "I have weighed what you have. A fair share, and the matter is closed."], "betray": ["You swore before me. I do not forget an oath, and neither does heaven.", "I saw your knife in the vision. I hoped it was for someone else."], "ally": ["Our tents will stand together. I have seen the smoke of one fire.", "Come under our roof. Your quarrel is my case now."], "rivalry": ["Two judges cannot sit on one bench. I am sorry, old friend.", "We walked the road together. The vision shows only one of us arriving."], "p_start": ["Here. This is the hill I was shown. Unpack.", "We have arrived where we were always going. Begin."], "p_win": ["Judgment is given. Give thanks, and tend the wounded.", "It fell as I foresaw. Be merciful in it."], "p_loss": ["We grieve tonight. I have seen the morning after, and we are in it.", "A hard ruling. It is not the final one."], "p_alert": ["They are at the tents! Gather the little ones, and stand!", "The hour I warned of. To your posts, without fear."], "p_ageup": ["A new day for the tribes. Walk into it.", "The age turns, and we are still here. As promised."]} },
    lines: {
      intro: ['I am Eliab. I have seen this meeting. You were taller in the vision.', 'The dawn showed me your face long ago. It did not show me how this ends for you.'],
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
      ally: ["I have seen our banners side by side. Let it be so.", "Walk in the light with us. We go together now."],
      rivalry: ["The vision ends with one sun in the sky. I am sorry it must be decided.", "We were a fair dawn together. But the day has only one noon."],
      p_start: ['The dawn brought us here. Let us learn why.', 'I have seen what we become. Come, it starts now.'],
      p_win: ['It unfolded as I saw it.', 'The light was with us. Give thanks.'],
      p_loss: ['This, too, was in the vision. It is not the last page.', 'A dark hour. They do not last. I have checked.'],
      p_alert: ['Shadows at the threshold. Stand firm, the sun is rising.', 'They come, as foretold. We are ready, as foretold.'],
      p_ageup: ['A new light rises on our people.', 'The age turns. We turn with it.'],
    },
  },
  wild: {
    civ: 'wild', female: false, name: 'Jarl Hroth Wolf-Father', title: 'Jarl of the Northern Fjords', icon: '🧔‍♂️',
    voice: 'Male, forties. Low, rough, close to a growl. Few words, long pauses. Laughs rarely and suddenly.',
    alt: { name: "Jarl Sigrun Wolf-Mother", title: "Jarl of the Northern Fjords", icon: '👩‍🦰', female: true, voice: "Female, forties. Low, rough, close to a growl. Few words, long pauses. Laughs rarely and suddenly.", lines: {"intro": ["Sigrun. The wolves know me. They will know you, soon.", "My cubs are hungry. You look well fed."], "attack": ["Winter is long. Your barns are full. You see how it is.", "I told my cubs there was meat this way."], "defend": ["You came between a she-wolf and her den. Fool.", "I know every tree here. You know none."], "win": ["The cubs eat tonight.", "Go. Tell the others what lives in these woods."], "lose": ["I bleed. I have bled before. It closes.", "Good bite. I will remember your scent."], "eliminated": ["My cubs are scattered. They will grow. They will find you.", "The snow covers everything. Even this."], "battle": ["Teeth out. Stay close to me.", "Howl. Let them hear how many we are."], "ageup": ["Sharper iron. Good.", "The cubs are grown. Now they hunt."], "wonder": ["Ha! The gods can see that from their hall.", "A den that will never fall. Come inside."], "truce": ["Peace. Until the thaw.", "Well. We will not eat you this winter."], "refuse": ["No.", "A wolf does not lie down with the flock."], "demand": ["Feed the pack. Or be the feeding.", "Leave meat at the edge of the wood. Every moon."], "betray": ["You turned on the pack. Nothing is worse.", "I will follow your trail to the end of it."], "ally": ["Then you run with us. Keep up.", "Your enemies have my teeth in them now."], "rivalry": ["Two mothers. One den. Come.", "I liked hunting with you. I will hunt you well."], "p_start": ["Here. Water, wood, deer. Make the den.", "Good country. Mark it as ours."], "p_win": ["Ha! Well hunted. Eat.", "Theirs is ours. Bring the cubs."], "p_loss": ["We lick the wounds. Then we go again.", "Some will not come home. Howl for them."], "p_alert": ["They are in the den! To me!", "Strangers at the door. Tear them."], "p_ageup": ["Stronger now. Good.", "New iron for old teeth."]} },
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
      ally: ["One pack, then. Your kill is our kill.", "Run beside us. We do not ask twice."],
      rivalry: ["The prey is gone. Only two wolves left, and one hill.", "You hunted well with us. Now we circle. No hatred in it."],
      p_start: ['Good country. Much game. We stay.', 'Mark the borders. Let the others smell it.'],
      p_win: ['A clean kill.', 'The pack feeds tonight.'],
      p_loss: ['We bled. We are not dead. Remember the difference.', 'Lick the wounds. Then we hunt them.'],
      p_alert: ['Something in the den. Kill it.', 'They hunt us? Here? Show them their mistake.'],
      p_ageup: ['We grow. Good. Stay hungry anyway.', 'New claws. Use them.'],
    },
  },
  egypt: {
    civ: 'egypt', female: false, name: "Pharaoh Khenemet", title: "Lord of the Two Lands", icon: '👑',
    voice: "Male, fifties. Measured, resonant, utterly assured. Speaks as if everything he says will be carved somewhere.",
    alt: { name: "Pharaoh Merit-Neith", title: "Lady of the Two Lands", icon: '👸🏾', female: true, voice: "Female, fifties. Measured, resonant, utterly assured. Speaks as if everything she says will be carved somewhere.", lines: {"intro": ["I am Merit-Neith. The river rose for my fathers and it rises for me. What do you bring to it?", "You may look upon me. Briefly."], "attack": ["The gods weighed your heart this morning. It was heavy. I come to collect.", "I have a wall waiting for the story of your defeat."], "defend": ["You raise your hand against the daughter of the sun. Look up, and reconsider.", "The desert has swallowed greater armies than yours. I have their names."], "win": ["It shall be carved, and painted, and remembered for ever.", "The gods are pleased. Bring the scribes."], "lose": ["It will not be carved. Therefore it did not happen.", "The sun sets. It has done so before, and risen."], "eliminated": ["I go into the west. My name stays, and names are everything.", "Seal the tomb well. I shall be needing all of it."], "battle": ["Go forth. Your names are already in the stone.", "Chariots. Let them hear the wheels first."], "ageup": ["The river has risen higher than in my mother's day.", "A new dynasty of thought. Record it."], "wonder": ["Now the gods have somewhere fitting to visit.", "It will stand when the stars have moved. I have asked."], "truce": ["Let there be peace. I shall have it written in two tongues.", "The river is wide enough for both our boats. For now."], "refuse": ["The daughter of the sun does not haggle.", "No. Withdraw, and walk backwards as you do."], "demand": ["Bring gold and cedar to the river. It is customary.", "An offering is fitting. See that it is generous."], "betray": ["You swore before my gods. They do not forget, and they are many.", "Your name will be chiselled out of every wall."], "ally": ["Our two crowns, side by side. Have it painted.", "You may stand in my shadow. It is a large one."], "rivalry": ["There is one sun. I am sorry; it was always so.", "We ruled well together. The wall has room for one face."], "p_start": ["Here the river bends kindly. Build.", "Mark out the temple first. The rest will follow."], "p_win": ["The gods smiled. Give them their share.", "It is ours. Let it be written so."], "p_loss": ["A lean year. Open the granaries, and the temples.", "We mourn seventy days. Then we build."], "p_alert": ["They defile the fields! Rise, all of you!", "The enemy is on the sacred ground. Remove them."], "p_ageup": ["The river rises on a new age.", "We are greater than our mothers. As is proper."]} },
    lines: {
      intro: ["I am Khenemet. The river rose for my fathers and it rises for me. What do you bring to it?", "A stranger. Come no nearer than the shade; we will speak from there."],
      attack: ["The river does not hurry, and it drowns whole towns. I have come as the river comes.", "You have lived well on my border. That is over."],
      defend: ["You march on walls that were old when your people were herdsmen.", "Come, then. The sand has room for you."],
      win: ["It is recorded. You will be the small figures at the bottom of the wall.", "Go home. Tell them what the Two Lands are."],
      lose: ["A bad year. The river gives those too.", "You have won a field. I have a kingdom of them."],
      eliminated: ["The stones will still say my name. Who will say yours?", "So it ends. Seal the door behind me and do it properly."],
      battle: ["Chariots forward. Let them hear the wheels.", "Hold the line as the stones hold. Then break them."],
      ageup: ["A new age. Have the masons begin.", "We have learned a thing. Write it down so that it is never lost."],
      wonder: ["Look at it. It will stand when this whole quarrel is forgotten.", "That is what a people can do when they pull together on one rope."],
      truce: ["Peace. Let it be cut in stone, both copies.", "Agreed. The harvest wants every hand in any case."],
      refuse: ["No. You have nothing I lack.", "I do not bargain with those I am about to outlast."],
      demand: ["A tenth of your grain, as tribute. It is a small price for my patience.", "Send gifts. It is the custom, and I am fond of custom."],
      betray: ["You swore it and broke it. Your name will be chiselled out wherever it stands.", "Oathbreaker. Even your own dead are ashamed."],
      ally: ["Then our houses stand together. It shall be written in both tongues.", "An alliance. I will have your likeness set beside mine. Slightly smaller."],
      rivalry: ["Two crowns remain and there is one throne. You understand.", "We were good neighbours. Now we must find out which of us history keeps."],
      p_start: ["Here. Mark the fields before the river marks them for us.", "Good black earth. We begin as we always have: with the planting."],
      p_win: ["It is done. Record it accurately.", "A victory. See that the fallen are buried as they deserve."],
      p_loss: ["We are thrown back. The river also falls, and returns.", "Gather the survivors. Count them by name, not by number."],
      p_alert: ["They are inside the fields. To arms, all of you.", "The kingdom is struck. Every man to the wall."],
      p_ageup: ["A new age of the kingdom. Let the builders rejoice.", "We rise. Carefully, as one builds: level by level."],
    },
  },
  babylon: {
    civ: 'babylon', female: false, name: "King Nabu-Shar", title: "King of Babylon, Keeper of the Law", icon: '🧔🏽',
    voice: "Male, sixties. Dry, exact, legal. Reads every sentence as though it were a clause; rarely amused, never hurried.",
    alt: { name: "Queen Ninsuna", title: "Queen of Babylon, Keeper of the Law", icon: '👩🏽', female: true, voice: "Female, sixties. Dry, exact, legal. Reads every sentence as though it were a clause; rarely amused, never hurried.", lines: {"intro": ["Ninsuna, queen. State your name, your people and your business, in that order.", "You are entered in the register as 'stranger'. That can be amended, either way."], "attack": ["The claim was heard, judged and sealed. I am here to enforce it.", "You are in arrears. I have brought the collectors."], "defend": ["Trespass, armed, by night. The tablet is quite clear on the penalty.", "You are out of order. Guards, restore it."], "win": ["Judgment for the crown. Enter it, and the costs.", "The matter is closed. File it."], "lose": ["The verdict went against me. I shall appeal.", "Noted. Let the record show it was close."], "eliminated": ["Then let it be written that the law outlived the queen.", "Preserve the tablets. Whoever rules here will need them."], "battle": ["By the authority of the court: proceed.", "Each man knows his clause. Carry it out."], "ageup": ["The code is revised. See that every gate has the new copy.", "A new chapter. Number the tablets from one."], "wonder": ["Let the law be seen from every road into the city.", "Completed, as contracted, and on the day named."], "truce": ["Agreed, sealed and witnessed. Do keep your copy.", "A sensible settlement. I prefer them to verdicts."], "refuse": ["Denied. Reasons will be given in writing.", "The terms are void on their face."], "demand": ["A levy is assessed. The sum is on the tablet.", "Pay what is owed. Interest runs from today."], "betray": ["Breach of oath. The tablet lists what follows; it is a long tablet.", "You put your seal to it. I have it here."], "ally": ["Bound by contract, then. I have never broken one.", "Allies of record. Witnessed and filed."], "rivalry": ["Two crowns, one court. Let it be tried.", "Our contract has run its term. I shall not renew."], "p_start": ["Survey it, stake it, and write down who owns what.", "A city begins with a boundary stone. Set it."], "p_win": ["The case is won. Divide the spoils by the schedule.", "Entered as a victory. Proceed to the next item."], "p_loss": ["A loss, duly recorded. Compensate the widows.", "We are diminished. Amend the rolls, and recruit."], "p_alert": ["The city is entered unlawfully. Every citizen to arms.", "Sound the gate drums. This is not a drill of the court."], "p_ageup": ["The law is rewritten for a larger city.", "A new age. Recount the granaries."]} },
    lines: {
      intro: ["Nabu-Shar, king. State your name, your people and your business, in that order.", "You are new. The law here is written at the gate. Read it before you speak."],
      attack: ["You were given notice. This is the consequence set down for it.", "By the forty-first article I am entitled to your city. I have come to collect."],
      defend: ["You bring an army to a city with seven walls. Did no one advise you?", "The gate is shut. That is what gates are for."],
      win: ["Judgment for Babylon. There is no appeal.", "It went as the figures said it would. It generally does."],
      lose: ["An error in my reckoning. I shall find it.", "Noted. The account between us is now open."],
      eliminated: ["Then let it be written that the law outlived the king.", "You have taken the city. You will find you cannot take what was learned in it."],
      battle: ["Sappers to the wall. Everyone else, as drilled.", "By the numbers. Begin."],
      ageup: ["A new age. Amend the tablets accordingly.", "The astronomers said this year. They are seldom wrong."],
      wonder: ["Finished to the cubit. Let anyone measure it who doubts.", "A wonder. And under budget, which is the greater one."],
      truce: ["Agreed. Two copies, sealed, one for each archive.", "A truce. The terms are clear and I expect them kept to the letter."],
      refuse: ["Refused. Your terms are loosely drafted and so are you.", "No. I do not sign what I cannot enforce."],
      demand: ["You owe tribute. I have the sum here; it is not negotiable.", "A levy, payable at once. Interest runs from today."],
      betray: ["You set your seal to it and broke it. Under our law that is the worst of crimes.", "A broken oath. I shall see that every court from here to the sea hears of it."],
      ally: ["An alliance, then. I have drafted it fairly; you may check.", "Your enemies are entered in my ledger as mine. So it stands."],
      rivalry: ["The treaty lapses by its own terms: only two parties remain. I regret the necessity.", "We kept faith to the end of the clause. Now the matter is between us."],
      p_start: ["Survey the ground. We build nothing that has not been measured first.", "Set down the first stone and the first law together."],
      p_win: ["The verdict is ours. Enter it.", "Won, and by the plan. See that the men are paid what was promised."],
      p_loss: ["We have lost this hearing. There will be another.", "A reverse. Find out why, exactly why, and bring it to me."],
      p_alert: ["The city is breached. Every man to his post, as the roll assigns.", "Alarm. This is what the walls were paid for; man them."],
      p_ageup: ["A new age. Let the scribes begin the new tablets.", "We advance. Keep the old records; we shall want them."],
    },
  },
  persia: {
    civ: 'persia', female: true, name: "Shahbanu Roshanak", title: "Queen of Kings", icon: '👸🏽',
    voice: "Female, forties. Gracious, warm, expansive; a perfect host. The threat is always in what she offers, never in her tone.",
    alt: { name: "Shah Ardashir", title: "King of Kings", icon: '🤴🏽', female: false, voice: "Male, forties. Gracious, warm, expansive; a perfect host. The threat is always in what he offers, never in his tone.", lines: {"intro": ["I am Ardashir. Sit, be welcome. Half the world already eats at my table; there is room for you.", "You look tired from the road. Rest; we can discuss whose road it is tomorrow."], "attack": ["You declined my gifts. So I have come to deliver them myself, with ten thousand bearers.", "Forgive the intrusion. I shall be staying."], "defend": ["Uninvited guests! How delightful. We shall have to find somewhere to put you all.", "You have come to my garden in armour. That is poor manners."], "win": ["Splendid. Do stay; you will find me a generous master.", "You fought well. I shall see that you are comfortable."], "lose": ["Bravo. Truly. I shall return with a larger party.", "Ah, you have spoiled my afternoon. I do admire the nerve."], "eliminated": ["The feast is over. I hope, at least, that you enjoyed it.", "Empty the cellars before they do. A host has standards."], "battle": ["My Immortals, if you would be so kind.", "Go, and be magnificent. I shall be watching from the shade."], "ageup": ["New wonders for the court! Send for the poets.", "The empire grows more beautiful. So it should."], "wonder": ["A small thing. Only the greatest in the world.", "Come and see it, all of you. Bring your envy."], "truce": ["Peace! Wonderful. Dine with me.", "Friends, then. I always thought we should be."], "refuse": ["My dear friend. No.", "I could not possibly. You must ask me for something else."], "demand": ["A little gift between friends. I shall say how little.", "It is the custom to bring something when one visits a king. You are late."], "betray": ["You ate my salt, and then this. I am wounded. You will be more so.", "How disappointing. I had such a pleasant end in mind for you."], "ally": ["Then my table is yours, and my armies with it.", "Wonderful! We shall be the envy of everyone left."], "rivalry": ["It has been a marvellous feast. Alas, there is one last cup.", "Dear friend. Only one of us can sit at the head of the table."], "p_start": ["Charming. Plant a garden; I mean to stay.", "Water, shade and a view. Begin with the palace."], "p_win": ["Exquisite. Wine for the whole army.", "They have gone. Do tidy the lawns."], "p_loss": ["A sad day. Let them be mourned as princes.", "We have been robbed. We shall be gracious, and then we shall be terrible."], "p_alert": ["Intruders among the roses! Guards, at once!", "They have come without an invitation. See them out."], "p_ageup": ["A richer age. Dress the court for it.", "Splendour upon splendour. Carry on."]} },
    lines: {
      intro: ["I am Roshanak. Sit, be welcome. Half the world already eats at my table; there is room for you.", "A new guest! Bring them water and shade, and then tell me who they are."],
      attack: ["I asked so politely. Now I must come in person, and I do not travel light.", "My armies are so many that I have never seen them all. You are about to."],
      defend: ["You come as an enemy to the house that would have fed you? How sad.", "Do come in. The elephants have been restless."],
      win: ["There. Now we may talk as friends. I am so much easier to like in victory.", "Rise. I have no wish to humble you further; I have what I came for."],
      lose: ["Well fought. I do admire it. I shall send more next time.", "You have cost me a province. I have a great many."],
      eliminated: ["So the garden falls. Do water it; it was three hundred years in the growing.", "I leave you an empire. Be kinder to it than you were to me."],
      battle: ["Immortals, forward. Let them count us if they can.", "Loose the beasts, and follow them in."],
      ageup: ["A new age. Let every province have a share in it.", "We grow wiser. Send word along the royal road."],
      wonder: ["Is it not beautiful? Ten peoples built it, and each thinks it theirs.", "A wonder of the world. Come and see it; I insist."],
      truce: ["Peace! I am so glad. Stay for the feast.", "A truce, with gifts on both sides. That is how it should be done."],
      refuse: ["No, my dear. You ask for too much and offer too little.", "I think not. But do ask again when you have less to lose."],
      demand: ["A small tribute, and you keep your crown. I am being very generous.", "Earth and water, and a little gold. Then we are friends."],
      betray: ["You ate my bread and then drew a knife. No one will open a door to you again.", "Treachery, at my own table. I shall remember, and I have a long memory and a long road."],
      ally: ["Then you are of my house. Your enemies will find that out.", "Allies. I shall send you an elephant; one should always send an elephant."],
      rivalry: ["All the other guests have gone home. It is only you and I, and one seat at the head.", "You were a good friend to me. I wish the world were wide enough for two of us."],
      p_start: ["A fair country. Plant a garden first; the rest follows.", "Here we stay. Let every people who join us keep their own customs."],
      p_win: ["A victory. Be gracious in it, all of you.", "They are beaten. Feed their wounded as you would our own."],
      p_loss: ["We are beaten today. Send to the provinces; there are always more.", "A loss. I do not care for it. See that it is not repeated."],
      p_alert: ["The enemy is in the gardens. Guards!", "We are attacked at home. Call up everyone."],
      p_ageup: ["A new age for all my peoples. Proclaim it.", "We advance. I should like the roads improved to match."],
    },
  },
  greece: {
    civ: 'greece', female: false, name: "Strategos Kallias", title: "General of the League", icon: '🧔🏻',
    voice: "Male, forties. Quick, argumentative, fond of his own wit. Cannot resist making a point even while losing.",
    alt: { name: "Archon Xanthe", title: "First Citizen of the League", icon: '👩🏻', female: true, voice: "Female, forties. Quick, argumentative, fond of her own wit. Cannot resist making a point even while losing.", lines: {"intro": ["Xanthe, elected to lead. Elected, mark you. And who chose you?", "Before you say anything: yes, I have heard that argument, and no, it does not hold."], "attack": ["The assembly voted for war. I spoke against it. I lost, so here I am.", "Consider this a rebuttal."], "defend": ["You attack a free city? We do so love a just cause.", "Wrong in principle and worse in practice. Allow me to demonstrate."], "win": ["I rest my case.", "A persuasive victory, if I say so myself. And I do."], "lose": ["Well argued. I shall need a better speech, and more spears.", "I am defeated, not refuted. There is a difference."], "eliminated": ["They will read about us. Nobody will read about you.", "The city falls. The idea, I am afraid, you cannot burn."], "battle": ["Citizens! You voted for this. Now go and win it.", "Shields locked, and no speeches until afterwards."], "ageup": ["A new idea, and for once everybody agreed on it.", "Progress! It took four votes and a riot."], "wonder": ["There. Let the philosophers argue about that for a thousand years.", "Paid for by the people, built by the people. I merely take the credit."], "truce": ["Peace, by a clear majority. I am astonished.", "Agreed. Now we can go back to arguing with each other."], "refuse": ["I put it to the vote. They laughed.", "No. And I have three reasons, if you have the afternoon."], "demand": ["The league requires a contribution. It was voted, so it is fair.", "Call it dues. Everyone pays; you are merely next."], "betray": ["A broken oath! The playwrights will be delighted.", "Treachery is an argument, I grant. A poor one."], "ally": ["An alliance of equals. I shall of course do the talking.", "Welcome to the league. The meetings are long."], "rivalry": ["Two cities, one league. I move that it be mine.", "We must settle it, friend. Debate has failed, which is rare."], "p_start": ["A fine site. Now, who is in charge? Besides me.", "Agora first. We shall need somewhere to disagree."], "p_win": ["Carried, unanimously, at spear point.", "Victory. Somebody write a poem; a short one."], "p_loss": ["We lost. Now we shall spend a month blaming each other.", "A defeat. I shall give the funeral speech; it will be good."], "p_alert": ["They are in the city! Stop talking and arm!", "Enemy at the gates. The debate is adjourned."], "p_ageup": ["We have thought of something new. Again.", "A wiser age. Marginally."]} },
    lines: {
      intro: ["Kallias, elected general. Elected, mark you. And who chose you?", "Ah, a stranger. Good. We had run out of people to argue with."],
      attack: ["We debated this for three days. The vote was for war. Narrowly.", "I come with ten thousand free men. That is a different thing from ten thousand soldiers."],
      defend: ["You attack a city where every man owns his own spear? Bold.", "Come up the pass, then. It is quite narrow."],
      win: ["And that settles the argument. For today.", "You fought as you were told to. We fought because we chose to. There is your answer."],
      lose: ["A fair point, forcefully made. I concede it.", "Beaten. The assembly will have my head, or at least a long speech about it."],
      eliminated: ["Then the city falls. The ideas will not; they travel.", "You have conquered us. Wait until we start teaching your children."],
      battle: ["Shields together. Nobody is a hero today; we are a wall.", "Forward at the walk. Sing if you know the words."],
      ageup: ["A new age. I told them so; nobody listens until it happens.", "Progress! Which some of us voted against, I remind you."],
      wonder: ["Is it not well proportioned? We argued about the columns for a year.", "A wonder. Paid for by public subscription, and only slightly embezzled."],
      truce: ["Peace. The assembly approves, by a show of hands.", "A truce. Good. I have a harvest and a lawsuit to see to."],
      refuse: ["No. And I can give you nine reasons, in order.", "The motion fails. So do you."],
      demand: ["A contribution to the common defence. You will find the sum reasonable.", "Tribute. We prefer to call it membership of the league."],
      betray: ["You swore by all that is sacred and then did this. Even our comedians will not find it funny.", "An oathbreaker. We have a word for that, and a rock to throw you from."],
      ally: ["An alliance of free peoples. I shall try to keep the speeches short.", "Then we stand together. Shield to shield, as it should be."],
      rivalry: ["Only two of us left. A league of two is merely a quarrel waiting.", "We were good allies. Let us settle the last question honourably."],
      p_start: ["Lay out the marketplace first. A city is where men talk.", "Here. Good harbour, good hills. We could argue about it, but let us build."],
      p_win: ["Victory. I told you it would work. Some of you owe me an apology.", "We won. Put up a modest monument. No, more modest than that."],
      p_loss: ["We lost. I shall explain why at length. Later.", "Beaten today. Free men recover from that faster than you would think."],
      p_alert: ["They are at the walls. Every citizen, your spear, now.", "The city is attacked. This is the part we cannot vote on."],
      p_ageup: ["A new age of the city. Let us use it better than the last.", "We advance. Someone write it all down this time."],
    },
  },
  england: {
    civ: 'england', female: false, name: "Earl Godric of Wessex", title: "Earl and Marshal of the Realm", icon: '🧔🏼',
    voice: "Male, fifties. Dry, understated, unhurried. Describes catastrophes as inconveniences and victories as \"not bad\".",
    alt: { name: "Countess Edith of Wessex", title: "Countess and Marshal of the Realm", icon: '👩🏼', female: true, voice: "Female, fifties. Dry, understated, unhurried. Describes catastrophes as inconveniences and victories as \"not bad\".", lines: {"intro": ["Edith. Countess of this and that. You will forgive me if I do not get up; the weather.", "One does hope you are not going to be tiresome."], "attack": ["I am so sorry about this. Do try not to take it personally.", "We have come about the border. And the rest of it."], "defend": ["You are standing in my roses. I shall give you a moment to step back.", "An invasion. On a Tuesday. Really."], "win": ["Not bad. One could almost call it a victory.", "That went rather well. Somebody see to their wounded."], "lose": ["Well. That was disagreeable.", "A reverse. I shall mention it to nobody."], "eliminated": ["How vexing. I had just had the hall repainted.", "We shall be back. We are dreadfully stubborn."], "battle": ["Archers, when you are ready. No hurry; they are coming to us.", "Do carry on. And aim, please."], "ageup": ["Progress, I suppose. I rather liked the old way.", "Something new. We shall get used to it in a century or two."], "wonder": ["A trifle large. Still, the neighbours will talk.", "It will do. In fact it will do very nicely."], "truce": ["Peace. Good. I can get back to the garden.", "Agreed. We shall be perfectly civil about it."], "refuse": ["I am afraid not.", "Out of the question. But thank you for asking so nicely."], "demand": ["There is the small matter of what you owe us.", "A modest sum. Promptly, if you would."], "betray": ["That was not cricket. Whatever cricket turns out to be.", "I see. One shall not be writing to you again."], "ally": ["Friends, then. We do not make many.", "An understanding. We shall muddle through together."], "rivalry": ["I fear there is only room for one of us. Frightfully sorry.", "It has been pleasant. It is about to be less so."], "p_start": ["Damp. Green. It will do splendidly.", "Put the kettle on, and then the palisade."], "p_win": ["Rather a good day, all things considered.", "They have gone. Well done, everybody."], "p_loss": ["A poor day. We do not speak of poor days.", "We have lost good people. Chins up; they would insist."], "p_alert": ["There are armed men in the village. How very rude.", "To the walls, please. Quickly, but do not run."], "p_ageup": ["We have improved. Let us not make a fuss about it.", "A new age. Mind you wipe your boots."]} },
    lines: {
      intro: ["Godric. Earl of this and that. You will forgive me if I do not get up; the weather.", "New neighbours. Well. I suppose we had better be civil about it."],
      attack: ["I am afraid it has come to blows. I did write.", "We have come over to settle the matter. It should not take long."],
      defend: ["You have picked a wet week to invade. I should have waited.", "Do mind the archers. They have had nothing to do all winter."],
      win: ["That went rather well. Not that one likes to say so.", "Off you go, then. No hard feelings, I hope."],
      lose: ["A setback. We have had worse, generally on the same day of the week.", "Well. That was not our best. We shall look into it."],
      eliminated: ["It seems we are finished. Somebody see to the dogs.", "So that is that. You will find the place damp, and the people stubborn."],
      battle: ["Archers to the front. Loose when you can count their teeth.", "Steady. Nobody runs; it looks dreadful."],
      ageup: ["A new age, they tell me. I shall believe it when the roads improve.", "Progress. I suppose we had better get on with it."],
      wonder: ["Quite a decent bit of building, if I say so myself.", "A wonder. The masons are insufferable about it already."],
      truce: ["Peace it is. I never cared for the other thing.", "A truce. Splendid. I shall get the harvest in after all."],
      refuse: ["I think not. Thank you all the same.", "No. One has to draw the line somewhere, and it is here."],
      demand: ["There is the small matter of what you owe. I should settle it, in your place.", "A levy. I dislike asking twice."],
      betray: ["You gave your word. Where I come from that still counts for something.", "Bad form. Very bad. We shall not forget it."],
      ally: ["Allies, then. I shall try to be worth having.", "Shoulder to shoulder. You will find we do not let people down."],
      rivalry: ["It seems there are only the two of us. Awkward.", "You have been a good friend. I am sorry it comes to this; I truly am."],
      p_start: ["This will do nicely. Hedge the fields and get the barley in.", "A fair bit of country. Let us not spoil it."],
      p_win: ["Carried the day. Well done, all of you. Quietly, now.", "A win. See that the men get something hot."],
      p_loss: ["We have had the worst of it. It happens. We shall be back.", "Lost. Nobody is to mope; there is work to do."],
      p_alert: ["They are in the village. Bows, everyone. Now, please.", "We are attacked. Bar the doors and string your bows."],
      p_ageup: ["A new age. Let us hope it is drier than the last.", "We move with the times. Reluctantly, but we move."],
    },
  },
  arabs: {
    civ: 'arabs', female: false, name: "Emir Rashid ibn Tariq", title: "Emir of the Caravan Cities", icon: '👳🏽‍♂️',
    voice: "Male, forties. Courteous, musical, patient: a merchant and a poet. Compliments you while he takes your measure.",
    alt: { name: "Emira Zaynab bint Tariq", title: "Emira of the Caravan Cities", icon: '🧕🏽', female: true, voice: "Female, forties. Courteous, musical, patient: a merchant and a poet. Compliments you while she takes your measure.", lines: {"intro": ["Peace upon you. I am Zaynab, daughter of Tariq. A guest has three days before I ask his business.", "Sit; the coffee is hot and the night is long. We shall know each other by morning."], "attack": ["I named a fair price for peace. You haggled too long.", "The caravan has arrived. Today it carries swords."], "defend": ["You come to rob the one who would have sold to you gladly. A poor bargain.", "My gates were open to you as a guest. They are shut to you as a thief."], "win": ["The account is settled. I bear you no grudge.", "God gives, and today He gave to me. Go in peace, what is left of you."], "lose": ["A loss. I have had worse seasons, and richer ones after.", "You bargained hard. I shall remember your price."], "eliminated": ["The wells will dry without me. You will learn what I was worth.", "Every caravan reaches its last inn. Mine was a fine road."], "battle": ["Ride, in God's name, and bring one another home.", "Swift and clean. I want the market open by evening."], "ageup": ["New learning from every road. Translate it all.", "The city is wiser tonight than it was this morning."], "wonder": ["A hundred years from now a poet will stand here, lost for words.", "Praise God, who lets small hands build great things."], "truce": ["Peace, and the roads open. Everyone grows rich.", "My hand on it. I have never sold a false measure."], "refuse": ["Forgive me. The price is too low, and so is the offer.", "No, my friend. Not for all your camels."], "demand": ["There is a toll on this road. I keep it, and I keep it fair.", "A small tribute keeps the wells sweet between us."], "betray": ["You broke bread and salt with me. No market on earth will take your word now.", "I trusted you on credit. I shall collect in full."], "ally": ["Then we are one caravan. What is mine guards what is yours.", "A partnership. May it profit us both, and for long."], "rivalry": ["We shared the road to its end. There is one well left.", "My friend, a market can have only one master."], "p_start": ["Water, and a road in each direction. Unload the camels.", "Here we raise a city. First the well, then the market."], "p_win": ["Praise God. Tend the wounded, theirs as well.", "The road is ours again. Open the gates."], "p_loss": ["A bitter cup. We drink it, and rise.", "We have lost much. Give to the widows before you count the rest."], "p_alert": ["Raiders in the market! To arms, to horse!", "They are inside the gates. Guard the wells!"], "p_ageup": ["A new age of learning. Fill the libraries.", "We have grown. Give thanks, and build."]} },
    lines: {
      intro: ["Peace upon you. I am Rashid, son of Tariq. A guest has three days before I ask his business.", "A stranger on the road. Come, there is coffee, and then we shall see what kind of man you are."],
      attack: ["I offered trade and you chose otherwise. I am sorry for it.", "The desert teaches patience. Mine is finished."],
      defend: ["You bring war to the well that watered you? That is a poor return.", "Come, then. You will find the sand fights on our side."],
      win: ["It is finished. Let no one mock the beaten; tomorrow it may be us.", "The matter is decided. Go home in safety. I ask only that you remember it."],
      lose: ["You have the better of me today. Fortune is a wheel.", "A loss. I have lost caravans before and still grown rich."],
      eliminated: ["So my road ends here. Deal justly with my people; they are good people.", "The wind covers every track in the end. Mine too."],
      battle: ["Riders, with me. Swift, and then swifter.", "Strike, wheel away, strike again. They cannot catch what they cannot reach."],
      ageup: ["A new age. Knowledge is the one treasure that grows when it is spent.", "The scholars have done well. See that they are paid like generals."],
      wonder: ["A wonder, raised by hands from a dozen lands. Is that not the better victory?", "They will come from the ends of the earth to see it. And to trade, I trust."],
      truce: ["Peace, then. It is the better bargain; it always was.", "A truce. Let the caravans run again."],
      refuse: ["Forgive me, no. The price is wrong.", "I must decline. A wise man does not sell his sword cheaply."],
      demand: ["A toll, for safe passage through my lands. It is customary.", "There is a debt between us. I should prefer it paid in gold and not otherwise."],
      betray: ["You broke bread with me and then broke faith. Among us there is no deeper shame.", "An oath is a man's whole name. You have thrown yours in the dust."],
      ally: ["Then we are brothers on this road. My well is your well.", "An alliance. May it profit us both, and may we deserve it."],
      rivalry: ["Only we two remain, my friend, and one cannot share a crown as one shares a meal.", "You kept faith with me. I honour it, even now that we must be rivals."],
      p_start: ["Water, shade and a crossroads. A city needs nothing else. We stop here.", "Dig the well first. Everything follows the water."],
      p_win: ["A victory. Give thanks, and see to the wounded on both sides.", "We prevailed. Let no one grow proud on it."],
      p_loss: ["We are beaten. Gather the riders; the road is long and this is one day of it.", "A hard loss. Patience. Patience is half of wisdom."],
      p_alert: ["Raiders at the gates. To horse!", "The city is attacked. Every man who can ride or stand, to arms."],
      p_ageup: ["A new age opens. Let us be worthy of it.", "We advance. Build schools as well as walls."],
    },
  },
  japan: {
    civ: 'japan', female: false, name: "Lord Akiyama Tadanobu", title: "Lord of the Eastern Provinces", icon: '🧑🏻',
    voice: "Male, fifties. Formal, quiet, very still. Short sentences with long silences; courtesy that never bends.",
    alt: { name: "Lady Akiyama Tomoko", title: "Lady of the Eastern Provinces", icon: '👩🏻‍🦱', female: true, voice: "Female, fifties. Formal, quiet, very still. Short sentences with long silences; courtesy that never bends.", lines: {"intro": ["I am Akiyama Tomoko. You stand on my border. State your purpose.", "You are far from your home. I suggest you remember the way back."], "attack": ["The blossoms have fallen. It is time.", "I regret this. I shall not hesitate."], "defend": ["You have entered my house with your sword drawn. You will not leave with it.", "This ground is my husband's grave. Step lightly."], "win": ["It is done. Wash the blades.", "You fought with honour. I shall say so."], "lose": ["I bow to the result. Not to you.", "The shame is mine. So is the remedy."], "eliminated": ["My house ends here. It ends standing.", "Burn the banners. Do not let them be taken."], "battle": ["Go. Do not look back at me.", "One breath. One stroke."], "ageup": ["The season turns. We turn with it.", "New ways. The old duty."], "wonder": ["It is finished. Sit, and look at it in silence.", "Built with patience. That is the whole of it."], "truce": ["Peace is accepted. My word is given.", "Let the swords sleep."], "refuse": ["I decline.", "It would dishonour us both."], "demand": ["Tribute is expected. I shall not ask again.", "You will send rice. It is a small courtesy."], "betray": ["You gave your word. Now you have none.", "There is no forgiveness for this. Only an ending."], "ally": ["Then my sword is yours. Do not waste it.", "We stand together. I shall not speak of it twice."], "rivalry": ["Two houses. One province. Forgive me.", "You were a worthy friend. Be a worthy enemy."], "p_start": ["This place. Clear the ground.", "We begin. Quietly, and well."], "p_win": ["Good. See to the fallen.", "The province is safe. Return to your work."], "p_loss": ["We have failed them. We shall not fail twice.", "Mourn tonight. Train at dawn."], "p_alert": ["The enemy is inside. Bar the gates.", "To arms. No one retreats."], "p_ageup": ["A new season for our house.", "We improve. That is all that is asked."]} },
    lines: {
      intro: ["I am Akiyama Tadanobu. You stand on my border. State your purpose.", "A visitor. You are received. Do not mistake courtesy for welcome."],
      attack: ["I have given this thought. I am here. There is nothing more to say.", "The blossom falls when it is time. It is time."],
      defend: ["You attack. Then you have chosen how this ends.", "My men have waited all their lives for this morning."],
      win: ["It is over. You fought. That will be remembered.", "Withdraw. I do not pursue the beaten."],
      lose: ["I have failed today. The fault is mine alone.", "A defeat. I accept it. I do not accept that it is final."],
      eliminated: ["My house ends. See that the swords are returned to the shrine.", "So. I have nothing to regret but the result."],
      battle: ["Draw. Advance. No one looks back.", "One breath. Then all together."],
      ageup: ["A new age. We will master it as we mastered the last.", "The craftsmen have done well. Tell them so; once is enough."],
      wonder: ["It is complete. Nothing could be added. Nothing taken away.", "A work of many lifetimes, finished in mine. I am humbled."],
      truce: ["Peace. My word is given. It is not given twice.", "A truce. I shall keep it exactly."],
      refuse: ["No.", "I decline. Do not ask again."],
      demand: ["You will send tribute. It is the proper order of things.", "A gift is expected. Its absence would be noticed."],
      betray: ["You gave your word and broke it. There is no lower thing.", "Dishonour. I will not speak your name again. Others will speak of what I did to you."],
      ally: ["We are allied. Your enemy is mine. I do not say such things lightly.", "Then it is settled. I shall stand where you need me."],
      rivalry: ["Two remain. It was always going to be so.", "You were a true ally. I shall meet you with respect, and without mercy."],
      p_start: ["This ground is good. Build carefully. Waste nothing.", "Here. First the paddies, then the walls."],
      p_win: ["A victory. Bow to the fallen, theirs and ours.", "It is done. Clean your blades."],
      p_loss: ["We are beaten. We will train until we are not.", "A loss. Remember how it felt. That is its use."],
      p_alert: ["The enemy is within the province. Every man, now.", "We are attacked. Hold. I am coming."],
      p_ageup: ["A new age. Let our discipline keep pace with it.", "We advance. The old ways still apply."],
    },
  },
};

// Words of rank that open a leader's name; their seal carries the letter of the name that follows.
const RANKS = new Set(['consul', 'augusta', 'khan', 'khatun', 'count', 'countess', 'lady', 'lord', 'master', 'jarl', 'pharaoh', 'king', 'queen', 'shah', 'shahbanu', 'strategos', 'archon', 'earl', 'emir', 'emira', 'sir', 'the', 'saint', 'prince', 'princess', 'duke', 'duchess', 'emperor', 'empress', 'chief', 'captain', 'general']);
/** The letter on a leader's seal, shown until they have a painted portrait. */
export function monogram(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const w = words.find((x) => !RANKS.has(x.toLowerCase())) ?? words[0] ?? '?';
  return [...w][0].toUpperCase();
}

/** The key a line is recorded under, e.g. `steppe_attack_2`. */
export const lineKey = (civ: string, event: LeaderEvent, index: number): string => `${civ}_${event}_${index + 1}`;

export interface Speech { civ: string; event: LeaderEvent; index: number }

/** Nations whose leader is played by the second persona (set from the recordings that are installed). */
const useAlt = new Set<string>();
export function setLeaderPersona(civ: string, alt: boolean): void {
  if (alt) useAlt.add(civ); else useAlt.delete(civ);
}
/**
 * A leader as rewritten by whoever voices them: their own name, title and wording of any line.
 * Whatever is left out stays as written. The leader keeps their nation and whether they are a man or a woman.
 */
export interface Character { name?: string; title?: string; temper?: Partial<Record<'war' | 'faith' | 'fort' | 'greed', number>>; lines?: Partial<Record<LeaderEvent, (string | null)[]>> }
export const CHARACTER_LIMITS = { name: 40, title: 60, line: 160 };
// Their words end up in the page, so anything that could be markup is dropped.
const clean = (s: unknown, max: number): string => (typeof s === 'string' ? s : '').replace(/[<>&"`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const custom = new Map<string, Character>();
/** Install (or with `null`, remove) the character someone has made of a nation's leader. */
export function setLeaderCharacter(civ: string, c: Character | null): void {
  const l = LEADERS[civ];
  if (!l) return;
  if (!c || typeof c !== 'object') { custom.delete(civ); return; }
  const out: Character = { name: clean(c.name, CHARACTER_LIMITS.name), title: clean(c.title, CHARACTER_LIMITS.title), lines: {} };
  for (const ev of LEADER_EVENTS) {
    const given = c.lines?.[ev];
    if (Array.isArray(given)) out.lines![ev] = l.lines[ev].map((_, i) => clean(given[i], CHARACTER_LIMITS.line) || null);
  }
  custom.set(civ, out);
}
/** The lines a persona speaks: the nation's lines, with their own versions of the ones that name them. */
export function personaLines(civ: string, alt: boolean): Record<LeaderEvent, string[]> {
  const l = LEADERS[civ];
  if (!alt || !l.alt) return l.lines;
  const out = { ...l.lines };
  for (const ev of LEADER_EVENTS) {
    const own = l.alt.lines[ev];
    if (own) out[ev] = l.lines[ev].map((line, i) => own[i] ?? line);
  }
  return out;
}
/** The leader of a nation as they appear in this game: the first persona unless the second has been chosen. */
export function leaderOf(civ: string): (Persona & { civ: string; lines: Record<LeaderEvent, string[]> }) | undefined {
  const l = LEADERS[civ];
  if (!l) return undefined;
  const alt = useAlt.has(civ) && !!l.alt;
  const { lines: _own, ...who } = alt ? l.alt! : l;
  const base = { ...who, civ, lines: personaLines(civ, alt) };
  const c = custom.get(civ);
  if (!c) return base;
  // The character someone made of this leader: their name, title and words, where they gave any.
  const lines = { ...base.lines };
  for (const ev of LEADER_EVENTS) if (c.lines?.[ev]) lines[ev] = base.lines[ev].map((line, i) => c.lines![ev]![i] || line);
  return { ...base, name: c.name || base.name, title: c.title || base.title, lines };
}
export const speechText = (s: Speech): string => leaderOf(s.civ)?.lines[s.event][s.index] ?? '';
