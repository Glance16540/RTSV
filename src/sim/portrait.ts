// Portraits: which woodblock icon stands beside a person, and which marks sit over it (docs/DESIGN.md, "Icons tell
// status"). Icons are the only way the game shows feeling, so this is where a person's state is read as one.
// Nothing here draws: it chooses keys of public/assets/icons/ (see scripts/icon-sheets.json for what each one is),
// best first, and src/client/portrait.ts draws the first that is there.
//
//   a villager        <nation>_<body>_<feeling>        their people, the one body they keep for life, how they are
//   a soldier, a ship <nation>_<unit id>, then <unit id>
//   a captive         <their nation>_captive_<m|f>     held by a rival people: clothed, bound
//                     <their nation>_enslaved_<m|f>_<1|2|3>, <their nation>_enslaved_<m|f>, status_enslaved_<m|f>
//                                                      held by slavers or marauders
//   a town            <nation>_<man|woman|soldier|tavern>_<holy|plain|worldly|low>   its standing, not anyone's feeling
//   a condition       status_*, drawn small over any of these
//
// Where feeling and standing meet: a person's own row (the selected unit, a notable) shows their feeling, because
// that is about them; a town's header shows its standing, because that is about all of them. The marks of
// condition go over either. Children are never shown (DESIGN.md): no child is given a portrait, and no key here
// names one.
import type { Building, Captive, Game, Unit } from './game';
import type { Campaign } from './campaign';
import { CHAMPION_KILLS } from './champion';
import { want } from './famine';
import { folkOf } from './township';

export const NATIONS = ['wild', 'england', 'hearth', 'stonekin', 'greece', 'dawn', 'babylon', 'persia', 'arabs', 'egypt', 'steppe', 'forge', 'japan', 'mali', 'kush'] as const;
export type Sex = 'm' | 'f';
export type Body = 'woman_full' | 'woman_slender' | 'man_broad' | 'man_lean';
export type Feeling = 'content' | 'afraid' | 'grief' | 'angry';
export type Standing = 'holy' | 'plain' | 'worldly' | 'low';
/** A person's condition, drawn as a small mark over the portrait. */
export type Mark = 'wounded' | 'maimed' | 'captive' | 'led' | 'freed' | 'sick' | 'starving' | 'grieving' | 'old' | 'veteran' | 'towar' | 'deserter' | 'rebel' | 'drunk';
/** Who holds a captive: a rival people (who would make them its own) or slavers and marauders (who work them). */
export type Captor = 'rival' | 'slaver';

/** The marks in the order they matter: when there is room for only a few, the first are drawn. */
export const MARK_ORDER: Mark[] = ['captive', 'led', 'rebel', 'deserter', 'wounded', 'maimed', 'sick', 'starving', 'grieving', 'drunk', 'freed', 'towar', 'veteran', 'old'];
const MARK_KEY: Record<Exclude<Mark, 'captive'>, string> = {
  wounded: 'status_wounded', maimed: 'status_maimed', led: 'status_led', freed: 'status_freed', sick: 'status_plague', starving: 'status_hunger',
  grieving: 'status_grief', old: 'status_elder', veteran: 'status_veteran', towar: 'status_towar', deserter: 'status_deserter', rebel: 'status_rebel', drunk: 'status_drunk',
};
/** The icon of a mark. A captive's mark is drawn as a man or a woman. */
export const markKey = (m: Mark, sex: Sex = 'm'): string => (m === 'captive' ? `status_captive_${sex}` : MARK_KEY[m]);
/** What a mark means, in words, for the picture's tooltip. */
export const MARK_WORDS: Record<Mark, string> = {
  wounded: 'wounded', maimed: 'maimed', captive: 'captive', led: 'being led away', freed: 'freed', sick: 'sick', starving: 'starving', grieving: 'grieving',
  old: 'old', veteran: 'a veteran', towar: 'gone to war', deserter: 'a deserter', rebel: 'in revolt', drunk: 'drunk',
};
export const FEELING_WORDS: Record<Feeling, string> = { content: 'content', afraid: 'afraid', grief: 'grieving', angry: 'angry' };
export const STANDING_WORDS: Record<Standing, string> = { holy: 'devout', plain: 'ordinary', worldly: 'worldly', low: 'decadent' };

