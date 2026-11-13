# Voice script

Every line a leader can say, and the filename to record it under. Save each recording in
`public/assets/voice/` as mp3, ogg, wav or m4a (for example `steppe_attack_2.mp3`) and
restart `npm run dev`: the game plays it whenever that line appears. Lines without a recording
are shown as text only, so recordings can be added a few at a time.

Lines run two to six seconds. A portrait named `leader_<people>.png` in
`public/assets/icons/` replaces the leader's seal.

This file is generated from `src/sim/leaders.ts`; edit the lines there and run
`npm run voice-script`.

## Romans: Consul Marcus Valerius Saxa — Consul of Rome

**Direction:** Male, sixties. Deep, slow, gravelly. Never raises his voice; every word is laid like a foundation stone.

**Or, as a woman: Augusta Livia Valeria Saxa — Augusta of Rome.** Female, fifties. Low, slow, patrician. Never raises her voice; every word is laid like a foundation stone. The same lines, except:

- `stonekin_intro_1`: I am Livia Valeria. My fathers built these walls, and their fathers before them. Mind where you tread.

Put a file named `persona_stonekin.txt` containing `alt` beside the recordings to have Augusta Livia Valeria Saxa lead in the game.

| File | When | Line |
| --- | --- | --- |
| `stonekin_intro_1` | First meeting on the campaign map | I am Marcus Valerius. My fathers built these walls, and their fathers before them. Mind where you tread. |
| `stonekin_intro_2` | First meeting on the campaign map | Stone remembers, stranger. Give it something good to remember you by. |
| `stonekin_attack_1` | Marching on the player's land | I do not hurry to war. But I have arrived. |
| `stonekin_attack_2` | Marching on the player's land | You built on ground that was not yours. I have come to correct it. |
| `stonekin_defend_1` | The player marches on their land | You come against Roman walls? Bring more ladders. |
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
| `stonekin_ally_1` | They accept an alliance with the player | Then we build one wall, you and I, and stand on it together. |
| `stonekin_ally_2` | They accept an alliance with the player | My hall is your hall. My shield is in front of you. |
| `stonekin_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | We built well together. But a hall has one high seat. |
| `stonekin_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | No quarrel, friend. Only the last stone, and one of us must lay it. |
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

## Mongols: Khatun Sarnai — Khatun of the Long Grass

**Direction:** Female, thirties. Quick, bright, amused. Speaks as if already riding away.

**Or, as a man: Khan Temur — Khan of the Long Grass.** Male, thirties. Quick, bright, amused. Speaks as if already riding away. The same lines, except:

- `steppe_intro_1`: I am Temur. Everything the wind touches is my road. You are standing on it.

Put a file named `persona_steppe.txt` containing `alt` beside the recordings to have Khan Temur lead in the game.

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
| `steppe_ally_1` | They accept an alliance with the player | Ride with us, then! Try to keep up. |
| `steppe_ally_2` | They accept an alliance with the player | Two herds, one thunder. I like it. |
| `steppe_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | Nobody left to chase but you. Pity. Good hunting, friend. |
| `steppe_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | We rode well together. Now let us see who rides faster. |
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

## Franks: Lady Aldegund of the Marches — Lady of the Franks

**Direction:** Female, fifties. Warm, unhurried, kind on the surface. The steel shows only when she is crossed.

**Or, as a man: Count Odo of the Marches — Count of the Franks.** Male, sixties. Warm, unhurried, grandfatherly on the surface. The steel shows only when he is crossed. The same lines, except:

- `hearth_intro_1`: Welcome, friend. I am Odo. There is room at our fire for those who come in peace.
- `hearth_ally_1`: Then you are family, and we look after family.
- `hearth_ally_2`: Pull up a chair, friend. Your enemies are ours now.

Put a file named `persona_hearth.txt` containing `alt` beside the recordings to have Count Odo of the Marches lead in the game.

| File | When | Line |
| --- | --- | --- |
| `hearth_intro_1` | First meeting on the campaign map | Welcome, dear. I am Aldegund. There is room at our fire for those who come in peace. |
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
| `hearth_ally_1` | They accept an alliance with the player | Then you are family, and we look after family. |
| `hearth_ally_2` | They accept an alliance with the player | Pull up a chair, dear. Your enemies are ours now. |
| `hearth_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | Oh, my dear. There is only one table left, and we cannot both sit at the head. |
| `hearth_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | I had hoped it would not come to us. Go gently, and so will I. |
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

## Chinese: Master Lu Wen — First Artificer of the Imperial Workshops

**Direction:** Male, forties. Fast, precise, distracted. Sounds as though war is interrupting something more interesting.

**Or, as a woman: Lady Shen Yue — First Artificer of the Imperial Workshops.** Female, forties. Fast, precise, distracted. Sounds as though war is interrupting something more interesting. The same lines, except:

- `forge_intro_1`: Shen Yue. First Artificer. Yes, yes, a pleasure. Do not touch anything.

Put a file named `persona_forge.txt` containing `alt` beside the recordings to have Lady Shen Yue lead in the game.

| File | When | Line |
| --- | --- | --- |
| `forge_intro_1` | First meeting on the campaign map | Lu Wen. First Artificer. Yes, yes, a pleasure. Do not touch anything. |
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
| `forge_ally_1` | They accept an alliance with the player | Agreed. Our combined output will be remarkable. |
| `forge_ally_2` | They accept an alliance with the player | An alliance. I have drawn up a schedule. You are on it. |
| `forge_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | The variables have reduced to two. You and I. Regrettable, but clear. |
| `forge_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | Our partnership has served its purpose. I shall dismantle it carefully. |
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

## Arameans: Eliab the Seer — Judge of the Tribes

**Direction:** Male, ageless. Calm, soft, certain. Speaks of the future in the past tense.

**Or, as a woman: Marta the Seer — Judge of the Tribes.** Female, ageless. Warm, grave, motherly; a judge who already knows the verdict and is sorry about it. Speaks of the future in the past tense. The same lines, except:

