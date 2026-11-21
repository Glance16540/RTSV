// The cases a town's Hall of Judgement hears in person (docs/DESIGN.md, rule and law; hallfield.ts is the field's side).
//
// What waits on the leader's judgement in a town of the player's with a Hall standing, as the map already has it:
//   - a thief taken and held for judgement there (intrigue.ts): set to work it off, pardoned, banished or hanged;
//   - a killer seized there by the player's soldiers and held (killerseized.ts): hanged or banished;
//   - a plotter laid bare, of a noble of the town (courtstory.ts): pardoned or put to death;
//   - a noble of the town come with a petition (petitions.ts): granted or refused.
// `hallCasesAt` hands them to the sitting as words and answers; `hallFromSitting` gives the rulings that come back, each
// only if the case is still waiting and the map would offer that answer now with nothing barring it, and then by the map's
// own rule (intrigue.ts choose, petitions.ts grant and refuse), so that it costs and does exactly what it would from the
// map. A battle for the town hears them as a visit does. Every one of them is grown: no child is ever a case.
import type { Campaign } from './campaign';
import { hallAt } from './hall';
import { choicesFor, choose, fullName, openIntrigues } from './intrigue';
import type { Intrigue } from './intriguebase';
import { noblesOf, titleOf } from './nobles';
import { grant, grantBar, petitionAt, petitionText, refuse } from './petitions';
import type { HallCase } from './hallfield';

declare module './campaign' {
  interface BattleAfter { /** The rulings given at the town's Hall of Judgement in the battle (`hallOut`, hallfield.ts). */ hall?: unknown }
}

const THIEF = ['work', 'pardon', 'banish', 'hang'];
const PLOT = ['pardon', 'death'];
const KILLER = ['hang', 'banish'];

/** The town a plot is judged in: its plotter's own town, else where the court was. */
const plotTown = (c: Campaign, it: Intrigue): number => {
  const key = it.nobles?.[it.culprit]?.key;
  return (key ? noblesOf(c, it.owner).find((n) => n.key === key)?.town : undefined) ?? it.at;
};
const killerHere = (it: Intrigue, tid: number): boolean => it.kind === 'killer' && it.at === tid && it.held !== undefined;
const thiefHere = (it: Intrigue, tid: number): boolean => it.kind === 'thief' && it.at === tid && it.caught !== undefined && !!it.thief;
const plotHere = (c: Campaign, it: Intrigue, tid: number): boolean => it.kind === 'plot' && !!it.found && !it.claim && plotTown(c, it) === tid && choicesFor(c, it).some((x) => x.id === 'death');

/** The cases waiting on the player's judgement in this town, for its Hall; none where no Hall stands or it is not theirs. */
export function hallCasesAt(c: Campaign, tid: number): HallCase[] {
  const t = c.territories[tid];
  if (!t || t.owner !== 0 || !hallAt(c, tid)) return [];
  const out: HallCase[] = [];
  for (const it of openIntrigues(c, 0)) {
    if (thiefHere(it, tid)) {
      const p = it.thief!;
      out.push({ id: `story:${it.id}`, kind: 'thief', who: fullName(p), text: `${fullName(p)} the ${p.trade}, taken for the robberies${it.why ? ` (${it.why === 'hunger' ? 'out of hunger' : it.why === 'widow' ? 'a widow with nothing' : it.why === 'drink' ? 'for drink' : 'out of greed'})` : ''}, waits on your judgement.`,
        answers: choicesFor(c, it).filter((x) => THIEF.includes(x.id)).map((x) => ({ id: x.id, label: x.label, ...(x.bar ? { bar: x.bar } : {}) })) });
    } else if (killerHere(it, tid)) {
      const p = it.people[it.held!];
      out.push({ id: `story:${it.id}`, kind: 'killer', who: fullName(p), text: `${fullName(p)} the ${p.trade}, seized by your soldiers, has confessed to the ${it.victims.length === 1 ? 'death' : `${it.victims.length} deaths`} in the town, and waits on your judgement.`,
        answers: choicesFor(c, it).filter((x) => KILLER.includes(x.id)).map((x) => ({ id: x.id, label: x.label, ...(x.bar ? { bar: x.bar } : {}) })) });
    } else if (plotHere(c, it, tid)) {
      const p = it.nobles![it.culprit];
      out.push({ id: `story:${it.id}`, kind: 'plotter', who: p.title, text: `${p.title}, who plotted to take your place, is held for your judgement.`,
        answers: choicesFor(c, it).filter((x) => PLOT.includes(x.id)).map((x) => ({ id: x.id, label: x.label, ...(x.bar ? { bar: x.bar } : {}) })) });
    }
  }
  const pet = petitionAt(c, 0, tid), n = pet ? noblesOf(c, 0).find((x) => x.key === pet.key) : undefined;
  if (pet && n) {
    const bar = grantBar(c, 0);
    out.push({ id: `petition:${pet.id}`, kind: 'petition', who: titleOf(c, n), text: `${titleOf(c, n)} asks ${petitionText(c, 0, pet)}`, answers: [{ id: 'grant', label: 'Grant the petition', ...(bar ? { bar } : {}) }, { id: 'refuse', label: 'Refuse it' }] });
  }
  return out;
}

/** The rulings given at the Hall come back: each given by the map's own rule, if the case still waits and the answer stands. Returns how many were given. */
export function hallFromSitting(c: Campaign, tid: number, raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  let k = 0;
  for (const r of raw.slice(0, 12) as { id?: unknown; answer?: unknown }[]) {
    const id = typeof r?.id === 'string' ? r.id : '', answer = typeof r?.answer === 'string' ? r.answer : '';
    const now = hallCasesAt(c, tid).find((x) => x.id === id), a = now?.answers.find((x) => x.id === answer);
    if (!now || !a || a.bar) continue; // no longer waiting, or the map would not give it now
    if (now.kind === 'petition') { if (answer === 'grant' ? grant(c, 0) === '' : refuse(c, 0)) k++; }
    else if (choose(c, Number(id.split(':')[1]), answer)) k++;
  }
  return k;
}