/** What a portrait shows: the keys to try, best first, and the marks over it. */
export interface Portrait { keys: string[]; marks: Mark[]; sex?: Sex; feeling?: Feeling; body?: Body; nation: string; words: string }

const NEVER = /child|baby|infant|kid/;
/** Keys a portrait may use: never one of a child. */
const clean = (keys: string[]): string[] => keys.filter((k, i) => k && !NEVER.test(k) && keys.indexOf(k) === i);
/** The first of `keys` that `has` says is there, or null. */
export function pickKey(keys: string[], has: (key: string) => boolean): string | null {
  return clean(keys).find(has) ?? null;
}

/** A people the icons know, or '' (beasts, marauders and anyone of no people). */
export const nationOf = (civ: string | undefined): string => ((NATIONS as readonly string[]).includes(civ ?? '') ? civ! : '');

const hashOf = (seed: number | string): number => {
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
  return h >>> 0;
};
/** The one body a person keeps for life, picked steadily from who they are. */
export function bodyOf(sex: Sex, seed: number | string): Body {
  const odd = hashOf(seed) % 2 === 1;
  return sex === 'f' ? (odd ? 'woman_slender' : 'woman_full') : (odd ? 'man_lean' : 'man_broad');
}
/**
 * What a body is seeded by: a person's name and family where they have one, otherwise their id. A unit's id is new
 * each time a person is made again (carried off and freed, brought into the next battle), and their name is not.
 */
export const seedOf = (u: { id: number; name?: string; family?: string }): number | string => (u.name ? `${u.name}|${u.family ?? ''}` : u.id);

/** The town's standing between church and tavern, on the same lines as the rules' (creed.ts: holy at 30, decadent at -70). */
export function standingOf(virtue: number): Standing {
  return virtue >= 30 ? 'holy' : virtue > -30 ? 'plain' : virtue > -70 ? 'worldly' : 'low';
}

/** What is known of how a person is. Any of these may be left out. */
export interface Mood {
  /** Wronged: held, newly taken into another people, in revolt, or resentful. */
  captive?: boolean; conquered?: boolean; rebel?: boolean; wronged?: boolean;
  /** In danger: raided, sick, or going without food. */
  raided?: boolean; sick?: boolean; starving?: boolean;
  /** Has lost someone of their own. */
  bereaved?: boolean;
}
/**
 * The face a person wears. Wrong done to them shows first (it is about them, and lasts); then fear of what is
 * happening now; then grief; and fed and safe, content.
 */
export function feelingOf(m: Mood): Feeling {
  if (m.captive || m.conquered || m.rebel || m.wronged) return 'angry';
  if (m.raided || m.sick || m.starving) return 'afraid';
  if (m.bereaved) return 'grief';
  return 'content';
}

/** An ordinary person of a people: their body and feeling, then plainer pictures of them if those are missing. */
export function personKeys(nation: string, sex: Sex, body: Body, feeling: Feeling): string[] {
  const plain = [`villager_${sex}`, 'villager'];
  if (!nation) return plain;
  return clean([`${nation}_${body}_${feeling}`, `${nation}_${body}_content`, `${nation}_${sex === 'f' ? 'woman' : 'man'}_plain`, ...plain]);
}
/** A soldier, a ship, an engine: as drawn by their people, else the one picture of it. */
export function unitKeys(nation: string, unitId: string): string[] {
  return clean(nation ? [`${nation}_${unitId}`, unitId] : [unitId]);
}
/** A town's standing, as one of its people (a man, a woman, a soldier, a woman of the tavern). */
export function standingKeys(nation: string, who: 'man' | 'woman' | 'soldier' | 'tavern', st: Standing): string[] {
  const after = who === 'tavern' ? ['milkmaid'] : who === 'woman' ? ['villager_f'] : who === 'man' ? ['villager_m'] : ['spearman'];
  return clean(nation ? [`${nation}_${who}_${st}`, `${nation}_${who}_plain`, ...after] : after);
}
/** Which of the three slavers' captives a body is: a full-figured woman 1, a slender one 3; a broad man 1, a lean one 2, or 3 when old. */
export function enslavedNumber(body: Body, old = false): 1 | 2 | 3 {
  return body === 'woman_full' || body === 'man_broad' ? 1 : body === 'woman_slender' ? 3 : old ? 3 : 2;
}
/** A captive, as their own people, by who holds them. */
export function captiveKeys(nation: string, sex: Sex, captor: Captor, body: Body, old = false): string[] {
  if (captor === 'rival') return clean([nation && `${nation}_captive_${sex}`, `status_captive_${sex}`, 'captive']);
  return clean([nation && `${nation}_enslaved_${sex}_${enslavedNumber(body, old)}`, nation && `${nation}_enslaved_${sex}`, `status_enslaved_${sex}`, 'captive']);
}