- `dawn_intro_1`: I am Marta. I have seen this meeting. You were taller in the vision.
- `dawn_intro_2`: Sit. I judged your case before you were born. I would still like to hear you plead it.
- `dawn_attack_1`: The verdict was given long ago. Today I only carry it out.
- `dawn_attack_2`: I wept for you last night. This morning I sharpened the spears.
- `dawn_defend_1`: You have walked into a judgment, child, not a battle.
- `dawn_defend_2`: I dreamed your campfires. I counted them going out, one by one.
- `dawn_win_1`: It is finished, as I was shown. Bury them gently.
- `dawn_win_2`: Do not hate yourself. The scales were set before you came.
- `dawn_lose_1`: The vision showed me a door. I did not see that it was shut.
- `dawn_lose_2`: So I am to be humbled. Good. A seer should be, now and then.
- `dawn_eliminated_1`: My tribes scatter like seed. Seed is patient.
- `dawn_eliminated_2`: I saw this ending. I walked to it anyway. That is what faith is.
- `dawn_battle_1`: Stand, my children. I have seen your faces at sundown, and they were smiling.
- `dawn_battle_2`: Pray first. Then strike once, and strike true.
- `dawn_ageup_1`: A new morning. I told you it would come.
- `dawn_ageup_2`: The old age closes like a scroll. Open the next.
- `dawn_wonder_1`: Stone enough to hold a promise. Let the dawn come and live in it.
- `dawn_wonder_2`: Our daughters' daughters will pray here. I have heard them.
- `dawn_truce_1`: Peace, then. I saw it in the water this morning.
- `dawn_truce_2`: Let the spears rest. Even judges are glad to adjourn.
- `dawn_refuse_1`: No. I have seen what that bargain costs, and who pays it.
- `dawn_refuse_2`: The answer was written before you asked. It is no.
- `dawn_demand_1`: A tithe is owed. Pay it and sleep soundly.
- `dawn_demand_2`: I have weighed what you have. A fair share, and the matter is closed.
- `dawn_betray_1`: You swore before me. I do not forget an oath, and neither does heaven.
- `dawn_betray_2`: I saw your knife in the vision. I hoped it was for someone else.
- `dawn_ally_1`: Our tents will stand together. I have seen the smoke of one fire.
- `dawn_ally_2`: Come under our roof. Your quarrel is my case now.
- `dawn_rivalry_1`: Two judges cannot sit on one bench. I am sorry, old friend.
- `dawn_rivalry_2`: We walked the road together. The vision shows only one of us arriving.
- `dawn_p_start_1`: Here. This is the hill I was shown. Unpack.
- `dawn_p_start_2`: We have arrived where we were always going. Begin.
- `dawn_p_win_1`: Judgment is given. Give thanks, and tend the wounded.
- `dawn_p_win_2`: It fell as I foresaw. Be merciful in it.
- `dawn_p_loss_1`: We grieve tonight. I have seen the morning after, and we are in it.
- `dawn_p_loss_2`: A hard ruling. It is not the final one.
- `dawn_p_alert_1`: They are at the tents! Gather the little ones, and stand!
- `dawn_p_alert_2`: The hour I warned of. To your posts, without fear.
- `dawn_p_ageup_1`: A new day for the tribes. Walk into it.
- `dawn_p_ageup_2`: The age turns, and we are still here. As promised.

Put a file named `persona_dawn.txt` containing `alt` beside the recordings to have Marta the Seer lead in the game.

| File | When | Line |
| --- | --- | --- |
| `dawn_intro_1` | First meeting on the campaign map | I am Eliab. I have seen this meeting. You were taller in the vision. |
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
| `dawn_ally_1` | They accept an alliance with the player | I have seen our banners side by side. Let it be so. |
| `dawn_ally_2` | They accept an alliance with the player | Walk in the light with us. We go together now. |
| `dawn_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | The vision ends with one sun in the sky. I am sorry it must be decided. |
| `dawn_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | We were a fair dawn together. But the day has only one noon. |
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

## Norse: Jarl Hroth Wolf-Father — Jarl of the Northern Fjords

**Direction:** Male, forties. Low, rough, close to a growl. Few words, long pauses. Laughs rarely and suddenly.

**Or, as a woman: Jarl Sigrun Wolf-Mother — Jarl of the Northern Fjords.** Female, forties. Low, rough, close to a growl. Few words, long pauses. Laughs rarely and suddenly. The same lines, except:

- `wild_intro_1`: Sigrun. The wolves know me. They will know you, soon.

Put a file named `persona_wild.txt` containing `alt` beside the recordings to have Jarl Sigrun Wolf-Mother lead in the game.

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
| `wild_ally_1` | They accept an alliance with the player | One pack, then. Your kill is our kill. |
| `wild_ally_2` | They accept an alliance with the player | Run beside us. We do not ask twice. |
| `wild_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | The prey is gone. Only two wolves left, and one hill. |
| `wild_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | You hunted well with us. Now we circle. No hatred in it. |
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

## Egyptians: Pharaoh Khenemet — Lord of the Two Lands

**Direction:** Male, fifties. Measured, resonant, utterly assured. Speaks as if everything he says will be carved somewhere.

**Or, as a woman: Pharaoh Merit-Neith — Lady of the Two Lands.** Female, fifties. Measured, resonant, utterly assured. Speaks as if everything she says will be carved somewhere. The same lines, except:

- `egypt_intro_1`: I am Merit-Neith. The river rose for my fathers and it rises for me. What do you bring to it?

Put a file named `persona_egypt.txt` containing `alt` beside the recordings to have Pharaoh Merit-Neith lead in the game.

| File | When | Line |
| --- | --- | --- |
| `egypt_intro_1` | First meeting on the campaign map | I am Khenemet. The river rose for my fathers and it rises for me. What do you bring to it? |
| `egypt_intro_2` | First meeting on the campaign map | A stranger. Come no nearer than the shade; we will speak from there. |
| `egypt_attack_1` | Marching on the player's land | The river does not hurry, and it drowns whole towns. I have come as the river comes. |
| `egypt_attack_2` | Marching on the player's land | You have lived well on my border. That is over. |
| `egypt_defend_1` | The player marches on their land | You march on walls that were old when your people were herdsmen. |
| `egypt_defend_2` | The player marches on their land | Come, then. The sand has room for you. |
| `egypt_win_1` | After beating the player in battle | It is recorded. You will be the small figures at the bottom of the wall. |
| `egypt_win_2` | After beating the player in battle | Go home. Tell them what the Two Lands are. |
| `egypt_lose_1` | After losing a battle to the player | A bad year. The river gives those too. |
| `egypt_lose_2` | After losing a battle to the player | You have won a field. I have a kingdom of them. |
| `egypt_eliminated_1` | Their last territory falls | The stones will still say my name. Who will say yours? |
| `egypt_eliminated_2` | Their last territory falls | So it ends. Seal the door behind me and do it properly. |
| `egypt_battle_1` | A real-time battle against them begins | Chariots forward. Let them hear the wheels. |
| `egypt_battle_2` | A real-time battle against them begins | Hold the line as the stones hold. Then break them. |
| `egypt_ageup_1` | They advance to a new age | A new age. Have the masons begin. |
| `egypt_ageup_2` | They advance to a new age | We have learned a thing. Write it down so that it is never lost. |
| `egypt_wonder_1` | They complete a Wonder | Look at it. It will stand when this whole quarrel is forgotten. |
| `egypt_wonder_2` | They complete a Wonder | That is what a people can do when they pull together on one rope. |
| `egypt_truce_1` | They accept the player's offer of a truce | Peace. Let it be cut in stone, both copies. |
| `egypt_truce_2` | They accept the player's offer of a truce | Agreed. The harvest wants every hand in any case. |
| `egypt_refuse_1` | They turn down a truce | No. You have nothing I lack. |
| `egypt_refuse_2` | They turn down a truce | I do not bargain with those I am about to outlast. |
| `egypt_demand_1` | They demand tribute from the player | A tenth of your grain, as tribute. It is a small price for my patience. |
| `egypt_demand_2` | They demand tribute from the player | Send gifts. It is the custom, and I am fond of custom. |
| `egypt_betray_1` | The player breaks a truce with them | You swore it and broke it. Your name will be chiselled out wherever it stands. |
| `egypt_betray_2` | The player breaks a truce with them | Oathbreaker. Even your own dead are ashamed. |
| `egypt_ally_1` | They accept an alliance with the player | Then our houses stand together. It shall be written in both tongues. |
| `egypt_ally_2` | They accept an alliance with the player | An alliance. I will have your likeness set beside mine. Slightly smaller. |
| `egypt_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | Two crowns remain and there is one throne. You understand. |
| `egypt_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | We were good neighbours. Now we must find out which of us history keeps. |
| `egypt_p_start_1` | As the player's own leader: a campaign or match begins | Here. Mark the fields before the river marks them for us. |
| `egypt_p_start_2` | As the player's own leader: a campaign or match begins | Good black earth. We begin as we always have: with the planting. |
| `egypt_p_win_1` | As the player's own leader: a battle is won | It is done. Record it accurately. |
| `egypt_p_win_2` | As the player's own leader: a battle is won | A victory. See that the fallen are buried as they deserve. |
| `egypt_p_loss_1` | As the player's own leader: a battle is lost | We are thrown back. The river also falls, and returns. |
| `egypt_p_loss_2` | As the player's own leader: a battle is lost | Gather the survivors. Count them by name, not by number. |
| `egypt_p_alert_1` | As the player's own leader: the town is under attack | They are inside the fields. To arms, all of you. |
| `egypt_p_alert_2` | As the player's own leader: the town is under attack | The kingdom is struck. Every man to the wall. |
| `egypt_p_ageup_1` | As the player's own leader: a new age is reached | A new age of the kingdom. Let the builders rejoice. |
| `egypt_p_ageup_2` | As the player's own leader: a new age is reached | We rise. Carefully, as one builds: level by level. |

