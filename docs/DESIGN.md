# Rise and Ruin: the design every session works from

Set by the owner on 14 November 2026. Where this page and the code disagree, the code is behind:
this page says where the game is going. Where it and `scripts/systems.mjs` disagree about what is
true *today*, the board is right. Change this page only on the owner's word.

## What the game is

A nation and its people, lived over generations. The world map is the game. A real-time battle is
not a separate mode: it is the close view of one town in that nation, and everything that happens
in it goes home. The work is no longer written story; it is systems deep enough that stories fall
out of them by chance: pirates on the coast take the women and burn the farms, and the nation is
poorer for a generation.

## Decided

**Time.** A turn on the map is a season, four to a year. A child is grown at about 15 and old at
about 60. Entering a town plays a fixed stretch of that season in real time. Every town the player
does not visit lives the same season by the same rules, run coarsely.

**Age belongs to the nation.** It advances only on the map. Nobody ages up inside a town; a town is
in whatever age its nation is in.

**Towns persist.** A land has a real town: its people, buildings and stores, loaded when the player
enters and saved when they leave. The people on screen are the population: ten women taken is ten
women gone. From the map the player may enter any of their towns at any time to train, build and
keep order.

**No auto-resolve.** A town the player is not in defends itself with what it has: walls, guards,
people, its state. It may hold, be sacked, be taken or be destroyed. The player is given a report
of the defence: who was killed, who was taken, and which way the town's morals swayed.

**A soldier costs a person.** Training takes a villager as well as the usual resources, and the
training time is what turns him into the unit chosen. No man comes from nowhere. Population is the
real resource: an army is paid for in births and years.

**Men and women.** Soldiers come from the men. Women may serve, in healing and support; a woman
who fights does so with a much lower attack. Women tend the farms, raise the children, work,
produce, and carry more than a man. War takes the men and raiders take the women, and those are
two different wounds.

**Children are never shown.** A child is written in the record of the house it is born to (name,
parents, age, what it may inherit) and is not seen, does not leave the house and cannot be struck,
taken or harmed until it comes of age, when it steps out as a grown villager. No violence is ever
done to a child, on screen or in the rules.

**Notable people.** Most villagers are ordinary. Some earn a name the nation remembers: a soldier
who rises through veterancy, and a woman whose home produces most (many children raised, a farm
well kept, much carried in). Their loss carries weight for the nation, not only for the town.

**Captivity.** People taken are held somewhere real on the map and can be got back for a time.
Captivity shortens a life: a captive man loses about twenty years, and a captive woman does not
long outlive her use to her captors. What the captor gains depends on who he is. A rival nation
that assimilates gains population outright. Slavers gain output: the captives' labour and the
children born in captivity raise what the holder produces. What is shown of it is the place and the condition: the stockade, the quarters, the
captives' dress, the work they are put to, the guards. What is done to a captive woman is told by
what follows from it (a shorter life, children born in captivity), and is not shown.
Nothing is drawn to suggest it, not even by a sign.

Children born in captivity: where the captor is a slaver or a marauder, they are the mother's and
her people's, and come home with her if she is got back. Where the captor is a rival nation that
assimilates, they are that nation's.

**Acts of God.** Famine, plague, fire and the like come at random. They fall harder on the
decadent than on the holy, but spare nobody: a Righteous town has them at about a third of the
rate and severity, and very rarely is struck hard.

**Threats of men never stop.** Raiders, highwaymen, slavers and pirates live on the map, choose
their marks and strike. There is always order to keep and something to fight.

**Drift.** Villagers do as they are set to while fed and safe. As more of them struggle, more turn
to what is worse for them: scarce food sends women to the taverns and men to the mines, and the
walls are left thin. Where a town is well kept the holy way is the more attractive and people
drift toward it instead.

**Decrees.** The leader rules by decree as well as by building. A church draws people back, guards
keep order by force, food removes the cause, closing the tavern works and angers a decadent town.
A decree can also go the other way: ordering the women into the taverns raises gold and lowers the
town's moral standing.

**The tavern as a town falls.** As a town grows less moral its tavern women come to sell more than
drink. This is shown by the house and not by any act: the tavern's look and lights, its hours, how
its women are dressed, the gold it brings in, and the town's standing going down.

**A visit.** Entering a town plays about ten minutes of its season; the player may leave sooner.
Any number of towns may be visited in a season, each once.

**A town left to itself** carries on with the last orders it was given (what to build, what to
train, where its people work), and a governor fills the gaps sensibly.

**Stores.** The four resources replace the map's supplies. Every town has its own stores of food,
wood, gold and stone, and the nation's stores on the map are the sum of its towns'. Towns send
food, goods and people to one another by road, a season on the way, and a convoy can be robbed.

**Armies belong to towns.** An army is the men of the town that raised it, and its dead are that
town's dead. A veteran who comes home is one of its notable people.

**A town taken.** Its people stay and become the taker's over time: resentful at first and likely
to rise, sooner settled where they are ruled well.

**Rivals live by the same rules.** A rival nation has real towns, loses real people, and can be
bled by raids as the player can.

**Faith is a town's.** Each town stands where it stands between piety and decadence, and towns of
one nation may stand at different levels. The nation's standing is the sum of its towns', as its
stores are.

**The leader is one person in one place.** He moves about the map, is in a town or with an army,
and steadies the town he is in. He can call armies to meet him and move with them as one.

**Grief.** A home that loses its mother or its sons works more slowly for a time. It tells most in
a town of middling morals, and less in a holy or a decadent one.

## The order of building

Each step is to be playable by itself.

1. A soldier costs a person. No ageing up inside a campaign battle.
2. Towns keep their people and stores between seasons; notable people are kept by name.
3. A season passes in every town: births, deaths, harvest, creed and acts of God, run coarsely.
4. Threats on the map that choose a town and strike it, settled by the town defending itself, with
   a report of what happened to whom.
5. Drift under pressure and the leader's decrees.

## How far the game is from this today

| Point | Today |
| --- | --- |
| Acts of God by creed | In part: the Righteous never take plague and creed scales contagion. Famine and fire do not look at creed. |
| A soldier costs a person | No: soldiers are bought with resources alone. |
| Notable people | Half: villagers have names, traits and families, and one best soldier of a battle is remembered. Only he and the leader outlive the match. |
| Towns persist | Buildings stay between battles on a land. People and stores do not. |
| A town defends itself | No: a battle not fought is settled by strength numbers. |
| Threats on the map | No: marauders and slavers exist only inside a match. |
| Drift | No: the parts exist as separate rules, not as cause and effect. |
| Children never shown | No: children are drawn as small figures that walk the town and can be hurt. |
| Age on the map only | Half: the campaign sets the age a battle begins in, and the player can still age up within it. |
