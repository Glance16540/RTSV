// How the governor raises the food and health works (governor.ts with granary.ts, mill.ts, well.ts, infirmary.ts): on
// the town's record (townworks.ts), only once a town has Farmland, and only out of plenty.
import { describe, expect, it } from 'vitest';
import { governTown } from '../src/sim/governor';
import { standsAt } from '../src/sim/studies';
import { WORKS, begun, town } from './foodtown';

/** A grieving town of thirty with fields, unless told otherwise: an Infirmary is wanted. */
function grieving(buildings: string[], goods = 900) {
  const x = town(buildings, { goods });
  x.f.grief = 3;
  x.c.factions[0].age = 1; // the Infirmary is of the Bronze Age
  return x;
}
const anyBegun = (x: ReturnType<typeof town>): boolean => WORKS.some((w) => begun(x.c, x.t.id, w));

describe('the governor and the food and health works', () => {
  it('begins one on the town\'s record once the town has Farmland, takes no place of the land\'s, and finishes it in time', () => {
    const fed = grieving(['farm', 'mill']);
    const places = fed.t.buildings.length;
    governTown(fed.c, fed.t.id);
    expect(begun(fed.c, fed.t.id, 'infirmary')).toBe(true);
    expect(fed.t.buildings.length).toBe(places);
    expect(standsAt(fed.c, fed.t.id, 'infirmary')).toBe(false); // begun, not yet standing
    for (let s = 0; s < 6; s++) governTown(fed.c, fed.t.id);
    expect(standsAt(fed.c, fed.t.id, 'infirmary')).toBe(true);
    const bare = grieving([]);
    governTown(bare.c, bare.t.id);
    expect(anyBegun(bare)).toBe(false);
    const young = grieving(['farm', 'mill']);
    young.c.factions[0].age = 0;
    governTown(young.c, young.t.id);
    expect(begun(young.c, young.t.id, 'infirmary')).toBe(false); // not before its age
  });

  it('buys only out of plenty, counted in goods other than bread', () => {
    const poor = grieving(['farm', 'mill'], 100);
    governTown(poor.c, poor.t.id);
    expect(begun(poor.c, poor.t.id, 'infirmary')).toBe(false);
  });
});