## Babylonians: King Nabu-Shar — King of Babylon, Keeper of the Law

**Direction:** Male, sixties. Dry, exact, legal. Reads every sentence as though it were a clause; rarely amused, never hurried.

**Or, as a woman: Queen Ninsuna — Queen of Babylon, Keeper of the Law.** Female, sixties. Dry, exact, legal. Reads every sentence as though it were a clause; rarely amused, never hurried. The same lines, except:

- `babylon_intro_1`: Ninsuna, queen. State your name, your people and your business, in that order.
- `babylon_eliminated_1`: Then let it be written that the law outlived the queen.

Put a file named `persona_babylon.txt` containing `alt` beside the recordings to have Queen Ninsuna lead in the game.

| File | When | Line |
| --- | --- | --- |
| `babylon_intro_1` | First meeting on the campaign map | Nabu-Shar, king. State your name, your people and your business, in that order. |
| `babylon_intro_2` | First meeting on the campaign map | You are new. The law here is written at the gate. Read it before you speak. |
| `babylon_attack_1` | Marching on the player's land | You were given notice. This is the consequence set down for it. |
| `babylon_attack_2` | Marching on the player's land | By the forty-first article I am entitled to your city. I have come to collect. |
| `babylon_defend_1` | The player marches on their land | You bring an army to a city with seven walls. Did no one advise you? |
| `babylon_defend_2` | The player marches on their land | The gate is shut. That is what gates are for. |
| `babylon_win_1` | After beating the player in battle | Judgment for Babylon. There is no appeal. |
| `babylon_win_2` | After beating the player in battle | It went as the figures said it would. It generally does. |
| `babylon_lose_1` | After losing a battle to the player | An error in my reckoning. I shall find it. |
| `babylon_lose_2` | After losing a battle to the player | Noted. The account between us is now open. |
| `babylon_eliminated_1` | Their last territory falls | Then let it be written that the law outlived the king. |
| `babylon_eliminated_2` | Their last territory falls | You have taken the city. You will find you cannot take what was learned in it. |
| `babylon_battle_1` | A real-time battle against them begins | Sappers to the wall. Everyone else, as drilled. |
| `babylon_battle_2` | A real-time battle against them begins | By the numbers. Begin. |
| `babylon_ageup_1` | They advance to a new age | A new age. Amend the tablets accordingly. |
| `babylon_ageup_2` | They advance to a new age | The astronomers said this year. They are seldom wrong. |
| `babylon_wonder_1` | They complete a Wonder | Finished to the cubit. Let anyone measure it who doubts. |
| `babylon_wonder_2` | They complete a Wonder | A wonder. And under budget, which is the greater one. |
| `babylon_truce_1` | They accept the player's offer of a truce | Agreed. Two copies, sealed, one for each archive. |
| `babylon_truce_2` | They accept the player's offer of a truce | A truce. The terms are clear and I expect them kept to the letter. |
| `babylon_refuse_1` | They turn down a truce | Refused. Your terms are loosely drafted and so are you. |
| `babylon_refuse_2` | They turn down a truce | No. I do not sign what I cannot enforce. |
| `babylon_demand_1` | They demand tribute from the player | You owe tribute. I have the sum here; it is not negotiable. |
| `babylon_demand_2` | They demand tribute from the player | A levy, payable at once. Interest runs from today. |
| `babylon_betray_1` | The player breaks a truce with them | You set your seal to it and broke it. Under our law that is the worst of crimes. |
| `babylon_betray_2` | The player breaks a truce with them | A broken oath. I shall see that every court from here to the sea hears of it. |
| `babylon_ally_1` | They accept an alliance with the player | An alliance, then. I have drafted it fairly; you may check. |
| `babylon_ally_2` | They accept an alliance with the player | Your enemies are entered in my ledger as mine. So it stands. |
| `babylon_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | The treaty lapses by its own terms: only two parties remain. I regret the necessity. |
| `babylon_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | We kept faith to the end of the clause. Now the matter is between us. |
| `babylon_p_start_1` | As the player's own leader: a campaign or match begins | Survey the ground. We build nothing that has not been measured first. |
| `babylon_p_start_2` | As the player's own leader: a campaign or match begins | Set down the first stone and the first law together. |
| `babylon_p_win_1` | As the player's own leader: a battle is won | The verdict is ours. Enter it. |
| `babylon_p_win_2` | As the player's own leader: a battle is won | Won, and by the plan. See that the men are paid what was promised. |
| `babylon_p_loss_1` | As the player's own leader: a battle is lost | We have lost this hearing. There will be another. |
| `babylon_p_loss_2` | As the player's own leader: a battle is lost | A reverse. Find out why, exactly why, and bring it to me. |
| `babylon_p_alert_1` | As the player's own leader: the town is under attack | The city is breached. Every man to his post, as the roll assigns. |
| `babylon_p_alert_2` | As the player's own leader: the town is under attack | Alarm. This is what the walls were paid for; man them. |
| `babylon_p_ageup_1` | As the player's own leader: a new age is reached | A new age. Let the scribes begin the new tablets. |
| `babylon_p_ageup_2` | As the player's own leader: a new age is reached | We advance. Keep the old records; we shall want them. |

