// Meeting them face to face (docs/DESIGN.md, the owner's word, 16 November 2026). When an army runs into a band, or a
// decision comes up in a story of the leader's (a suitor, a rival king's envoy, a plotter found, a thief brought for
// judgement), a window opens over the map with the ones met as figures. This module says who stands there: who is in
// front, how many of his men stand behind him, how each is dressed and armed, and whether a story is waiting on the
// leader's word. The figures themselves are drawn by src/client/encounter.ts.
//
// Plain data, read only: nothing here changes the campaign.
//
// No child is ever among them: a band's captives are its grown people, and those born to the women it holds are
// records and never figures (bandborn.ts). A captive stands covered, in plain long clothes.
import type { Campaign } from './campaign';
import type { Band, BandKind } from './threats';
import type { Intrigue } from './intriguebase';

/** How a figure is dressed: as a kind of soldier (a unit type of data.ts), or as one of the plain people. */
export type Dress = string;
export interface Figure {
  role: 'leader' | 'man' | 'captive' | 'asker';
  /** A unit type to dress them as ('marauder', 'slaver', ...), or 'villager', 'noble' or 'envoy'. */
  dress: Dress;
  female: boolean;
  /** Whose people they are, for their look (lookOf); '' for a band, which belongs to no nation. */
  civ: string;
  /** Picks the face, the build and the hair, the same each time it is shown. */
  seed: number;
  /** What they do while they stand there. */
  /** 'talk': speaking with his hands; 'ready': at ease with his arms; 'stand': upright, hands down; 'humble': brought before the leader, head a little bowed; 'sit': seated. */
  pose: 'talk' | 'ready' | 'stand' | 'humble' | 'sit';
  /** The kind of band they are of, for the colours of its kit. */
  band?: BandKind;
}

export const ENCOUNTER = {
  /** The most of a band's men shown behind its leader, and the strength each one stands for. */
  most: 6, per: 1.5,
  /** The most of its captives shown, at the back. */
  captives: 3,
};

/** How each kind of band goes dressed and armed: its leader, then the men in turn. */
export const BAND_DRESS: Record<BandKind, { leader: Dress; men: Dress[] }> = {
  raiders: { leader: 'berserker', men: ['marauder', 'clubman', 'javelineer'] },
  slavers: { leader: 'slaver', men: ['slaver', 'clubman', 'spearman'] },
  pirates: { leader: 'swordsman', men: ['javelineer', 'clubman', 'swordsman'] },
  highwaymen: { leader: 'swordsman', men: ['bowman', 'clubman', 'slinger'] },
  marauders: { leader: 'berserker', men: ['marauder', 'berserker', 'marauder'] },
};

/** How many of a band's men stand behind its leader: one for every `per` of its strength, from one to `most`. */
export const menShown = (strength: number): number => Math.max(1, Math.min(ENCOUNTER.most, Math.round((Number(strength) || 0) / ENCOUNTER.per)));

/** Everyone a band holds, as grown men and women (their children are records, never shown). */
export function heldOf(b: Band): { men: number; women: number } {
  let men = 0, women = 0;
  for (const h of b.held ?? []) { men += h.men.length; women += h.women.length; }
  return { men, women };
}

/** The civ of a people of the campaign, for a figure's look. */
const civ = (c: Campaign, f: number | undefined): string => (f === undefined || f < 0 ? '' : c.factions[f]?.civ ?? '');

/** Who stands there when an army meets a band: its leader in front, some of his men, and a few of those it holds. */
export function bandLineup(c: Campaign, b: Band): Figure[] {
  const d = BAND_DRESS[b.kind] ?? BAND_DRESS.raiders, seed = (k: number) => b.id * 97 + k * 13 + 5;
  const out: Figure[] = [{ role: 'leader', dress: d.leader, female: false, civ: '', seed: seed(0), pose: 'talk', band: b.kind }];
  for (let i = 0; i < menShown(b.strength); i++) out.push({ role: 'man', dress: d.men[i % d.men.length], female: false, civ: '', seed: seed(i + 1), pose: 'ready', band: b.kind });
  // Their captives, women first as a band's captives mostly are, covered and seated at the back.
  const held = heldOf(b), shown = Math.min(ENCOUNTER.captives, held.men + held.women);
  for (let i = 0; i < shown; i++) {
    const female = i < held.women;
    const from = (b.held ?? []).find((h) => (female ? h.women.length : h.men.length) > 0);
    out.push({ role: 'captive', dress: 'villager', female, civ: civ(c, from?.owner), seed: seed(20 + i), pose: 'sit' });
  }
  return out;
}

