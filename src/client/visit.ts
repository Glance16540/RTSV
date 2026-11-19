// A visit to one of your own towns from the campaign map: the button on the land's panel, the clock and the way
// out while you are there, and the carrying of what you built back to the map. The rules are in src/sim/visit.ts.
import { homeNow } from '../sim/furlough';
import { showBriefing } from './briefing';
import type { BattleConfig, Campaign } from '../sim/campaign';
import type { Ground, Standing } from '../sim/game';
import { VISIT_SECONDS, beginVisit, canVisit, finishVisit, visitArms, visitBar } from '../sim/visit';
import { learnedIn } from '../sim/studies';
import type { VisitAfter } from '../sim/visit';
import { driftedIn } from '../sim/driftintown';
import { storyOut } from '../sim/fieldstory';
import { handRoadsOut } from '../sim/handroads';
import { courtOut } from '../sim/courtfield';
import type { App } from './main';

const RESULT_KEY = 'rtsv-visit-result';
export const VISIT_SAVE_KEY = 'rtsv-visit-save';
const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The button for the land's panel on the campaign screen, or a line saying why the town cannot be entered. Nothing for a land that is not yours. */
export function visitButton(c: Campaign, tid: number): string {
  if (c.territories[tid]?.owner !== 0) return '';
  const bar = visitBar(c, tid), mins = Math.round(VISIT_SECONDS / 60);
  return `<button data-visit="${tid}" title="${bar || `Play up to ${mins} minutes of this season in the town itself: build, train and set people to work, with no enemy there. What you build stays.`}" ${bar ? 'disabled' : ''}>Enter the town <small>${mins} min</small></button>` +
    (c.territories[tid].visited === c.turn ? '<div class="hint">You have visited this town this season.</div>' : '');
}

/** Make the button work: it is drawn by the campaign screen and answered here. */
export function mountVisits(c: Campaign, save: () => void, go: (query: string) => void): void {
  document.getElementById('ow-actions')?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-visit]');
    if (!b || !canVisit(c, Number(b.dataset.visit))) return;
    if (beginVisit(c, Number(b.dataset.visit))) { save(); go('?visit=1'); }
  });
}

/** Back on the campaign map: take in what the visit sent home. A visit that was walked out on without leaving is forgotten. */
export function returnFromVisit(c: Campaign): boolean {
  if (!c.visit) return false;
  let after: VisitAfter | null = null;
  try { after = JSON.parse(localStorage.getItem(RESULT_KEY) ?? 'null') as VisitAfter | null; localStorage.removeItem(RESULT_KEY); } catch { /* storage unavailable */ }
  if (after) return finishVisit(c, after);
  c.visit = null;
  return false;
}

/** In the town: the word before it, the clock, the way out, and no advancing of the age. */
export function enterVisit(app: App, cfg: BattleConfig, resumed: boolean, back: () => void): void {
  const start = document.getElementById('start')!;
  start.querySelector('h1')!.textContent = cfg.title;
  showBriefing(start, app.game, app.pid, 'visit', Math.round(VISIT_SECONDS / 60)); // the visit's own briefing, not the skirmish's (briefing.ts)
  start.querySelector<HTMLElement>('.levels .resume')!.textContent = resumed ? 'Back to the town' : 'Enter the town';
  document.body.classList.add('visiting');

  // Age belongs to the nation: the order is refused here, whatever the town can afford.
  const game = app.game;
  game.cmdAgeUp = (owner: number): boolean => {
    game.events.push({ t: 'msg', player: owner, text: 'Your nation advances to a new age on the map, not in a town.' });
    return false;
  };

  let gone = false;
  const leave = (): void => {
    if (gone) return;
    gone = true;
    const after: VisitAfter = {
      town: app.game.standing(app.pid), orders: app.game.orders(app.pid), leave: homeNow(app.game, app.pid), ground: app.game.ground(), virtue: app.game.players[app.pid].virtue, seconds: Math.min(VISIT_SECONDS, app.game.time),
      folk: app.game.census(app.pid), // its people and stores go home with it (township.ts)
      drifted: driftedIn(app.game, app.pid), // and who has drifted to the tavern and the mine (driftintown.ts)
      arms: visitArms(app.game.units, app.pid), // and its soldiers: the army's losses, and companies trained here (visit.ts)
      studies: learnedIn(app.game.players[app.pid].techs), // and what was learned here, the nation's now (studies.ts)
      story: storyOut(app.game, app.pid), // and what came of a story afoot here (fieldstory.ts)
      roads: handRoadsOut(app.game, app.pid), // and the roads laid by hand here, which the town keeps (handroads.ts)
      court: courtOut(app.game, app.pid), // and of a story of the leader's house (courtfield.ts)
    };
    try { localStorage.setItem(RESULT_KEY, JSON.stringify(after)); localStorage.removeItem(VISIT_SAVE_KEY); } catch { /* storage unavailable */ }
    back();
  };
  // If the town is lost to fire or beasts there is nothing more to order: the visit is over.
  app.onGameOver = leave;

  const box = document.createElement('div');
  box.id = 'visit';
  box.innerHTML = '<div><b></b><span></span></div><small>No enemy is here. What you build stays.</small><button>Leave the town</button>';
  document.getElementById('hud')!.append(box);
  box.querySelector('button')!.addEventListener('click', leave);
  box.querySelector('b')!.textContent = cfg.title;
  const clock = box.querySelector('span')!;
  const tick = (): void => {
    if (gone) return;
    const left = Math.max(0, VISIT_SECONDS - app.game.time);
    clock.textContent = `${mmss(left)} left`;
    box.classList.toggle('ending', left <= 60);
    if (left <= 0 || app.game.players[app.pid].defeated) leave();
  };
  tick();
  setInterval(tick, 250);
}