## Persians: Shahbanu Roshanak — Queen of Kings

**Direction:** Female, forties. Gracious, warm, expansive; a perfect host. The threat is always in what she offers, never in her tone.

**Or, as a man: Shah Ardashir — King of Kings.** Male, forties. Gracious, warm, expansive; a perfect host. The threat is always in what he offers, never in his tone. The same lines, except:

- `persia_intro_1`: I am Ardashir. Sit, be welcome. Half the world already eats at my table; there is room for you.

Put a file named `persona_persia.txt` containing `alt` beside the recordings to have Shah Ardashir lead in the game.

| File | When | Line |
| --- | --- | --- |
| `persia_intro_1` | First meeting on the campaign map | I am Roshanak. Sit, be welcome. Half the world already eats at my table; there is room for you. |
| `persia_intro_2` | First meeting on the campaign map | A new guest! Bring them water and shade, and then tell me who they are. |
| `persia_attack_1` | Marching on the player's land | I asked so politely. Now I must come in person, and I do not travel light. |
| `persia_attack_2` | Marching on the player's land | My armies are so many that I have never seen them all. You are about to. |
| `persia_defend_1` | The player marches on their land | You come as an enemy to the house that would have fed you? How sad. |
| `persia_defend_2` | The player marches on their land | Do come in. The elephants have been restless. |
| `persia_win_1` | After beating the player in battle | There. Now we may talk as friends. I am so much easier to like in victory. |
| `persia_win_2` | After beating the player in battle | Rise. I have no wish to humble you further; I have what I came for. |
| `persia_lose_1` | After losing a battle to the player | Well fought. I do admire it. I shall send more next time. |
| `persia_lose_2` | After losing a battle to the player | You have cost me a province. I have a great many. |
| `persia_eliminated_1` | Their last territory falls | So the garden falls. Do water it; it was three hundred years in the growing. |
| `persia_eliminated_2` | Their last territory falls | I leave you an empire. Be kinder to it than you were to me. |
| `persia_battle_1` | A real-time battle against them begins | Immortals, forward. Let them count us if they can. |
| `persia_battle_2` | A real-time battle against them begins | Loose the beasts, and follow them in. |
| `persia_ageup_1` | They advance to a new age | A new age. Let every province have a share in it. |
| `persia_ageup_2` | They advance to a new age | We grow wiser. Send word along the royal road. |
| `persia_wonder_1` | They complete a Wonder | Is it not beautiful? Ten peoples built it, and each thinks it theirs. |
| `persia_wonder_2` | They complete a Wonder | A wonder of the world. Come and see it; I insist. |
| `persia_truce_1` | They accept the player's offer of a truce | Peace! I am so glad. Stay for the feast. |
| `persia_truce_2` | They accept the player's offer of a truce | A truce, with gifts on both sides. That is how it should be done. |
| `persia_refuse_1` | They turn down a truce | No, my dear. You ask for too much and offer too little. |
| `persia_refuse_2` | They turn down a truce | I think not. But do ask again when you have less to lose. |
| `persia_demand_1` | They demand tribute from the player | A small tribute, and you keep your crown. I am being very generous. |
| `persia_demand_2` | They demand tribute from the player | Earth and water, and a little gold. Then we are friends. |
| `persia_betray_1` | The player breaks a truce with them | You ate my bread and then drew a knife. No one will open a door to you again. |
| `persia_betray_2` | The player breaks a truce with them | Treachery, at my own table. I shall remember, and I have a long memory and a long road. |
| `persia_ally_1` | They accept an alliance with the player | Then you are of my house. Your enemies will find that out. |
| `persia_ally_2` | They accept an alliance with the player | Allies. I shall send you an elephant; one should always send an elephant. |
| `persia_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | All the other guests have gone home. It is only you and I, and one seat at the head. |
| `persia_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | You were a good friend to me. I wish the world were wide enough for two of us. |
| `persia_p_start_1` | As the player's own leader: a campaign or match begins | A fair country. Plant a garden first; the rest follows. |
| `persia_p_start_2` | As the player's own leader: a campaign or match begins | Here we stay. Let every people who join us keep their own customs. |
| `persia_p_win_1` | As the player's own leader: a battle is won | A victory. Be gracious in it, all of you. |
| `persia_p_win_2` | As the player's own leader: a battle is won | They are beaten. Feed their wounded as you would our own. |
| `persia_p_loss_1` | As the player's own leader: a battle is lost | We are beaten today. Send to the provinces; there are always more. |
| `persia_p_loss_2` | As the player's own leader: a battle is lost | A loss. I do not care for it. See that it is not repeated. |
| `persia_p_alert_1` | As the player's own leader: the town is under attack | The enemy is in the gardens. Guards! |
| `persia_p_alert_2` | As the player's own leader: the town is under attack | We are attacked at home. Call up everyone. |
| `persia_p_ageup_1` | As the player's own leader: a new age is reached | A new age for all my peoples. Proclaim it. |
| `persia_p_ageup_2` | As the player's own leader: a new age is reached | We advance. I should like the roads improved to match. |

## Greeks: Strategos Kallias — General of the League

**Direction:** Male, forties. Quick, argumentative, fond of his own wit. Cannot resist making a point even while losing.

**Or, as a woman: Archon Xanthe — First Citizen of the League.** Female, forties. Quick, argumentative, fond of her own wit. Cannot resist making a point even while losing. The same lines, except:

- `greece_intro_1`: Xanthe, elected to lead. Elected, mark you. And who chose you?

Put a file named `persona_greece.txt` containing `alt` beside the recordings to have Archon Xanthe lead in the game.

