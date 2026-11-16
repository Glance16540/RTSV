// The Noble's Manor (src/sim/manor.ts): the lord's own house in a large town.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { MANOR, lordSay, manorAt } from '../src/sim/manor';
import { manorSeason } from '../src/sim/rule';
import { raiseBar, raiseWork } from '../src/sim/townworks';
import { layTown } from '../src/sim/rivalrule';
import { folkOf } from '../src/sim/township';
import { NOBLES, heardDecree, noblesAt, noblesSeason } from '../src/sim/nobles';
import { Game } from '../src/sim/game';
import { setups, spot } from './helpers';

const world = (grown = 14): { c: Campaign; tid: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  for (const x of c.factions) x.age = 1;
  const f = folkOf(c, tid);
  f.men = Math.ceil(grown / 2); f.women = Math.floor(grown / 2); f.elders = 0; delete f.ages; delete f.hungry;
  f.stores = { food: 3000, wood: 3000, gold: 3000, stone: 3000 };
  layTown(c, tid);
  delete c.factions[0].nobles;
  noblesSeason(c, 0);
  return { c, tid };
};
const lordOf = (c: Campaign, tid: number) => noblesAt(c, tid).find((n) => n.rank === 'lord')!;

describe('the Noble\'s Manor', () => {
  it('is raised only in a town of twelve grown people or more', () => {
    const small = world(8);
    expect(raiseBar(small.c, 0, small.tid, 'manor')).toMatch(/12 grown/);
    const { c, tid } = world();
    expect(raiseWork(c, 0, tid, 'manor')).toBe('');
    expect(manorAt(c, tid)).toBe(false); // begun
  });

  it('the lord grows content in it, but every decree moves him twice as far', () => {
    const { c, tid } = world();
    const lord = lordOf(c, tid);
    lord.leaning = 'pious'; lord.mood = 0;
    heardDecree(c, 0, tid, 'tavernWomen', 1);
    const without = lord.mood;
    expect(without).toBe(-NOBLES.sway);
    c.territories[tid].town!.b.push(['manor', 4, 4]);
    expect(lordSay(c, tid)).toBe(MANOR.say);
    lord.mood = 0;
    heardDecree(c, 0, tid, 'tavernWomen', 1);
    expect(lord.mood).toBe(-NOBLES.sway * MANOR.say);
    lord.mood = 0;
    noblesSeason(c, 0);
    expect(lordOf(c, tid).mood).toBe(MANOR.content);
  });

  it('a rival raises one in its largest town that has none, when it can spare the stores', () => {
    const { c } = world();
    const r = c.territories.find((t) => t.capital === 1)!, f = folkOf(c, r.id);
    f.men = 8; f.women = 8; f.elders = 0; delete f.ages;
    layTown(c, r.id);
    f.stores = { food: 100, wood: 100, gold: 100, stone: 100 };
    expect(manorSeason(c, 1)).toBe(false);
    f.stores = { food: 3000, wood: 3000, gold: 3000, stone: 3000 };
    expect(manorSeason(c, 1)).toBe(true);
    expect(manorSeason(c, 1)).toBe(false);
  });

  it('in a town, too, only where there are twelve grown', () => {
    const g = new Game(3, setups);
    const at = spot(g, 'manor', 0);
    g.players[0].age = 1; g.players[0].res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
    const few = g.units.filter((u) => u.owner === 0 && u.type === 'villager').length;
    expect(few).toBeLessThan(12);
    expect(g.cmdPlace(0, 'manor', at.cx, at.cy, [])).toBeNull();
  });
});
