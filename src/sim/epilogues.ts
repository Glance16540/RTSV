// A campaign's own ending (docs/CLOSING.md: "No campaign has an ending of its own beyond the summing-up page"). When a
// campaign is over, the last page (story.ts `epilogue`) goes on to tell what became of everyone in it:
//   - the matters brought before you: how each thread of tales ended for those in it (its `fate`, threadtales.ts and
//     worldtales.ts), was left unfinished, or was still open when the story ended;
//   - the people of note: the ruler at the end and the line before them, the ruler's husband or wife, the grown heirs,
//     the inner circle, the lords and captains (and any who plotted for the throne), claimants to it, and the
//     notable people of your towns, the living and the lost;
//   - the houses: your ruling house, the houses it was joined to by marriage, and the great houses of your towns.
// Only the grown are named: an heir or a claimant not yet of age is not a figure here, and a notable home is told by
// its house, never by its children. Nothing suggestive; anyone taken is told only as taken. Words only: it reads the
// campaign as it ended and changes nothing. It puts itself on the last page as it loads (story.ts LAST_PAGE).
import type { Campaign } from './campaign';
import { LAST_PAGE, TALES } from './story';
import { fillIn, leadsOn, list, threadName, threadOf } from './talethreads';
import { yearOf } from './chroniclethreads';
import { HEIR_AGE, rulerName } from './dynasty';
import { POST_NAMES } from './kin';
import { isAngry, titleOf } from './nobles';

/** The most lines each part of the last page runs to, so the page stays a page. */
export const EPILOGUE = { threads: 10, nobles: 6, notables: 6, houses: 6, circle: 5 };

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const ordinal = (n: number): string => ORDINAL[n - 1] ?? `${n}th`;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** How each matter brought before you ended: one line a thread. */
export function threadFates(c: Campaign): string[] {
  const out: string[] = [];
  const ends = c.threadEnds ?? [];
  for (const e of ends) {
    const tale = TALES.find((x) => x.id === e.last), name = threadName(e.last);
    if (e.how === 'ended') {
      const fate = tale?.[e.choice].fate;
      out.push(fillIn(c, fate ? `Of ${name}: ${fate}` : `Of ${name}: it was settled in year ${yearOf(e.to)}.`, e));
    } else out.push(fillIn(c, `Of ${name}: it was never finished, for ${tale && TALES.find((x) => x.after?.id === e.last && x.after.choice === e.choice)?.needs === 'tribe' ? '{tribe} was no longer a free people' : '{rival} were no more'} before it could be.`, e));
  }
  // Threads still open: an answer that leads on, whose next telling never came and that ended no thread.
  const answered = new Set((c.answers ?? []).map((a) => a.id));
  for (const a of c.answers ?? []) {
    if (!leadsOn(a.id, a.choice) || ends.some((e) => e.last === a.id && e.choice === a.choice)) continue;
    const next = TALES.find((x) => x.after?.id === a.id && x.after.choice === a.choice);
    if (!next || answered.has(next.id)) continue;
    const thread = threadOf(c, a);
    const did = thread.map((x) => TALES.find((t) => t.id === x.id)?.[x.choice].told).filter(Boolean) as string[];
    out.push(fillIn(c, `Of ${threadName(a.id)}: it was still unfinished when the story ended${did.length ? `; so far you ${list(did)}` : ''}.`, a));
  }
  return out.slice(0, EPILOGUE.threads).map(cap);
}