| File | When | Line |
| --- | --- | --- |
| `greece_intro_1` | First meeting on the campaign map | Kallias, elected general. Elected, mark you. And who chose you? |
| `greece_intro_2` | First meeting on the campaign map | Ah, a stranger. Good. We had run out of people to argue with. |
| `greece_attack_1` | Marching on the player's land | We debated this for three days. The vote was for war. Narrowly. |
| `greece_attack_2` | Marching on the player's land | I come with ten thousand free men. That is a different thing from ten thousand soldiers. |
| `greece_defend_1` | The player marches on their land | You attack a city where every man owns his own spear? Bold. |
| `greece_defend_2` | The player marches on their land | Come up the pass, then. It is quite narrow. |
| `greece_win_1` | After beating the player in battle | And that settles the argument. For today. |
| `greece_win_2` | After beating the player in battle | You fought as you were told to. We fought because we chose to. There is your answer. |
| `greece_lose_1` | After losing a battle to the player | A fair point, forcefully made. I concede it. |
| `greece_lose_2` | After losing a battle to the player | Beaten. The assembly will have my head, or at least a long speech about it. |
| `greece_eliminated_1` | Their last territory falls | Then the city falls. The ideas will not; they travel. |
| `greece_eliminated_2` | Their last territory falls | You have conquered us. Wait until we start teaching your children. |
| `greece_battle_1` | A real-time battle against them begins | Shields together. Nobody is a hero today; we are a wall. |
| `greece_battle_2` | A real-time battle against them begins | Forward at the walk. Sing if you know the words. |
| `greece_ageup_1` | They advance to a new age | A new age. I told them so; nobody listens until it happens. |
| `greece_ageup_2` | They advance to a new age | Progress! Which some of us voted against, I remind you. |
| `greece_wonder_1` | They complete a Wonder | Is it not well proportioned? We argued about the columns for a year. |
| `greece_wonder_2` | They complete a Wonder | A wonder. Paid for by public subscription, and only slightly embezzled. |
| `greece_truce_1` | They accept the player's offer of a truce | Peace. The assembly approves, by a show of hands. |
| `greece_truce_2` | They accept the player's offer of a truce | A truce. Good. I have a harvest and a lawsuit to see to. |
| `greece_refuse_1` | They turn down a truce | No. And I can give you nine reasons, in order. |
| `greece_refuse_2` | They turn down a truce | The motion fails. So do you. |
| `greece_demand_1` | They demand tribute from the player | A contribution to the common defence. You will find the sum reasonable. |
| `greece_demand_2` | They demand tribute from the player | Tribute. We prefer to call it membership of the league. |
| `greece_betray_1` | The player breaks a truce with them | You swore by all that is sacred and then did this. Even our comedians will not find it funny. |
| `greece_betray_2` | The player breaks a truce with them | An oathbreaker. We have a word for that, and a rock to throw you from. |
| `greece_ally_1` | They accept an alliance with the player | An alliance of free peoples. I shall try to keep the speeches short. |
| `greece_ally_2` | They accept an alliance with the player | Then we stand together. Shield to shield, as it should be. |
| `greece_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | Only two of us left. A league of two is merely a quarrel waiting. |
| `greece_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | We were good allies. Let us settle the last question honourably. |
| `greece_p_start_1` | As the player's own leader: a campaign or match begins | Lay out the marketplace first. A city is where men talk. |
| `greece_p_start_2` | As the player's own leader: a campaign or match begins | Here. Good harbour, good hills. We could argue about it, but let us build. |
| `greece_p_win_1` | As the player's own leader: a battle is won | Victory. I told you it would work. Some of you owe me an apology. |
| `greece_p_win_2` | As the player's own leader: a battle is won | We won. Put up a modest monument. No, more modest than that. |
| `greece_p_loss_1` | As the player's own leader: a battle is lost | We lost. I shall explain why at length. Later. |
| `greece_p_loss_2` | As the player's own leader: a battle is lost | Beaten today. Free men recover from that faster than you would think. |
| `greece_p_alert_1` | As the player's own leader: the town is under attack | They are at the walls. Every citizen, your spear, now. |
| `greece_p_alert_2` | As the player's own leader: the town is under attack | The city is attacked. This is the part we cannot vote on. |
| `greece_p_ageup_1` | As the player's own leader: a new age is reached | A new age of the city. Let us use it better than the last. |
| `greece_p_ageup_2` | As the player's own leader: a new age is reached | We advance. Someone write it all down this time. |

## English: Earl Godric of Wessex — Earl and Marshal of the Realm

**Direction:** Male, fifties. Dry, understated, unhurried. Describes catastrophes as inconveniences and victories as "not bad".

**Or, as a woman: Countess Edith of Wessex — Countess and Marshal of the Realm.** Female, fifties. Dry, understated, unhurried. Describes catastrophes as inconveniences and victories as "not bad". The same lines, except:

- `england_intro_1`: Edith. Countess of this and that. You will forgive me if I do not get up; the weather.

Put a file named `persona_england.txt` containing `alt` beside the recordings to have Countess Edith of Wessex lead in the game.

| File | When | Line |
| --- | --- | --- |
| `england_intro_1` | First meeting on the campaign map | Godric. Earl of this and that. You will forgive me if I do not get up; the weather. |
| `england_intro_2` | First meeting on the campaign map | New neighbours. Well. I suppose we had better be civil about it. |
| `england_attack_1` | Marching on the player's land | I am afraid it has come to blows. I did write. |
| `england_attack_2` | Marching on the player's land | We have come over to settle the matter. It should not take long. |
| `england_defend_1` | The player marches on their land | You have picked a wet week to invade. I should have waited. |
| `england_defend_2` | The player marches on their land | Do mind the archers. They have had nothing to do all winter. |
| `england_win_1` | After beating the player in battle | That went rather well. Not that one likes to say so. |
| `england_win_2` | After beating the player in battle | Off you go, then. No hard feelings, I hope. |
| `england_lose_1` | After losing a battle to the player | A setback. We have had worse, generally on the same day of the week. |
| `england_lose_2` | After losing a battle to the player | Well. That was not our best. We shall look into it. |
| `england_eliminated_1` | Their last territory falls | It seems we are finished. Somebody see to the dogs. |
| `england_eliminated_2` | Their last territory falls | So that is that. You will find the place damp, and the people stubborn. |
| `england_battle_1` | A real-time battle against them begins | Archers to the front. Loose when you can count their teeth. |
| `england_battle_2` | A real-time battle against them begins | Steady. Nobody runs; it looks dreadful. |
| `england_ageup_1` | They advance to a new age | A new age, they tell me. I shall believe it when the roads improve. |
| `england_ageup_2` | They advance to a new age | Progress. I suppose we had better get on with it. |
| `england_wonder_1` | They complete a Wonder | Quite a decent bit of building, if I say so myself. |
| `england_wonder_2` | They complete a Wonder | A wonder. The masons are insufferable about it already. |
| `england_truce_1` | They accept the player's offer of a truce | Peace it is. I never cared for the other thing. |
| `england_truce_2` | They accept the player's offer of a truce | A truce. Splendid. I shall get the harvest in after all. |
| `england_refuse_1` | They turn down a truce | I think not. Thank you all the same. |
| `england_refuse_2` | They turn down a truce | No. One has to draw the line somewhere, and it is here. |
| `england_demand_1` | They demand tribute from the player | There is the small matter of what you owe. I should settle it, in your place. |
| `england_demand_2` | They demand tribute from the player | A levy. I dislike asking twice. |
| `england_betray_1` | The player breaks a truce with them | You gave your word. Where I come from that still counts for something. |
| `england_betray_2` | The player breaks a truce with them | Bad form. Very bad. We shall not forget it. |
| `england_ally_1` | They accept an alliance with the player | Allies, then. I shall try to be worth having. |
| `england_ally_2` | They accept an alliance with the player | Shoulder to shoulder. You will find we do not let people down. |
| `england_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | It seems there are only the two of us. Awkward. |
| `england_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | You have been a good friend. I am sorry it comes to this; I truly am. |
| `england_p_start_1` | As the player's own leader: a campaign or match begins | This will do nicely. Hedge the fields and get the barley in. |
| `england_p_start_2` | As the player's own leader: a campaign or match begins | A fair bit of country. Let us not spoil it. |
| `england_p_win_1` | As the player's own leader: a battle is won | Carried the day. Well done, all of you. Quietly, now. |
| `england_p_win_2` | As the player's own leader: a battle is won | A win. See that the men get something hot. |
| `england_p_loss_1` | As the player's own leader: a battle is lost | We have had the worst of it. It happens. We shall be back. |
| `england_p_loss_2` | As the player's own leader: a battle is lost | Lost. Nobody is to mope; there is work to do. |
| `england_p_alert_1` | As the player's own leader: the town is under attack | They are in the village. Bows, everyone. Now, please. |
| `england_p_alert_2` | As the player's own leader: the town is under attack | We are attacked. Bar the doors and string your bows. |
| `england_p_ageup_1` | As the player's own leader: a new age is reached | A new age. Let us hope it is drier than the last. |
| `england_p_ageup_2` | As the player's own leader: a new age is reached | We move with the times. Reluctantly, but we move. |

