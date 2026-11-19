// A defied rival king may declare war (docs/DESIGN.md, "Relationships": the leader's household can be threatened;
// docs/CLOSING.md, before the move, 9: "a rival king's threats lead neither to war nor to a raid on the court").
//
// When a rival king who threatened the leader's house is defied, his people hold a feud (aftermath.ts): no goodwill, and
// they come for the player first, for sixteen seasons. But a truce or an alliance sworn before the quarrel still bound
// him, and the player could buy a new truce the season after: a feud with a people one is at peace with is no feud.
// So, as the feud begins, he may declare war (FEUDWAR.chance, by a chance of its own):
//   - any truce with the player is at an end, and an alliance with him is broken, by his act and not the player's
//     (the player's honour is not touched);
//   - while the feud runs he will hear of no truce (campaign.ts `offerTruce` asks `atWarWith`);
//   - it is told as the season's news, written in the chronicle, and kept on the feud's mark (`war`), which the
//     land's panel and the roll already show by its words.
// When the feud runs out the war is over: he may be treated with again. Nothing else is new: how he fights is the feud's
// own rule (he is angry, and comes for the player first).
//
// A king who is defied and does not declare war is as before. Only the player's feuds are weighed: truces are the player's.
import type { Campaign } from './campaign';
import type { Mark } from './aftermath';
import { chance } from './intriguebase';

declare module './aftermath' {
  interface Mark { /** A feud in which the rival king has declared war (feudwar.ts). */ war?: boolean }
}

export const FEUDWAR = {
  /** The chance that a rival king, defied, declares war as the feud begins. */
  chance: 0.5,
};

/**
 * A feud has just begun: the rival king may declare war. Ends any truce or alliance between him and the player, marks
 * the feud, and tells it. Returns whether he did. `sure` forces it (for the tests, and for whoever would have it so).
 */
export function mayDeclareWar(c: Campaign, m: Mark | undefined, sure = false): boolean {
  if (!m || m.kind !== 'feud' || m.owner !== 0 || m.rival === undefined || m.war) return false;
  const r = c.factions[m.rival];
  if (!r?.alive) return false;
  if (!sure && chance(c, m.story * 211 + 7) >= FEUDWAR.chance) return false;
  m.war = true;
  const sworn = c.ally === m.rival, bound = sworn || c.truces.some((t) => t.with === m.rival && t.until >= c.turn);
  if (sworn) c.ally = -1;
  c.truces = c.truces.filter((t) => t.with !== m.rival);
  const king = m.name ?? 'The rival king';
  const text = `${king} of the ${r.name} has declared war on you${bound ? `, and ${sworn ? 'your alliance' : 'the truce between you'} is at an end` : ''}. He will hear of no truce until it is forgotten.`;
  m.text = `${m.text} He has declared war.`;
  (c.intrigueNews ??= []).push({ turn: c.turn, id: m.story, kind: m.from, at: c.territories.find((t) => t.capital === 0)?.id ?? 0, owner: 0, tone: 'bad', text });
  c.log.push(text);
  (c.chronicle ??= []).push({ turn: c.turn, text: `${king} of the ${r.name}, defied, declared war.` });
  return true;
}

/** Is this rival people at war with the player by a feud still running? Then they will hear of no truce. */
export const atWarWith = (c: Campaign, rival: number): boolean => (c.marks ?? []).some((m) => m.kind === 'feud' && m.war && m.owner === 0 && m.rival === rival && m.until >= c.turn);
/** The season the war is forgotten, if there is one. */
export const warUntil = (c: Campaign, rival: number): number | undefined => (c.marks ?? []).filter((m) => m.kind === 'feud' && m.war && m.owner === 0 && m.rival === rival && m.until >= c.turn).map((m) => m.until).sort((a, b) => b - a)[0];
