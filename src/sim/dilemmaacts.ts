// What an answer to a dilemma does beyond the standing and the stores, where its words say more (dilemmas.ts).
// Each is done through a rule the game already has; an answer whose words no existing rule can bear out says less.
//
//   held  a: everyone held in the people's work camps goes free and home, as a freed captive does (captivity.ts
//            freeCaptive: to their own people, if those still stand);
//         b: everyone held there is sold on at once, at the camp's own price (captivity.ts sellOn: SOLD_GOLD a head),
//            and is lost to their people as one sold on always is.
// A marauders' lair is not the people's camp, and is not touched.
import type { Game } from './game';
import { freeCaptive, sellOn } from './captivity';

type Act = (g: Game, pid: number) => void;

const camps = (g: Game, pid: number) => g.buildings.filter((b) => b.owner === pid && !b.dead && b.type !== 'lair' && (b.captives?.length ?? 0) > 0);

export const ACTS: Record<string, Partial<Record<'a' | 'b', Act>>> = {
  held: {
    a: (g, pid) => { for (const b of camps(g, pid)) while (b.captives!.length) freeCaptive(g, b.captives!.shift()!, b.x, b.y); },
    b: (g, pid) => { for (const b of camps(g, pid)) while (b.captives!.length) sellOn(g, b, b.captives!.length - 1); },
  },
};

/** Do what the answer says beyond its goods and standing, if anything. */
export function dilemmaAct(g: Game, pid: number, id: string, choice: 'a' | 'b'): void {
  ACTS[id]?.[choice]?.(g, pid);
}