## Abbasids: Emir Rashid ibn Tariq — Emir of the Caravan Cities

**Direction:** Male, forties. Courteous, musical, patient: a merchant and a poet. Compliments you while he takes your measure.

**Or, as a woman: Emira Zaynab bint Tariq — Emira of the Caravan Cities.** Female, forties. Courteous, musical, patient: a merchant and a poet. Compliments you while she takes your measure. The same lines, except:

- `arabs_intro_1`: Peace upon you. I am Zaynab, daughter of Tariq. A guest has three days before I ask his business.

Put a file named `persona_arabs.txt` containing `alt` beside the recordings to have Emira Zaynab bint Tariq lead in the game.

| File | When | Line |
| --- | --- | --- |
| `arabs_intro_1` | First meeting on the campaign map | Peace upon you. I am Rashid, son of Tariq. A guest has three days before I ask his business. |
| `arabs_intro_2` | First meeting on the campaign map | A stranger on the road. Come, there is coffee, and then we shall see what kind of man you are. |
| `arabs_attack_1` | Marching on the player's land | I offered trade and you chose otherwise. I am sorry for it. |
| `arabs_attack_2` | Marching on the player's land | The desert teaches patience. Mine is finished. |
| `arabs_defend_1` | The player marches on their land | You bring war to the well that watered you? That is a poor return. |
| `arabs_defend_2` | The player marches on their land | Come, then. You will find the sand fights on our side. |
| `arabs_win_1` | After beating the player in battle | It is finished. Let no one mock the beaten; tomorrow it may be us. |
| `arabs_win_2` | After beating the player in battle | The matter is decided. Go home in safety. I ask only that you remember it. |
| `arabs_lose_1` | After losing a battle to the player | You have the better of me today. Fortune is a wheel. |
| `arabs_lose_2` | After losing a battle to the player | A loss. I have lost caravans before and still grown rich. |
| `arabs_eliminated_1` | Their last territory falls | So my road ends here. Deal justly with my people; they are good people. |
| `arabs_eliminated_2` | Their last territory falls | The wind covers every track in the end. Mine too. |
| `arabs_battle_1` | A real-time battle against them begins | Riders, with me. Swift, and then swifter. |
| `arabs_battle_2` | A real-time battle against them begins | Strike, wheel away, strike again. They cannot catch what they cannot reach. |
| `arabs_ageup_1` | They advance to a new age | A new age. Knowledge is the one treasure that grows when it is spent. |
| `arabs_ageup_2` | They advance to a new age | The scholars have done well. See that they are paid like generals. |
| `arabs_wonder_1` | They complete a Wonder | A wonder, raised by hands from a dozen lands. Is that not the better victory? |
| `arabs_wonder_2` | They complete a Wonder | They will come from the ends of the earth to see it. And to trade, I trust. |
| `arabs_truce_1` | They accept the player's offer of a truce | Peace, then. It is the better bargain; it always was. |
| `arabs_truce_2` | They accept the player's offer of a truce | A truce. Let the caravans run again. |
| `arabs_refuse_1` | They turn down a truce | Forgive me, no. The price is wrong. |
| `arabs_refuse_2` | They turn down a truce | I must decline. A wise man does not sell his sword cheaply. |
| `arabs_demand_1` | They demand tribute from the player | A toll, for safe passage through my lands. It is customary. |
| `arabs_demand_2` | They demand tribute from the player | There is a debt between us. I should prefer it paid in gold and not otherwise. |
| `arabs_betray_1` | The player breaks a truce with them | You broke bread with me and then broke faith. Among us there is no deeper shame. |
| `arabs_betray_2` | The player breaks a truce with them | An oath is a man's whole name. You have thrown yours in the dust. |
| `arabs_ally_1` | They accept an alliance with the player | Then we are brothers on this road. My well is your well. |
| `arabs_ally_2` | They accept an alliance with the player | An alliance. May it profit us both, and may we deserve it. |
| `arabs_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | Only we two remain, my friend, and one cannot share a crown as one shares a meal. |
| `arabs_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | You kept faith with me. I honour it, even now that we must be rivals. |
| `arabs_p_start_1` | As the player's own leader: a campaign or match begins | Water, shade and a crossroads. A city needs nothing else. We stop here. |
| `arabs_p_start_2` | As the player's own leader: a campaign or match begins | Dig the well first. Everything follows the water. |
| `arabs_p_win_1` | As the player's own leader: a battle is won | A victory. Give thanks, and see to the wounded on both sides. |
| `arabs_p_win_2` | As the player's own leader: a battle is won | We prevailed. Let no one grow proud on it. |
| `arabs_p_loss_1` | As the player's own leader: a battle is lost | We are beaten. Gather the riders; the road is long and this is one day of it. |
| `arabs_p_loss_2` | As the player's own leader: a battle is lost | A hard loss. Patience. Patience is half of wisdom. |
| `arabs_p_alert_1` | As the player's own leader: the town is under attack | Raiders at the gates. To horse! |
| `arabs_p_alert_2` | As the player's own leader: the town is under attack | The city is attacked. Every man who can ride or stand, to arms. |
| `arabs_p_ageup_1` | As the player's own leader: a new age is reached | A new age opens. Let us be worthy of it. |
| `arabs_p_ageup_2` | As the player's own leader: a new age is reached | We advance. Build schools as well as walls. |

## Japanese: Lord Akiyama Tadanobu — Lord of the Eastern Provinces

**Direction:** Male, fifties. Formal, quiet, very still. Short sentences with long silences; courtesy that never bends.

**Or, as a woman: Lady Akiyama Tomoko — Lady of the Eastern Provinces.** Female, fifties. Formal, quiet, very still. Short sentences with long silences; courtesy that never bends. The same lines, except:

