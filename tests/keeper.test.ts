// A town kept in peace (src/sim/keeper.ts): the computer keeping a campaign town with no enemy about raises no
// works of war, which a visit would leave on the map for the town's men to be raised from.
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { newCampaign } from '../src/sim/campaign';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { MILITARY_WORKS, inPeace } from '../src/sim/keeper';
import { run, setups } from './helpers';

const works = (g: Game, owner: number) => g.buildings.filter((b) => b.owner === owner && (MILITARY_WORKS.includes(b.type) || b.def.wall)).map((b) => b.type);

describe('a town kept in peace', () => {
  it('is a campaign town with nobody hostile in the game and no marauders', () => {
    const g = new Game(7, setups);
    expect(inPeace(g, 0)).toBe(false); // a skirmish
    g.bornOnly = true;
    expect(inPeace(g, 0)).toBe(false); // a rival is in the game
    g.players[1].defeated = true;
    expect(inPeace(g, 0)).toBe(true);
    g.marauders = true;
    expect(inPeace(g, 0)).toBe(false);
  });

  it('a visit kept by the computer raises no works of war, and leaves none on the map', () => {
    const c = newCampaign(1, 2, 1, 'hearth'), t = c.territories.find((x) => x.capital === 0)!;
    beginVisit(c, t.id);
    const cfg = visitConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups.map((s) => ({ ...s, isAI: true })), cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    g.fixedAge = true; g.bornOnly = true;
    expect(inPeace(g, 0)).toBe(true);
    const ai = new AIController(g, 0); ai.setLevel(1);
    const had = works(g, 0).length;
    run(g, 600, () => ai.update());
    expect(works(g, 0).length).toBe(had);
    const before = [...t.buildings];
    finishVisit(c, { town: g.standing(0), ground: g.ground(), virtue: g.players[0].virtue, seconds: g.time, folk: g.census(0) });
    expect(t.buildings.filter((b) => !before.includes(b) && ['barracks', 'range', 'stable'].includes(b))).toEqual([]);
  }, 120_000);

  it('in a skirmish, with an enemy in the game, the computer still raises its barracks', () => {
    const g = new Game(11, [{ ...setups[0], isAI: true, civ: 'forge' }, setups[1]]);
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    ais.forEach((a) => a.setLevel(1));
    run(g, 60 * 8, () => ais.forEach((a) => a.update()));
    expect(works(g, 0)).toContain('barracks');
  }, 120_000);
});
