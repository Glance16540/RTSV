// Every people's house of faith in its own faith (src/sim/faithhouse.ts; drawn by src/client/faithhouses.ts).
import { describe, expect, it } from 'vitest';
import { CIV_IDS, BUILDINGS } from '../src/sim/data';
import { SITES } from '../src/sim/campaignbase';
import { HOUSE_OF, buildingLook, faithOf, houseKind, houseOfFaith, inFaith, siteLook } from '../src/sim/faithhouse';
import { beliefOf } from '../src/sim/folkfaith';

describe('a house of each people\'s own faith', () => {
  it('Greece and Rome keep a temple of their gods, under a laurel wreath, not a church under a cross', () => {
    for (const civ of ['greece', 'stonekin']) {
      expect(houseOfFaith(civ).name).toBe('Temple');
      expect(faithOf(civ)).toBe('wreath');
      expect(inFaith('Call them to church', civ)).toBe('Call them to the temple');
    }
  });
  it('every people has its own, and it answers to the faith its people speak in (folkfaith.ts)', () => {
    const want: Record<string, string[]> = {
      christian: ['church'], hebrew: ['tabernacle'], muslim: ['mosque', 'sahel'], nile: ['nile'], babylon: ['ziggurat'], zoroastrian: ['firetemple'],
      greek: ['classical'], roman: ['classical'], japanese: ['shrine'], chinese: ['ancestral'], tengri: ['cairn'], norse: ['hof'],
    };
    for (const civ of CIV_IDS) {
      expect(HOUSE_OF[civ], civ).toBeDefined();
      expect(want[beliefOf(civ)], civ).toContain(houseKind(civ));
    }
    expect(houseOfFaith('forge').name).toBe('Ancestral Hall');
    expect(houseOfFaith('steppe').name).toBe('Sacred Cairn');
    expect(houseOfFaith('wild').name).toBe('Hof');
    expect(houseOfFaith('babylon').name).toBe('Ziggurat Shrine');
    expect(houseOfFaith('nobody').name).toBe('Sacred Grove');
  });
  it('only the name and the look change: the rules\' building is the same church everywhere', () => {
    expect(SITES.church).toBeDefined();
    expect(BUILDINGS.temple).toBeDefined();
    expect(siteLook('church', SITES.church, 'greece').name).toBe('Temple');
    expect(buildingLook('temple', BUILDINGS.temple, 'japan')).toEqual({ name: 'Shrine', icon: '⛩️' });
    expect(buildingLook('temple', BUILDINGS.temple, 'hearth').name).toBe('Church');
    expect(buildingLook('farm', BUILDINGS.farm, 'japan')).toEqual({ name: BUILDINGS.farm.name, icon: BUILDINGS.farm.icon });
  });
});
