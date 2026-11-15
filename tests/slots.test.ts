// Several campaigns (docs/DESIGN.md, "Relationships"; src/sim/slots.ts): worlds kept side by side, the old save
// key kept as the first of them, each world found again by its people, its house, its turn and when it was played.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { ACTIVE_KEY, FIRST_KEY, MAX_SLOTS, Store, activeSlot, beginNew, deleteSlot, freeSlot, infoOf, listSlots, readSlot, setActive, slotKey, writeSlot } from '../src/sim/slots';

/** A store like the browser's, in memory. */
const memory = (): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, String(v)); }, removeItem: (k) => { data.delete(k); } };
};
const world = (seed: number, civ = 'hearth') => newCampaign(seed, 1, 1, civ);

describe('slots', () => {
  it('the first slot is the key every campaign was always saved under, so an old save is the first world', () => {
    expect(slotKey(1)).toBe('rtsv-campaign');
    expect(FIRST_KEY).toBe('rtsv-campaign');
    expect(slotKey(2)).toBe('rtsv-campaign-2');
    const s = memory(), old = world(3);
    s.setItem('rtsv-campaign', JSON.stringify(old)); // saved before there were slots
    expect(activeSlot(s)).toBe(1);
    expect(readSlot(s, 1)?.seed).toBe(old.seed);
    const [only] = listSlots(s);
    expect(only).toMatchObject({ slot: 1, turn: old.turn, played: 0, civ: 'hearth' });
  });
  it('a world is found again by its people, its house, its turn and when it was last played', () => {
    const s = memory(), c = world(4);
    c.factions[0].people = 'Holtfolk'; c.factions[0].dynasty = 'Ashby'; c.turn = 12;
    writeSlot(s, 2, c, 1_700_000_000_000);
    expect(infoOf(readSlot(s, 2)!, 2)).toMatchObject({ slot: 2, people: 'Holtfolk', house: 'Ashby', turn: 12, played: 1_700_000_000_000, over: false });
  });
  it('a new world goes in a free slot and becomes the one played; the others are kept', () => {
    const s = memory();
    writeSlot(s, 1, world(1));
    expect(beginNew(s)).toBe(2);
    expect(activeSlot(s)).toBe(2);
    writeSlot(s, activeSlot(s), world(2));
    expect(listSlots(s).map((w) => w.slot).sort()).toEqual([1, 2]);
    expect(readSlot(s, 1)?.seed).toBe(world(1).seed);
  });
  it('lists the most lately played first, and says when every slot is taken', () => {
    const s = memory();
    for (let n = 1; n <= MAX_SLOTS; n++) writeSlot(s, n, world(n), 1000 * n);
    expect(listSlots(s).map((w) => w.slot)).toEqual(Array.from({ length: MAX_SLOTS }, (_, i) => MAX_SLOTS - i));
    expect(freeSlot(s)).toBeNull();
    setActive(s, 2);
    expect(beginNew(s)).toBeNull();
    expect(activeSlot(s)).toBe(2); // nothing is overwritten
  });
  it('deleting a world frees its slot; deleting the one played moves to the most lately played of the rest', () => {
    const s = memory();
    writeSlot(s, 1, world(1), 1000); writeSlot(s, 2, world(2), 3000); writeSlot(s, 3, world(3), 2000);
    setActive(s, 2);
    deleteSlot(s, 2);
    expect(readSlot(s, 2)).toBeNull();
    expect(activeSlot(s)).toBe(3);
    expect(freeSlot(s)).toBe(2);
    deleteSlot(s, 1); // not the one played
    expect(activeSlot(s)).toBe(3);
  });
  it('a world the game cannot load is listed, to be deleted, and its slot is not taken for a new one', () => {
    const s = memory();
    s.setItem(slotKey(1), JSON.stringify({ v: -1 }));
    s.setItem(slotKey(2), 'not a world at all');
    expect(readSlot(s, 1)).toBeNull();
    expect(listSlots(s).map((w) => [w.slot, !!w.stale])).toEqual([[1, true], [2, true]]);
    expect(freeSlot(s)).toBe(3);
  });
  it('a slot number out of range is kept in range', () => {
    const s = memory();
    s.setItem(ACTIVE_KEY, '99');
    expect(activeSlot(s)).toBe(1);
    setActive(s, 0);
    expect(activeSlot(s)).toBe(1);
  });
  it('storage that refuses is not an error', () => {
    const broken: Store = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    expect(readSlot(broken, 1)).toBeNull();
    expect(writeSlot(broken, 1, world(1))).toBe(false);
    expect(listSlots(broken)).toEqual([]);
    expect(activeSlot(broken)).toBe(1);
    expect(() => deleteSlot(broken, 1)).not.toThrow();
  });
});