const sorted = (marks: Iterable<Mark>): Mark[] => MARK_ORDER.filter((m) => new Set(marks).has(m));
const words = (lead: string, marks: Mark[]): string => [lead, ...marks.map((m) => MARK_WORDS[m])].filter(Boolean).join(', ');

/** Seconds after being taken into another people that a person still counts as newly conquered. */
export const CONQUERED_FOR = 300;
/** How near, and how lately, an attack on their people makes a person afraid. */
export const RAID_NEAR = 16, RAID_FOR = 30;

/** A person's home, if they have one standing. */
const homeOf = (g: Game, u: Unit): Building | null => {
  const h = g.entities.get(u.homeId);
  return h && h.kind === 'building' && !h.dead ? h : null;
};
/**
 * How a person in a battle is, read from what the rules already keep. Some of this is a guess, because nothing
 * keeps it outright:
 *   bereaved   alone in a house that has raised children: the other of the couple is gone (dead, or taken).
 *   conquered  their record's last line is being taken into this people, within CONQUERED_FOR seconds.
 *   raided     their people were attacked within RAID_FOR seconds and RAID_NEAR tiles of them, or the bell is rung.
 */
export function moodOf(g: Game, u: Unit): Mood {
  const p = g.players[u.owner];
  const last = u.story?.[u.story.length - 1];
  const hit = p?.lastAttacked;
  const home = homeOf(g, u);
  const partner = home ? (u.gender === 'f' ? home.residents.m : home.residents.f) : -1;
  return {
    conquered: !!last && last.s.startsWith('Taken into') && g.time - last.t < CONQUERED_FOR,
    raided: !!p && (p.bell || (!!hit && g.time - hit.t < RAID_FOR && Math.hypot(hit.x - u.x, hit.y - u.y) < RAID_NEAR)),
    sick: u.plagueT > 0,
    starving: !!p && !p.neutral && want(p) !== '',
    bereaved: !!home && home.type === 'house' && partner === 0 && home.children > 0,
  };
}
/** The marks of condition on a person in a battle. Maimed, deserter and gone to war are not kept by the battle's rules. */
export function marksOf(g: Game, u: Unit, mood: Mood = moodOf(g, u)): Mark[] {
  const p = g.players[u.owner];
  const m: Mark[] = [];
  if (u.hp > 0 && u.hp < u.maxHp * 0.5) m.push('wounded');
  if (u.plagueT > 0) m.push('sick');
  if (p && !p.neutral && want(p) === 'famine') m.push('starving');
  if (mood.bereaved) m.push('grieving');
  if (g.isElder(u)) m.push('old');
  if ((u.kills ?? 0) >= CHAMPION_KILLS || (u.hero?.rank ?? 0) > 0) m.push('veteran');
  if (u.freed) m.push('freed');
  const at = g.entities.get(u.inside);
  if (at && at.kind === 'building' && at.type === 'tavern' && u.gender === 'm') m.push('drunk');
  return sorted(m);
}

