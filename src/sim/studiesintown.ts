// The studies of rule, law, nobles and faith, in a town (docs/DESIGN.md, "Buildings and research that answer the systems";
// the board's line "In a town they do nothing: each is the nation's, on the map").
//
// A nation's studies reach a battle or a visit of its town already: the setup's `bonus.studies` puts each in the side's
// techs (game.ts). Here each of the seven of a Hall of Judgement or a Monastery (studies.ts) does in the town what it does
// on the map, where it honestly has a meaning there:
//   - Couriers: a decree reaches the town at the strength the map reckons it, by messenger three-quarters (decrees.ts
//     strengthAt): it already acts in the town, and nothing more is done here.
//   - Stewardship (the governor finishes what he has begun half again as fast, stewardship.ts): works standing half-built
//     as the sitting begins are built STUDY_TOWN.steward times as fast (`studyBuild`, game.ts building).
//   - Written Law (unrest four-fifths as likely, writtenlaw.ts): a thief afoot in the town is taken by a guard in
//     STUDY_TOWN.law of the time (`lawGuard`, fieldstory.ts): the law reaches the town's own crime.
//   - Spymasters (a plot laid bare the sooner, spymasters.ts): in a visit to the court's town with a plot, one of the great
//     watched is shown true in STUDY_TOWN.spies of the time (`spyWatch`, courtfield.ts).
//   - Feast Days (the towns lifted toward the holy way once a year, feastdays.ts): care in the town brings the drifted
//     back to honest work STUDY_TOWN.feast times as readily (`feastCare`, driftintown.ts): a feast steadies its people.
//   - Oaths of Fealty (the nobles' moods swing less) and Pilgrimage (towns drawn toward the nation's faith): no meaning in a
//     town's streets. The nobles are not on the field, and the pull is between the nation's towns: nothing is done here.
// Plain data: it reads the side's techs and the town's buildings.
import type { Building, Game } from './game';

export const STUDY_TOWN = {
  /** Works begun before the sitting, under Stewardship: built this many times as fast (stewardship.ts STEWARDSHIP.build). */
  steward: 1.5,
  /** Under Written Law, the share of a guard's watch it takes to take a thief (as unrest is four-fifths as likely: writtenlaw.ts). */
  law: 0.8,
  /** With Spymasters, the share of a watch it takes to show one of the great true. */
  spies: 0.7,
  /** With Feast Days, how much more readily care brings the drifted back. */
  feast: 1.25,
};

declare module './game' {
  interface Building { /** Standing half-built as the sitting began: a work its governor had begun (studiesintown.ts). */ begun?: boolean }
}

const knows = (g: Game, owner: number, id: string): boolean => !!g.players[owner]?.techs.has(id);

/** As the sitting begins: mark this side's works standing half-built, begun before it. */
export function markBegun(g: Game, owner: number): number {
  let k = 0;
  for (const b of g.buildings) if (b.owner === owner && !b.dead && !b.complete) { b.begun = true; k++; }
  return k;
}
/** How fast a work is built: STUDY_TOWN.steward for one begun before the sitting, its people knowing Stewardship; else 1. */
export const studyBuild = (g: Game, b: Building): number => (b.begun && knows(g, b.owner, 'stewardship') ? STUDY_TOWN.steward : 1);
/** The share of a guard's watch it takes to take a thief in this side's town: STUDY_TOWN.law under Written Law. */
export const lawGuard = (g: Game, owner: number): number => (knows(g, owner, 'writtenlaw') ? STUDY_TOWN.law : 1);
/** The share of a watch it takes to show one of the great true: STUDY_TOWN.spies with Spymasters. */
export const spyWatch = (g: Game, owner: number): number => (knows(g, owner, 'spymasters') ? STUDY_TOWN.spies : 1);
/** How readily care brings the drifted back: STUDY_TOWN.feast with Feast Days. */
export const feastCare = (g: Game, owner: number): number => (knows(g, owner, 'feastdays') ? STUDY_TOWN.feast : 1);
