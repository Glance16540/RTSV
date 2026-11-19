// The named places of a world, and what is befalling the whole world (src/sim/places.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { hireOff, placeAt, placeGood, placeWorth, placesOf, worldNow } from '../src/sim/places';
import { LEGENDS, PLACES, PlaceKind } from '../src/sim/story';

/** A campaign with one place of each kind set down by hand, none of them held by anybody. */
const laid = () => {
  const c = newCampaign(4, 1, 1, 'hearth');
  const lands = c.territories.filter((t) => t.capital < 0 && !t.rim).slice(0, 5);
  for (const t of lands) t.owner = -1;
  const kinds = Object.keys(PLACES) as PlaceKind[];
  c.places = kinds.map((kind, i) => ({ at: lands[i].id, kind, name: PLACES[kind].names[0], legend: LEGENDS[PLACES[kind].names[0]][0] }));
  const at = (kind: PlaceKind) => c.territories[c.places!.find((p) => p.kind === kind)!.at];
  return { c, at };
};

describe('placesOf', () => {
  it('the same seed lays the same places, and another seed others', () => {
    const a = placesOf(newCampaign(4, 1, 1, 'hearth'));
    const b = placesOf(newCampaign(4, 1, 1, 'hearth'));
    expect(b).toEqual(a);
    const others = [5, 6, 7].map((s) => JSON.stringify(placesOf(newCampaign(s, 1, 1, 'hearth'))));
    expect(others.some((x) => x !== JSON.stringify(a))).toBe(true);
  });

  it('are laid once, on lands that are no capital and not in the rim, as many as the world\'s size allows, one to a land', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const ps = placesOf(c);
    const inner = c.territories.filter((t) => !t.rim);
    expect(ps.length).toBe(Math.min(inner.filter((t) => t.capital < 0).length, 3 + Math.floor(inner.length / 6)));
    expect(new Set(ps.map((p) => p.at)).size).toBe(ps.length);
    for (const p of ps) {
      expect(c.territories[p.at].capital).toBeLessThan(0);
      expect(c.territories[p.at].rim).toBeFalsy();
      expect(PLACES[p.kind].names).toContain(p.name);
      expect(LEGENDS[p.name]).toContain(p.legend);
    }
    expect(placesOf(c)).toBe(c.places); // kept, not made again
  });

  it('the kinds go round before any repeats, and a second of a kind takes another name', () => {
    const ps = placesOf(newCampaign(4, 1, 1, 'hearth'));
    const kinds = Object.keys(PLACES).length;
    expect(new Set(ps.slice(0, kinds).map((p) => p.kind)).size).toBe(Math.min(kinds, ps.length));
    for (const kind of Object.keys(PLACES)) {
      const names = ps.filter((p) => p.kind === kind).map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('a place with no legend of its own is given one; one already its own is kept', () => {
    const { c } = laid();
    c.places![0].legend = '';
    c.places![1].legend = LEGENDS[c.places![1].name][1];
    const ps = placesOf(c);
    expect(LEGENDS[ps[0].name]).toContain(ps[0].legend);
    expect(ps[1].legend).toBe(LEGENDS[ps[1].name][1]);
  });
});

describe('placeAt', () => {
  it('the place in a land, or nothing', () => {
    const { c, at } = laid();
    expect(placeAt(c, at('keep').id)?.kind).toBe('keep');
    expect(placeAt(c, c.territories.find((t) => t.capital === 0)!.id)).toBeUndefined();
  });
});

describe('placeGood', () => {
  it('adds up one kind of good from the places a people holds, and nothing from those it does not', () => {
    const { c, at } = laid();
    expect(placeGood(c, 0, 'virtue')).toBe(0);
    expect(placeGood(c, 0, 'supplies')).toBe(0);
    at('shrine').owner = 0;
    expect(placeGood(c, 0, 'virtue')).toBe(PLACES.shrine.virtue);
    expect(placeGood(c, 0, 'supplies')).toBe(0); // a shrine pays no supplies
    expect(placeGood(c, 1, 'virtue')).toBe(0);
    at('fair').owner = 0;
    at('library').owner = 1;
    expect(placeGood(c, 0, 'supplies')).toBe(PLACES.fair.supplies);
    expect(placeGood(c, 0, 'age')).toBe(0);
    expect(placeGood(c, 1, 'age')).toBe(PLACES.library.age);
  });

  it('two of the same kind held count twice', () => {
    const { c, at } = laid();
    const other = c.territories.find((t) => t.capital < 0 && !t.rim && !c.places!.some((p) => p.at === t.id))!;
    c.places!.push({ at: other.id, kind: 'shrine', name: PLACES.shrine.names[1], legend: LEGENDS[PLACES.shrine.names[1]][0] });
    at('shrine').owner = 0;
    other.owner = 0;
    expect(placeGood(c, 0, 'virtue')).toBe(2 * PLACES.shrine.virtue!);
  });
});

describe('worldNow', () => {
  it('what befalls the world while it lasts, and nothing before or after', () => {
    const { c } = laid();
    c.world = null;
    expect(worldNow(c)).toBe('');
    c.turn = 6;
    c.world = { kind: 'winter', until: 7 };
    expect(worldNow(c)).toBe('winter');
    c.turn = 7;
    expect(worldNow(c)).toBe('winter'); // its last turn
    c.turn = 8;
    expect(worldNow(c)).toBe('');
  });
});

describe('placeWorth and hireOff', () => {
  it('a place\'s defence or what it takes off a company raised there; nothing in a land with no place', () => {
    const { c, at } = laid();
    expect(placeWorth(c, at('keep').id, 'defence')).toBe(PLACES.keep.defence);
    expect(placeWorth(c, at('keep').id, 'raise')).toBe(0);
    expect(placeWorth(c, at('forge').id, 'raise')).toBe(PLACES.forge.raise);
    expect(placeWorth(c, c.territories.find((t) => t.capital === 0)!.id, 'defence')).toBe(0);
  });

  it('supplies off a company: the people\'s faith, iron in the ground, and a season of iron, each adding', () => {
    const { c, at } = laid();
    c.world = null;
    const home = c.territories.find((t) => t.capital === 0)!.id;
    const base = hireOff(c, 0, home);
    expect(hireOff(c, 0, at('forge').id)).toBe(base + PLACES.forge.raise!);
    c.world = { kind: 'iron', until: c.turn + 2 };
    expect(hireOff(c, 0, home)).toBe(base + 1);
    expect(hireOff(c, 0, at('forge').id)).toBe(base + PLACES.forge.raise! + 1);
    c.world = { kind: 'winter', until: c.turn + 2 };
    expect(hireOff(c, 0, home)).toBe(base);
  });
});
