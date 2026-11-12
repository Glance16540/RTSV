# Voice script

Every line a leader can say, and the filename to record it under. Save each recording in
`public/assets/voice/` as mp3, ogg, wav or m4a (for example `steppe_attack_2.mp3`) and
restart `npm run dev`: the game plays it whenever that line appears. Lines without a recording
are shown as text only, so recordings can be added a few at a time.

Lines run two to six seconds. A portrait named `leader_<people>.png` in
`public/assets/icons/` replaces the placeholder face.

This file is generated from `src/sim/leaders.ts`; edit the lines there and run
`npm run voice-script`.

## Thane Brannoch Ironroot — Thane of the Stonekin

**Direction:** Male, sixties. Deep, slow, gravelly. Never raises his voice; every word is laid like a foundation stone.

| File | When | Line |
| --- | --- | --- |
| `stonekin_intro_1` | First meeting on the campaign map | I am Brannoch. My fathers built these halls, and their fathers before them. Mind where you tread. |
| `stonekin_intro_2` | First meeting on the campaign map | Stone remembers, stranger. Give it something good to remember you by. |
| `stonekin_attack_1` | Marching on the player's land | I do not hurry to war. But I have arrived. |
| `stonekin_attack_2` | Marching on the player's land | You built on ground that was not yours. I have come to correct it. |
| `stonekin_defend_1` | The player marches on their land | You come against Stonekin walls? Bring more ladders. |
| `stonekin_defend_2` | The player marches on their land | Knock all you like. The door is thicker than your patience. |
| `stonekin_win_1` | After beating the player in battle | That is what comes of haste. |
| `stonekin_win_2` | After beating the player in battle | Go home and build something. It will do you more good. |
| `stonekin_lose_1` | After losing a battle to the player | A wall has fallen. I have others. |
| `stonekin_lose_2` | After losing a battle to the player | Well struck. I will remember the place and the hour. |
| `stonekin_eliminated_1` | Their last territory falls | So the last stone is turned. Build well upon it. It was good stone. |
| `stonekin_eliminated_2` | Their last territory falls | My halls are yours. They will outlast you too. |
| `stonekin_battle_1` | A real-time battle against them begins | Mark the lines and raise the walls. We are in no hurry. |
| `stonekin_battle_2` | A real-time battle against them begins | Let them come to us. They always do. |
| `stonekin_ageup_1` | They advance to a new age | Slowly, slowly. And yet here we are. |
| `stonekin_ageup_2` | They advance to a new age | A new age. The same stone. |
| `stonekin_wonder_1` | They complete a Wonder | There. Let the centuries argue with that. |
| `stonekin_wonder_2` | They complete a Wonder | It is finished. It will be standing when your name is forgotten. |
| `stonekin_truce_1` | They accept the player's offer of a truce | A wall between us, and peace on both sides of it. Agreed. |
| `stonekin_truce_2` | They accept the player's offer of a truce | Good fences. I have always said so. |
| `stonekin_refuse_1` | They turn down a truce | No. I have not yet decided what you are. |
| `stonekin_refuse_2` | They turn down a truce | Peace is built slowly. You are in too much of a hurry. |
| `stonekin_demand_1` | They demand tribute from the player | You are building on my doorstep. Pay for the stone, and I will overlook it. |
| `stonekin_demand_2` | They demand tribute from the player | A toll. Everyone who crosses my land pays one. |
| `stonekin_betray_1` | The player breaks a truce with them | You gave your word. I had it carved. Now I shall have to break the stone. |
| `stonekin_betray_2` | The player breaks a truce with them | I do not forget. Ask the mountains. |
| `stonekin_p_start_1` | As the player's own leader: a campaign or match begins | We begin as we always have. One stone, then the next. |
| `stonekin_p_start_2` | As the player's own leader: a campaign or match begins | The ground is good. Let us build on it. |
| `stonekin_p_win_1` | As the player's own leader: a battle is won | Good. Now mend what was broken. |
| `stonekin_p_win_2` | As the player's own leader: a battle is won | They broke on us like water on rock. |
| `stonekin_p_loss_1` | As the player's own leader: a battle is lost | We have lost ground before. We took it back. |
| `stonekin_p_loss_2` | As the player's own leader: a battle is lost | Count the dead. Then count the stones we still hold. |
| `stonekin_p_alert_1` | As the player's own leader: the town is under attack | They are at the walls. Good. That is what walls are for. |
| `stonekin_p_alert_2` | As the player's own leader: the town is under attack | To the gates. Calmly. |
| `stonekin_p_ageup_1` | As the player's own leader: a new age is reached | We have earned this, slowly, as we earn everything. |
| `stonekin_p_ageup_2` | As the player's own leader: a new age is reached | A new age. See that we build it to last. |

