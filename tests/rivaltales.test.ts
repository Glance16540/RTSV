// Rivals have tales of their own (src/sim/rivaltales.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { TALES } from '../src/sim/story';
import { rivalAnswer, rivalTales } from '../src/sim/rivaltales';
import { storyTurn, taleDueNow } from '../src/sim/storyturn';
import { nationVirtue } from '../src/sim/townfaith';

const world = (): Campaign => { const c = newCampaign(9, 2, 1, 'hearth'); c.turn = 30; return c; };
const tale = (id: string) => TALES.find((x) => x.id === id)!;
const landOf = (c: Campaign, f: number): number => c.territories.find((t) => t.owner === f && !t.horde)!.id;

describe('a rival\'s tale', () => {
  it('each rival the computer leads is brought one when a tale is due, and the chronicle tells it in a line', () => {
    const c = world();
    const before = (c.chronicle ?? []).length;
    const got = rivalTales(c);
    const rivals = c.factions.filter((f) => f.alive && f.isAI && f.id > 0);
    expect(got.map((x) => x.f)).toEqual(rivals.map((f) => f.id));
    const lines = (c.chronicle ?? []).slice(before).map((x) => x.text);
    expect(lines.length).toBe(rivals.length);
    for (const [i, f] of rivals.entries()) expect(lines[i]).toMatch(new RegExp(`^Among the ${f.name}, .*: they took the (upright|other) way\\.$`));
  });

  it('is one that could come to anybody: never a thread\'s, nor a named place\'s', () => {
    for (let t = 20; t < 80; t++) {
      const c = world(); c.turn = t;
      for (const x of rivalTales(c)) { const y = tale(x.id); expect(y.after).toBeUndefined(); expect(y.opens).toBeUndefined(); expect(y.place).toBeUndefined(); }
    }
  });

  it('is answered by its lean: the upright way when it leans so and can pay for it, else the other', () => {
    const c = world(), f = 1, land = landOf(c, f), x = tale('pilgrims');
    c.factions[f].supplies = 0; // it cannot pay for the upright answer
    expect(rivalAnswer(c, f, x, land)).toBe('b');
    let upright = 0, other = 0;
    for (let t = 20; t < 220; t++) { c.turn = t; c.factions[f].supplies = 999; if (rivalAnswer(c, f, x, land) === 'a') upright++; else other++; }
    expect(upright).toBeGreaterThan(0);
    expect(other).toBeGreaterThan(0);
  });

  it('goes through the rules there are: its standing moves by the answer', () => {
    const c = world();
    const was = c.factions.map((f) => nationVirtue(c, f.id));
    const got = rivalTales(c);
    for (const x of got) {
      const v = tale(x.id)[x.choice].virtue;
      if (v) expect(Math.sign(nationVirtue(c, x.f) - was[x.f])).toBe(Math.sign(v));
    }
  });

  it('brings a rival nothing it would bring in: no supplies, no company, no land; what it costs is paid', () => {
    for (let t = 20; t < 120; t++) {
      const c = world(); c.turn = t;
      const lands = c.territories.map((x) => x.owner), armies = c.armies.map((a) => `${a.id}:${JSON.stringify(a.units)}`).join(), had = c.factions.map((f) => f.supplies);
      const got = rivalTales(c);
      expect(c.territories.map((x) => x.owner)).toEqual(lands);
      expect(c.armies.map((a) => `${a.id}:${JSON.stringify(a.units)}`).join()).toBe(armies);
      for (const x of got) {
        const ch = tale(x.id)[x.choice];
        if (ch.supplies >= 0) expect(c.factions[x.f].supplies).toBeLessThanOrEqual(had[x.f]);
      }
    }
  });

  it('comes with the player\'s, as a tale is due, and not between', () => {
    const c = world();
    c.taleDue = c.turn + 1;
    const before = (c.chronicle ?? []).length;
    storyTurn(c);
    expect((c.chronicle ?? []).slice(before).some((x) => x.text.startsWith('Among the'))).toBe(false);
    c.turn++;
    expect(taleDueNow({ ...c } as Campaign)).toBe(true);
    storyTurn(c);
    expect((c.chronicle ?? []).slice(before).some((x) => x.text.startsWith('Among the'))).toBe(true);
  });

  it('a rival that is the player\'s own, or out of the game, is brought none', () => {
    const c = world();
    c.factions[1].alive = false;
    expect(rivalTales(c).some((x) => x.f === 1 || x.f === 0)).toBe(false);
  });
});
