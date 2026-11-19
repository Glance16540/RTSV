// The common people's lines in their own faith (folk.ts; docs/systems-board, "Leaders": the holy lines spoke of God
// and the Lord whatever nation they belonged to).
//
// The people's script (folk.ts) is written once for every nation, and its lines of faith were Christian: He sends the
// rain, the first fishers were holy men, God's house, the church, relics. Here each people's faith says those lines in
// its own words, with the same sense, the same length and the same temper: the One God of the Judges, God as the
// Abbasids and Mali pray to Him, the gods of the Nile (Egypt and Kush), of Babylon, of Greece and of Rome, the Wise
// Lord and the sacred fire of Persia, the kami and the Buddha of Japan, Heaven and the ancestors of China, the Eternal
// Blue Sky of the steppe, and the gods of the North. The Franks and the English keep the script as it is written.
//
// Only lines that speak of faith differ; every other line is the script's. A line in another faith is recorded under
// its own name (`faithKey`: the script's name and the faith), so nobody hears one people's words from another. Plain
// data, no DOM; nothing here is a rule of the game.
import type { FolkMoment, Lean } from './folk';

export type Belief = 'christian' | 'hebrew' | 'muslim' | 'nile' | 'babylon' | 'zoroastrian' | 'greek' | 'roman' | 'japanese' | 'chinese' | 'tengri' | 'norse';

/** Which faith each people's common folk speak in. A people not named here speaks the script as written. */
export const BELIEF_OF: Record<string, Belief> = {
  hearth: 'christian', england: 'christian', dawn: 'hebrew', arabs: 'muslim', mali: 'muslim', egypt: 'nile', kush: 'nile',
  babylon: 'babylon', persia: 'zoroastrian', greece: 'greek', stonekin: 'roman', japan: 'japanese', forge: 'chinese', steppe: 'tengri', wild: 'norse',
};
export const beliefOf = (civ: string | undefined): Belief => BELIEF_OF[civ ?? ''] ?? 'christian';

/** Who speaks in each faith, for whoever records the lines. */
export const BELIEF_NOTES: Record<Belief, string> = {
  christian: 'The Franks and the English: the script as written',
  hebrew: 'The Tribes of the Judges: the One God, His altar and His temple',
  muslim: 'The Abbasids and Mali: Muslims, praying to God, at the mosque',
  nile: 'Egypt and Kush: the gods of the Nile, Amun and Ra, Hapi of the flood, at the temple',
  babylon: 'Babylon: Marduk, Shamash and Adad, Ea of the waters, at the temple',
  zoroastrian: 'Persia: the Wise Lord, Ahura Mazda, and the sacred fire',
  greek: 'The Greeks: Zeus, Demeter, Artemis, Poseidon and Athena, at the temple',
  roman: 'Rome: Jupiter, Ceres, Diana, Neptune and the household gods, at the temple',
  japanese: 'Japan: the kami and the Buddha, at the shrine',
  chinese: 'China: Heaven and the ancestors, at the shrine',
  tengri: 'The steppe: the Eternal Blue Sky and Mother Earth, the spirits, at the sacred grove',
  norse: 'The North: Thor, Freyr, Ullr, Njord and the rest of the gods',
};