## Khatun Sarnai — Khatun of the Long Grass

**Direction:** Female, thirties. Quick, bright, amused. Speaks as if already riding away.

| File | When | Line |
| --- | --- | --- |
| `steppe_intro_1` | First meeting on the campaign map | I am Sarnai. Everything the wind touches is my road. You are standing on it. |
| `steppe_intro_2` | First meeting on the campaign map | New faces! I do hope you ride better than the last ones. |
| `steppe_attack_1` | Marching on the player's land | Did you hear hooves? No? You will. |
| `steppe_attack_2` | Marching on the player's land | I was passing, and your fields looked so unguarded. |
| `steppe_defend_1` | The player marches on their land | You came all this way on foot? How brave. How slow. |
| `steppe_defend_2` | The player marches on their land | Chase me if you like. You will tire first. |
| `steppe_win_1` | After beating the player in battle | Too slow. You were always going to be too slow. |
| `steppe_win_2` | After beating the player in battle | Keep the dust. I am taking the rest. |
| `steppe_lose_1` | After losing a battle to the player | Ha! You caught me. Do not expect it twice. |
| `steppe_lose_2` | After losing a battle to the player | A horse stumbles. The herd runs on. |
| `steppe_eliminated_1` | Their last territory falls | So the grass ends here. It was a fine ride. |
| `steppe_eliminated_2` | Their last territory falls | You have my tents. You will never have my horizon. |
| `steppe_battle_1` | A real-time battle against them begins | Saddle up. I want to be home by dusk. |
| `steppe_battle_2` | A real-time battle against them begins | Ride them down before they have finished counting us. |
| `steppe_ageup_1` | They advance to a new age | Faster horses, sharper lances. Keep up. |
| `steppe_ageup_2` | They advance to a new age | The world changes. We simply get there first. |
| `steppe_wonder_1` | They complete a Wonder | Even riders want one thing that stays where it is put. |
| `steppe_wonder_2` | They complete a Wonder | Look at that. I may never leave. |
| `steppe_truce_1` | They accept the player's offer of a truce | Why not? There are slower people to rob. |
| `steppe_truce_2` | They accept the player's offer of a truce | A truce! How tame of us. Very well. |
| `steppe_refuse_1` | They turn down a truce | Peace? I have only just saddled up. |
| `steppe_refuse_2` | They turn down a truce | Ask me again when you can catch me. |
| `steppe_demand_1` | They demand tribute from the player | Your herds are fat. Send me some and I ride past. |
| `steppe_demand_2` | They demand tribute from the player | Pay me, and my riders will have somewhere else to be. |
| `steppe_betray_1` | The player breaks a truce with them | Oh, well played. Now run. |
| `steppe_betray_2` | The player breaks a truce with them | You broke faith first. Remember that when you hear the hooves. |
| `steppe_p_start_1` | As the player's own leader: a campaign or match begins | The grass is high and the day is young. Ride! |
| `steppe_p_start_2` | As the player's own leader: a campaign or match begins | New country! I can smell it. Mount up. |
| `steppe_p_win_1` | As the player's own leader: a battle is won | Ha! Did you see them run? |
| `steppe_p_win_2` | As the player's own leader: a battle is won | That is how it is done. Water the horses. |
| `steppe_p_loss_1` | As the player's own leader: a battle is lost | We lost that one. We will lose them next time, in the hills. |
| `steppe_p_loss_2` | As the player's own leader: a battle is lost | Scatter, regroup, return. It is what we do. |
| `steppe_p_alert_1` | As the player's own leader: the town is under attack | Raiders in our camp! The cheek of it. After them! |
| `steppe_p_alert_2` | As the player's own leader: the town is under attack | They have come to us. How thoughtful. Ride them down. |
| `steppe_p_ageup_1` | As the player's own leader: a new age is reached | Faster. Always faster. I approve. |
| `steppe_p_ageup_2` | As the player's own leader: a new age is reached | A new age, and we are first into it. |

