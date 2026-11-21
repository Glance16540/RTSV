// Who follows a fallen leader, and what each choice costs (docs/CLOSING.md, "Claimants to the throne": "the player's
// own succession is asked of the player before a claimant can take the throne"; the rule made whole).
//
// The order of the throne, for the player and every rival alike (`chooseSuccessor`, which the computer plays by for
// the rivals and for a player it plays):
//   1. an heir of the house of age, eldest first (dynasty.ts);
//   2. with none, a grown child of both houses by a royal marriage (bothhouses.ts);
//   3. with neither, a grown claimant who stands in arms for the throne (claimants.ts, claimantrising.ts): the towns
//      that rose for them come back as they take it;
//   4. a captain of the most seasoned armies (dynasty.ts); and failing all, a stranger hired at the capital.
// The player may choose any of them (`successionChoices`), each told with who stands and what taking them up costs:
// the house ended, a war of succession pressed by the other house for SUCCESSION.war seasons (bothhouses.ts), a rising
// left standing with its towns free, and the lords' moods (thronemoods.ts). A choice put off is no choice: with the
// line failed, a claimant in arms takes the throne as the season turns (claimantrising.ts), as before.
import type { Campaign } from './campaign';
import type { Claim as Rule } from './dynasty';
import { canSucceed, claimants, houseOf, ofAge, succeed } from './dynasty';
import { SUCCESSION, bloodClaim } from './bothhouses';
import type { Claim as Rising } from './claimants';
import { crown, standing } from './claimantrising';
import { THRONE_MOODS, setAsideMoods } from './thronemoods';

/** One way the throne may go: who, in words, and what it costs, in words. */
export interface Choice {
  kind: 'heir' | 'blood' | 'rising' | 'captain';
  name: string; female: boolean;
  /** Who they are. */
  who: string;
  /** What taking them up costs, and what it leaves standing. */
  cost: string;
  /** The rule's own claim (dynasty.ts), for an heir, a child of both houses or a captain. */
  claim?: Rule;
  /** The claimant in arms (claimants.ts), by id. */
  rising?: number;
}

const list = (names: string[]): string => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
/** No heir of the house is of age. */
const lineFailed = (c: Campaign, f: number): boolean => !houseOf(c, f).heirs.some((h) => ofAge(c, h));
/** Grown claimants standing in arms for this throne, while the line has failed: they may take it. */
const inArms = (c: Campaign, f: number): Rising[] => (lineFailed(c, f) ? standing(c, f).filter((cl) => cl.grown !== undefined && !!cl.name) : []);
const towns = (c: Campaign, cl: Rising): string[] => c.territories.filter((t) => t.free?.claimant === cl.id && t.owner < 0 && !t.horde).map((t) => t.name);

/** Everyone who could take up the rule of people `f` now, in the order of the throne, each with what it costs. */
export function successionChoices(c: Campaign, f: number): Choice[] {
  const fac = c.factions[f];
  if (!fac?.alive || fac.heroAlive) return [];
  const rules = claimants(c, f).filter((x) => canSucceed(c, f, x));
  const heirs = rules.filter((x) => x.kind === 'heir'), blood = rules.filter((x) => x.kind === 'blood'), captains = rules.filter((x) => x.kind === 'captain');
  const arms = inArms(c, f), you = f === 0;
  const theirs = (them: string): string => (you ? 'your' : `the ${fac.name}'`) + ` ${them}`;
  const out: Choice[] = [];
  for (const h of heirs) out.push({ kind: 'heir', name: h.name, female: h.female, who: h.what, cost: `The house goes on. ${theirs('lords')} take it as the order of things.`, claim: h });
  for (const b of blood) {
    const bc = bloodClaim(c, f)!, them = c.factions[bc.other];
    out.push({ kind: 'blood', name: b.name, female: b.female, who: b.what, cost: `The houses are joined in ${b.female ? 'her' : 'him'}: peace with ${bc.other === 0 ? 'you' : `the ${them.name}`} for ${SUCCESSION.peace} seasons. The lords take it as the order of things.`, claim: b });
  }
  for (const cl of arms) {
    const back = towns(c, cl), he = cl.female ? 'she' : 'he';
    out.push({
      kind: 'rising', name: cl.name!, female: !!cl.female, rising: cl.id,
      who: `${cl.name}, ${cl.female ? 'daughter' : 'son'} of ${cl.mother}, born in the house of ${cl.by}, stands in arms for the throne${back.length ? ` at ${list(back)}` : ''}.`,
      cost: `${back.length ? `${list(back)} come${back.length === 1 ? 's' : ''} back as ${he} takes the throne. ` : ''}The old house ends. ${cl.parent === 'noble' ? `${cl.by} is pleased; every other lord takes it ill (moods fall by ${THRONE_MOODS.usurper}).` : `Every lord takes it ill (moods fall by ${THRONE_MOODS.usurper}).`}`,
    });
  }
  const bloodStands = heirs.length + blood.length + arms.length > 0;
  for (const k of captains) {
    const left: string[] = [];
    if (heirs.length) left.push(`${list(heirs.map((h) => h.name.split(',')[0]))} ${heirs.length === 1 ? 'is' : 'are'} set aside.`);
    if (blood.length) { const bc = bloodClaim(c, f)!; left.push(`The ${c.factions[bc.other].name} take up the claim of ${bc.name} and press it by war for ${SUCCESSION.war} seasons.`); }
    for (const cl of arms) left.push(`The rising for ${cl.name} goes on${towns(c, cl).length ? `: ${list(towns(c, cl))} stay${towns(c, cl).length === 1 ? 's' : ''} free` : ''}.`);
    if (bloodStands) left.push(`Every lord takes the blood set aside ill (moods fall by ${THRONE_MOODS.setAside}).`);
    out.push({ kind: 'captain', name: k.name, female: k.female, who: k.what, cost: ['The old house ends.', ...left].join(' '), claim: k });
  }
  return out;
}

/** Take up one of the choices: true if they rule now. */
export function takeUp(c: Campaign, f: number, choice: Choice): boolean {
  const fac = c.factions[f];
  if (!fac?.alive || fac.heroAlive) return false;
  if (choice.kind === 'rising') {
    const cl = inArms(c, f).find((x) => x.id === choice.rising);
    if (!cl) return false;
    crown(c, cl); // the towns come back, and the lords take it as they do (thronemoods.ts)
    return !!c.factions[f].heroAlive;
  }
  if (!choice.claim || !canSucceed(c, f, choice.claim)) return false;
  const bloodStood = choice.kind === 'captain' && successionChoices(c, f).some((x) => x.kind !== 'captain');
  if (!succeed(c, f, choice.claim)) return false;
  if (bloodStood) setAsideMoods(c, f);
  return true;
}

/** A people the computer plays settles its succession by the order of the throne: the first who can take it up. */
export function chooseSuccessor(c: Campaign, f: number): boolean {
  const first = successionChoices(c, f)[0];
  return !!first && takeUp(c, f, first);
}
