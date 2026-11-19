// A guide for a visit (docs/systems-board, "Visiting a town": the first-steps guide is put away during a visit and
// nothing took its place but one line on the slip).
//
// A visit is not a battle: no enemy comes, the map waits, and what is done in the town goes home with it. Four steps,
// each read from the visit's own rules, each put by when its moment has passed:
//   1. what a visit is for (done once the player sets anyone to other work or begins anything, or after 45 seconds);
//   2. that the season does not move while the player is here (done after the first minute);
//   3. what goes home with the town (done once a building is begun, or after three minutes);
//   4. how to leave (done when the player leaves: it stays up to the end).
// It is shown on the player's first visit only, as the first-steps guide is in a battle (the client keeps that).
import type { Game } from './game';
import type { GuideStep } from './raiderguide';
import { workChanged } from './atwork';

/** The visit's steps, in order. `minutes`: how long a visit lasts (visit.ts VISIT_SECONDS). */
export function visitSteps(g: Game, pid: number, minutes: number): GuideStep[] {
  const mine = g.buildings.filter((b) => b.owner === pid && !b.dead);
  const begun = mine.some((b) => !b.complete), working = workChanged(g, pid); // the town turns out at work by itself (atwork.ts): it is the player's own orders that count
  return [
    { title: 'A visit to your own town', how: 'No enemy is here. Build, train and set your people to work: select villagers and right-click trees, fields or a place to build.', done: working || begun || g.time > 45 },
    { title: 'The season waits for you', how: `The map does not move while you are here. You have ${minutes} minutes in the town, and the season is the one you came in.`, done: g.time > 60 },
    { title: 'What goes home', how: 'What you build stays. The town\'s people and stores, the roads you lay, what is learned here and the soldiers you train all go back to the map with it.', done: begun || g.time > 180 },
    { title: 'Leaving the town', how: 'When you are done, press Leave the town on the slip at the top. When the clock runs out you leave of yourself.', done: false },
  ];
}
