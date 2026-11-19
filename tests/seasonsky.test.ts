// The season and the sound of the weather in a battle (src/sim/seasonsky.ts).
import { describe, expect, it } from 'vitest';
import { STORM, THUNDER, seasonLook, seasonOfTurn, strokeAt, thunderOdds, weatherSound } from '../src/sim/seasonsky';
import { newCampaign } from '../src/sim/campaign';
import { beginVisit, visitConfig } from '../src/sim/visit';
import { Game } from '../src/sim/game';
import { run, setups } from './helpers';

describe('the season in a battle', () => {
  it('follows the map: the first turn is spring, and the year turns round', () => {
    expect([0, 1, 2, 3, 4, 7, 9].map(seasonOfTurn)).toEqual(['spring', 'summer', 'autumn', 'winter', 'spring', 'winter', 'summer']);
    const c = newCampaign(7, 1, 1, 'hearth'), tid = c.territories.find((t) => t.capital === 0)!.id;
    c.turn = 3;
    expect(beginVisit(c, tid)).toBe(true);
    expect(visitConfig(c)!.season).toBe('winter');
  });

  it('looks like the season where the land has one: snow and bare boughs in winter, turned leaves in autumn, blossom in spring', () => {
    const winter = seasonLook('winter', 'temperate');
    expect(winter.snow).toBeGreaterThan(0.4);
    expect(winter.bare).toBeGreaterThan(0.9);
    expect(seasonLook('winter', 'snow').snow).toBeGreaterThan(winter.snow);
    expect(seasonLook('autumn', 'temperate').turned).toBeGreaterThan(0.5);
    expect(seasonLook('spring', 'temperate').blossom).toBeGreaterThan(0);
    expect(seasonLook('summer', 'temperate').snow).toBe(0);
    // The desert has no winter; a skirmish or a mission has no season, and looks as it always has.
    for (const s of ['spring', 'autumn', 'winter'] as const) expect(seasonLook(s, 'desert')).toMatchObject({ grass: [0, 0, 0], bare: 0, turned: 0, snow: 0 });
    expect(seasonLook('', 'temperate')).toMatchObject({ season: '', grass: [0, 0, 0], bare: 0, snow: 0, blossom: 0 });
  });

  it('is kept with a battle when it is saved, and moves nothing in it', () => {
    const a = new Game(4, setups, 72), b = new Game(4, setups, 72);
    b.season = 'winter';
    run(a, 120); run(b, 120);
    expect(JSON.parse(b.serialize())).toEqual({ ...JSON.parse(a.serialize()), season: 'winter' }); // the same battle, but for the season
    expect(Game.restore(b.serialize()).season).toBe('winter');
    expect(Game.restore(a.serialize()).season).toBe('');
  });
});

describe('thunder and the sound of the weather', () => {
  const rain = (weatherAmt: number) => ({ weather: 'rain' as const, weatherAmt });

  it('thunders only in a storm, and more the heavier it is', () => {
    expect(thunderOdds(rain(STORM - 0.01))).toBe(0);
    expect(thunderOdds({ weather: 'snow', weatherAmt: 1 })).toBe(0);
    expect(thunderOdds({ weather: 'dust', weatherAmt: 1 })).toBe(0);
    expect(thunderOdds(rain(1))).toBeCloseTo(THUNDER.most);
    expect(thunderOdds(rain(0.8))).toBeGreaterThan(thunderOdds(rain(STORM)));
    const count = (amt: number): number => { let n = 0; for (let k = 0; k < 2000; k++) if (strokeAt(11, k * THUNDER.slot, rain(amt))) n++; return n; };
    expect(count(0.5)).toBe(0);
    expect(count(1) / 2000).toBeGreaterThan(THUNDER.most * 0.8);
    expect(count(1) / 2000).toBeLessThan(THUNDER.most * 1.2);
    expect(count(1)).toBeGreaterThan(count(0.7));
  });

  it('strikes at the same moments for the same battle, within its slot, with the thunder later the further off', () => {
    const strokes = [];
    for (let k = 0; k < 400; k++) {
      const t = k * THUNDER.slot + 1.3, s = strokeAt(5, t, rain(1));
      expect(strokeAt(5, t, rain(1))).toEqual(s);
      if (!s) continue;
      expect(s.at).toBeGreaterThanOrEqual(k * THUNDER.slot);
      expect(s.at).toBeLessThan((k + 1) * THUNDER.slot);
      strokes.push(s);
    }
    expect(strokes.length).toBeGreaterThan(50);
    const sorted = [...strokes].sort((a, b) => a.far - b.far);
    expect(sorted[sorted.length - 1].delay).toBeGreaterThan(sorted[0].delay);
    // Another battle's storm strikes at other moments.
    let same = 0;
    for (let k = 0; k < 400; k++) if (!!strokeAt(5, k * THUNDER.slot, rain(1)) === !!strokeAt(6, k * THUNDER.slot, rain(1))) same++;
    expect(same).toBeLessThan(400);
  });

  it('sounds as heavy as the weather is: rain hisses, wind blows with snow and dust, and fair weather is quiet', () => {
    expect(weatherSound({ weather: '', weatherAmt: 0 })).toEqual({ rain: 0, wind: 0 });
    expect(weatherSound(rain(0.9)).rain).toBeGreaterThan(weatherSound(rain(0.3)).rain);
    expect(weatherSound(rain(0.3)).wind).toBe(0);
    expect(weatherSound(rain(1)).wind).toBeGreaterThan(0);
    expect(weatherSound({ weather: 'snow', weatherAmt: 1 })).toMatchObject({ rain: 0 });
    expect(weatherSound({ weather: 'dust', weatherAmt: 1 }).wind).toBeGreaterThan(weatherSound({ weather: 'snow', weatherAmt: 1 }).wind);
  });
});