/** What became of the people of note. */
export function peopleFates(c: Campaign): string[] {
  const me = c.factions[0], out: string[] = [];
  if (!me) return out;
  const line = me.house?.line ?? 1, ruler = rulerName(c, 0);
  out.push(line > 1 ? `The ${ordinal(line)} to lead your people in this story, ${ruler}, ruled at the end.` : `${ruler} led your people from the first season to the last.`);
  const s = me.kin?.spouse;
  if (s) {
    const role = s.female ? 'wife' : 'husband';
    if (!s.lost) out.push(`${s.name}, the ruler's ${role}, was at their side at the end.`);
    else if (s.lost.how === 'died') out.push(`${s.name}, the ruler's ${role}, died in year ${yearOf(s.lost.turn)}.`);
    else if (s.lost.how === 'taken') out.push(`${s.name}, the ruler's ${role}, was taken from the court in year ${yearOf(s.lost.turn)}${s.lost.final ? ', and never came home' : ''}.`);
    else out.push(`${s.name} was widowed in year ${yearOf(s.lost.turn)}, when the ruler they had wed fell.`);
  }
  for (const h of (me.house?.heirs ?? []).filter((x) => c.turn - x.born >= HEIR_AGE)) {
    const wed = (h as { wedTo?: { name: string } }).wedTo;
    out.push(`${h.name}, of the ruling house, ${wed ? `was wed to ${wed.name}` : 'was grown and unwed'} when the story ended.`);
  }
  for (const x of (me.kin?.circle ?? []).slice(0, EPILOGUE.circle)) {
    const how = x.loyalty >= 70 ? 'loyal to the end' : x.loyalty >= 40 ? 'served faithfully enough' : 'served without love';
    out.push(`${x.family && !x.name.endsWith(x.family) ? `${x.name} ${x.family}` : x.name}, ${POST_NAMES[x.post].toLowerCase()}, ${how}.`);
  }
  // Those who plotted for the throne, and how it ended for them.
  const plotted = new Map<string, string>();
  for (const it of c.intrigues ?? []) {
    if (it.owner !== 0 || it.kind !== 'plot' || !it.ended || !it.nobles?.length || it.culprit < 0) continue;
    const who = it.nobles[it.culprit];
    if (!who) continue;
    const how = it.ended.how === 'executed' ? 'was put to death for it' : it.ended.how === 'pardoned' ? 'was pardoned' : it.ended.how === 'usurped' ? 'took the throne by it' : it.ended.how === 'banished' ? 'was banished for it' : '';
    if (how) plotted.set(who.key, `${who.title} plotted for the throne in year ${yearOf(it.since)}, and ${how}.`);
  }
  const nobles = (me.nobles ?? []).filter((n) => n.rank !== 'close'); // as they stand: never reckoned afresh here
  for (const n of nobles.slice(0, EPILOGUE.nobles)) {
    if (plotted.has(n.key)) { out.push(plotted.get(n.key)!); plotted.delete(n.key); continue; }
    out.push(`${titleOf(c, n)} ${isAngry(n) ? 'ended it at odds with the crown' : n.mood >= 70 ? 'was the crown\'s friend to the end' : 'kept faith with the crown'}.`);
  }
  for (const line of [...plotted.values()].slice(0, 2)) out.push(line);
  // Claimants to the throne: only the grown, by name (one not yet of age is no figure here).
  for (const cl of (c.claims ?? []).filter((x) => x.owner === 0 && x.name && x.grown !== undefined)) {
    const who = cl.name!;
    const how = !cl.ended ? (cl.towns?.length ? 'still had towns risen in their name' : 'was still waiting') : cl.ended.how === 'crowned' ? 'took the throne' : cl.ended.how === 'putdown' ? 'saw their rising put down' : cl.ended.how === 'home' ? 'came home' : cl.ended.how === 'lapsed' || cl.ended.how === 'nofollowing' ? 'found too few to follow them' : 'was heard of no more';
    out.push(`${who}, with a claim to your throne, ${how}${cl.ended ? '' : ' when the story ended'}.`);
  }
  // The notable people of your towns: the most renowned, living and lost.
  const known: { text: string; weight: number }[] = [];
  for (const t of c.territories) {
    if (t.owner !== 0 || !t.folk) continue;
    for (const n of t.folk.notables) {
      const name = n.family && !n.name.endsWith(n.family) ? `${n.name} ${n.family}` : n.name;
      const what = n.kind === 'veteran' ? `a veteran of ${t.name}${n.kills ? ` who felled ${n.kills} in war` : ''}` : `at the head of a notable house of ${t.name}`;
      const fate = n.lost ? `${n.lost.how} in year ${yearOf(n.lost.turn)}` : 'lived out their days there';
      known.push({ text: `${name}, ${what}, ${fate}.`, weight: (n.kills ?? 0) * 3 + (n.made ?? 0) / 100 + (n.war ?? 0) + (n.lost ? 1 : 2) });
    }
  }
  known.sort((a, b) => b.weight - a.weight);
  for (const k of known.slice(0, EPILOGUE.notables)) out.push(k.text);
  return out;
}

/** What became of the houses: your own, those it married into, and the great houses of your towns. */
export function houseFates(c: Campaign): string[] {
  const me = c.factions[0], out: string[] = [];
  if (!me) return out;
  const line = me.house?.line ?? 1, house = me.dynasty ? `The house of ${me.dynasty}` : 'Your ruling house';
  const grown = (me.house?.heirs ?? []).filter((x) => c.turn - x.born >= HEIR_AGE).length;
  out.push(`${house} gave your people ${line === 1 ? 'one ruler' : `${line} rulers`} in this story${grown ? `, and had ${grown === 1 ? 'one heir' : `${grown} heirs`} of age at its end` : ', and no heir of age at its end'}.`);
  for (const p of (c.pacts ?? []).filter((x) => x.kind === 'marriage' && (x.a === 0 || x.b === 0))) {
    const other = p.a === 0 ? p.b : p.a, f = c.factions[other];
    if (!f) continue;
    const ours = p.wed ? (p.a === 0 ? p.wed[0] : p.wed[1]) : '', theirs = p.wed ? (p.a === 0 ? p.wed[1] : p.wed[0]) : '';
    out.push(`The house of ${rulerName(c, other)} of the ${f.name} was joined to yours in year ${yearOf(p.since)}${ours && theirs ? `, when ${ours} wed ${theirs}` : ''}; ${f.alive ? (p.until >= c.turn ? 'the peace it made still held' : 'the peace it made had run its course') : `the ${f.name} were no more by the end`}.`);
  }
  for (const it of (c.intrigues ?? []).filter((x) => x.owner === 0 && x.kind === 'suitor' && x.ended?.how === 'wed' && x.rival !== undefined)) {
    const f = c.factions[it.rival!];
    if (f && it.cast?.daughter && it.cast?.suitor) out.push(`${it.cast.daughter} of your house was given in marriage to ${it.cast.suitor} of the ${f.name} in year ${yearOf(it.ended!.turn)}.`);
  }
  const homes: { text: string; weight: number }[] = [];
  for (const t of c.territories) {
    if (t.owner !== 0 || !t.folk) continue;
    const great = [...new Set(t.folk.notables.filter((n) => n.kind === 'mother' && n.family && !n.lost).map((n) => n.family!))];
    if (great.length) homes.push({ text: `The great ${great.length === 1 ? 'house' : 'houses'} of ${t.name} at the end: ${great.length === 1 ? 'the house of ' : 'the houses of '}${list(great)}.`, weight: great.length });
  }
  homes.sort((a, b) => b.weight - a.weight);
  for (const h of homes) out.push(h.text);
  return out.slice(0, EPILOGUE.houses);
}

/** The ending told whole: how the threads ended, then the people, then the houses. Only once the campaign is over. */
export function ending(c: Campaign): string[] {
  if (c.phase !== 'over') return [];
  return [...threadFates(c), ...peopleFates(c), ...houseFates(c)];
}

LAST_PAGE.push(ending);
