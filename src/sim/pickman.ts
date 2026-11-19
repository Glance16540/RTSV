// Who goes to arms, seen and chosen (docs/DESIGN.md, "A soldier costs a person").
//
// Training a soldier calls a villager in to be made into him (muster.ts): the nearest free man, one with no house
// before a husband. The player could not see who had been called, nor choose him, and a soldier ordered when nobody
// was free stood in the queue with no word of why it did not start. Here:
//   - who is going where, for any villager and any place in a queue (`enlistOf`, `queueWho`): on his way, inside
//     being trained, or a place waiting for a man; the panels and the mark over the figure read these;
//   - the player may send a villager of their own choosing (`sendMan`): to a place waiting for a man first, else in
//     place of a man still on his way (who goes back to what he was doing), the nearest such place he may fill (a
//     soldier's place takes a man; a healer's anyone). One already inside being trained is not swapped out.
// Plain data: it reads the queues and the villagers, and gives orders only through what the field already has.
import type { Building, Game, QueueItem, Unit } from './game';
import { UNITS } from './data';
import { mayServe, needsPerson } from './muster';

/** A place in a queue that a person is to be made into. */
export interface Slot { b: Building; q: QueueItem; at: number }

/** Every place in this people's queues that takes a person, in order. */
function slotsOf(g: Game, owner: number): Slot[] {
  const out: Slot[] = [];
  for (const b of g.buildings) {
    if (b.owner !== owner || b.dead || !b.complete) continue;
    b.queue.forEach((q, at) => { if (q.kind === 'unit' && UNITS[q.id] && needsPerson(UNITS[q.id]) && q.who !== undefined) out.push({ b, q, at }); });
  }
  return out;
}

const living = (g: Game, id: number | undefined): Unit | undefined => { const u = id ? g.entities.get(id) : undefined; return u && u.kind === 'unit' && !u.dead ? u : undefined; };

/** Where this villager is going to be trained, or being trained, if anywhere. */
export function enlistOf(g: Game, v: Unit): { b: Building; q: QueueItem; inside: boolean } | null {
  if (v.type !== 'villager' || v.dead) return null;
  for (const s of slotsOf(g, v.owner)) if (s.q.who === v.id) return { b: s.b, q: s.q, inside: !!s.q.in && v.inside === s.b.id };
  return null;
}

export type Who = { state: 'waiting' } | { state: 'coming' | 'inside'; who: Unit };
/** Who a place in a queue is to be made from: nobody yet, a villager on his way, or one inside. Null for a place that takes nobody. */
export function queueWho(g: Game, q: QueueItem): Who | null {
  if (q.kind !== 'unit' || q.who === undefined) return null;
  const u = living(g, q.who);
  if (!u) return { state: 'waiting' };
  return { state: q.in ? 'inside' : 'coming', who: u };
}

const nameOf = (u: Unit): string => u.name || 'A villager';
const article = (s: string): string => (/^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`);

/** The line on a villager's panel when they have been called to arms; empty otherwise. */
export function enlistLine(g: Game, v: Unit): string {
  const e = enlistOf(g, v);
  if (!e) return '';
  const what = UNITS[e.q.id]?.name ?? 'soldier';
  return e.inside ? `Inside the ${e.b.def.name}, being trained as ${article(what)}.` : `On ${v.gender === 'f' ? 'her' : 'his'} way to the ${e.b.def.name} to be trained as ${article(what)}.`;
}

/** The line under a building's queue for each place that takes a person: who is going, or that it waits for one. */
export function queueLines(g: Game, b: Building): string[] {
  const out: string[] = [];
  for (const q of b.queue) {
    const w = queueWho(g, q), what = UNITS[q.id]?.name ?? '';
    if (!w) continue;
    if (w.state === 'waiting') out.push(`${what}: waiting for ${UNITS[q.id]?.cls === 'support' ? 'someone' : 'a man'} to come and be trained. Send one from a villager's panel.`);
    else out.push(`${what}: ${nameOf(w.who)} ${w.state === 'inside' ? 'is inside, being trained' : 'is on the way'}.`);
  }
  return out;
}

/**
 * The place this villager would fill if sent: one waiting for a person, else one whose person is still on the way, the
 * nearest he may fill. Null where there is none, or he cannot go (already called, inside, a captive, a child).
 */
export function slotFor(g: Game, v: Unit): Slot | null {
  if (v.type !== 'villager' || v.dead || v.inside || v.captive || v.growT > 0 || v.order?.t === 'enlist') return null;
  let best: Slot | null = null, bestD = Infinity;
  for (const s of slotsOf(g, v.owner)) {
    if (!mayServe(v, UNITS[s.q.id]) || s.q.in) continue;
    const waiting = !living(g, s.q.who);
    const d = Math.hypot(v.x - s.b.x, v.y - s.b.y) + (waiting ? 0 : 10000);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

/** The player sends this villager to arms: to the place `slotFor` gives. Returns whether he went. */
export function sendMan(g: Game, owner: number, vid: number): boolean {
  const v = living(g, vid);
  if (!v || v.owner !== owner) return false;
  const s = slotFor(g, v);
  if (!s) return false;
  const was = living(g, s.q.who);
  if (was && was.order?.t === 'enlist' && was.order.id === s.b.id) g.setOrder(was, null); // back to what he was doing
  s.q.who = v.id;
  v.queue.length = 0;
  g.setOrder(v, { t: 'enlist', id: s.b.id });
  return true;
}
