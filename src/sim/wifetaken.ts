/**
 * The leader's wife taken into a noble's house (docs/DESIGN.md, "Claimants to the throne", the owner's word).
 *
 * A noble who plots against the leader over faith (noblefaith.ts) and holds a town of his own (a lord) may, while
 * he is still unnamed, take the leader's wife into his house. It is told as the plain fact and nothing more. It
 * names him: the whispers are over, and the plot becomes a standing matter between the leader and that lord, one
 * way a plot may go (courtstory.ts, `PLOT_STAGES`).
 *
 *   - Before: whatever ends a plot or finds the plotter prevents it, and a loyal marshal or right hand at court
 *     halves the chance (`WIFE.loyal`).
 *   - While she is held: no child is born to the leader's house (kin.ts: he has no wife beside him). After
 *     `BORN.after` seasons a child may be born in the lord's house, one at most: a record only (claimants.ts).
 *   - The leader may demand her back with gifts to his house (he yields or refuses, and will not be asked again
 *     for a while), or take him in his town with an army standing there (she comes home, and he is held for
 *     judgement as any plotter found). Left alone for `WIFE.keeps` seasons, she is not seen at court again.
 *   - If the lord is gone from his town while it is still the leader's people's, she comes home; if the town is
 *     lost to them, she is lost with it.
 *
 * A child born there stays in the lord's house whatever becomes of her or of him: it is his heir, and grown it
 * may claim the throne (claimantrising.ts).
 */
import type { Campaign } from './campaign';
import type { Choice, Intrigue } from './intriguebase';
import { chance, end, note } from './intriguebase';
import { PLOT_STAGES } from './courtstory';
import { COURT } from './courtstory';
import { noblesOf } from './nobles';
import type { Noble } from './nobles';
import { kinOf } from './kin';
import { heroFor } from './campaignbase';
import { canPayFor, payFor } from './prices';
import { BORN } from './bandborn';
import { CLAIM, recordChild } from './claimants';

export const WIFE = {
  /** Seasons a plot over faith has run before its lord may take her, and the chance each season from then that he does. */
  after: 2, chance: 0.6,
  /** With a loyal marshal or right hand at court, the chance is this much of that. */
  loyal: 0.5,
  /** Demanded back: the gifts it costs in supplies, the chance he yields, and seasons before he will hear it again. */
  gifts: 6, yields: 0.5, again: 4,
  /** Seasons she is held with nothing done before she is not seen at court again. */
  keeps: 12,
};
declare module './campaign' {
  interface Campaign { /** How many leaders' wives have been taken into a lord's house in this campaign (wifetaken.ts): a count for the record. */ wivesTaken?: number }
}
declare module './intriguebase' {
  interface Intrigue {
    /** A plot in which the lord has taken the leader's wife into his house (wifetaken.ts): who, where, since when, when she was last asked for, and whether a child has been born there. */
    wife?: { name: string; key: string; town: number; since: number; asked?: number; child?: boolean };
    /** The season a wife was taken in this plot, kept after it is settled. */
    wifeTaken?: number;
  }
}

const lordOf = (c: Campaign, it: Intrigue): Noble | undefined => noblesOf(c, it.owner).find((n) => n.key === it.nobles?.[it.culprit]?.key);
const leader = (c: Campaign, f: number): string => heroFor(c, f).name;
const chronicle = (c: Campaign, it: Intrigue, text: string): void => { if (it.owner === 0) (c.chronicle ??= []).push({ turn: c.turn, text }); };

/** She is home: the leader has a wife beside him again. */
function home(c: Campaign, it: Intrigue): void {
  const k = kinOf(c, it.owner), s = k.spouse;
  if (s && s.name === it.wife?.name && s.lost?.house) { delete s.lost; delete k.alone; }
  delete it.wife;
}
/** She is not seen again. */
function gone(c: Campaign, it: Intrigue): void {
  const s = kinOf(c, it.owner).spouse;
  if (s && s.name === it.wife?.name && s.lost?.house) s.lost.final = true;
  delete it.wife;
}

/** Could the lord of this plot take the leader's wife this season? For the season's chance, and for whoever would warn of it. */
export function mayTake(c: Campaign, it: Intrigue): boolean {
  if (it.kind !== 'plot' || it.ended || it.found || it.wife || it.wifeTaken !== undefined || !it.faith) return false;
  const fac = c.factions[it.owner], n = lordOf(c, it), s = fac?.kin?.spouse;
  return !!fac?.alive && !!fac.heroAlive && !!n && n.rank === 'lord' && !!s && s.female && !s.lost && c.territories[n.town]?.owner === it.owner;
}
/** He takes her into his house. For the season's chance, and for tests. */
export function takeWife(c: Campaign, it: Intrigue): boolean {
  if (!mayTake(c, it)) return false;
  const f = it.owner, k = kinOf(c, f), s = k.spouse!, n = lordOf(c, it)!, p = it.nobles![it.culprit], town = c.territories[n.town].name;
  s.lost = { turn: c.turn, how: 'taken', house: n.key };
  k.alone = c.turn;
  it.wife = { name: s.name, key: n.key, town: n.town, since: c.turn };
  it.wifeTaken = c.turn;
  c.wivesTaken = (c.wivesTaken ?? 0) + 1;
  it.cleared = it.nobles!.map((_, i) => i).filter((i) => i !== it.culprit); // nobody else is spoken of now
  const text = `${p.title} has taken ${s.name}, wife of ${leader(c, f)}, into his house at ${town}. It is he who plotted for the leader's place.`;
  note(c, it, 'bad', text);
  chronicle(c, it, text);
  return true;
}