/** The portrait of anyone on a battlefield, or null for one who is never shown (a child). */
export function unitPortrait(g: Game, u: Unit): Portrait | null {
  if (u.growT > 0) return null;
  const owner = g.players[u.owner];
  // A person keeps their own people even when taken into another; a marauder belongs to none.
  const nation = u.def.marauder ? '' : nationOf(u.people ?? owner?.civ);
  if (u.type === 'villager' && u.gender) {
    const mood = moodOf(g, u), feeling = feelingOf(mood), body = bodyOf(u.gender, seedOf(u)), marks = marksOf(g, u, mood);
    return { keys: personKeys(nation, u.gender, body, feeling), marks, sex: u.gender, feeling, body, nation, words: words(FEELING_WORDS[feeling], marks) };
  }
  const marks = marksOf(g, u);
  return { keys: unitKeys(nation, u.type), marks, sex: u.gender ?? undefined, nation, words: words('', marks) };
}

/** The portrait of someone held. `led`: still on the road to where they will be kept. */
export function captivePortrait(g: Game, c: Captive, captor: Captor, led = false): Portrait {
  const nation = nationOf(c.people ?? g.players[c.from]?.civ), body = bodyOf(c.gender, seedOf({ id: 0, name: c.name, family: c.family }));
  const old = c.lifespan > 0 && g.aging && c.age > c.lifespan * 0.75;
  const marks = sorted([...(led ? ['led' as const] : ['captive' as const]), ...(old ? ['old' as const] : [])]);
  return { keys: captiveKeys(nation, c.gender, captor, body, old), marks, sex: c.gender, feeling: 'angry', body, nation, words: words(captor === 'rival' ? 'held by a rival people' : 'held as a slave', marks) };
}
/** Who holds a captive being led by `u`, or kept in `b`. */
export const captorOf = (x: Unit | Building): Captor => (x.kind === 'unit' ? (x.def.slaver ? 'slaver' : 'rival') : 'slaver');

/** How the people of a town on the campaign map are, from what has happened there lately. */
export function townMood(c: Campaign, tid: number): Mood & { lost: boolean } {
  const now = (c.events ?? []).filter((e) => e.at === tid && e.until >= c.turn - 1);
  const has = (...k: string[]): boolean => now.some((e) => k.includes(e.kind));
  const t = c.territories[tid];
  const lost = folkOf(c, tid).notables.some((n) => n.lost && n.lost.turn >= c.turn - 1);
  return {
    rebel: has('unrest', 'revolt'),
    raided: has('raiders', 'taken', 'overrun', 'horde', 'blaze'),
    sick: has('plague', 'fever'),
    starving: has('famine', 'hard'),
    bereaved: lost || (t.taken ?? 0) > 0,
    lost,
  };
}
/** The marks a whole town's people share on the campaign map. */
export function townMarks(m: Mood): Mark[] {
  return sorted([...(m.rebel ? ['rebel' as const] : []), ...(m.sick ? ['sick' as const] : []), ...(m.starving ? ['starving' as const] : []), ...(m.bereaved ? ['grieving' as const] : [])]);
}
/** One of a town's notable people, as the campaign keeps them, in the town's present mood. */
export function notablePortrait(nation: string, n: { name: string; family?: string; gender: Sex; kind: string; unit?: string }, mood: Mood): Portrait {
  const feeling = feelingOf(mood), body = bodyOf(n.gender, seedOf({ id: 0, name: n.name, family: n.family }));
  const keys = n.kind === 'veteran' && n.unit ? [...unitKeys(nation, n.unit), ...personKeys(nation, n.gender, body, feeling)] : personKeys(nation, n.gender, body, feeling);
  const marks: Mark[] = n.kind === 'veteran' ? ['veteran'] : [];
  return { keys: clean(keys), marks, sex: n.gender, feeling, body, nation, words: words(n.kind === 'veteran' ? '' : FEELING_WORDS[feeling], marks) };
}
/** A town's standing, as a man and a woman of it. */
export function townStanding(nation: string, virtue: number): { standing: Standing; man: string[]; woman: string[] } {
  const st = standingOf(virtue);
  return { standing: st, man: standingKeys(nation, 'man', st), woman: standingKeys(nation, 'woman', st) };
}
