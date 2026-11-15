// A world that ends in ruin (docs/DESIGN.md, the owner's word; src/sim/ruin.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { RUIN, bandShare, bandsHoldMuch, groundGained, heldShare, inRuin, ruinIn, ruinSeason, ruinWords } from '../src/sim/ruin';
import { infoOf } from '../src/sim/slots';
import { epilogue } from '../src/sim/story';

/** A world where the peoples hold `held` lands between them and the marauders `hordes`, the rest nobody's. */
const world = (held: number, hordes: number) => {
  const c = newCampaign(7, 2, 1);
  c.bands = [];
  c.territories.forEach((t, i) => { t.horde = false; t.owner = i < held ? i % 3 : -1; if (i >= held && i < held + hordes) t.horde = true; });
  return c;
};
/** Turn so many seasons with nothing changing hands. */
const quiet = (c: ReturnType<typeof world>, seasons: number): boolean => { let ended = false; for (let i = 0; i < seasons && !ended; i++) { c.turn++; ended = ruinSeason(c); } return ended; };

describe('a world ends in ruin', () => {
  it('twenty years with no people gaining ground, and the bands on much of the map: it is over, and nobody has won', () => {
    const c = world(6, 8);
    expect(c.territories.length).toBeGreaterThan(14);
    expect(bandsHoldMuch(c)).toBe(true);
    expect(quiet(c, RUIN.seasons)).toBe(false); // not before twenty years are on record
    expect(c.phase).not.toBe('over');
    expect(quiet(c, 1)).toBe(true);
    expect(c.phase).toBe('over');
    expect(c.winner).toBe(-1);
    expect(c.ended).toBe('ruin');
    expect(inRuin(c)).toBe(true);
    expect(c.chronicle!.at(-1)!.text).toContain('closed in ruin');
    expect(c.log.at(-1)).toContain('nobody has won');
    // The ending screen and the chronicle's last page say how it ended; the menu does not call it won.
    expect(epilogue(c)[0]).toContain('lay in ruin');
    expect(ruinWords(c).title).toBe('The land lies in ruin');
    expect(infoOf(c, 0)).toMatchObject({ over: true, won: false });
    expect(ruinSeason(c)).toBe(false); // a campaign that is over is left as it ended
  });

  it('a people that gains ground and keeps it puts the ruin off', () => {
    const c = world(6, 8);
    quiet(c, RUIN.seasons - 5);
    c.territories.find((t) => t.owner < 0 && !t.horde)!.owner = 1; // a land taken, and held
    expect(quiet(c, 40)).toBe(false);
    expect(groundGained(c)).toBe(true);
    expect(quiet(c, 45)).toBe(true); // twenty years on from that, with nothing more
  });

  it('a land taken and lost again is not ground gained', () => {
    const c = world(6, 8);
    const spare = c.territories.find((t) => t.owner < 0 && !t.horde)!;
    let ended = false;
    for (let i = 0; i <= RUIN.seasons && !ended; i++) { spare.owner = i % 2 ? 1 : -1; c.turn++; ended = ruinSeason(c); }
    expect(spare.owner).toBe(-1);
    expect(ended).toBe(true);
  });

  it('not while the peoples hold half the map, however long they stand still', () => {
    const c = world(Math.ceil(newCampaign(7, 2, 1).territories.length * RUIN.held), 6);
    expect(heldShare(c)).toBeGreaterThanOrEqual(RUIN.held);
    expect(quiet(c, RUIN.seasons * 2)).toBe(false);
    expect(ruinIn(c)).toBe(-1);
  });

  it('not while the bands hold little, however weak the peoples', () => {
    const c = world(4, 1);
    expect(bandShare(c)).toBeLessThan(RUIN.bands);
    expect(quiet(c, RUIN.seasons * 2)).toBe(false);
    // A band with its place on a land counts as holding it.
    c.bands = c.territories.filter((t) => !t.horde).slice(0, 6).map((t, i) => ({ id: 500 + i, kind: 'raiders' as const, name: 'the Test Men', at: t.id, strength: 3, since: 0, held: [] }));
    expect(bandShare(c)).toBeGreaterThanOrEqual(RUIN.bands);
    expect(quiet(c, 1)).toBe(true);
  });

  it('a people that has died out is not waited for, and a warning can be given', () => {
    const c = world(6, 8);
    quiet(c, 10);
    c.factions[2].alive = false;
    for (const t of c.territories) if (t.owner === 2) t.owner = -1;
    expect(ruinIn(c)).toBeGreaterThan(0);
    expect(ruinIn(c)).toBeLessThanOrEqual(RUIN.seasons);
    expect(quiet(c, RUIN.seasons)).toBe(true);
  });

  it('a campaign saved before this keeps no record and simply begins one', () => {
    const c = world(6, 8);
    delete c.grounds; delete c.ended;
    expect(ruinSeason(c)).toBe(false);
    expect(c.grounds!.length).toBe(1);
    quiet(c, RUIN.seasons + 20);
    expect(c.grounds!.length).toBeLessThanOrEqual(RUIN.seasons); // only what it needs is kept
  });
});
