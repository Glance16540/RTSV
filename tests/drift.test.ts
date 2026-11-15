// Drift under pressure and the leader's decrees (docs/DESIGN.md, step 5; src/sim/drift.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { DECREES, DRIFT, canDecree, decree, decreeOf, driftOf, pressureOf, rivalDecree, seasonOfDrift, watchOf } from '../src/sim/drift';
import { seat } from '../src/sim/court';
import { townTaken } from '../src/sim/conquered';
import { faithAt, swayTown } from '../src/sim/townfaith';
import { folkOf } from '../src/sim/township';

const LONG = 60_000;
/** A plain town of the player's: eight men, eight women, well fed, nothing built, nobody's army in it, the leader elsewhere. */
const town = (seed = 7) => {
  const c = newCampaign(seed, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner < 0 && !x.horde)!;
  t.owner = 0; t.buildings = []; c.places = [];
  c.armies = c.armies.filter((a) => a.at !== t.id);
  const f = folkOf(c, t.id);
  Object.assign(f, { men: 8, women: 8, elders: 0, children: 0 }); delete f.ages;
  f.stores = { food: 2000, wood: 200, gold: 100, stone: 100 };
  c.factions[0].supplies = 50;
  return { c, t, f };
};
const starve = (f: { stores: { food: number } }) => { f.stores.food = 0; };

