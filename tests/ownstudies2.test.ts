// The second study of each people (src/sim/ownstudies.ts; docs/DESIGN.md: "one or two studies of its own that fit what it
// is"): each has a job in a system that already runs, and does it only for the people that learned it.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { CIV_IDS, TECHS, baseMods } from '../src/sim/data';
import { OWN, caravanGold, colonyReach, crowdEase, dykesKept, faminePart, griefFaster, landsBySea, lossSpared, militiaEdge, nationOf, ownStudiesSeason, plagueSpared, plotEdge, studiesOf, thiefEdge, yamRides, bandStand } from '../src/sim/ownstudies';
import { crowding } from '../src/sim/acts';
import { flood } from '../src/sim/floods';
import { militiaOf } from '../src/sim/militia';
import { messengerStrength } from '../src/sim/couriers';
import { MESSENGER } from '../src/sim/decrees';
import { caravanWorth } from '../src/sim/caravans';
import { FOUNDING } from '../src/sim/founding';
import { pressing } from '../src/sim/studies';
import { folkOf } from '../src/sim/township';

const SECOND: Record<string, string> = {
  egypt: 'own_dykes', hearth: 'own_hearth', babylon: 'own_eye', mali: 'own_griots', kush: 'own_iron', stonekin: 'own_aqueducts', steppe: 'own_yam',
  forge: 'own_granaries', persia: 'own_eyes', greece: 'own_colonies', england: 'own_wool', arabs: 'own_bimaristan', japan: 'own_coast', dawn: 'own_tongue', wild: 'own_longships',
};
const world = (civ: string) => {
  const c = newCampaign(7, 2, 1, civ);
  c.turn = 10;
  const home = c.territories.find((t) => t.capital === 0)!;
  Object.assign(folkOf(c, home.id), { men: 30, women: 30, elders: 4, children: 10 }); delete folkOf(c, home.id).ages;
  return { c, home };
};
/** The same world twice: one with the people's second study learned, one without. */
const pair = (civ: string) => { const a = world(civ), b = world(civ); (a.c.factions[0].studies ??= []).push(SECOND[civ]); return { on: a, off: b }; };