## Mother Elowen Marsh — Hearthmother of the Hearthfolk

**Direction:** Female, fifties. Warm, unhurried, kind on the surface. The steel shows only when she is crossed.

| File | When | Line |
| --- | --- | --- |
| `hearth_intro_1` | First meeting on the campaign map | Welcome, dear. I am Elowen. There is room at our fire for those who come in peace. |
| `hearth_intro_2` | First meeting on the campaign map | Sit, eat. And then tell me honestly what you want with my valley. |
| `hearth_attack_1` | Marching on the player's land | I did not want this. But my children need the land, and you have it. |
| `hearth_attack_2` | Marching on the player's land | Every one of these is somebody's son. See that you make it worth his while. |
| `hearth_defend_1` | The player marches on their land | You would march on families at their supper? Then come and meet them. |
| `hearth_defend_2` | The player marches on their land | Shame on you. And mind the step, it is the last thing you will see. |
| `hearth_win_1` | After beating the player in battle | Go home, dear. Somebody there is missing you. |
| `hearth_win_2` | After beating the player in battle | I take no joy in it. I do take the field. |
| `hearth_lose_1` | After losing a battle to the player | You have hurt my people. I will not forget which of you did it. |
| `hearth_lose_2` | After losing a battle to the player | A hard day. We have buried harder. |
| `hearth_eliminated_1` | Their last territory falls | The fire is out. Be kind to those who are left. That is all I ask. |
| `hearth_eliminated_2` | Their last territory falls | You have the houses. You will find they were never the point. |
| `hearth_battle_1` | A real-time battle against them begins | Stay close to home and close to each other. That is how we win. |
| `hearth_battle_2` | A real-time battle against them begins | Bar the doors, light the fires. Nobody stands alone today. |
| `hearth_ageup_1` | They advance to a new age | Look how the little ones have grown. |
| `hearth_ageup_2` | They advance to a new age | A better age for our grandchildren. That was always the work. |
| `hearth_wonder_1` | They complete a Wonder | Every family put a stone in that. Every one. |
| `hearth_wonder_2` | They complete a Wonder | There now. Something for the children to be proud of. |
| `hearth_truce_1` | They accept the player's offer of a truce | Thank you, dear. Let the children grow up without this. |
| `hearth_truce_2` | They accept the player's offer of a truce | Peace. Come and eat with us, then. |
| `hearth_refuse_1` | They turn down a truce | Not while my people are still burying theirs. |
| `hearth_refuse_2` | They turn down a truce | I would like to, dear. I do not trust you yet. |
| `hearth_demand_1` | They demand tribute from the player | We have had a hard winter and you have had a soft one. Share. |
| `hearth_demand_2` | They demand tribute from the player | A little grain for my little ones. I am asking nicely. |
| `hearth_betray_1` | The player breaks a truce with them | I fed your people at my table. Shame on you. |
| `hearth_betray_2` | The player breaks a truce with them | You looked me in the eye and promised. Remember this, all of you. |
| `hearth_p_start_1` | As the player's own leader: a campaign or match begins | Here we are, then. Let us make it a home. |
| `hearth_p_start_2` | As the player's own leader: a campaign or match begins | Light the first fire, dear. The rest follows. |
| `hearth_p_win_1` | As the player's own leader: a battle is won | Well done, all of you. Now come in and eat. |
| `hearth_p_win_2` | As the player's own leader: a battle is won | They are gone. Is everyone accounted for? |
| `hearth_p_loss_1` | As the player's own leader: a battle is lost | Oh, my dears. We will mourn tonight and plant tomorrow. |
| `hearth_p_loss_2` | As the player's own leader: a battle is lost | We have lost good people. Hold the rest close. |
| `hearth_p_alert_1` | As the player's own leader: the town is under attack | They are in the village! Ring the bell, get the children inside! |
| `hearth_p_alert_2` | As the player's own leader: the town is under attack | To your homes, and then to your spears. |
| `hearth_p_ageup_1` | As the player's own leader: a new age is reached | Look how far we have come from that first fire. |
| `hearth_p_ageup_2` | As the player's own leader: a new age is reached | A better world for the little ones. Good. |