/** `<role>.<moment>.<lean>`: the line as each faith says it. Only the lines of the script that speak of faith. */
type Said = Partial<Record<string, string>>;
// The temple-keeping peoples' cleric, the same but for whose house it is.
const keeper = (house: string, offering: string, wares: string): Said => ({
  'cleric.ready.plain': `The ${house} doors are open.`,
  'cleric.ready.decadent': `${offering} first, sinner.`,
  'cleric.go.decadent': `${wares}! Prices are on the door.`,
  'cleric.fear.plain': `To the ${house}, all of you!`,
  'cleric.fear.decadent': 'Save the silver! Leave the rest!',
});
export const FAITH_LINES: Record<Exclude<Belief, 'christian'>, Said> = {
  hebrew: {
    'forager.ready.pious': "He feeds the young ravens. He'll feed us.",
    'fisher.ready.pious': 'The sea is His, for He made it.',
    'miner.ready.pious': 'Even the mountains sing His praise.',
    ...keeper('temple', 'An offering', 'Atonement'),
    'cleric.go.plain': 'To the altar.',
  },
  muslim: {
    'farmer.ready.pious': 'God sends the rain; I bring the plough.',
    'forager.ready.pious': "God provides for every creature. He'll feed us.",
    'hunter.go.pious': "In God's name, swift and clean.",
    'fisher.ready.pious': 'The sea and all in it are His gift.',
    'miner.ready.pious': 'Even the stones glorify Him.',
    'miner.go.pious': 'I dig for the mosque and my neighbour\'s roof.',
    'builder.ready.pious': 'Build a house for God, and He builds one for you.',
    'cleric.ready.pious': 'Peace be upon you. What troubles you?',
    ...keeper('mosque', 'Alms in my hand', 'Blessings'),
    'cleric.go.plain': 'To the prayer hall.',
  },
  nile: {
    'farmer.ready.pious': 'Hapi sends the flood; I bring the plough.',
    'forager.ready.pious': 'The river feeds us all, as the gods meant.',
    'hunter.go.pious': 'Thanks to the gods for the beast that feeds us.',
    'fisher.ready.pious': 'The river is the gift of the gods.',
    'miner.ready.pious': 'Even the stones sing to Ra.',
    'miner.go.pious': "I dig for Amun's house and my neighbour's roof.",
    'builder.ready.pious': 'Unless the gods raise the house, we toil for nothing.',
    ...keeper('temple', 'An offering', 'Amulets'),
    'healer.ready.decadent': 'The gods are hungry. Feed them.',
  },
  babylon: {
    'farmer.ready.pious': 'Adad sends the rain; I bring the plough.',
    'forager.ready.pious': "Shamash sees every creature fed. He'll feed us.",
    'hunter.go.pious': 'Thanks to the gods for the beast that feeds us.',
    'fisher.ready.pious': 'Ea gave the waters their fish.',
    'miner.ready.pious': "Even the stones are Marduk's.",
    'miner.go.pious': "I dig for Marduk's house and my neighbour's roof.",
    'builder.ready.pious': 'Unless Marduk lays the brick, we toil for nothing.',
    ...keeper('temple', 'An offering', 'Omens read'),
    'healer.ready.decadent': 'The gods are hungry. Feed them.',
  },
  zoroastrian: {
    'farmer.ready.pious': 'The Wise Lord sends the rain; I bring the plough.',
    'forager.ready.pious': "The Wise Lord feeds the sparrows. He'll feed us.",
    'hunter.go.pious': 'Good thoughts for the beast that feeds us.',
    'fisher.ready.pious': 'The waters are holy. Take, and keep them clean.',
    'miner.ready.pious': "Even the stones are the Wise Lord's work.",
    'miner.go.pious': 'I dig for the fire temple and my neighbour\'s roof.',
    'builder.ready.pious': 'Good thoughts, good words, good deeds; then good walls.',
    ...keeper('fire temple', 'Coin for the fire', 'Sins burned away'),
    'cleric.go.plain': 'To the sacred fire.',
  },
  greek: {
    'farmer.ready.pious': 'Zeus sends the rain; I bring the plough.',
    'forager.ready.pious': "Demeter feeds the sparrows. She'll feed us.",
    'hunter.go.pious': 'Thanks to Artemis for the beast that feeds us.',
    'fisher.ready.pious': 'Poseidon gives the catch. A share is his.',
    'miner.ready.pious': 'Even the stones remember the gods.',
    'miner.go.pious': "I dig for Athena's temple and my neighbour's roof.",
    'builder.ready.pious': 'Unless Athena guides the hand, we toil for nothing.',
    ...keeper('temple', 'An offering', 'Oracles told'),
    'healer.ready.decadent': 'The gods are hungry. Feed them.',
  },
  roman: {
    'farmer.ready.pious': 'Jupiter sends the rain; I bring the plough.',
    'forager.ready.pious': "Ceres feeds the sparrows. She'll feed us.",
    'hunter.go.pious': 'Thanks to Diana for the beast that feeds us.',
    'fisher.ready.pious': 'Neptune gives the catch. A share is his.',
    'miner.ready.pious': 'Even the stones remember the gods.',
    'miner.go.pious': "I dig for Jupiter's temple and my neighbour's roof.",
    'builder.ready.pious': 'Unless the household gods keep it, we toil for nothing.',
    ...keeper('temple', 'An offering', 'Omens read'),
    'healer.ready.decadent': 'The gods are hungry. Feed them.',
  },
  japanese: {
    'farmer.ready.pious': 'The kami send the rain; I bring the plough.',
    'forager.ready.pious': "The Buddha's mercy reaches the sparrows. And us.",
    'hunter.go.pious': 'Thanks to the mountain kami for this beast.',
    'fisher.ready.pious': 'The sea kami give, and we give thanks.',
    'miner.ready.pious': 'Even the stones have their kami.',
    'miner.go.pious': "I dig for the shrine and my neighbour's roof.",
    'builder.ready.pious': 'Purify the ground first, then raise the house.',
    'cleric.ready.pious': 'Be at peace, child. What troubles you?',
    ...keeper('shrine', 'Coin in the box', 'Charms and blessings'),
    'cleric.go.plain': 'To the shrine.',
  },
  chinese: {
    'farmer.ready.pious': 'Heaven sends the rain; I bring the plough.',
    'forager.ready.pious': 'Heaven feeds the sparrows. It will feed us.',
    'hunter.go.pious': 'Thanks to Heaven for the beast that feeds us.',
    'fisher.ready.pious': 'The river spirits give. Burn them incense.',
    'miner.ready.pious': 'Even the mountains bow to Heaven.',
    'miner.go.pious': "I dig for the ancestors' hall and my neighbour's roof.",
    'builder.ready.pious': 'Unless Heaven wills it, we toil for nothing.',
    ...keeper('shrine', 'Incense money', 'Fortunes told'),
    'cleric.go.plain': 'To the shrine.',
  },
  tengri: {
    'farmer.ready.pious': 'The Blue Sky sends the rain; I bring the plough.',
    'forager.ready.pious': "Mother Earth feeds the sparrows. She'll feed us.",
    'hunter.go.pious': 'Thanks to the Sky for the beast that feeds us.',
    'fisher.ready.pious': 'Ask the water spirits before you take.',
    'miner.ready.pious': 'Even the stones lie under the Eternal Sky.',
    'miner.go.pious': "I dig for the cairn of offerings and my neighbour's roof.",
    'builder.ready.pious': 'Unless the Sky wills it, we toil for nothing.',
    ...keeper('sacred grove', 'Coin for the spirits', 'Spirits soothed'),
    'cleric.go.plain': 'To the sacred grove.',
    'healer.ready.decadent': 'The spirits are hungry. Feed them.',
  },
  norse: {
    'farmer.ready.pious': 'Thor sends the rain; I bring the plough.',
    'forager.ready.pious': "Freyr feeds the land. He'll feed us.",
    'hunter.go.pious': 'Thanks to Ullr for the beast that feeds us.',
    'fisher.ready.pious': 'Njord fills the nets. Give him his share.',
    'miner.ready.pious': "Even the stones were Ymir's bones.",
    'miner.go.pious': "I dig for the gods' hall and my neighbour's roof.",
    'builder.ready.pious': 'Unless the gods keep the roof, we toil for nothing.',
    ...keeper('sacred grove', 'Silver for the gods', 'Runes cast'),
    'healer.ready.decadent': 'The gods are hungry. Feed them.',
    'cleric.go.plain': 'To the sacred grove.',
  },
};

