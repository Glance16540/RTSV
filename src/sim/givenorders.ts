// Which of a field's work is the leader's orders (docs/PLAYTEST.md 4.2; docs/DESIGN.md, "A town left to itself").
//
// When the player leaves a town, what its people were doing is what it goes on doing (governor.ts keepOrders). The field
// reported a count of who was gathering what, and that count was taken whole: after a siege in which 27 townsfolk stood
// idle and one man dug gold, the town's orders read "100% gold", and a town of 67 dug nothing else until it was visited
// again, on orders nobody gave.
//
// So the field also says how many hands the town had there (`Game.orders().hands`: its villagers), and the work it
// reports is orders only when a fair share of them were at it (GIVEN.share). Fewer, and nobody set the town to work:
// it keeps the work it was last given, or its governor's own shares where it was never given any. What stood half
// built and who was in the queues are kept either way: those were begun by somebody.
// A report with no count of hands (an old save's, a test's) is taken as it always was.
import type { Orders } from './governor';
import type { Stores } from './township';

declare module './governor' {
  interface Orders {
    /** In a field's report only: how many villagers the town had there, working or not (givenorders.ts). Not kept. */
    hands?: number;
  }
}

export const GIVEN = {
  /** The share of a town's hands on the field that must be at work for that work to be its orders. */
  share: 0.5,
};

const KINDS = ['food', 'wood', 'gold', 'stone'] as const;
const at = (w: Partial<Stores> | undefined): number => (w && typeof w === 'object' ? KINDS.reduce((n, k) => n + Math.max(0, Number(w[k]) || 0), 0) : 0);

/** Was the town set to work? Enough of its hands were at it; or the report does not say how many it had. */
export function workGiven(work: Partial<Stores> | undefined, hands: unknown): boolean {
  const n = Number(hands);
  if (hands === undefined || hands === null || !Number.isFinite(n) || n <= 0) return at(work) > 0;
  return at(work) > 0 && at(work) >= GIVEN.share * n;
}

/** A field's report as orders: its work where the town was set to it, else the work the town was last given. */
export function ordersGiven(last: Orders | undefined, x: Partial<Orders> | null | undefined): Partial<Orders> | null | undefined {
  if (!x || typeof x !== 'object' || workGiven(x.work, x.hands)) return x;
  const { work: _idle, ...rest } = x;
  return last?.work ? { ...rest, work: { ...last.work } } : rest;
}
