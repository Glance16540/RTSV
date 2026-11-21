// The longer threads of the tales (docs/CLOSING.md, "Systems deep enough that stories fall out of them": a thread was
// one step long). Words and numbers only, as story.ts's own tales are: each tale here is what an earlier answer led
// to (`after`), so a matter begun by one answer runs on three to five tellings, and which way it goes turns on every
// answer given along it. The rules that tell them, and tell a thread whole when it ends, are talethreads.ts.
//
// Each answer says what was done in a few words (`told`, after "you"), for the chronicle's telling of the thread; an
// answer that ends a thread says how it ended for those in it (`fate`), for the last page.
// As everywhere: `a` is the upright answer and `b` the dissolute one; no child is a figure in any of them, nothing
// suggestive is told, and everyone in them is grown.
import type { Tale } from './story';

/** What each thread is called, by the tale it begins with. */
export const THREAD_NAMES: Record<string, string> = {
  exile: 'the exile at the gate', hunger: 'the hungry tribe', sellswords: 'the sellswords', relics: 'the saint\'s bones',
};

export const THREAD_TALES: Tale[] = [
  // ---- The exile: sheltered, he goes home; sold, he is avenged. ----
  { id: 'exile_crowned', title: 'The prince in his hall', after: { id: 'exile_home', choice: 'a' }, needs: 'rival',
    text: 'Word comes over the border: the prince you sheltered in {land} sits in his father\'s hall again. His envoy brings thanks, and one more thing to ask: that you stand with him if {rival} come against him.',
    a: { label: 'Swear to stand with him', virtue: 6, supplies: 0, favor: -1, told: 'swore to stand with him', result: 'The oath is sworn with his envoy\'s hand on yours. {rival} hear of it within the month.' },
    b: { label: 'Ask for gold instead of oaths', virtue: -6, supplies: 4, told: 'asked him for gold instead of an oath', fate: 'The prince paid what you asked, and never asked anything of you again.', result: 'The gold comes in a chest with his seal on it, and no letter.' } },
  { id: 'exile_oath', title: 'The oath called on', after: { id: 'exile_crowned', choice: 'a' }, needs: 'rival',
    text: '{rival} have marched on the prince you swore to stand with. His rider is in the yard at {land}, and his horse has been ridden near to death.',
    a: { label: 'Send what you can spare', virtue: 8, supplies: -3, favor: -1, told: 'kept your oath when he called on it', result: 'Carts and spears go over the border. The prince holds his hall.' },
    b: { label: 'Send the rider back with nothing', virtue: -12, supplies: 0, favor: 1, told: 'broke your oath when he called on it', fate: 'The prince lost his hall to {rival} and went into the hills, and his people say your name as a curse.', result: 'The rider goes back alone. {rival} take the prince\'s hall before the leaves fall.' } },
  { id: 'exile_heir', title: 'The old prince\'s last envoy', after: { id: 'exile_oath', choice: 'a' },
    text: 'The prince you sheltered and stood by is old now. His last envoy asks that his heir, a grown man with a beard already grey, be received at your table and swear friendship there.',
    a: { label: 'Feast the heir', virtue: 8, supplies: -2, told: 'feasted his heir', fate: 'The prince died old in his father\'s hall, and his heir kept the friendship he swore at your table.', result: 'The heir sits at your right hand in {land}. The friendship is sworn over bread and salt.' },
    b: { label: 'Ask tribute for it', virtue: -8, supplies: 3, told: 'asked tribute of his heir', fate: 'The prince died old in his hall, and his heir paid you tribute and did not love you.', result: 'The heir pays, and swears, and leaves before the meat is served.' } },
  { id: 'exile_spoils', title: 'The carts asked back', after: { id: 'exile_home', choice: 'b' }, needs: 'rival',
    text: 'Envoys of {rival} have come to {land} for the carts your spears brought home with the prince, and say that what was taken was theirs.',
    a: { label: 'Give back what was taken', virtue: 6, supplies: -3, favor: 2, told: 'gave back what your spears had taken', fate: 'The prince kept his hall, and {rival} let the matter of the carts be.', result: 'The carts go back with the envoys. Something like respect goes with them.' },
    b: { label: 'Keep it, and send them off', virtue: -6, supplies: 0, favor: -2, told: 'kept the spoils and sent the envoys off', result: 'The envoys leave with nothing and say nothing. That is the worst of it.' } },
  { id: 'exile_feud', title: 'A broken spear on the threshold', after: { id: 'exile_spoils', choice: 'b' }, needs: 'rival',
    text: 'Riders of {rival} have burned a granary in {land} and left a broken spear across its threshold, for the carts you kept.',
    a: { label: 'Pay what was kept, and end it', virtue: 6, supplies: -3, favor: 1, told: 'paid for the carts at last', fate: 'The feud over the prince\'s carts was paid off, and {rival} spoke of it no more.', result: 'The price is paid at the border stone. The spear is taken away.' },
    b: { label: 'Burn one of theirs', virtue: -10, supplies: 1, favor: -2, told: 'burned a granary of theirs for it', fate: 'The feud over the prince\'s carts was never settled, and the burnings went on between your peoples for years.', result: 'A granary burns over the border. The broken spear is sent back.' } },
  { id: 'exile_sister', title: 'A stone for the prince', after: { id: 'exile_debt', choice: 'a' },
    text: 'The prince\'s sister, paid the blood price, asks leave to raise a stone for him in {land}, where he was handed over.',
    a: { label: 'Let it stand in the square', virtue: 8, supplies: -1, told: 'let his stone stand in the square', fate: 'The prince\'s stone stood in the square of {land}, and his sister tended it until she died.', result: 'The stone goes up in the square. People touch it as they pass.' },
    b: { label: 'Let it stand outside the walls', virtue: -4, supplies: 0, told: 'put his stone outside the walls', fate: 'The prince\'s stone stood outside the walls of {land}, where the grass grew over it.', result: 'The stone is raised by the road outside the walls. His sister does not thank you.' } },
  { id: 'exile_name', title: 'The name on the church door', after: { id: 'exile_debt', choice: 'b' },
    text: 'The prince\'s name has been cut again, this time into the door of the church in {land}, and the priest will not have it planed off.',
    a: { label: 'Leave it, and do penance', virtue: 10, supplies: -2, told: 'left his name on the door and did penance', fate: 'The prince\'s name stayed cut in the church door at {land}, and a candle was lit under it every year.', result: 'You kneel under the name in front of the town. The burnings stop for good.' },
    b: { label: 'Burn the door and hang a new one', virtue: -10, supplies: -1, told: 'had the church door burned', fate: 'The prince\'s name was burned with the door, and cut again on the new one, and on the one after.', result: 'The door burns in the square. The priest preaches on it for a month.' } },
  // ---- The hungry tribe: fed, it comes over; fleeced, it bears a grudge. ----
  { id: 'tribe_law', title: 'Their old law', after: { id: 'tribe_comes', choice: 'a' },
    text: 'The elders of {tribe}, your people now, ask that their old law be kept beside yours in their own villages.',
    a: { label: 'Let their law stand beside yours', virtue: 6, supplies: 0, told: 'let their old law stand beside yours', fate: 'The people of {tribe} kept their old law beside yours, and were the most loyal of your lands.', result: 'The elders go home with their law and yours. Both are kept.' },
    b: { label: 'One law for all', virtue: -6, supplies: 2, told: 'gave them your law alone', fate: 'The people of {tribe} lived under your law alone, and their old law was spoken only at the hearth.', result: 'Your judges ride into {tribe}. The elders\' law is spoken only at the hearth.' } },
  { id: 'tribe_tithe', title: 'The tithe comes short', after: { id: 'tribe_comes', choice: 'b' },
    text: 'The tithe from {tribe} has come short this year. Their elders say the harvest failed again, as it did the year you first fed them.',
    a: { label: 'Forgive it this year', virtue: 8, supplies: -1, told: 'forgave the tithe in a bad year', fate: 'The people of {tribe} paid their tithe in good years and were forgiven it in bad ones.', result: 'The tithe is forgiven. The elders bow lower than they have before.' },
    b: { label: 'Take it in cattle', virtue: -8, supplies: 3, told: 'took the tithe in cattle', fate: 'The people of {tribe} paid every tithe in full, and their herds never grew again.', result: 'The cattle are driven off to {land}. {tribe} goes hungry a second time.' } },
  { id: 'tribe_market', title: 'Men of the tribe at market', after: { id: 'tribe_grudge', choice: 'a' }, needs: 'tribe',
    text: 'Men of {tribe} have come to the market in {land} to trade, the first since the hungry year and the cattle.',
    a: { label: 'Let them trade as any others', virtue: 6, supplies: 1, told: 'let them trade at your market as any others', fate: '{tribe} traded at your markets ever after, and the hungry year was forgotten.', result: 'They sell their hides and buy salt, and go home with a story to tell.' },
    b: { label: 'Tax them double at the gate', virtue: -8, supplies: 3, told: 'taxed them double at the gate', fate: '{tribe} never came to your markets again, and the hungry year was not forgotten.', result: 'They pay, and go home, and do not come back.' } },
  { id: 'tribe_mourner', title: 'An old woman at the gate', after: { id: 'tribe_grudge', choice: 'b' }, needs: 'tribe',
    text: 'An old woman of {tribe} has walked into {land} alone, and stands at the gate asking for the bones of her kin who fell when your riders burned their huts.',
    a: { label: 'Give her the bones, and bread for the road', virtue: 10, supplies: -1, told: 'gave the bones back to an old woman of theirs', result: 'She carries them home on her back. Your riders do not look at her.' },
    b: { label: 'Have her driven off', virtue: -10, supplies: 0, told: 'had their mourner driven from the gate', fate: '{tribe} sent no more mourners, and its men waited for their day.', result: 'She is driven from the gate. She does not run.' } },
  { id: 'tribe_peace', title: 'The border stone', after: { id: 'tribe_mourner', choice: 'a' }, needs: 'tribe',
    text: 'Word comes from {tribe} with the old woman\'s kin: they will make peace, if you will meet them yourself at the border stone.',
    a: { label: 'Go, and make peace', virtue: 8, supplies: -1, militia: -1, told: 'met them at the border stone and made peace', fate: 'Peace was made with {tribe} at the border stone, and kept.', result: 'You meet them at the stone with empty hands. They put down their spears.' },
    b: { label: 'Send a captain in your place', virtue: -4, supplies: 0, told: 'sent a captain to the border stone in your place', fate: '{tribe} took your captain\'s word, and trusted it as far as a captain\'s word goes.', result: 'Your captain makes the peace. They wanted you.' } },
  // ---- The sellswords: taken on, they want paying. ----
  { id: 'sellswords_spring', title: 'Another year', after: { id: 'wages', choice: 'a' },
    text: 'Spring has come, and the captain of the sellswords you paid through the winter asks whether you will keep them another year.',
    a: { label: 'Pay them off and send them on', virtue: 6, supplies: -1, told: 'paid them off in the spring', fate: 'The sellswords went on to other wars, and spoke well of your pay.', result: 'They ride out of {land} in good order, and owe nobody there anything.' },
    b: { label: 'Keep them another year', virtue: -6, supplies: -2, company: true, told: 'kept them another year', result: 'They stay, and more of their kind come to join them.' } },
  { id: 'sellswords_turn', title: 'The captain\'s supper', after: { id: 'sellswords_spring', choice: 'b' }, needs: 'rival',
    text: 'The captain of your sellswords has been seen at supper in {land} with envoys of {rival}, and he paid for nothing.',
    a: { label: 'Send him and his men away tonight', virtue: 6, supplies: 0, told: 'sent them away before they could be bought', fate: 'The sellswords left your service by night, and went to {rival}, who had paid for their supper.', result: 'They are gone by the morning, with their wages and no more.' },
    b: { label: 'Outbid them', virtue: -6, supplies: -3, told: 'outbid {rival} for them', fate: 'The sellswords served you as long as you could pay them, and not a day longer.', result: 'The captain takes your purse and is all smiles. For now.' } },
  { id: 'sellswords_village', title: 'The headman at the door', after: { id: 'wages', choice: 'b' },
    text: 'The headman of the village in {land} that the sellswords collected their pay from has walked to your door with what is left of its people behind him.',
    a: { label: 'Repay the village from your stores', virtue: 10, supplies: -3, told: 'repaid the village from your own stores', fate: 'The village in {land} was rebuilt with your grain, and its headman held his peace.', result: 'Grain and seed go back with him. The village will see the spring.' },
    b: { label: 'Have him whipped from the gate', virtue: -10, supplies: 0, told: 'had its headman whipped from the gate', fate: 'The village in {land} was never rebuilt, and travellers were shown where it had stood.', result: 'He is whipped from the gate. Those behind him scatter.' } },
  // ---- The saint's bones: enshrined, they draw the sick; sold, they are missed. ----
  { id: 'shrine_crowd', title: 'The sick in the road', after: { id: 'cure', choice: 'a' },
    text: 'So many come to the shrine in {land} that the sick lie in the road for a mile, and fever has come with them.',
    a: { label: 'Build them a house of healing beside it', virtue: 8, supplies: -3, told: 'built a house of healing beside the shrine', result: 'A long house goes up beside the shrine, with beds, and women to tend them.' },
    b: { label: 'Close the road to the shrine', virtue: -6, supplies: 0, told: 'closed the road to the shrine', fate: 'The road to the shrine in {land} was closed, and the bones lay there with nobody to pray to them.', result: 'A barrier goes across the road. The sick turn back, those who can.' } },
  { id: 'shrine_saint', title: 'A saint of their own', after: { id: 'shrine_crowd', choice: 'a' },
    text: 'The keepers of the shrine in {land} ask you to send to the holy fathers, so that the saint of the bones may be named among the saints.',
    a: { label: 'Send the petition, with gifts', virtue: 8, supplies: -2, told: 'sent to the holy fathers to have the saint named', fate: 'The saint of {land} was named among the saints, and the house of healing beside the shrine stood for a hundred years.', result: 'The petition goes south with gifts. The keepers pray for its road.' },
    b: { label: 'Keep quiet and keep the takings', virtue: -6, supplies: 2, told: 'kept the saint and the takings to yourselves', fate: 'The saint of {land} was never named by the holy fathers, and the town did very well out of it.', result: 'Nothing is sent. The offerings are counted, and they are many.' } },
  { id: 'shrine_doubt', title: 'A pig\'s bones', after: { id: 'cure', choice: 'b' },
    text: 'A healer turned from the shrine door in {land} for want of coin has stood in the market and said that the bones are a pig\'s.',
    a: { label: 'Open the door free, and let the bones answer', virtue: 8, supplies: -2, told: 'opened the shrine door free and let the bones answer', fate: 'The shrine door in {land} stood open to all, and the healer who doubted it was cured there in his old age.', result: 'The door is opened free. The healer goes in first, and comes out quiet.' },
    b: { label: 'Have him put in the stocks', virtue: -8, supplies: 1, told: 'put the doubting healer in the stocks', fate: 'The shrine in {land} kept its price, and its doubters.', result: 'He sits in the stocks in the market. Fewer come to the shrine that month.' } },
  { id: 'relics_sold', title: 'The bones elsewhere', after: { id: 'relics', choice: 'b' },
    text: 'The merchant who bought the saint\'s bones has sold them again, to a shrine two lands off that now draws the pilgrims who once came to {land}.',
    a: { label: 'Send priests to ask for them back', virtue: 8, supplies: -2, told: 'sent priests to ask for the bones back', result: 'Your priests take the road with their staffs and their pleading.' },
    b: { label: 'Raise a shrine over other bones', virtue: -10, supplies: 1, told: 'raised a shrine over other bones', result: 'Bones are found. A shrine goes up over them in {land}. The pilgrims begin to come back.' } },
  { id: 'relics_home', title: 'The bones come home', after: { id: 'relics_sold', choice: 'a' },
    text: 'The bones come home to {land} in a cart hung with flowers, the priests walking beside it. The town turns out to meet them.',
    a: { label: 'Build the shrine at last', virtue: 10, supplies: -3, told: 'built the shrine over them at last', fate: 'The saint\'s bones came home to {land}, and the shrine over them was never sold again.', result: 'The shrine is raised over them where the priests first wanted it.' },
    b: { label: 'Charge the town to see them', virtue: -8, supplies: 3, told: 'charged the town to see them', fate: 'The saint\'s bones came home to {land}, and were shown for a price ever after.', result: 'A price is set at the cart. The flowers wilt.' } },
  { id: 'relics_false', title: 'The carpenter\'s dog', after: { id: 'relics_sold', choice: 'b' },
    text: 'The new bones in {land} have been found out: a carpenter swears on his life that he buried his dog on that spot.',
    a: { label: 'Own it from the church steps', virtue: 10, supplies: 0, told: 'owned to the false bones from the church steps', fate: 'The false shrine in {land} was pulled down, and you were the better trusted for owning to it.', result: 'You say it before the whole town. The shrine is pulled down by evening.' },
    b: { label: 'Pay him to swear otherwise', virtue: -8, supplies: -1, told: 'paid the carpenter to swear otherwise', fate: 'The shrine over the carpenter\'s dog stood in {land} for years, and the carpenter drank well.', result: 'The carpenter remembers that it was another spot after all.' } },
];
