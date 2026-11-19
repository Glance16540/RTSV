// The first-steps guide for a war band (docs/systems-board, "Teaching": a raiding people were shown the settled
// town's steps, which begin with a Town Center they do not have).
//
// A raiding people (STYLES.raider) begin a battle in the open as a war band: a man and a woman to found a hall, a few
// fighters, a store of wood and stone, and no Town Center (game.ts; raidertown.ts). Their steps, until they settle:
//   1. take people alive: fighters right-click an enemy villager to bind him, and he joins the band;
//   2. put the band's people to work gathering;
//   3. raise the hall when they choose, from the wood and stone set by for it.
// Once the hall stands they are a town, and the settled town's steps follow (hud.ts).
import { BAND, BUILDINGS } from './data';
import type { Game } from './game';

/** One step of a guide: what to do, how, and whether it is done. */
export interface GuideStep { title: string; how: string; done: boolean }

/** Does this player follow the war band's guide: a raiding people in the open, with no hall yet? */
export function onTheMove(g: Game, pid: number): boolean {
  return !g.field && g.warband(pid) && !g.buildings.some((b) => b.owner === pid && b.type === 'towncenter' && !b.dead);
}

/** The war band's steps, in order. */
export function raiderSteps(g: Game, pid: number): GuideStep[] {
  const own = g.units.filter((u) => u.owner === pid && !u.dead);
  const villagers = own.filter((u) => u.type === 'villager');
  const tc = BUILDINGS.towncenter, cost = Object.entries(tc.cost).map(([k, n]) => `${n} ${k}`).join(' and ');
  return [
    { title: 'Take people alive', how: `You begin with ${BAND.fighters} fighters and no town. Select fighters and right-click an enemy villager: they bind them, and they join your band. Every one taken makes you stronger and them weaker.`, done: villagers.length > 2 || g.time > 420 },
    { title: 'Put the band to work', how: 'Your people gather like any villagers: drag a box around them, then right-click berries or trees. Keep them near the fighters, who are all the walls you have.', done: villagers.some((u) => u.order?.t === 'gather') && villagers.length > 2 },
    { title: 'Settle when you choose', how: `A band can raise its ${tc.name} in any age. Select a villager and build one where you mean to stay (${cost}: the band set out with wood and stone for it). Until it stands, you are beaten when the last of your band falls.`, done: g.buildings.some((b) => b.owner === pid && b.type === 'towncenter' && b.complete) },
  ];
}