/** The line as this people says it where the script's speaks of faith; undefined where the script's own stands. (No
 * role of the script speaks of faith in the barmaid's lines, so a woman at the tavern is never in it.) */
export function inFaith(role: string, moment: FolkMoment, lean: Lean, civ: string | undefined): string | undefined {
  const b = beliefOf(civ);
  return b === 'christian' ? undefined : FAITH_LINES[b][`${role}.${moment}.${lean}`];
}

/** The name of the recording of a line (`key`, folk.ts folkKey): the script's, or for a line said in another faith, the script's and the faith. */
export function faithKey(key: string, role: string, moment: FolkMoment, lean: Lean, civ: string | undefined): string {
  return inFaith(role, moment, lean, civ) === undefined ? key : `${key}_${beliefOf(civ)}`;
}

/** Every line said in another faith, for the voice booth and the script: the faith, where it falls in the script, and the words. */
export function faithVariants(): { belief: Exclude<Belief, 'christian'>; role: string; moment: FolkMoment; lean: Lean; text: string }[] {
  const out: ReturnType<typeof faithVariants> = [];
  for (const [belief, said] of Object.entries(FAITH_LINES) as [Exclude<Belief, 'christian'>, Said][]) {
    for (const [k, text] of Object.entries(said)) {
      const [role, moment, lean] = k.split('.') as [string, FolkMoment, Lean];
      out.push({ belief, role, moment, lean, text: text! });
    }
  }
  return out;
}
