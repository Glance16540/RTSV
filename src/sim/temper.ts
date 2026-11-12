// A leader's temperament, as answered by whoever plays them in the voice booth. It steers how the
// computer plays that nation: in battle, in matters of faith, and on the campaign map.
// A nation with no temperament set plays as it was written.

/** Each from -1 to 1. */
export interface Temperament {
  /** -1 peaceable … 1 warlike */
  war: number;
  /** -1 worldly … 1 pious */
  faith: number;
  /** -1 roams and raids … 1 digs in behind walls */
  fort: number;
  /** -1 open-handed, keeps their word … 1 grasping */
  greed: number;
}
export const TEMPER_AXES: (keyof Temperament)[] = ['war', 'faith', 'fort', 'greed'];

/** A question put to the leader, and what each answer says about them. */
export interface TemperQuestion { id: string; ask: string; answers: { say: string; move: Partial<Temperament> }[] }
export const TEMPER_QUESTIONS: TemperQuestion[] = [
  { id: 'border', ask: 'A neighbour has left a border town poorly guarded.', answers: [
    { say: 'Take it before someone else does.', move: { war: 1 } },
    { say: 'Watch it, and wait for a reason.', move: { war: 0 } },
    { say: 'Leave it be. I have enough.', move: { war: -1, greed: -0.5 } },
  ] },
  { id: 'truce', ask: 'You are winning a war, and the enemy sues for peace.', answers: [
    { say: 'No. I finish what I start.', move: { war: 1 } },
    { say: 'Peace has a price. Let them pay it.', move: { greed: 1 } },
    { say: 'Gladly. Enough have died.', move: { war: -1 } },
  ] },
  { id: 'harvest', ask: 'The harvest is good and there is coin to spare. What do you build?', answers: [
    { say: 'A church, and give thanks.', move: { faith: 1 } },
    { say: 'A tavern. The people have earned a drink.', move: { faith: -1 } },
    { say: 'Barracks. Good years do not last.', move: { war: 0.5, faith: 0 } },
  ] },
  { id: 'plague', ask: 'Plague comes to your town.', answers: [
    { say: 'Call the people to prayer and fasting.', move: { faith: 1 } },
    { say: 'Fetch physicians, whoever they pray to.', move: { faith: 0 } },
    { say: 'Seal the gates and let it burn out. Trade must go on.', move: { faith: -1, greed: 0.5 } },
  ] },
  { id: 'strength', ask: 'Where does your strength lie?', answers: [
    { say: 'Behind high walls that no one has climbed.', move: { fort: 1 } },
    { say: 'In a strong town and an army ready to leave it.', move: { fort: 0 } },
    { say: 'In the saddle, wherever the enemy is not looking.', move: { fort: -1 } },
  ] },
  { id: 'siege', ask: 'An enemy host is marching on your capital.', answers: [
    { say: 'Man the walls and let them break on us.', move: { fort: 1 } },
    { say: 'Ride out and meet them in the open.', move: { fort: -1, war: 0.5 } },
    { say: 'Burn the fields, fall back, and strike their homeland instead.', move: { fort: -1 } },
  ] },
  { id: 'tribute', ask: 'A weaker neighbour has gold. You have soldiers.', answers: [
    { say: 'They will pay me to stay home.', move: { greed: 1 } },
    { say: 'Trade with them fairly.', move: { greed: -1 } },
    { say: 'Why ask for some when I can take it all?', move: { greed: 1, war: 1 } },
  ] },
  { id: 'word', ask: 'You gave your word, and keeping it has become costly.', answers: [
    { say: 'I keep it. An oath is an oath.', move: { greed: -1, faith: 0.5 } },
    { say: 'I keep it, and I remember who made it costly.', move: { greed: 0 } },
    { say: 'Words are wind. I do what serves my people.', move: { greed: 1, faith: -0.5 } },
  ] },
];

const clamp = (n: unknown): number => (typeof n === 'number' && isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0);

/** The temperament a set of answers describes (answer index per question id; unanswered questions are skipped), or null if none were answered. */
export function temperFrom(answers: Record<string, number>): Temperament | null {
  const sum = { war: 0, faith: 0, fort: 0, greed: 0 }, n = { war: 0, faith: 0, fort: 0, greed: 0 };
  let any = false;
  for (const q of TEMPER_QUESTIONS) {
    const a = q.answers[answers[q.id]];
    if (!a) continue;
    any = true;
    for (const k of TEMPER_AXES) if (a.move[k] !== undefined) { sum[k] += a.move[k]!; n[k]++; }
  }
  if (!any) return null;
  const out = { war: 0, faith: 0, fort: 0, greed: 0 };
  for (const k of TEMPER_AXES) out[k] = n[k] ? Math.round(clamp(sum[k] / n[k]) * 100) / 100 : 0;
  return out;
}

/** A word for where someone stands on each axis. */
export const TEMPER_WORDS: Record<keyof Temperament, [string, string, string]> = {
  war: ['Peaceable', 'Measured', 'Warlike'],
  faith: ['Worldly', 'Of two minds', 'Pious'],
  fort: ['Roams and raids', 'Town and army', 'Digs in'],
  greed: ['Open-handed', 'Fair', 'Grasping'],
};
export const temperWord = (axis: keyof Temperament, v: number): string => TEMPER_WORDS[axis][v > 0.33 ? 2 : v < -0.33 ? 0 : 1];

const set = new Map<string, Temperament>();
/** Give a nation's leader a temperament, or with `null` return them to how they were written. */
export function setTemperament(civ: string, t: Partial<Temperament> | null | undefined): void {
  if (!t || typeof t !== 'object') { set.delete(civ); return; }
  set.set(civ, { war: clamp(t.war), faith: clamp(t.faith), fort: clamp(t.fort), greed: clamp(t.greed) });
}
export const temperOf = (civ: string): Temperament | undefined => set.get(civ);

/** How this nation's leaning toward piety (0 worldly … 1 pious) reads once their temperament is known. */
export const leaningWith = (civ: string, written: number): number => {
  const t = set.get(civ);
  return t ? 0.5 + 0.42 * t.faith : written;
};

/** A campaign leader's habits (caution in attack, taste for forts and farms, openness to peace, greed) once their temperament is known. */
export function habitsWith<T extends { margin: number; fort: number; farm: number; peace: number; greed: number }>(civ: string, written: T): T {
  const t = set.get(civ);
  if (!t) return written;
  return {
    ...written,
    margin: t.war > 0.33 ? -1 : t.war < -0.33 ? 1 : 0,
    peace: 0.5 - 0.3 * t.war,
    fort: Math.max(0.02, 0.3 + 0.35 * t.fort),
    farm: 0.5 + 0.15 * t.fort - 0.15 * t.war,
    greed: Math.max(0.02, 0.2 + 0.22 * t.greed),
  };
}

/** How a temperament changes the computer's play in a battle: when it first attacks, how large an army it wants, and whether it walls its town. */
export function battleHabits(civ: string): { haste: number; army: number; walls: 'never' | 'usual' | 'early' } {
  const t = set.get(civ);
  if (!t) return { haste: 1, army: 1, walls: 'usual' };
  return {
    haste: 1 - 0.3 * t.war - (t.fort < -0.33 ? 0.1 : 0),
    army: 1 + 0.15 * t.war,
    walls: t.fort > 0.33 ? 'early' : t.fort < -0.33 ? 'never' : 'usual',
  };
}
