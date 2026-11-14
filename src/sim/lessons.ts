// Lessons for the moment they are needed: things a first battle's list of steps cannot teach in order, because
// they come when they come. A fire, a bare store, an attack on the town, a glut of one thing and a want of
// another, a town gone decadent. Each is told once, when it first happens, and reads its numbers from the rules.
import { BUILDINGS, TRADE } from './data';
import { FIRE } from './calamity';
import { FAMINE, want } from './famine';
import { isDecadent } from './creed';
import type { Game } from './game';

export interface Lesson { id: string; title: string; text: string }

/** A store with this much of one thing and under `SHORT` of another is worth a Market. */
export const GLUT = 400, SHORT = 50;
/** An attack on the town counts as news for this many seconds. */
export const FRESH = 20;

/** Every lesson there is, in the order they are told when several fall due together: the most pressing first. */
export function lessons(): Lesson[] {
  const wall = BUILDINGS.palisade, stone = BUILDINGS.stonewall, tower = BUILDINGS.tower, camp = BUILDINGS.workcamp;
  return [
    { id: 'fire', title: 'Fire in the town',
      text: `Select villagers and right-click the burning building: they beat the fire down before they mend anything, up to ${FIRE.hands} of them usefully at once. Idle villagers within ${FIRE.turnout} tiles go to it by themselves. A fire left alone can catch the building beside it; rain puts fires out.` },
    { id: 'hungry', title: 'The store is bare',
      text: `Your people are going hungry. If the store stays empty for another ${FAMINE.starving - FAMINE.hungry} seconds it is famine, and one of the town is lost every ${FAMINE.toll} seconds: the old first, then the children. One load of food carried home ends it, so send villagers to berries, game or a farm now.` },
    { id: 'walls', title: 'They have come for your town',
      text: `A ${wall.name} keeps raiders out: select a villager, choose ${wall.name} and drag a line (${wall.cost.wood} wood a piece). It stops your own people too, so set a ${BUILDINGS.gate.name} in it. Ring the town bell at the Town Center to send villagers under cover.` },
    { id: 'tower', title: 'Stone for defence',
      text: `From the Bronze Age a villager can build a ${stone.name} (${stone.cost.stone} stone a piece) in place of timber, and on the military page a ${tower.name} (${tower.cost.wood} wood, ${tower.cost.stone} stone): it shoots at enemies ${tower.range} tiles off and shelters ${tower.shelter} of your people, who make it shoot faster.` },
    { id: 'market', title: 'Too much of one thing',
      text: `A ${BUILDINGS.market.name} (${BUILDINGS.market.cost.wood} wood) turns what you have too much of into what you lack. It sells 100 food for ${TRADE.food!.sell} gold, wood for ${TRADE.wood!.sell} and stone for ${TRADE.stone!.sell}, and buys them back dearer.` },
    { id: 'camp', title: 'A decadent town takes captives',
      text: `Your town has turned Decadent, so it may build a ${camp.name} (military page, ${camp.cost.wood} wood) and train Slavers. A Slaver right-clicks an enemy villager to seize them and lead them to the camp. Every man held there makes the whole town gather faster. Post Slavers inside as guards, up to ${camp.guards}: by night the unwatched slip away.` },
  ];
}

/** The lessons whose moment has come for this player, most pressing first. It does not know which were told before. */
export function lessonsDue(g: Game, pid: number): string[] {
  if (g.field) return [];
  const p = g.players[pid];
  if (!p || p.defeated) return [];
  const mine = g.buildings.filter((b) => b.owner === pid && !b.dead);
  const has = (type: string): boolean => mine.some((b) => b.type === type);
  const struck = !!p.lastAttacked && g.time - p.lastAttacked.t <= FRESH;
  const stocks = [p.res.food, p.res.wood, p.res.stone], all = [...stocks, p.res.gold];
  const due: string[] = [];
  if (mine.some((b) => b.complete && b.burnT > 0)) due.push('fire');
  if (want(p) !== '') due.push('hungry');
  if (struck && !mine.some((b) => b.def.wall)) due.push('walls');
  if (struck && p.age >= BUILDINGS.tower.age && !has('tower')) due.push('tower');
  if (p.age >= BUILDINGS.market.age && !has('market') && Math.max(...stocks) >= GLUT && Math.min(...all) < SHORT) due.push('market');
  if (isDecadent(p.virtue) && p.age >= BUILDINGS.workcamp.age && !has('workcamp')) due.push('camp');
  return due;
}

/** The next lesson to tell: the most pressing one that is due and has not been told. */
export function nextLesson(g: Game, pid: number, told: string[]): Lesson | null {
  const id = lessonsDue(g, pid).find((d) => !told.includes(d));
  return id ? lessons().find((l) => l.id === id) ?? null : null;
}