function step(c: Campaign, it: Intrigue): boolean {
  if (!it.wife) {
    if (c.turn - it.since < WIFE.after || !mayTake(c, it)) return false; // each season from then on, while he is unnamed
    const loyal = kinOf(c, it.owner).circle.some((x) => (x.post === 'marshal' || x.post === 'right') && x.loyalty >= COURT.rival.loyalAt);
    return chance(c, it.id * 97 + 11) < WIFE.chance * (loyal ? WIFE.loyal : 1) && takeWife(c, it);
  }
  const f = it.owner, fac = c.factions[f], w = it.wife, p = it.nobles![it.culprit], n = lordOf(c, it), town = c.territories[w.town];
  if (!fac.alive || !fac.heroAlive) { gone(c, it); end(c, it, 'outlived', `${p.title} kept ${w.name} in his house, and the leader she was taken from is dead.`, 'plain'); return true; }
  if (town.owner !== f) { gone(c, it); end(c, it, 'lost', `${town.name} is lost, and ${w.name} with it: she will not be seen at court again.`, 'bad'); return true; }
  if (!n || n.town !== w.town) { home(c, it); end(c, it, 'nothing', `${p.title} is no longer lord in ${town.name}, and ${w.name} has come home.`, 'good'); return true; }
  if (!w.child && c.turn - w.since >= BORN.after && chance(c, it.id * 97 + 13) < CLAIM.born) {
    w.child = true;
    recordChild(c, { owner: f, mother: w.name, parent: 'noble', by: p.title, town: w.town });
    const text = `A child is born to ${w.name} in the house of ${p.title}.`;
    note(c, it, 'plain', text);
    chronicle(c, it, text);
  }
  if (c.turn - w.since >= WIFE.keeps) { gone(c, it); end(c, it, 'lost', `${w.name} has been ${WIFE.keeps / 4} years in the house of ${p.title}, and will not be seen at court again.`, 'bad'); }
  return true;
}
function choices(c: Campaign, it: Intrigue): Choice[] {
  const w = it.wife!, f = it.owner, town = c.territories[w.town].name;
  const wait = w.asked === undefined ? 0 : WIFE.again - (c.turn - w.asked);
  const there = c.armies.some((a) => a.owner === f && a.at === w.town);
  return [
    { id: 'demand', label: `Demand her back, with gifts to his house (${WIFE.gifts} supplies)`, ...(wait > 0 ? { bar: `He has given his answer, and will not hear it again for ${wait} ${wait === 1 ? 'season' : 'seasons'}.` } : canPayFor(c, f, 'dealing', WIFE.gifts) ? {} : { bar: 'You have not the supplies.' }) },
    { id: 'march', label: `Take him in his town, with the army in ${town}`, ...(there ? {} : { bar: `No army of yours stands in ${town}.` }) },
  ];
}
function choose(c: Campaign, it: Intrigue, choice: string): boolean {
  const w = it.wife!, f = it.owner, p = it.nobles![it.culprit], n = lordOf(c, it);
  if (choices(c, it).find((x) => x.id === choice)?.bar !== undefined) return false;
  if (choice === 'demand') {
    payFor(c, f, 'dealing', WIFE.gifts);
    if (chance(c, it.id * 97 + 17) < WIFE.yields) {
      const name = w.name;
      home(c, it);
      if (n) n.mood = 10;
      end(c, it, 'bought', `${p.title} took the gifts and sent ${name} home to ${leader(c, f)}. Nothing more was said of the plot.`, 'good');
    } else {
      w.asked = c.turn;
      note(c, it, 'bad', `${p.title} kept the gifts and sent no answer. ${w.name} is still in his house.`);
    }
    return true;
  }
  if (choice === 'march') {
    const name = w.name;
    home(c, it);
    it.found = true;
    note(c, it, 'good', `Your army has taken ${p.title} in his own hall. ${name} has come home, and he waits on your judgement.`);
    return true;
  }
  return false;
}
const standing = (c: Campaign, it: Intrigue): string => `${it.nobles![it.culprit].title} holds ${it.wife!.name}, the leader's wife, in his house at ${c.territories[it.wife!.town].name}.${it.wife!.child ? ' A child has been born there.' : ''}`;

PLOT_STAGES.push({ is: (it) => !!it.wife, step, choices, choose, standing });