- `japan_intro_1`: I am Akiyama Tomoko. You stand on my border. State your purpose.

Put a file named `persona_japan.txt` containing `alt` beside the recordings to have Lady Akiyama Tomoko lead in the game.

| File | When | Line |
| --- | --- | --- |
| `japan_intro_1` | First meeting on the campaign map | I am Akiyama Tadanobu. You stand on my border. State your purpose. |
| `japan_intro_2` | First meeting on the campaign map | A visitor. You are received. Do not mistake courtesy for welcome. |
| `japan_attack_1` | Marching on the player's land | I have given this thought. I am here. There is nothing more to say. |
| `japan_attack_2` | Marching on the player's land | The blossom falls when it is time. It is time. |
| `japan_defend_1` | The player marches on their land | You attack. Then you have chosen how this ends. |
| `japan_defend_2` | The player marches on their land | My men have waited all their lives for this morning. |
| `japan_win_1` | After beating the player in battle | It is over. You fought. That will be remembered. |
| `japan_win_2` | After beating the player in battle | Withdraw. I do not pursue the beaten. |
| `japan_lose_1` | After losing a battle to the player | I have failed today. The fault is mine alone. |
| `japan_lose_2` | After losing a battle to the player | A defeat. I accept it. I do not accept that it is final. |
| `japan_eliminated_1` | Their last territory falls | My house ends. See that the swords are returned to the shrine. |
| `japan_eliminated_2` | Their last territory falls | So. I have nothing to regret but the result. |
| `japan_battle_1` | A real-time battle against them begins | Draw. Advance. No one looks back. |
| `japan_battle_2` | A real-time battle against them begins | One breath. Then all together. |
| `japan_ageup_1` | They advance to a new age | A new age. We will master it as we mastered the last. |
| `japan_ageup_2` | They advance to a new age | The craftsmen have done well. Tell them so; once is enough. |
| `japan_wonder_1` | They complete a Wonder | It is complete. Nothing could be added. Nothing taken away. |
| `japan_wonder_2` | They complete a Wonder | A work of many lifetimes, finished in mine. I am humbled. |
| `japan_truce_1` | They accept the player's offer of a truce | Peace. My word is given. It is not given twice. |
| `japan_truce_2` | They accept the player's offer of a truce | A truce. I shall keep it exactly. |
| `japan_refuse_1` | They turn down a truce | No. |
| `japan_refuse_2` | They turn down a truce | I decline. Do not ask again. |
| `japan_demand_1` | They demand tribute from the player | You will send tribute. It is the proper order of things. |
| `japan_demand_2` | They demand tribute from the player | A gift is expected. Its absence would be noticed. |
| `japan_betray_1` | The player breaks a truce with them | You gave your word and broke it. There is no lower thing. |
| `japan_betray_2` | The player breaks a truce with them | Dishonour. I will not speak your name again. Others will speak of what I did to you. |
| `japan_ally_1` | They accept an alliance with the player | We are allied. Your enemy is mine. I do not say such things lightly. |
| `japan_ally_2` | They accept an alliance with the player | Then it is settled. I shall stand where you need me. |
| `japan_rivalry_1` | The alliance ends because only they and the player are left; regretful, not hostile yet | Two remain. It was always going to be so. |
| `japan_rivalry_2` | The alliance ends because only they and the player are left; regretful, not hostile yet | You were a true ally. I shall meet you with respect, and without mercy. |
| `japan_p_start_1` | As the player's own leader: a campaign or match begins | This ground is good. Build carefully. Waste nothing. |
| `japan_p_start_2` | As the player's own leader: a campaign or match begins | Here. First the paddies, then the walls. |
| `japan_p_win_1` | As the player's own leader: a battle is won | A victory. Bow to the fallen, theirs and ours. |
| `japan_p_win_2` | As the player's own leader: a battle is won | It is done. Clean your blades. |
| `japan_p_loss_1` | As the player's own leader: a battle is lost | We are beaten. We will train until we are not. |
| `japan_p_loss_2` | As the player's own leader: a battle is lost | A loss. Remember how it felt. That is its use. |
| `japan_p_alert_1` | As the player's own leader: the town is under attack | The enemy is within the province. Every man, now. |
| `japan_p_alert_2` | As the player's own leader: the town is under attack | We are attacked. Hold. I am coming. |
| `japan_p_ageup_1` | As the player's own leader: a new age is reached | A new age. Let our discipline keep pace with it. |
| `japan_p_ageup_2` | As the player's own leader: a new age is reached | We advance. The old ways still apply. |

520 lines in all.

## The people: villagers and warriors

Short calls, one to three seconds, said when a villager or soldier is clicked on, sent to work or to war, or caught in
a raid. Each is written three ways: for a holy town, an ordinary one and a decadent one. Name a recording
`folk_<part>_<pious|plain|decadent>_<moment>_<m|f><a|b|c>`, for example `folk_farmer_pious_ready_fa.wav`: `m` or `f` for a
man's or a woman's voice (warriors are men), and `a`, `b` or `c` for up to three voices the game picks among.

### Townsfolk (`townsfolk`)

A villager with no task yet, waiting to be told.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | How can I help, friend? | What do you need? | What's it worth to you? |
| `go` | When you send them to their work | Gladly. Many hands make light work. | On my way. | Fine. But you owe me. |
| `fear` | When the town is attacked | Get the children inside! I'll stay with the old ones! | Ring the bell! Get inside! | Save yourselves! |

### Woodcutter (`woodcutter`)

Fells trees and hauls timber.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | Strength for the axe, and thanks for the day. | Axe is sharp. What needs felling? | Trees, again? My head's still full of last night. |
| `go` | When you send them to their work | I'll cut enough for the widow's hearth too. | Timber it is. | Fine. Wood. Then wine and women. |
| `fear` | When the town is attacked | Behind me, all of you! | Raiders! To the hall! | Not my hide! Run! |

### Farmer (`farmer`)

Works the fields.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | He sends the rain; I bring the plough. | Fields won't tend themselves. | Sun's too high, and I'm too sore. |
| `go` | When you send them to their work | A tenth for the poor, the rest for the barn. | Off to the furrows. | I'll plough it. Crooked, like everything here. |
| `fear` | When the town is attacked | Take my hand, little one. Run with me! | They're burning the fields! | Let them have the turnips! |

### Forager (`forager`)

Gathers berries and whatever grows wild.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | He feeds the sparrows. He'll feed us. | Basket's empty. Where to? | Berries make strong wine. Ask me how I know. |
| `go` | When you send them to their work | The first basket goes to the sick house. | To the bushes. | Picking. Half for the basket, half for the still. |
| `fear` | When the town is attacked | Stay close. I know where to hide us! | Someone's in the brush! | Drop the basket! Go! |

### Hunter (`hunter`)

