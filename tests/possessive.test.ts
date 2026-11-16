// A people's name before a thing of theirs (src/sim/naming.ts): "the Arameans' army", "the English army", "the Ashfolk's army".
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { peoplesArmy, possessive, whoseOf } from '../src/sim/naming';

describe('whose army', () => {
  it('a name in -s takes the apostrophe after it; a name that is its own adjective stands as it is; any other takes \'s', () => {
    expect(`${possessive('Arameans')} army`).toBe("the Arameans' army");
    expect(`${possessive('Kushites')} army`).toBe("the Kushites' army");
    for (const n of ['English', 'Chinese', 'Japanese', 'Norse']) expect(`${possessive(n)} army`).toBe(`the ${n} army`);
    expect(`${possessive('Ashfolk')} army`).toBe("the Ashfolk's army");
  });

  it('the player\'s is "your"; a rival\'s goes by its people\'s name, and a chosen name too', () => {
    const c = newCampaign(7, 2, 1, 'japan', { names: { people: 'Ashfolk' } });
    expect(peoplesArmy(c, 0)).toBe('your army');
    expect(whoseOf(c, 0)).toBe('your');
    c.factions[1].people = 'Ashfolk';
    expect(peoplesArmy(c, 1)).toBe("the Ashfolk's army");
    for (const f of c.factions.slice(1)) expect(peoplesArmy(c, f.id)).not.toMatch(/s's /);
  });
});