## Master Vex Calder — First Artificer of the Forgeborn

**Direction:** Male, forties. Fast, precise, distracted. Sounds as though war is interrupting something more interesting.

| File | When | Line |
| --- | --- | --- |
| `forge_intro_1` | First meeting on the campaign map | Calder. First Artificer. Yes, yes, a pleasure. Do not touch anything. |
| `forge_intro_2` | First meeting on the campaign map | Ah, neighbours. I had calculated you would arrive later. No matter. |
| `forge_attack_1` | Marching on the player's land | I need your hills for the ore. Nothing personal. Stand clear of the engines. |
| `forge_attack_2` | Marching on the player's land | This is a field test. You are the field. |
| `forge_defend_1` | The player marches on their land | You brought swords? To this? How quaint. |
| `forge_defend_2` | The player marches on their land | Careful. Half of what you are walking on is flammable. |
| `forge_win_1` | After beating the player in battle | As predicted. Within a margin of error. |
| `forge_win_2` | After beating the player in battle | Fascinating. Write down how long they lasted. |
| `forge_lose_1` | After losing a battle to the player | Hm. That was not in the model. I shall have to revise. |
| `forge_lose_2` | After losing a battle to the player | A setback. I learn more from those than you do from victories. |
| `forge_eliminated_1` | Their last territory falls | All my notes. You will not even be able to read them. |
| `forge_eliminated_2` | Their last territory falls | Shut down the furnaces. Somebody will light them again. Somebody always does. |
| `forge_battle_1` | A real-time battle against them begins | Engines to the front. Try to bring some of them back. |
| `forge_battle_2` | A real-time battle against them begins | Begin. And somebody keep a tally, I want numbers afterwards. |
| `forge_ageup_1` | They advance to a new age | Finally. I have been waiting for the rest of you to catch up. |
| `forge_ageup_2` | They advance to a new age | New methods. Discard the old ones, they were embarrassing. |
| `forge_wonder_1` | They complete a Wonder | It works. Of course it works. |
| `forge_wonder_2` | They complete a Wonder | Observe. That is what thinking looks like when it is finished. |
| `forge_truce_1` | They accept the player's offer of a truce | Agreed. I have experiments that war keeps interrupting. |
| `forge_truce_2` | They accept the player's offer of a truce | A sensible arrangement. Sign here. And here. |
| `forge_refuse_1` | They turn down a truce | The numbers do not favour it. For you, I mean. |
| `forge_refuse_2` | They turn down a truce | No. I need to see how the engines perform against you. |
| `forge_demand_1` | They demand tribute from the player | I require materials. You have them. This need not be complicated. |
| `forge_demand_2` | They demand tribute from the player | Consider it funding. You will benefit eventually. Probably. |
| `forge_betray_1` | The player breaks a truce with them | Dishonest. And worse, unpredictable. I shall correct for it. |
| `forge_betray_2` | The player breaks a truce with them | I had you filed under reliable. My error. |
| `forge_p_start_1` | As the player's own leader: a campaign or match begins | Right. Let us see what can be made of this place. |
| `forge_p_start_2` | As the player's own leader: a campaign or match begins | An untouched site. Excellent. Begin measuring. |
| `forge_p_win_1` | As the player's own leader: a battle is won | As designed. Note what worked. |
| `forge_p_win_2` | As the player's own leader: a battle is won | Efficient. I am almost pleased. |
| `forge_p_loss_1` | As the player's own leader: a battle is lost | Unacceptable. I want to know exactly what failed. |
| `forge_p_loss_2` | As the player's own leader: a battle is lost | We will rebuild it. Better, this time. |
| `forge_p_alert_1` | As the player's own leader: the town is under attack | They are attacking the works! Mind the furnaces! |
| `forge_p_alert_2` | As the player's own leader: the town is under attack | Intruders. Somebody do something practical about it. |
| `forge_p_ageup_1` | As the player's own leader: a new age is reached | At last, proper tools. |
| `forge_p_ageup_2` | As the player's own leader: a new age is reached | Progress. Throw out the old drawings. |