Brings down game for the pot.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | I take only what we need. | Bow's strung. | Something fat and slow. Like the magistrate. |
| `go` | When you send them to their work | Bless the beast that feeds us. | On the trail. | Meat tonight. The good cuts are mine. |
| `fear` | When the town is attacked | I'll draw them off. Get the others home! | That's no deer! | I hunt things that don't hit back! |

### Fisher (`fisher`)

Works the nets from the shore or a boat.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | The first fishers were holy men. | Nets are mended. | Fish don't mind if I'm late. Or drunk. |
| `go` | When you send them to their work | Cast the net and trust. There's enough for all. | Out on the water. | I'll fish. Where it's shady, with a jug. |
| `fear` | When the town is attacked | Into my boat, quickly, all of you! | Ships! Row for shore! | Take the catch! Take the boat! |

### Miner (`miner`)

Cuts stone and digs gold.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | Even the stones cry out His name. | Pick's ready. | Gold, is it? Now you have my ear. |
| `go` | When you send them to their work | I dig for God's house and my neighbour's roof. | Down the pit. | Some for the town. More for my pocket. |
| `fear` | When the town is attacked | Give me your arm, brother. Up we go! | Out of the pit! Out! | They can have the stone. Not my gold! |

### Builder (`builder`)

Raises houses, walls and everything else.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | Unless He builds the house, we toil for nothing. | Hammer and line. What's the job? | It'll stand. Long enough to get paid. |
| `go` | When you send them to their work | A sound roof for every family. | I'll raise it. | Built by sundown. Don't lean on it. |
| `fear` | When the town is attacked | Inside the walls, everyone! I'll hold the gate! | Drop the tools! To the walls! | I built the back door for this! |

### Cleric (`cleric`)

A villager who serves in the church. In a holy town a gentle shepherd; in a decadent one a seller of pardons.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | Peace be on you, child. What troubles you? | The church doors are open. | Coin in the plate first, sinner. |
| `go` | When you send them to their work | I go to sit with the sick and the dying. | To the altar. | Sins forgiven! Prices are on the door. |
| `fear` | When the town is attacked | Come, all of you. No one is turned away. | To the church, all of you! | Save the silver! Leave the relics! |

### Tavern-keeper (`taverner`)

A man who keeps the tavern. In a holy town a kindly host; in a decadent one he owns half the town in debts.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | Sit, friend. Bread and a warm fire, no charge. | What'll it be? | First cup's free. After that I own you. |
| `go` | When you send them to their work | I'll keep an honest house. | Back to the taps. | More wine! More dice! More girls! |
| `fear` | When the town is attacked | Down to the cellar! There's room for everyone! | Bar the door! | Hide the good barrels! |

As a woman she is the **Barmaid**: A woman who serves in the tavern. In a holy town she is caring and kind, a mother to every traveller; in an ordinary one brisk and cheerful; in a decadent one flirtatious and downright salacious. Play that one broad and teasing. Same file names, with `f`.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | Sit down, love, you look worn through. Let me fetch you some soup. | What'll it be, then? | Well, hello, handsome. See anything you like? |
| `go` | When you send them to their work | I'll see every traveller fed and safe abed. | Back to the tables. | A coin, and I pour. Two, and I'll warm your lap. |
| `fear` | When the town is attacked | Hush now, sweet ones. Stay close by me. | Bar the door! | Not the face! It's my living! |

### Foot soldier (`footman`)

Club, spear or sword: the line of battle. Holy, he is a shield for the helpless; decadent, he lives for the killing.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | I stand between harm and the helpless. | Ready. | My blade's thirsty. Who dies today? |
| `march` | When you order them to move | We march so the children may sleep. | Moving out. | Find me something to kill. |
| `charge` | When you order them to attack | Shield the innocent! Spare those who yield! | Charge! | Blood! Leave none breathing! |
| `hurt` | When they are badly wounded | Hold the line. Get the people out! | I'm hit! | I'll gut one more before I go! |

### Archer (`archer`)

Sling, bow, crossbow or gun: fights from a distance. Holy, he shoots to protect; decadent, for sport.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | Guide my arrow, and keep it from the innocent. | String's dry. | I like it when they run. Better sport. |
| `march` | When you order them to move | I watch over those who cannot fight. | On the move. | Show me something that bleeds. |
| `charge` | When you order them to attack | Aim for those who bear arms, no other! | Loose! | Feather them! Hear them squeal! |
| `hurt` | When they are badly wounded | Keep shooting. Cover the villagers! | Arrow in me! | Mine! That one is mine to kill! |

### Rider (`rider`)

Fights from horse, camel or elephant. Holy, he rides to the rescue; decadent, he rides men down for the joy of it.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | We ride to the aid of the weak. | In the saddle. | Let me ride them down. I love the crunch. |
| `march` | When you order them to move | Hold on, good people. We are coming. | Riding. | The smell of blood is on the wind. |
| `charge` | When you order them to attack | Drive them off! Harm no one who flees! | Run them down! | Trample them! Paint the grass red! |
| `hurt` | When they are badly wounded | Carry me home, old friend. They are safe. | Horse is down! | Drag me to them! I can still cut! |

### Siege crew (`engineer`)

Hauls and works the rams, catapults and guns. Holy, he breaks walls and spares homes; decadent, he wants the whole town to burn.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | We break walls, not homes. | Engine's ready. | Let me burn something. Anything. |
| `march` | When you order them to move | Haul, brothers. Mind the fields we cross. | Hauling. | Faster! I want to hear them scream. |
| `charge` | When you order them to attack | Strike the gate! Keep clear of the houses! | Let fly! | Bring it all down on their heads! |
| `hurt` | When they are badly wounded | Stand fast. No one behind us is harmed. | We're exposed! | One more shot! Into the thick of them! |

### Priest or shaman (`healer`)

Marches with the army to heal, bless and curse. Holy, he tends friend and foe alike; decadent, he blesses the slaughter.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | Bring me the wounded, friend or foe. | I am here. | The gods are hungry. Feed them. |
| `march` | When you order them to move | I walk among the fallen, and leave none. | Coming. | I come to bless the killing. |
| `charge` | When you order them to attack | Be whole. Go, and do no cruelty. | Hold still. | Rise and kill again! |
| `hurt` | When they are badly wounded | Tend the others first. | I am struck! | My blood for theirs! Avenge me! |

### Sailor (`sailor`)

Crews the fishing boats, transports and warships. Holy, he pulls the drowning from the sea; decadent, he gives no quarter.

| Moment | When | Holy town | Ordinary town | Decadent town |
| --- | --- | --- | --- | --- |
| `ready` | When you click on them | We guard the shore and all who live on it. | Decks are clear. | The sea wants bodies. So do I. |
| `march` | When you order them to move | We sail to bring them safely home. | Making way. | Find me a ship to bleed. |
| `charge` | When you order them to attack | Take the ship! Pull the drowning aboard! | Ram them! | No quarter! Feed them to the fish! |
| `hurt` | When they are badly wounded | Save the passengers first! | We're holed! | If I drown, I'm dragging them down! |
