// Lessons for the moment: each falls due when its occasion comes, is told once, and quotes the rules' own numbers.
import { describe, expect, it } from 'vitest';
import { FIRE } from '../src/sim/calamity';
import { BUILDINGS } from '../src/sim/data';
import { FAMINE } from '../src/sim/famine';
import { Game } from '../src/sim/game';
import { GLUT, FRESH, lessons, lessonsDue, nextLesson } from '../src/sim/lessons';
import { run, setups, spot } from './helpers';

const start = () => { const g = new Game(5, setups, 72); run(g, 1); return g; };
const hall = (g: Game) => g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;

describe('lessons for the moment', () => {
  it('has nothing to say to a town where nothing has happened', () => {
    expect(lessonsDue(start(), 0)).toEqual([]);
  });

  it('teaches fire-fighting when a building of yours burns, and famine when the store stays bare', () => {
    const g = start();
    hall(g).burnT = 12;
    expect(lessonsDue(g, 0)).toEqual(['fire']);
    hall(g).burnT = 0;
    g.players[0].hunger = FAMINE.hungry;
    expect(lessonsDue(g, 0)).toEqual(['hungry']);
    expect(lessonsDue(g, 1)).toEqual([]);
  });

  it('teaches walls after an attack, the tower once it can be built, and neither to a town that has them', () => {
    const g = start(), p = g.players[0];
    p.lastAttacked = { x: 1, y: 1, t: g.time };
    expect(lessonsDue(g, 0)).toEqual(['walls']);
    p.age = 1;
    expect(lessonsDue(g, 0)).toEqual(['walls', 'tower']);
    const at = spot(g, 'tower', 0);
    g.spawnBuilding('tower', 0, at.cx, at.cy, true);
    const w = spot(g, 'palisade', 0);
    g.spawnBuilding('palisade', 0, w.cx, w.cy, true);
    expect(lessonsDue(g, 0)).toEqual([]);
    // Old news is not news.
    const h = new Game(5, setups, 72);
    h.players[0].lastAttacked = { x: 1, y: 1, t: 0 };
    run(h, FRESH + 2);
    expect(lessonsDue(h, 0)).toEqual([]);
  });

  it('teaches the market to a town with a glut and a want, and the work camp to a decadent one', () => {
    const g = start(), p = g.players[0];
    p.age = 1;
    p.res.wood = GLUT; p.res.gold = 0;
    expect(lessonsDue(g, 0)).toEqual(['market']);
    p.res.gold = 200;
    expect(lessonsDue(g, 0)).toEqual([]);
    p.virtue = -80;
    expect(lessonsDue(g, 0)).toEqual(['camp']);
    p.age = 0;
    expect(lessonsDue(g, 0)).toEqual([]);
  });

  it('tells the most pressing first, and never the same one twice', () => {
    const g = start(), p = g.players[0];
    hall(g).burnT = 12;
    p.hunger = FAMINE.starving;
    expect(nextLesson(g, 0, [])!.id).toBe('fire');
    expect(nextLesson(g, 0, ['fire'])!.id).toBe('hungry');
    expect(nextLesson(g, 0, ['fire', 'hungry'])).toBeNull();
  });

  it('quotes the numbers the rules use', () => {
    const by = Object.fromEntries(lessons().map((l) => [l.id, l.text]));
    expect(by.fire).toContain(`${FIRE.hands} of them`);
    expect(by.hungry).toContain(`every ${FAMINE.toll} seconds`);
    expect(by.walls).toContain(`${BUILDINGS.palisade.cost.wood} wood`);
    expect(by.tower).toContain(`${BUILDINGS.tower.range} tiles`);
    expect(by.camp).toContain(`up to ${BUILDINGS.workcamp.guards}`);
  });
});
