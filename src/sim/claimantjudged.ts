/**
 * Whoever led a claimant's rising is brought to judgement when its seat is retaken (docs/DESIGN.md, "Claimants to
 * the throne").
 *
 * A rising for a claim is over when its seat is its people's again (claimantrising.ts). Then whoever led it is
 * taken with the town and waits on the leader's judgement, as a plotter found does (courtstory.ts): it is a plot
 * already laid bare, one way a plot may stand (`PLOT_STAGES`), with one name in it.
 *
 *   - A grown claimant who led it is the one judged, by name.
 *   - A rising raised in a child's name: the lord who proclaimed it is the one judged, if he is still lord there.
 *     The child is a record and stays one: it is never judged, never named, and nothing here touches it. A band
 *     that proclaimed a child is nobody to bring to judgement.
 *
 * The leader pardons, banishes or puts to death. A lord pardoned keeps his town, and his mood is mended; banished
 * or put to death, the town has a new lord. A claimant pardoned goes free and claims nothing more; banished, is
 * sent out of the land; put to death, is dead. Pardon and death weigh on the people's creed and on the other
 * nobles as they do for any plotter (`COURT.plot`); banishment weighs on neither. A rival ruler judges by his
 * creed as he judges a plotter (rivalstories.ts), and the computer-played player pardons (storypolicy.ts).
 */
import type { Campaign } from './campaign';
import type { Choice, Intrigue } from './intriguebase';
import { begin, end, note } from './intriguebase';
import { COURT, PLOT_STAGES, removeNoble } from './courtstory';
import { noblesOf, titleOf } from './nobles';
import type { Noble } from './nobles';
import { shiftVirtue } from './townfaith';
import { heroFor } from './campaignbase';
import type { Claim } from './claimants';

declare module './intriguebase' {
  interface Intrigue {
    /** A judgement after a claimant's rising (claimantjudged.ts): the claim's id, and whether it is the grown claimant or the lord who proclaimed a child that stands to be judged. */
    claim?: { id: number; who: 'claimant' | 'lord' };
  }
}

const lordIn = (c: Campaign, it: Intrigue): Noble | undefined => (it.claim?.who === 'lord' ? noblesOf(c, it.owner).find((n) => n.key === it.nobles?.[0]?.key) : undefined);
const leader = (c: Campaign, f: number): string => heroFor(c, f).name;

/**
 * The seat of a rising is retaken: whoever led it is taken with it and waits on judgement. Returns the record of
 * it, or null where there is nobody to judge (a band proclaimed the child, or the lord is gone).
 */
export function bringToJudgement(c: Campaign, cl: Claim, seat: number): Intrigue | null {
  const f = cl.owner, fac = c.factions[f], t = c.territories[seat];
  if (!fac?.alive || !fac.heroAlive || t?.owner !== f) return null;
  let who: NonNullable<Intrigue['nobles']>[number], kind: 'claimant' | 'lord';
  if (cl.grown !== undefined && cl.name) { kind = 'claimant'; who = { key: `claimant:${cl.id}`, name: cl.name, title: `${cl.name}, who claimed the throne`, female: !!cl.female }; }
  else {
    const lord = cl.parent === 'noble' ? noblesOf(c, f).find((n) => n.key === cl.key && n.rank === 'lord') : undefined;
    if (!lord) return null;
    kind = 'lord'; who = { key: lord.key, name: lord.name, title: titleOf(c, lord), female: lord.female };
  }
  const it = begin(c, 'plot', seat);
  it.nobles = [who]; it.culprit = 0; it.found = true; it.claim = { id: cl.id, who: kind };
  note(c, it, 'good', kind === 'claimant'
    ? `${who.title} of ${leader(c, f)}, was taken when ${t.name} fell, and waits on your judgement.`
    : `${who.title}, who proclaimed the child of ${cl.mother} heir, was taken when ${t.name} fell, and waits on your judgement.`);
  return it;
}

function step(c: Campaign, it: Intrigue): boolean {
  if (!it.claim) return false;
  const fac = c.factions[it.owner], p = it.nobles![0];
  if (!fac.alive || !fac.heroAlive) end(c, it, 'outlived', `${p.title} waited on the judgement of a leader who is dead.`, 'plain');
  else if (it.claim.who === 'lord' && !lordIn(c, it)) end(c, it, 'nothing', `${p.title} is no longer among the great, and is judged by nobody.`, 'plain');
  return true; // else it waits on judgement
}
const choices = (_c: Campaign, it: Intrigue): Choice[] => { const p = it.nobles![0]; return [{ id: 'pardon', label: `Pardon ${p.name}` }, { id: 'exile', label: `Banish ${p.name}` }, { id: 'death', label: `Have ${p.name} put to death` }]; };
function choose(c: Campaign, it: Intrigue, choice: string): boolean {
  const P = COURT.plot, f = it.owner, p = it.nobles![0], n = lordIn(c, it), led = it.claim!.who === 'claimant' ? 'rose for the throne' : 'raised a rising in a child\'s name';
  const others = (by: number): void => { for (const x of noblesOf(c, f)) if (x !== n) x.mood = Math.max(-100, Math.min(100, x.mood + by)); };
  if (choice === 'pardon') {
    if (n) n.mood = 10;
    others(P.pardonMood); shiftVirtue(c, f, P.pardonVirtue);
    end(c, it, 'pardoned', `${p.title} ${led}, was taken, and was pardoned before the court.`, 'good');
    return true;
  }
  if (choice === 'exile') {
    removeNoble(c, n, 'was banished for raising a rising against the leader', f);
    end(c, it, 'banished', `${p.title} ${led}, was taken, and was sent out of the land.`, 'plain');
    return true;
  }
  if (choice === 'death') {
    removeNoble(c, n, 'was put to death for raising a rising against the leader', f);
    others(P.deathMood); shiftVirtue(c, f, P.deathVirtue);
    end(c, it, 'executed', `${p.title} ${led}, was taken, and was put to death. The other great houses took note.`, 'plain');
    return true;
  }
  return false;
}
const standing = (_c: Campaign, it: Intrigue): string => `${it.nobles![0].title} was taken when the rising fell, and is held for your judgement.`;

PLOT_STAGES.push({ is: (it) => !!it.claim, step, choices, choose, standing });
