// A town's feast day, kept in a visit or a battle (src/sim/feastfield.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { FEAST_FIELD, feastDue, feastFor, feastWords, feasting, holdFeast, keepFeast } from '../src/sim/feastfield';
import { SEASONS_A_YEAR } from '../src/sim/ageing';
import { run, setups, spot } from './helpers';

const world = () => {
  const c: Campaign = newCampaign(5, 2);
  c.turn = 40; c.phase = 'player';
  const home = c.territories.find((t) => t.capital === 0)!;
  if (!home.buildings.includes('church')) home.buildings.push('church');
  return { c, home };
};

/** A campaign town with a tavern and a church, raided without end. */
const town = (feast: boolean) => {
  const g = new Game(7, setups);
  g.bornOnly = true;
  const p = g.players[0];
  Object.assign(p.res, { food: 2000, wood: 2000, gold: 500, stone: 500 });
  p.popCap = 200;
  for (const type of ['tavern', 'temple']) { const at = spot(g, type, 0); g.spawnBuilding(type, 0, at.cx, at.cy, true); }
  const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
  for (let k = 0; k < 6; k++) g.spawnUnit('villager', 0, tc.x + 3 + (k % 3), tc.y + 3 + Math.floor(k / 3), k % 2 ? 'm' : 'f');
  if (feast) holdFeast(g, 0, { town: 'Ashford' });
  if (p.feast) p.feast.until = 1e9; // the whole run on its feast day
  return { g, p, tc };
};

describe('a feast day in a town', () => {
  it('is due once a year in a town of the player\'s with a Church', () => {
    const { c, home } = world();
    expect(feastDue(c, home.id)).toBe(true);
    expect(feastFor(c, home.id)).toEqual({ town: home.name });
    keepFeast(c, home.id);
    expect(home.feastKept).toBe(40);
    expect(feastDue(c, home.id)).toBe(false);
    c.turn += SEASONS_A_YEAR - 1;
    expect(feastDue(c, home.id)).toBe(false); // still the same year
    c.turn += 1;
    expect(feastDue(c, home.id)).toBe(true);
    home.buildings = home.buildings.filter((b) => b !== 'church');
    expect(feastDue(c, home.id)).toBe(false); // no Church, no feast
    home.town = { b: [['temple', 10, 10, 1]] } as unknown as typeof home.town;
    expect(feastDue(c, home.id)).toBe(true); // one built in the town, and standing as it was left
  });

  it('a visit opens on it, and once over it is kept for the year', () => {
    const { c, home } = world();
    expect(beginVisit(c, home.id)).toBe(true);
    const cfg = visitConfig(c)!;
    expect(cfg.setups[0].bonus!.feast).toEqual({ town: home.name });
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    expect(g.players[0].feast?.town).toBe(home.name);
    finishVisit(c, { seconds: 30 });
    expect(feastDue(c, home.id)).toBe(false);
    expect(feastFor(c, home.id)).toBeUndefined(); // a second visit that year opens on none
  });

  it('holds a raided town\'s drift back while it lasts, and the town is told', () => {
    const plain = town(false), kept = town(true);
    for (const { g, tc } of [plain, kept]) run(g, 900, () => { g.players[0].lastAttacked = { x: tc.x, y: tc.y, t: g.time }; });
    const d = (x: typeof plain) => (x.p.drifted?.tavern ?? 0) + (x.p.drifted?.mine ?? 0);
    expect(d(plain)).toBeGreaterThan(0);
    expect(d(kept)).toBe(0);
    expect(feasting(kept.g, kept.p)).toBe(true);
    expect(feastWords(kept.g, 0)).toMatch(/feast day of Ashford/);
  }, 60_000);

  it('lasts its span, and ends with no Church', () => {
    const { g, p } = town(true);
    p.feast!.until = g.time + FEAST_FIELD.span;
    expect(feasting(g, p)).toBe(true);
    const church = g.buildings.find((b) => b.type === 'temple')!;
    church.dead = true;
    expect(feasting(g, p)).toBe(false);
    church.dead = false;
    p.feast!.church = false;
    expect(feasting(g, p)).toBe(true); // a town with no Church in it, keeping the feast of the Church on the map
    p.feast!.church = true; church.dead = false;
    p.feast!.until = g.time - 1;
    expect(feasting(g, p)).toBe(false);
    expect(feastWords(g, 0)).toBe('');
    holdFeast(g, 1, 'nonsense');
    expect(g.players[1].feast).toBeUndefined();
  });
});