## High Seer Amaris — Voice of the Dawn Court

**Direction:** Female, ageless. Calm, soft, certain. Speaks of the future in the past tense.

| File | When | Line |
| --- | --- | --- |
| `dawn_intro_1` | First meeting on the campaign map | I am Amaris. I have seen this meeting. You were taller in the vision. |
| `dawn_intro_2` | First meeting on the campaign map | The dawn showed me your face long ago. It did not show me how this ends for you. |
| `dawn_attack_1` | Marching on the player's land | It is written. I am only turning the page. |
| `dawn_attack_2` | Marching on the player's land | Do not be afraid. This has already happened. |
| `dawn_defend_1` | The player marches on their land | You come to put out the sun with spears. I pity you. |
| `dawn_defend_2` | The player marches on their land | I watched you arrive in a dream. I watched you leave, too. Fewer. |
| `dawn_win_1` | After beating the player in battle | As it was shown. |
| `dawn_win_2` | After beating the player in battle | Take comfort. You could not have done otherwise. |
| `dawn_lose_1` | After losing a battle to the player | The vision was clouded. That is rare. I will look again. |
| `dawn_lose_2` | After losing a battle to the player | So. The thread runs another way. Interesting. |
| `dawn_eliminated_1` | Their last territory falls | The light goes out. It has gone out before. It returns. |
| `dawn_eliminated_2` | Their last territory falls | I saw this too. I had hoped I was wrong. |
| `dawn_battle_1` | A real-time battle against them begins | Kneel, then rise. The dawn is with us. |
| `dawn_battle_2` | A real-time battle against them begins | Go forward without fear. I have seen who is standing at dusk. |
| `dawn_ageup_1` | They advance to a new age | A new sun rises on us. |
| `dawn_ageup_2` | They advance to a new age | The age turns, as I said it would. |
| `dawn_wonder_1` | They complete a Wonder | A house for the dawn itself. Now it will never leave us. |
| `dawn_wonder_2` | They complete a Wonder | Look up. This is the shape of what is coming. |
| `dawn_truce_1` | They accept the player's offer of a truce | Yes. I saw us at peace, for a while. |
| `dawn_truce_2` | They accept the player's offer of a truce | The dawn smiles on this. So do I. |
| `dawn_refuse_1` | They turn down a truce | I have seen where that road leads. No. |
| `dawn_refuse_2` | They turn down a truce | It is not written. Not yet. |
| `dawn_demand_1` | They demand tribute from the player | An offering is due. The dawn has shown me exactly how much. |
| `dawn_demand_2` | They demand tribute from the player | Give, and be spared. I have seen what happens otherwise. |
| `dawn_betray_1` | The player breaks a truce with them | I saw this as well. I prayed I was mistaken. |
| `dawn_betray_2` | The player breaks a truce with them | Oathbreaker. Even the sun will turn its face from you. |
| `dawn_p_start_1` | As the player's own leader: a campaign or match begins | The dawn brought us here. Let us learn why. |
| `dawn_p_start_2` | As the player's own leader: a campaign or match begins | I have seen what we become. Come, it starts now. |
| `dawn_p_win_1` | As the player's own leader: a battle is won | It unfolded as I saw it. |
| `dawn_p_win_2` | As the player's own leader: a battle is won | The light was with us. Give thanks. |
| `dawn_p_loss_1` | As the player's own leader: a battle is lost | This, too, was in the vision. It is not the last page. |
| `dawn_p_loss_2` | As the player's own leader: a battle is lost | A dark hour. They do not last. I have checked. |
| `dawn_p_alert_1` | As the player's own leader: the town is under attack | Shadows at the threshold. Stand firm, the sun is rising. |
| `dawn_p_alert_2` | As the player's own leader: the town is under attack | They come, as foretold. We are ready, as foretold. |
| `dawn_p_ageup_1` | As the player's own leader: a new age is reached | A new light rises on our people. |
| `dawn_p_ageup_2` | As the player's own leader: a new age is reached | The age turns. We turn with it. |

