// The tavern as a town falls (src/sim/tavernfall.ts, src/client/tavernlook.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { MAID_GOLD } from '../src/sim/creed';
import { TAVERN, tavernTier, tavernTrade } from '../src/sim/tavernfall';
import { tavernLight, tavernPanel } from '../src/client/tavernlook';
import { roleOutfit } from '../src/client/person';
import { run, setups, villagers } from './helpers';

describe('the tavern as a town falls', () => {
  it('is an honest house, one that keeps late hours, or one that never shuts, by the town\'s standing', () => {
    expect([tavernTier(40), tavernTier(0), tavernTier(-30), tavernTier(-69), tavernTier(-70)]).toEqual(['plain', 'plain', 'worldly', 'worldly', 'decadent']);
  });
  it('takes more gold the further the town has fallen, and nothing once it has shut', () => {
    expect(tavernTrade(0, 0.3)).toEqual({ tier: 'plain', open: true, gold: 1 });
    expect(tavernTrade(0, 0.75)).toMatchObject({ open: false, gold: 0 }); // shut at dusk
    expect(tavernTrade(-50, 0.75)).toMatchObject({ open: true, gold: TAVERN.worldly.gold });
    expect(tavernTrade(-50, 0.9).open).toBe(false); // late, not all night
    expect(tavernTrade(-90, 0.99)).toMatchObject({ open: true, gold: TAVERN.decadent.gold });
    expect(TAVERN.decadent.gold).toBeGreaterThan(TAVERN.worldly.gold);
    expect(TAVERN.worldly.gold).toBeGreaterThan(TAVERN.plain.gold);
  });
  it('pays the town by that rule', () => {
    const earn = (virtue: number) => {
      const g = new Game(5, setups), p = g.players[0];
      p.dilemmaT = 1e9; g.nightless = true;
      const tc = g.buildings.find((b) => b.owner === 0)!;
      const tavern = g.spawnBuilding('tavern', 0, Math.floor(tc.x) + 8, Math.floor(tc.y) + 2, true);
      const women = villagers(g, 0).filter((v) => v.gender === 'f').slice(0, 2);
      g.cmdTarget(0, women.map((v) => v.id), tavern.id);
      run(g, 20, () => { p.virtue = virtue; });
      const gold = p.res.gold;
      run(g, 30, () => { p.virtue = virtue; });
      return { got: p.res.gold - gold, women: tavern.staff!.length };
    };
    const plain = earn(0), fallen = earn(-90);
    expect(plain.women).toBeGreaterThan(0);
    expect(plain.got).toBeCloseTo(plain.women * MAID_GOLD * 30, 0);
    expect(fallen.got / fallen.women).toBeCloseTo((plain.got / plain.women) * TAVERN.decadent.gold, 0);
  });
  it('shows it by its lamp: out when an honest house has shut, amber where it keeps late hours, red where it never shuts', () => {
    expect(tavernLight(0, 0.8).on).toBe(false);
    expect(tavernLight(0, 0.5)).toMatchObject({ on: true, lamp: 0xffd080 });
    expect(tavernLight(-50, 0.8)).toMatchObject({ on: true, lamp: 0xffb45a });
    const red = tavernLight(-90, 0.95);
    expect(red.on).toBe(true);
    expect((red.lamp >> 16) & 255).toBeGreaterThan(((red.lamp >> 8) & 255) * 2); // red
    expect(red.strength).toBeGreaterThan(tavernLight(-50, 0.8).strength);
  });
  it('and by its women\'s dress, which changes in cloth and colour and no further', () => {
    const look = { skin: 0xc89a70, hair: 0x3a2a1a };
    const plain = roleOutfit('milkmaid', true, 1, look, 5, ''), low = roleOutfit('milkmaid', true, 1, look, 5, 'low'), fallen = roleOutfit('milkmaid', true, 1, look, 5, 'fallen');
    expect([plain.apron != null, low.apron != null, fallen.apron != null]).toEqual([true, true, false]);
    expect(low.top).not.toBe(plain.top);
    expect([fallen.skirtColor, fallen.trim]).toEqual([fallen.top, 0xd8b040]);
    for (const o of [plain, low, fallen]) { expect(o.skirt).toBe('long'); expect(o.neck).toBeLessThanOrEqual(2); }
  });
  it('and on its panel: what kind of house, its hours, and the gold it is bringing in now', () => {
    expect(tavernPanel(0, 0.3, 2)).toContain('An honest house');
    expect(tavernPanel(0, 0.3, 2)).toContain(`${Math.round(2 * MAID_GOLD * 60)} gold a minute`);
    expect(tavernPanel(0, 0.8, 2)).toContain('shut for the night');
    expect(tavernPanel(-90, 0.8, 2)).toContain('Never shuts');
    expect(tavernPanel(-90, 0.8, 2)).toContain(`${Math.round(2 * MAID_GOLD * 2 * 60)} gold a minute`);
  });
});
