// A besieger assaults: the attacking side of a campaign siege goes in with what it brought (src/sim/besieger.ts).
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { BESIEGE, assaultDue, besieging } from '../src/sim/besieger';
import { battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { setups as plain } from './helpers';

/** A rival's army marched on the player's capital, as the pending battle of a campaign. */
function marched(mode: 'siege' | 'field', playerAttacks = false) {
  const c = newCampaign(4, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const next = c.territories[home.adj[0]];
  next.owner = 1;
  if (playerAttacks) {
    c.armies = c.armies.filter((a) => a.at !== next.id);
    c.armies.push({ id: 98, owner: 0, at: home.id, units: { infantry: 6 }, hero: false, vet: 0, moved: false });
    expect(moveArmy(c, 98, next.id)).toBe('battle');
  } else {
    c.armies.push({ id: 99, owner: 1, at: next.id, units: { infantry: 6, archers: 3 }, hero: false, vet: 0, moved: false });
    c.phase = 'ai';
    expect(moveArmy(c, 99, home.id)).toBe('battle');
  }
  c.pending!.mode = mode;
  return battleConfig(c)!;
}
const stateOf = (a: AIController): string => (a.save() as { state: string }).state;

describe('who is a besieger', () => {
  it('the attacking side of a campaign siege, whichever it is; nobody in a field battle, and never the defender', () => {
    const siege = marched('siege');
    expect(siege.humanAttacks).toBe(false);
    expect(siege.setups[0].besieger).toBeUndefined(); // the town's holder
    expect(siege.setups[1].besieger).toBe(true);
    const mine = marched('siege', true);
    expect(mine.humanAttacks).toBe(true);
    expect(mine.setups[0].besieger).toBe(true);
    expect(mine.setups[1].besieger).toBeUndefined();
    const field = marched('field');
    expect(field.setups.some((s) => s.besieger)).toBe(false);
  });

  it('the assault is due once it has formed up, with fighters enough, and not while it is itself attacked', () => {
    const cfg = marched('siege');
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    expect(besieging(g, 1)).toBe(true);
    expect(besieging(g, 0)).toBe(false);
    expect(assaultDue(g, 1, 9, false)).toBe(false); // not formed up yet
    g.time = BESIEGE.form;
    expect(assaultDue(g, 1, 9, false)).toBe(true);
    expect(assaultDue(g, 1, BESIEGE.least - 1, false)).toBe(false);
    expect(assaultDue(g, 1, 9, true)).toBe(false);
    expect(assaultDue(g, 0, 9, false)).toBe(false); // the defender is no besieger
  });
});

describe('the computer as a besieger', () => {
  const play = (cfg: ReturnType<typeof marched>, seconds: number) => {
    const setups = cfg.setups.map((s) => ({ ...s, isAI: true }));
    const g = new Game(cfg.seed, setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    g.fixedAge = true; g.bornOnly = true;
    const ais = setups.map((_, i) => { const a = new AIController(g, i); a.setLevel(1); return a; });
    let first = -1;
    for (let s = 0; s < seconds && g.winner < 0; s++) {
      for (let i = 0; i < 20; i++) { g.step(); g.events.length = 0; }
      ais.forEach((a) => a.update());
      if (first < 0 && stateOf(ais[1]) === 'attack') first = s;
    }
    return { first, g, ais };
  };

  it('goes in within moments of forming up, long before a skirmish would allow a first attack; marked as no besieger, the same army waits', () => {
    const cfg = marched('siege');
    const went = play(cfg, BESIEGE.form + 30);
    expect(went.first).toBeGreaterThanOrEqual(BESIEGE.form - 1);
    expect(went.first).toBeLessThanOrEqual(BESIEGE.form + 10);
    expect(went.first).toBeLessThan(went.ais[1].firstAttack);
    const waits = play({ ...cfg, setups: cfg.setups.map((s) => ({ ...s, besieger: undefined })) }, BESIEGE.form + 30);
    expect(waits.first).toBe(-1);
  }, 60000);

  it('a skirmish is unchanged: nobody is a besieger there, and nobody attacks in the first minutes', () => {
    const g = new Game(7, plain.map((s) => ({ ...s, isAI: true })));
    const ais = [0, 1].map((i) => { const a = new AIController(g, i); a.setLevel(1); return a; });
    expect(besieging(g, 0) || besieging(g, 1)).toBe(false);
    for (let s = 0; s < BESIEGE.form + 60; s++) { for (let i = 0; i < 20; i++) g.step(); g.events.length = 0; ais.forEach((a) => a.update()); expect(ais.map(stateOf)).toEqual(['build', 'build']); }
  }, 60000);
});
