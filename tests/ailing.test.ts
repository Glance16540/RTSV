// A town comes to a battle or a visit as sick and as hungry as the map has it (src/sim/ailing.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { AILING, ailingIn, ailingOf } from '../src/sim/ailing';
import { CONTAGION } from '../src/sim/contagion';
import { FAMINE } from '../src/sim/famine';
import { beginVisit, visitConfig } from '../src/sim/visit';
import { folkOf } from '../src/sim/township';
import { setups } from './helpers';

const world = () => {
  const c = newCampaign(7, 1, 1, 'hearth');
  c.turn = 12;
  const t = c.territories.find((x) => x.capital === 0)!;
  return { c, t };
};

describe('the map\'s ills on the map', () => {
  it('a town well and fed brings nothing; plague brings a few sick, at least one and at most a few; hunger brings hunger', () => {
    const { c, t } = world();
    expect(ailingOf(c, t.id)).toBeUndefined();
    (c.events ??= []).push({ kind: 'plague', at: t.id, turn: c.turn, until: c.turn + 1 });
    const f = folkOf(c, t.id), grown = f.men + f.women + f.elders;
    expect(ailingOf(c, t.id)).toEqual({ sick: Math.min(AILING.most, Math.max(1, Math.round(grown * AILING.share))) });
    c.events = [{ kind: 'famine', at: t.id, turn: c.turn, until: c.turn }];
    expect(ailingOf(c, t.id)).toEqual({ hungry: true });
    c.events = [{ kind: 'famine', at: t.id, turn: c.turn - 1, until: c.turn - 1 }];
    expect(ailingOf(c, t.id)).toBeUndefined(); // last season's failed harvest is the larder's now
    f.drift = { strain: 0.4, care: 0, moved: 0, hungry: true, raided: false };
    expect(ailingOf(c, t.id)).toEqual({ hungry: true });
  });

  it('a plague that has passed brings nobody sick', () => {
    const { c, t } = world();
    c.events = [{ kind: 'plague', at: t.id, turn: c.turn - 3, until: c.turn - 1 }];
    expect(ailingOf(c, t.id)).toBeUndefined();
  });
});

describe('in the town', () => {
  it('so many grown villagers begin sick, for a short while, and the people hungry', () => {
    const g = new Game(5, setups);
    const p = g.players[0];
    expect(ailingIn(g, 0, { sick: 2, hungry: true })).toBe(2);
    const sick = g.units.filter((u) => u.owner === 0 && u.plagueT > 0);
    expect(sick).toHaveLength(2);
    for (const u of sick) { expect(u.type).toBe('villager'); expect(u.plagueT).toBe(CONTAGION.least); }
    expect(p.hunger).toBe(FAMINE.hungry);
    expect(g.units.filter((u) => u.owner === 1 && u.plagueT > 0)).toHaveLength(0);
  });

  it('asks no more than AILING.most, and nonsense is nothing', () => {
    const g = new Game(5, setups);
    expect(ailingIn(g, 0, { sick: 99 })).toBeLessThanOrEqual(AILING.most);
    const h = new Game(5, setups);
    expect(ailingIn(h, 0, { sick: 'x' as unknown as number, hungry: 'yes' as unknown as boolean })).toBe(0);
    expect(h.players[0].hunger ?? 0).toBe(0);
  });

  it('a visit to a plagued, hungry town carries both onto the field', () => {
    const { c, t } = world();
    c.events = [{ kind: 'plague', at: t.id, turn: c.turn, until: c.turn + 1 }, { kind: 'famine', at: t.id, turn: c.turn, until: c.turn }];
    c.phase = 'player';
    expect(beginVisit(c, t.id)).toBe(true);
    const cfg = visitConfig(c)!;
    expect(cfg.setups[0].bonus?.ailing).toMatchObject({ hungry: true });
    expect(cfg.setups[0].bonus?.ailing?.sick).toBeGreaterThan(0);
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    expect(g.units.some((u) => u.owner === 0 && u.plagueT > 0)).toBe(true);
    expect(g.players[0].hunger).toBe(FAMINE.hungry);
  });
});
