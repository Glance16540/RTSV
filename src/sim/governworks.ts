// The player's governor and the works of rule, law, nobles and faith (docs/DESIGN.md, "Rule, law, nobles and faith"): what
// a town of the player's left to itself raises of a Hall of Judgement, a Noble's Manor and a Monastery, and the studies it
// learns, by the standing orders the player gives it (townorders.ts). A rival nation raises and learns them by its own
// sense (rule.ts, studies.ts); a town of the player's only as it is told:
//   - Rule first: a Hall of Judgement where the nation has none begun, else a Noble's Manor in a town of the size one needs
//     (manor.ts), the town keeping GOVERN_WORKS.rule floors of goods after paying;
//   - Faith first: a Monastery once the town's Church stands and the town keeps the faith (creed.ts isHoly), keeping
//     GOVERN_WORKS.monastery floors, as a rival does;
//   - Learn studies: the study taught in the town that answers what presses most on the nation (studies.ts pressing), when
//     the town has the means and the nation keeps its floors after paying (plenty.ts nationCanSpare).
// None of it is raised when the governor is told never to build it, and none of it starves a town: each is bought only out of
// plenty (plenty.ts, the one rule for every purchase), more so where the town is told to keep much in store. At most one
// work begun and one study learned a season, the nation over.
import type { Campaign } from './campaign';
import { BUILDINGS, TECHS } from './data';
import { folkOf, grown } from './township';
import { PLENTY, canSpare, nationCanSpare } from './plenty';
import { begunAt, raiseBar, raiseWork } from './townworks';
import { allStudies, hasStudy, learn, pressing, studyBar } from './studies';
import { manorNeeds } from './manor';
import { faithAt } from './townfaith';
import { isHoly } from './creed';
import { forbids, keepTimes, standingOf } from './townorders';

/** Floors of goods a town keeps after paying, by work: a Hall or a Manor as a rival's (rule.ts), a Monastery two. */
export const GOVERN_WORKS = { rule: PLENTY.rule, monastery: 2 * PLENTY.rule };

const mine = (c: Campaign) => c.territories.filter((t) => t.owner === 0 && !t.horde);

/** The work of rule or faith this town's governor would begin now by his orders, or null. */
export function workWanted(c: Campaign, tid: number): string | null {
  const t = c.territories[tid];
  if (!t || t.owner !== 0 || t.horde) return null;
  const first = standingOf(t).first, keep = keepTimes(t);
  const can = (type: string, floors: number): boolean => !forbids(t, type) && !begunAt(c, tid, type) && canSpare(c, tid, BUILDINGS[type]?.cost ?? {}, { times: floors * keep }) && !raiseBar(c, 0, tid, type);
  if (first === 'rule') {
    if (!mine(c).some((x) => begunAt(c, x.id, 'hall')) && can('hall', GOVERN_WORKS.rule)) return 'hall';
    if (grown(folkOf(c, tid)) >= manorNeeds() && can('manor', GOVERN_WORKS.rule)) return 'manor';
  }
  if (first === 'faith' && t.buildings.includes('church') && isHoly(faithAt(c, tid)) && can('monastery', GOVERN_WORKS.monastery)) return 'monastery';
  return null;
}

/** The study this town's governor would learn now by his orders, or null: the one taught here that presses most. */
export function studyWanted(c: Campaign, tid: number): string | null {
  const t = c.territories[tid];
  if (!t || t.owner !== 0 || t.horde || !standingOf(t).learn) return null;
  let best: { id: string; need: number } | null = null;
  for (const s of allStudies()) {
    if (hasStudy(c, 0, s.id) || studyBar(c, 0, s.id, tid)) continue;
    const need = pressing(c, 0, s.answers!);
    if (need <= 0 || (best && need <= best.need)) continue;
    if (!nationCanSpare(c, 0, tid, s.cost, PLENTY.studies * keepTimes(t))) continue; // plenty.ts, one rule for every purchase
    best = { id: s.id, need };
  }
  return best?.id ?? null;
}

/** A season of the player's governors: one work of rule or faith begun and one study learned at most, by their orders. Returns what was done. */
export function governWorksSeason(c: Campaign): { work?: { type: string; at: number }; study?: { id: string; at: number } } {
  const out: { work?: { type: string; at: number }; study?: { id: string; at: number } } = {};
  if (!c.factions[0]?.alive) return out;
  for (const t of mine(c)) {
    if (out.work) break;
    const type = workWanted(c, t.id);
    if (type && raiseWork(c, 0, t.id, type) === '') {
      out.work = { type, at: t.id };
      c.log.push(`By your orders the governor of ${t.name} has begun ${type === 'hall' ? 'a Hall of Judgement' : type === 'manor' ? 'a Noble\'s Manor' : 'a Monastery'}.`);
    }
  }
  for (const t of mine(c)) {
    if (out.study) break;
    const id = studyWanted(c, t.id);
    if (id && learn(c, 0, id, t.id) === '') out.study = { id, at: t.id }; // learn() tells the player
  }
  return out;
}

/** The study a town's governor learns, in words, for its panel: '' when none is taught there or none presses. */
export const studyWantedText = (c: Campaign, tid: number): string => { const id = studyWanted(c, tid); return id ? `He would learn ${TECHS[id].name} next.` : ''; };
