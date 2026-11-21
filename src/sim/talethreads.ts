// A thread of tales told whole (docs/CLOSING.md, "Systems deep enough that stories fall out of them").
//
// The tales a matter leads to are threadtales.ts's, told by storyturn.ts as the earlier ones were: one answer leads to
// the next telling, about the same land, rival and tribe, three to five tellings long, and each answer along it picks
// which way it goes. Here:
//   - when an answer leads nowhere further, and two or more answers make the thread, the chronicle tells it whole,
//     from the year it began: what was done at each step, and how it ended for those in it (`fate`);
//   - when a thread is dropped because the rival it turned on has fallen, or the tribe is no longer free, the
//     chronicle says it was left unfinished, and why;
//   - each thread's end is kept (`c.threadEnds`), for the last page.
// Words only: nothing here changes a rule, and nothing is drawn by chance.
import type { Campaign } from './campaign';
import { TALES } from './story';
import type { Answer, Tale } from './story';
import { THREAD_NAMES } from './threadtales';
import { WORLD_THREAD_NAMES } from './worldtales';
import { placeAt } from './places';
import { yearOf } from './chroniclethreads';

/** How a thread ended: told to its end, or left unfinished; its first and last answers' turns. */
export interface ThreadEnd { root: string; last: string; choice: 'a' | 'b'; from: number; to: number; how: 'ended' | 'dropped'; land: number; rival: number; tribe: number; steps: number }

declare module './campaign' {
  interface Campaign {
    /** Every thread of tales that has ended, told whole or left unfinished (talethreads.ts). */
    threadEnds?: ThreadEnd[];
  }
}

const taleOf = (id: string): Tale | undefined => TALES.find((x) => x.id === id);
/** Does this answer lead to a later telling? */
export const leadsOn = (id: string, choice: 'a' | 'b'): boolean => TALES.some((x) => x.after?.id === id && x.after.choice === choice);
/** The tale a thread begins with. */
export function rootOf(id: string): string {
  let t = taleOf(id);
  for (let i = 0; i < 12 && t?.after; i++) t = taleOf(t.after.id);
  return t?.id ?? id;
}
/** What a thread is called. */
export const threadName = (id: string): string => THREAD_NAMES[rootOf(id)] ?? WORLD_THREAD_NAMES[rootOf(id)] ?? `"${taleOf(rootOf(id))?.title ?? 'an old matter'}"`;

/** The answers of a thread, first to last, ending with this one. */
export function threadOf(c: Campaign, last: Answer): Answer[] {
  const out = [last], all = c.answers ?? [];
  let tale = taleOf(last.id);
  for (let i = 0; i < 12 && tale?.after; i++) {
    const was = tale.after, before = out[0];
    const prev = [...all].reverse().find((a) => a !== before && a.id === was.id && a.choice === was.choice && a.turn <= before.turn);
    if (!prev) break;
    out.unshift(prev);
    tale = taleOf(prev.id);
  }
  return out;
}

/** A thread's words with its names filled in, as the tale that told them would. */
export function fillIn(c: Campaign, text: string, a: Pick<Answer, 'land' | 'rival' | 'tribe'>): string {
  return text.replace(/\{land\}/g, c.territories[a.land]?.name ?? 'your land').replace(/\{rival\}/g, a.rival > 0 && c.factions[a.rival] ? `the ${c.factions[a.rival].name}` : 'a rival')
    .replace(/\{tribe\}/g, c.territories[a.tribe]?.name ?? 'the next valley').replace(/\{place\}/g, placeAt(c, a.land)?.name ?? 'the old place')
    .replace(/(^|[.!?] )the /g, (_, lead: string) => `${lead}The `);
}

const list = (xs: string[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const told = (c: Campaign, thread: Answer[]): string => list(thread.map((a) => fillIn(c, taleOf(a.id)?.[a.choice].told ?? `settled "${taleOf(a.id)?.title ?? 'a matter'}"`, a)));
const years = (thread: Answer[], to: number): string => (yearOf(thread[0].turn) === yearOf(to) ? `in year ${yearOf(to)}` : `from year ${yearOf(thread[0].turn)} to year ${yearOf(to)}`);
const keep = (c: Campaign, thread: Answer[], how: ThreadEnd['how'], to: number): void => {
  const last = thread[thread.length - 1];
  (c.threadEnds ??= []).push({ root: thread[0].id, last: last.id, choice: last.choice, from: thread[0].turn, to, how, land: last.land, rival: last.rival, tribe: last.tribe, steps: thread.length });
};

/**
 * The player has just answered a tale (the last of `c.answers`): if it ends a thread of two answers or more, the
 * chronicle tells the thread whole. Returns the line written, or ''.
 */
export function threadTold(c: Campaign): string {
  const last = c.answers?.[c.answers.length - 1];
  if (!last || leadsOn(last.id, last.choice)) return '';
  const thread = threadOf(c, last);
  if (thread.length < 2) return '';
  const fate = taleOf(last.id)?.[last.choice].fate;
  const name = threadName(last.id);
  const text = fillIn(c, `So ended the matter of ${name}, ${years(thread, last.turn)}: you ${told(c, thread)}.${fate ? ` ${fate}` : ''}`, last);
  (c.chronicle ??= []).push({ turn: c.turn, text });
  keep(c, thread, 'ended', last.turn);
  return text;
}

/**
 * A later telling is dropped (storyturn.ts): the rival it turned on has fallen, or the tribe's land is no longer
 * free. The chronicle says the thread was left unfinished, and why. Returns the line written, or ''.
 */
export function threadDropped(c: Campaign, next: Tale, was: Answer): string {
  const thread = threadOf(c, was);
  if (thread.length < 2) return '';
  const why = next.needs === 'rival' ? '{rival} were no more' : '{tribe} was no longer a free people';
  const text = fillIn(c, `The matter of ${threadName(was.id)} was left unfinished, ${years(thread, c.turn)}: you ${told(c, thread)}, and then ${why}.`, was);
  (c.chronicle ??= []).push({ turn: c.turn, text });
  keep(c, thread, 'dropped', c.turn);
  return text;
}