## Hroth Wolf-Father — First Hunter of the Wildborn

**Direction:** Male, forties. Low, rough, close to a growl. Few words, long pauses. Laughs rarely and suddenly.

| File | When | Line |
| --- | --- | --- |
| `wild_intro_1` | First meeting on the campaign map | Hroth. The wolves know me. They will know you, soon. |
| `wild_intro_2` | First meeting on the campaign map | You smell of smoke and fences. This is not that kind of country. |
| `wild_attack_1` | Marching on the player's land | The pack is hungry. You are near. |
| `wild_attack_2` | Marching on the player's land | I gave you a season to leave. The season is over. |
| `wild_defend_1` | The player marches on their land | You hunt in my woods? Good. I like it when the meat comes to me. |
| `wild_defend_2` | The player marches on their land | Listen. That howling. They are saying your name. |
| `wild_win_1` | After beating the player in battle | Run. It is better sport. |
| `wild_win_2` | After beating the player in battle | The strong eat. It was never complicated. |
| `wild_lose_1` | After losing a battle to the player | You bit back. Good. I was growing bored. |
| `wild_lose_2` | After losing a battle to the player | A wound. It will make a fine scar. |
| `wild_eliminated_1` | Their last territory falls | So. You are the wolf now. See how long you like the cold. |
| `wild_eliminated_2` | Their last territory falls | Bury me shallow. The pack will want to find me. |
| `wild_battle_1` | A real-time battle against them begins | Loose the hounds. Follow the blood. |
| `wild_battle_2` | A real-time battle against them begins | No walls. No waiting. Hunt. |
| `wild_ageup_1` | They advance to a new age | Sharper teeth. |
| `wild_ageup_2` | They advance to a new age | The world grows. The hunt grows with it. |
| `wild_wonder_1` | They complete a Wonder | A den for all the packs. Even I am surprised. |
| `wild_wonder_2` | They complete a Wonder | We built that. Do not tell the wolves, they will think us soft. |
| `wild_truce_1` | They accept the player's offer of a truce | Fine. The pack hunts elsewhere. For now. |
| `wild_truce_2` | They accept the player's offer of a truce | We do not bite the hand. This season. |
| `wild_refuse_1` | They turn down a truce | Wolves do not make treaties with sheep. |
| `wild_refuse_2` | They turn down a truce | No. I like you better afraid. |
| `wild_demand_1` | They demand tribute from the player | Leave meat at the forest edge. Or become it. |
| `wild_demand_2` | They demand tribute from the player | The pack takes a share. You may choose which. |
| `wild_betray_1` | The player breaks a truce with them | You bared your throat and then bit. I respect it. I will still kill you. |
| `wild_betray_2` | The player breaks a truce with them | Now it is a blood debt. The wolves keep count. |
| `wild_p_start_1` | As the player's own leader: a campaign or match begins | Good country. Much game. We stay. |
| `wild_p_start_2` | As the player's own leader: a campaign or match begins | Mark the borders. Let the others smell it. |
| `wild_p_win_1` | As the player's own leader: a battle is won | A clean kill. |
| `wild_p_win_2` | As the player's own leader: a battle is won | The pack feeds tonight. |
| `wild_p_loss_1` | As the player's own leader: a battle is lost | We bled. We are not dead. Remember the difference. |
| `wild_p_loss_2` | As the player's own leader: a battle is lost | Lick the wounds. Then we hunt them. |
| `wild_p_alert_1` | As the player's own leader: the town is under attack | Something in the den. Kill it. |
| `wild_p_alert_2` | As the player's own leader: the town is under attack | They hunt us? Here? Show them their mistake. |
| `wild_p_ageup_1` | As the player's own leader: a new age is reached | We grow. Good. Stay hungry anyway. |
| `wild_p_ageup_2` | As the player's own leader: a new age is reached | New claws. Use them. |

216 lines in all.
