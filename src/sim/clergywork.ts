// Monks and nuns at their work (docs/systems-board, "Church": monks and nuns did the same thing). In a town (a
// battle or a visit) the clergy of a Church or a Monastery are counted as they always were (game.ts: the pull toward
// piety, more children); beside that, each does what fits them:
//   - nuns nurse: where a finished Infirmary stands, each nun serving makes plague wear the sick down NUNS.each the
//     less, to NUNS.most at most (beside the Infirmary's own nursing, infirmary.ts);
//   - monks copy and teach: each monk serving makes the people's studies and research go MONKS.each the faster, to
//     MONKS.most at most.
// Only the clergy in a Church or a Monastery count (not a tavern's people, nor a camp's guards). The numbers are first guesses.
import type { Game } from './game';

export const NUNS = { each: 0.05, most: 0.2 };
export const MONKS = { each: 0.05, most: 0.25 };

const HOUSES = new Set(['temple', 'monastery']);

/** The monks and nuns serving a people's Churches and Monasteries, and whether it has a finished Infirmary. Worked out once a tick. */
const seen = new WeakMap<Game, { tick: number; of: Map<number, { monks: number; nuns: number; infirmary: boolean }> }>();
export function clergyOf(g: Game, owner: number): { monks: number; nuns: number; infirmary: boolean } {
  let s = seen.get(g);
  if (!s || s.tick !== g.tick) {
    const of = new Map<number, { monks: number; nuns: number; infirmary: boolean }>();
    const at = (o: number) => { let x = of.get(o); if (!x) of.set(o, (x = { monks: 0, nuns: 0, infirmary: false })); return x; };
    for (const b of g.buildings) {
      if (b.dead) continue;
      if (b.type === 'infirmary' && b.complete) at(b.owner).infirmary = true;
      if (!HOUSES.has(b.type) || !b.staff?.length) continue;
      for (const id of b.staff) { const u = g.entities.get(id); if (u && u.kind === 'unit') u.gender === 'f' ? at(b.owner).nuns++ : at(b.owner).monks++; }
    }
    s = { tick: g.tick, of };
    seen.set(g, s);
  }
  return s.of.get(owner) ?? { monks: 0, nuns: 0, infirmary: false };
}

/** How fast plague wears this people's sick down, for the nuns nursing them: 1 with none, or no Infirmary to nurse in. */
export function nunsNurse(g: Game, owner: number): number {
  const k = clergyOf(g, owner);
  return k.infirmary ? 1 - Math.min(NUNS.most, NUNS.each * k.nuns) : 1;
}
/** How fast this people's studies and research go, for the monks copying and teaching: 1 with none. */
export function monksTeach(g: Game, owner: number): number {
  return 1 + Math.min(MONKS.most, MONKS.each * clergyOf(g, owner).monks);
}