/**
 * Is this story waiting on the leader's word, as one of the four that are met face to face? A suitor at court, a
 * rival king's envoy with his demand, a plotter found out, a thief caught. The rest (a killer, a watch to set) stay on
 * the land's panel.
 */
export function awaitsWord(it: Intrigue): boolean {
  if (it.ended || it.owner !== 0) return false;
  if (it.kind === 'suitor') return true;
  if (it.kind === 'rival') return it.stage === 1;
  if (it.kind === 'plot') return !!it.found;
  if (it.kind === 'thief') return it.caught !== undefined && !!it.thief;
  if (it.kind === 'killer') return it.held !== undefined; // seized on the field, held for judgement (killerseized.ts)
  return false;
}
/** A mark for a story at the moment it waits on the leader: shown once, and again only if it comes to a new pass. */
export const wordKey = (it: Intrigue): string => `${it.id}:${it.kind}:${it.stage ?? 0}:${it.found ? 1 : 0}:${it.caught ?? -1}:${it.held ?? -1}`;

/** The one who asks: the figure shown for a story that waits on the leader's word, or null. */
export function askerOf(c: Campaign, it: Intrigue): Figure | null {
  if (!awaitsWord(it)) return null;
  const seed = it.id * 131 + 17;
  if (it.kind === 'suitor') return { role: 'asker', dress: 'noble', female: false, civ: civ(c, it.rival), seed, pose: 'stand' };
  if (it.kind === 'rival') return { role: 'asker', dress: 'envoy', female: false, civ: civ(c, it.rival), seed, pose: 'stand' };
  if (it.kind === 'plot') { const n = it.nobles?.[it.culprit]; return { role: 'asker', dress: 'noble', female: !!n?.female, civ: civ(c, 0), seed, pose: 'humble' }; }
  return { role: 'asker', dress: 'villager', female: (it.kind === 'killer' && it.held !== undefined ? it.people[it.held] : it.thief)?.gender === 'f', civ: civ(c, 0), seed, pose: 'humble' };
}
/** The stories of the player's that wait on their word, oldest first. */
export const awaiting = (c: Campaign): Intrigue[] => (c.intrigues ?? []).filter(awaitsWord);

/**
 * How the one met answers the choice made (docs/CLOSING.md, "Meeting them face to face": the figures did not answer
 * it). By the choice's own id: one pardoned, or given what they asked, bows; one set to work it off, or taken, is led
 * away; one banished, sent off, refused or defied leaves; a hanging or a death is told in words, never shown. A choice
 * not here (asking, a watch, a demand) closes the meeting as before.
 */
export type Reaction = 'bow' | 'led' | 'leave' | 'told';
export const REACTIONS: Record<string, Reaction> = {
  pardon: 'bow', give: 'bow', buy: 'bow', gifts: 'bow',
  work: 'led', march: 'led', seize: 'led',
  banish: 'leave', exile: 'leave', spurn: 'leave', decline: 'leave', defy: 'leave', yield: 'leave',
  hang: 'told', death: 'told',
};
/** The reaction to a choice, by its id ("accuse:2" reads as "accuse"), or undefined. */
export const reactionTo = (id: string): Reaction | undefined => REACTIONS[id.split(':')[0]];
/** The line the sheet says as the figure answers. `who` is the one met, by name or as "the envoy". */
export function reactionWords(r: Reaction, who: string, female = false): string {
  const they = female ? 'she' : 'he', W = who.charAt(0).toUpperCase() + who.slice(1);
  if (r === 'bow') return `${W} bows low.`;
  if (r === 'led') return `${W} is led away.`;
  if (r === 'leave') return `${W} goes, and does not look back.`;
  return `${W} is taken out. It is done before evening, and ${they} is not seen again.`;
}
