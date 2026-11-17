// A siege is lifted when the besieging army is spent (src/sim/siegelift.ts): a siege the player sits through still ends.
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { BESIEGE } from '../src/sim/besieger';
import { battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { LIFT, liftClock, spent } from '../src/sim/siegelift';
import { run } from './helpers';

/** A rival's army marched on the player's capital, fought as a campaign battle with the player's side left idle. */
function siege(infantry: number, mode: 'siege' | 'field' = 'siege'): Game {
  const c = newCampaign(4, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const next = c.territories[home.adj[0]];
  next.owner = 1;
  c.armies.push({ id: 99, owner: 1, at: next.id, units: { infantry, archers: 1 }, hero: false, vet: 0, moved: false });
  c.phase = 'ai';
  expect(moveArmy(c, 99, home.id)).toBe('battle');
  c.pending!.mode = mode;
  const cfg = battleConfig(c)!;
  const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  return g;
}
const fighters = (g: Game, pid: number) => g.units.filter((u) => u.owner === pid && !u.dead && g.isMilitary(u));
/** The besieger's army thinned to `left` fighters, the rest gone as if fallen in the assault. */
function thin(g: Game, left: number): void { for (const u of fighters(g, 1).slice(left)) g.perish(u); }

describe('siegelift', () => {
  it('a besieger in strength, or still forming up, is not spent; nor is the defender', () => {
    const g = siege(6);
    expect(spent(g, 1)).toBe(false); // forming up
    run(g, BESIEGE.form + 1);
    thin(g, 1);
    expect(spent(g, 0)).toBe(false); // the town's holder is never a besieger
    const strong = siege(6);
    run(strong, BESIEGE.form + 1);
    expect(fighters(strong, 1).length).toBeGreaterThanOrEqual(LIFT.fewest);
    expect(spent(strong, 1)).toBe(false);
  });

  it('a spent besieger is warned, and after the grace lifts the siege: the town has held', () => {
    const g = siege(6);
    run(g, BESIEGE.form + 1);
    thin(g, 1);
    expect(spent(g, 1)).toBe(true);
    run(g, 2);
    expect(g.players[1].liftDue).toBeGreaterThan(g.time);
    expect(g.winner).toBe(-1);
    run(g, LIFT.grace + 2);
    expect(g.players[1].defeated).toBe(true);
    expect(g.winner).toBe(0);
  });

  it('a besieger that raises fighters again in time stops the clock', () => {
    const g = siege(6);
    run(g, BESIEGE.form + 1);
    thin(g, 1);
    run(g, 2);
    expect(g.players[1].liftDue).toBeDefined();
    const by = g.units.find((u) => u.owner === 1 && !u.dead)!;
    for (let i = 0; i < LIFT.fewest; i++) g.spawnUnit(g.trainedAs(1, 'clubman'), 1, by.x, by.y);
    expect(liftClock(g, 1)).toBe('eased');
    expect(g.players[1].liftDue).toBeUndefined();
  });

  it('a works that trains fighters, with someone to train, is the means to go on', () => {
    const g = siege(6);
    run(g, BESIEGE.form + 1);
    thin(g, 1);
    const v = g.units.find((u) => u.owner === 1 && u.type === 'villager' && !u.dead)!;
    g.spawnBuilding('barracks', 1, Math.round(v.x) + 3, Math.round(v.y) + 3, false);
    expect(spent(g, 1)).toBe(false);
  });

  it('a field battle is not touched', () => {
    const g = siege(6, 'field');
    run(g, BESIEGE.form + 1);
    expect(spent(g, 1)).toBe(false);
  });

  it('a siege the defender sits through ends, won or lost, within a few minutes', () => {
    for (const [infantry, want] of [[2, 0], [14, 1]] as const) {
      const g = siege(infantry);
      const ai = new AIController(g, 1);
      for (let s = 0; s < 15 * 60 && g.winner < 0; s++) { run(g, 1); ai.update(); }
      expect(g.winner, `${infantry} companies`).toBe(want);
    }
  }, 300_000);
});
