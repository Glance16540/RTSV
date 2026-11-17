// A people's house of faith, by name and sign (src/sim/faithhouse.ts).
import { describe, expect, it } from 'vitest';
import { CIV_IDS } from '../src/sim/data';
import { SITES } from '../src/sim/campaignbase';
import { DECREES } from '../src/sim/decrees';
import { faithOf, houseOfFaith, inFaith, siteLook } from '../src/sim/faithhouse';

describe('the house of a people\'s faith', () => {
  it('is a Church only where the faith keeps a cross', () => {
    expect(siteLook('church', SITES.church, 'hearth')).toEqual({ name: 'Church', icon: '⛪' });
    expect(siteLook('church', SITES.church, 'japan')).toEqual({ name: 'Shrine', icon: '⛩️' });
    expect(siteLook('church', SITES.church, 'arabs').name).toBe('Mosque');
    expect(siteLook('church', SITES.church, 'persia').name).toBe('Fire Temple');
    expect(siteLook('farm', SITES.farm, 'japan')).toEqual({ name: SITES.farm.name, icon: SITES.farm.icon });
  });

  it('every people has one', () => {
    for (const civ of CIV_IDS) expect(houseOfFaith(civ).name, civ).toBeTruthy();
    expect(faithOf('nobody')).toBe('');
  });

  it('the decrees that speak of the church speak of the people\'s own', () => {
    expect(inFaith(DECREES.church.name, 'japan')).toBe('Call them to the shrine');
    expect(inFaith(DECREES.church.desc, 'arabs')).toMatch(/^The mosque calls the people back/);
    expect(inFaith(DECREES.church.name, 'england')).toBe(DECREES.church.name);
    expect(inFaith('It needs a Church in the town.', 'japan')).toBe('It needs a Shrine in the town.');
  });
});