describe('a second study for every people', () => {
  it('every nation has two, each its own, each answering a want the computer reads, each with a rule in a town too', () => {
    for (const civ of CIV_IDS) {
      expect(studiesOf(civ).map((t) => t.id), civ).toContain(SECOND[civ]);
      expect(studiesOf(civ).length, civ).toBe(2);
      const t = TECHS[SECOND[civ]];
      expect(nationOf(t.id)).toBe(civ);
      expect(t.taughtAt).toBe('towncenter');
      const { c } = world(civ);
      expect(Number.isFinite(pressing(c, 0, t.answers!)), t.id).toBe(true);
      const m = baseMods(), was = JSON.stringify(m);
      t.apply(m);
      expect(JSON.stringify(m), t.id).not.toBe(was);
    }
  });

  it('Egyptians, Dykes and Basins: a flood spoils half as much, wears nothing and washes no farmland away', () => {
    const { on, off } = pair('egypt');
    for (const w of [on, off]) { folkOf(w.c, w.home.id).stores.food = 1000; if (!w.home.buildings.includes('farm')) w.home.buildings.push('farm'); }
    expect(dykesKept(on.c, on.home.id)).toBe(true);
    const a = flood(on.c, on.home.id, 1, true), b = flood(off.c, off.home.id, 1, true);
    expect(a.food).toBeLessThan(b.food);
    expect(a.farm).toBe(false);
    expect(b.farm).toBe(true);
  });

  it('Franks, Hearth and Home: grief passes twice as fast', () => {
    const { on, off } = pair('hearth');
    expect(griefFaster(on.c, on.home.id)).toBe(OWN.hearth);
    expect(griefFaster(off.c, off.home.id)).toBe(1);
  });

  it('Babylonians, an Eye for an Eye: a thief is the likelier taken', () => {
    const { on, off } = pair('babylon');
    expect(thiefEdge(on.c, on.home.id)).toBe(OWN.eye);
    expect(thiefEdge(off.c, off.home.id)).toBe(0);
  });

  it('Malians, the Griots: the nation dips half as much for its known lost', () => {
    const { on, off } = pair('mali');
    expect(lossSpared(on.c, 0)).toBe(OWN.griots);
    expect(lossSpared(off.c, 0)).toBe(1);
  });

  it('Kushites, the Iron of Meroë: the town\'s own men count more in its defence', () => {
    const { on, off } = pair('kush');
    expect(militiaEdge(on.c, on.home.id)).toBe(OWN.iron);
    expect(militiaOf(on.c, on.home.id)).toBeGreaterThan(militiaOf(off.c, off.home.id));
  });

  it('Romans, Aqueducts: a crowded town has less plague', () => {
    const { on, off } = pair('stonekin');
    expect(crowdEase(on.c, on.home.id)).toBe(OWN.aqueducts);
    expect(crowding(on.c, on.home.id)).toBeLessThan(crowding(off.c, off.home.id));
  });

  it('Mongols, the Yam: a decree by messenger at full strength', () => {
    const { on, off } = pair('steppe');
    expect(yamRides(on.c, 0)).toBe(true);
    expect(messengerStrength(on.c, 0, MESSENGER)).toBe(1);
    expect(messengerStrength(off.c, 0, MESSENGER)).toBe(MESSENGER);
  });

  it('Chinese, Ever-Normal Granaries: a failed harvest eats less', () => {
    const { on, off } = pair('forge');
    expect(faminePart(on.c, on.home.id)).toBe(OWN.granaries);
    expect(faminePart(off.c, off.home.id)).toBe(1);
  });

  it('Persians, the King\'s Eyes and Ears: a plot is laid bare sooner', () => {
    const { on, off } = pair('persia');
    expect(plotEdge(on.c, 0)).toBe(OWN.eyes);
    expect(plotEdge(off.c, 0)).toBe(0);
  });

  it('Greeks, Colonies: settlers go one land further', () => {
    const { on, off } = pair('greece');
    expect(colonyReach(on.c, 0)).toBe(OWN.colonies);
    expect(colonyReach(off.c, 0)).toBe(0);
    expect(FOUNDING.reach + colonyReach(on.c, 0)).toBe(FOUNDING.reach + 1);
  });

  it('English, the Wool Staple: a farmed town with a Market brings in gold', () => {
    const { on, off } = pair('england');
    for (const w of [on, off]) {
      if (!w.home.buildings.includes('farm')) w.home.buildings.push('farm');
      w.home.town = { at: w.home.town?.at ?? 2, b: [...(w.home.town?.b ?? []), ['market', 5, 5, 1] as never] } as never;
    }
    expect(ownStudiesSeason(on.c) - ownStudiesSeason(off.c)).toBe(OWN.wool);
  });

  it('Abbasids, Bimaristans: plague kills fewer', () => {
    const { on, off } = pair('arabs');
    expect(plagueSpared(on.c, on.home.id)).toBe(OWN.bimaristan);
    expect(plagueSpared(off.c, off.home.id)).toBe(1);
  });

  it('Japanese, the Coast Watch: a coastal town stands better against a band; an inland one as before', () => {
    const { on, off } = pair('japan');
    on.home.trait = 'coast'; off.home.trait = 'coast';
    expect(bandStand(on.c, on.home.id)).toBe(OWN.coast);
    expect(bandStand(off.c, off.home.id)).toBe(1);
    on.home.trait = '';
    expect(bandStand(on.c, on.home.id)).toBe(1);
  });

  it('Arameans, the Common Tongue: their caravans bring home more gold', () => {
    const { on, off } = pair('dawn');
    const to = on.home.adj[0];
    expect(caravanGold(on.c, 0)).toBe(OWN.tongue);
    expect(caravanWorth(on.c, on.home.id, to, [on.home.id, to])).toBeGreaterThan(caravanWorth(off.c, off.home.id, to, [off.home.id, to]));
  });

  it('Norse, Longships: an army landing from the sea fights at full strength', () => {
    const { on, off } = pair('wild');
    expect(landsBySea(on.c, 0)).toBe(true);
    expect(landsBySea(off.c, 0)).toBe(false);
  });

  it('none of them works for a people that has not learned it, nor for another people', () => {
    const { c, home } = world('hearth');
    (c.factions[0].studies ??= []).push('own_dykes', 'own_iron', 'own_yam'); // not theirs: refused by `knows`
    expect(dykesKept(c, home.id)).toBe(false);
    expect(militiaEdge(c, home.id)).toBe(1);
    expect(yamRides(c, 0)).toBe(false);
  });
});