describe('drift under pressure', () => {
  it('a town fed and safe is under no pressure, and nobody drifts', () => {
    const { c, t } = town();
    expect(pressureOf(c, t.id)).toEqual({ hunger: 0, danger: 0, grief: 0, total: 0, causes: [] });
    expect(seasonOfDrift(c).filter((n) => n.at === t.id)).toEqual([]);
    expect(driftOf(c, t.id)).toEqual({ tavern: 0, mines: 0 });
    expect(t.drift).toBeUndefined();
    expect(watchOf(c, t.id)).toBe(1);
  }, LONG);

  it('hunger presses, and more each season go: women to the taverns and men to the mines, up to half of each', () => {
    const { c, t, f } = town();
    starve(f);
    const p = pressureOf(c, t.id);
    expect(p).toMatchObject({ hunger: DRIFT.hunger, total: DRIFT.hunger, causes: ['hunger'] });
    const first = seasonOfDrift(c).find((n) => n.at === t.id)!;
    expect(first.went.tavern + first.went.mines).toBe(Math.min(DRIFT.most, Math.ceil((p.total - DRIFT.press) / DRIFT.step)));
    expect(c.log.join('\n')).toMatch(new RegExp(`${t.name} is under strain \\(hunger\\)`));
    for (let i = 0; i < 30; i++) { starve(f); c.turn++; seasonOfDrift(c); }
    expect(driftOf(c, t.id)).toMatchObject({ tavern: Math.floor(8 * DRIFT.share), mines: Math.floor(8 * DRIFT.share) });
    expect(watchOf(c, t.id)).toBe(0.5); // the walls are left thin
  }, LONG);

  it('what removes the cause removes the pressure: Farmland, the stores opened, a Church, the leader there', () => {
    const { c, t, f } = town();
    starve(f);
    t.buildings = ['farm'];
    expect(pressureOf(c, t.id).hunger).toBe(DRIFT.hunger - DRIFT.farm);
    t.buildings = ['church'];
    expect(pressureOf(c, t.id).total).toBe(DRIFT.hunger - DRIFT.church);
    seat(c, 0, t.id);
    expect(pressureOf(c, t.id).total).toBe(DRIFT.hunger - DRIFT.church - DRIFT.leader);
    t.buildings = [];
    expect(decree(c, 0, t.id, 'bread')).toBe(true);
    expect(pressureOf(c, t.id).hunger).toBe(0);
    const had = c.factions[0].supplies;
    seasonOfDrift(c);
    expect(c.factions[0].supplies).toBe(had - DECREES.bread.cost);
    expect(f.stores.food).toBe(DRIFT.bread);
    expect(driftOf(c, t.id)).toEqual({ tavern: 0, mines: 0 });
  }, LONG);

  it('danger presses too: a raid, a town held against its will, a notable person lost; an army there steadies it', () => {
    const { c, t, f } = town();
    (c.events ??= []).push({ kind: 'raid', at: t.id, turn: c.turn, until: c.turn });
    expect(pressureOf(c, t.id)).toMatchObject({ danger: DRIFT.struck, causes: ['danger'] });
    c.armies.push({ id: 90, owner: 0, at: t.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    expect(pressureOf(c, t.id).danger).toBe(DRIFT.struck - DRIFT.garrison);
    c.armies.pop(); c.events = [];
    townTaken(c, t.id, 1, 0);
    expect(pressureOf(c, t.id)).toMatchObject({ danger: Math.round(t.yoke!.resent * DRIFT.resent), causes: ['held against its will'] });
    delete t.yoke;
    f.notables.push({ name: 'Maren', gender: 'f', kind: 'mother', deed: 'raised 3 children', turn: 1, lost: { turn: c.turn, how: 'killed' } });
    expect(pressureOf(c, t.id)).toMatchObject({ grief: DRIFT.grief, causes: ['grief'] });
    c.turn += DRIFT.griefTurns + 1;
    expect(pressureOf(c, t.id).grief).toBe(0);
  }, LONG);

  it('those who drift bring in gold and stone, and the taverns cost the town its standing', () => {
    const { c, t, f } = town();
    t.drift = { tavern: 4, mines: 2 };
    const gold = f.stores.gold, stone = f.stores.stone, faith = faithAt(c, t.id);
    starve(f); // hard times go on, so nobody comes back this season
    const n = seasonOfDrift(c).find((x) => x.at === t.id)!;
    const d = driftOf(c, t.id);
    expect(n.gold).toBe(d.tavern * DRIFT.tavernGold + d.mines * DRIFT.mineGold);
    expect(f.stores.gold).toBe(gold + n.gold);
    expect(f.stores.stone).toBe(stone + d.mines * DRIFT.mineStone);
    expect(faithAt(c, t.id)).toBe(faith - Math.max(1, Math.floor(d.tavern / DRIFT.perPoint)));
  }, LONG);

  it('where a town is well kept they come back, sooner with a church, and the holy way draws it', () => {
    const { c, t } = town();
    t.drift = { tavern: 3, mines: 3 };
    const n = seasonOfDrift(c).find((x) => x.at === t.id)!;
    expect(n.back).toEqual({ tavern: 1, mines: 1 });
    expect(c.log.join('\n')).toContain(`${t.name} is well kept: 2 of those who had drifted have come back`);
    t.buildings = ['church'];
    c.turn++;
    expect(seasonOfDrift(c).find((x) => x.at === t.id)!.back).toEqual({ tavern: 2, mines: 2 });
    expect(driftOf(c, t.id)).toEqual({ tavern: 0, mines: 0 });
    // The season they came home the town moved toward piety, not away.
    const b = town(9);
    b.t.drift = { tavern: 0, mines: 2 }; b.t.buildings = ['church'];
    const was = faithAt(b.c, b.t.id);
    seasonOfDrift(b.c);
    expect(faithAt(b.c, b.t.id)).toBe(was + 2);
  }, LONG);
});

describe('the leader\'s decrees', () => {
  it('guards keep order by force: nobody else drifts and one a season is brought back, and it is resented', () => {
    const { c, t, f } = town();
    t.drift = { tavern: 2, mines: 2 };
    starve(f);
    expect(decree(c, 0, t.id, 'guards')).toBe(true);
    expect(decreeOf(c, t.id)).toBe('guards');
    const had = c.factions[0].supplies;
    const n = seasonOfDrift(c).find((x) => x.at === t.id)!;
    expect(n.went).toEqual({ tavern: 0, mines: 0 });
    expect(n.back).toEqual({ tavern: 1, mines: 1 });
    expect(c.factions[0].supplies).toBe(had - DECREES.guards.cost);
    expect(driftOf(c, t.id).anger).toBe(DRIFT.guardAnger);
    for (let i = 0; i < 10; i++) { starve(f); c.turn++; seasonOfDrift(c); }
    expect(driftOf(c, t.id)).toMatchObject({ tavern: 0, mines: 0, anger: 11 * DRIFT.guardAnger });
    expect(pressureOf(c, t.id).causes).toContain('anger at a decree');
    // Lifted, the anger cools.
    expect(decree(c, 0, t.id, '')).toBe(true);
    f.stores.food = 2000; c.turn++;
    seasonOfDrift(c);
    expect(driftOf(c, t.id).anger).toBe(11 * DRIFT.guardAnger - DRIFT.cool);
  }, LONG);

  it('closing the tavern brings the women home, and angers a worldly town', () => {
    const { c, t, f } = town();
    expect(canDecree(c, 0, t.id, 'close')).toBe(false); // there is no tavern to close
    t.buildings = ['tavern'];
    t.drift = { tavern: 3, mines: 1 };
    expect(decree(c, 0, t.id, 'close')).toBe(true);
    expect(driftOf(c, t.id)).toMatchObject({ tavern: 0, mines: 1 });
    expect(driftOf(c, t.id).anger ?? 0).toBe(0); // an ordinary town takes it quietly
    starve(f);
    seasonOfDrift(c);
    expect(driftOf(c, t.id).tavern).toBe(0); // and no more go, though the men still may
    const w = town(9);
    w.t.buildings = ['tavern'];
    swayTown(w.c, w.t.id, DRIFT.worldly - 10 - faithAt(w.c, w.t.id));
    expect(decree(w.c, 0, w.t.id, 'close')).toBe(true);
    expect(driftOf(w.c, w.t.id).anger).toBe(DRIFT.closeAnger);
    expect(w.c.log.join('\n')).toContain('the town is angry about it');
  }, LONG);

  it('a decree can go the other way: the women ordered into the taverns bring gold and the town falls', () => {
    const { c, t, f } = town();
    t.buildings = ['tavern'];
    expect(decree(c, 0, t.id, 'tavern')).toBe(true);
    expect(driftOf(c, t.id).tavern).toBe(Math.floor(8 * DRIFT.share));
    const gold = f.stores.gold, faith = faithAt(c, t.id);
    seasonOfDrift(c);
    expect(f.stores.gold).toBe(gold + 4 * DRIFT.tavernGold);
    expect(faithAt(c, t.id)).toBe(faith - Math.floor(4 / DRIFT.perPoint) - DRIFT.ordered);
    c.turn++;
    seasonOfDrift(c);
    expect(driftOf(c, t.id).tavern).toBe(4); // well kept or not, they stay while the order stands
  }, LONG);

  it('a town is under one decree at a time, of its own people, and one that cannot be paid for lapses', () => {
    const { c, t } = town();
    expect(canDecree(c, 1, t.id, 'guards')).toBe(false);
    expect(canDecree(c, 0, t.id, '')).toBe(false); // nothing to lift
    expect(decree(c, 0, t.id, 'guards')).toBe(true);
    expect(canDecree(c, 0, t.id, 'guards')).toBe(false);
    expect(decree(c, 0, t.id, 'bread')).toBe(true);
    expect(decreeOf(c, t.id)).toBe('bread');
    c.factions[0].supplies = 1;
    const n = seasonOfDrift(c).find((x) => x.at === t.id)!;
    expect(n.lapsed).toBe('bread');
    expect(decreeOf(c, t.id)).toBe('');
    expect(c.factions[0].supplies).toBe(1);
    expect(c.log.join('\n')).toContain('has lapsed');
    c.factions[0].supplies = 0;
    expect(canDecree(c, 0, t.id, 'guards')).toBe(false);
  }, LONG);

  it('a rival feeds a hungry town when it has plenty, sets guards when many have drifted, and lifts a decree that has done its work', () => {
    const { c, t, f } = town();
    t.owner = 1; c.factions[1].supplies = 30;
    starve(f);
    rivalDecree(c, t.id);
    expect(decreeOf(c, t.id)).toBe('bread');
    f.stores.food = 5000;
    rivalDecree(c, t.id);
    expect(decreeOf(c, t.id)).toBe('');
    t.drift = { tavern: 2, mines: 2 };
    rivalDecree(c, t.id);
    expect(decreeOf(c, t.id)).toBe('guards');
    t.drift = { tavern: 0, mines: 0 };
    rivalDecree(c, t.id);
    expect(decreeOf(c, t.id)).toBe('');
  }, LONG);

  it('a town that has gone back to the tribes keeps neither its drift nor its decree', () => {
    const { c, t } = town();
    t.drift = { tavern: 2, mines: 2 }; decree(c, 0, t.id, 'guards');
    t.owner = -1;
    seasonOfDrift(c);
    expect(t.drift).toBeUndefined();
    expect(t.decree).toBeUndefined();
  }, LONG);
});
