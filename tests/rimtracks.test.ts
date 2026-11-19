// The tracks drawn from a rim land to the lands below it (src/client/rimdraw.ts rimTracks, paintRimTracks).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { paintRimTracks, rimTracks } from '../src/client/rimdraw';

/** A 2D context that only counts what is drawn on it. */
const pen = () => {
  const seen = { strokes: 0, dashes: [] as number[][], saved: 0 };
  const ctx = {
    save: () => { seen.saved++; }, restore: () => { seen.saved--; }, beginPath: () => {}, moveTo: () => {}, quadraticCurveTo: () => {},
    stroke: () => { seen.strokes++; }, setLineDash: (d: number[]) => { seen.dashes.push(d); }, lineCap: '', strokeStyle: '', lineWidth: 0,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, seen };
};

describe('the tracks out of the rim', () => {
  it('there is one from every rim land to every land it looks down on, and no other', () => {
    for (const seed of [3, 11, 27, 64]) {
      const c = newCampaign(seed, 1, 1, 'hearth'), tracks = rimTracks(c);
      const want = c.territories.filter((t) => t.rim).flatMap((t) => (t.down ?? []).map((d) => `${t.id}>${d}`));
      expect(tracks.map((k) => `${k.rim}>${k.to}`)).toEqual(want);
      for (const k of tracks) {
        const a = c.territories[k.rim], b = c.territories[k.to];
        expect(a.rim).toBe(true);
        expect(b.rim).toBeFalsy();
        expect([k.ax, k.ay, k.bx, k.by]).toEqual([a.x, a.y + 8, b.x, b.y + 8]); // it ends where the roads end at a land
      }
    }
  });
  it('a track bends the other way from a road between the same two places, so the two never lie along each other', () => {
    const c = newCampaign(11, 1, 1, 'hearth');
    for (const k of rimTracks(c)) {
      const a = c.territories[k.rim], b = c.territories[k.to];
      const road = { x: (a.x + b.x) / 2 + (b.y - a.y) * 0.08, y: (a.y + b.y) / 2 - (b.x - a.x) * 0.08 + 8 }; // worldmap.ts, the roads' bend
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 8 };
      expect(k.mx - mid.x).toBeCloseTo(-(road.x - mid.x));
      expect(k.my - mid.y).toBeCloseTo(-(road.y - mid.y));
    }
  });
  it('each is drawn twice over (a pale bed, a dark trail), broken, and the pen is left as it was found', () => {
    const c = newCampaign(11, 1, 1, 'hearth'), n = rimTracks(c).length, { ctx, seen } = pen();
    expect(n).toBeGreaterThan(0);
    expect(paintRimTracks(ctx, c)).toBe(n);
    expect(seen.strokes).toBe(n * 2);
    expect(seen.dashes[0].length).toBe(2);
    expect(seen.dashes[seen.dashes.length - 1]).toEqual([]);
    expect(seen.saved).toBe(0);
  });
  it('a map with no rim has none, and nothing is drawn', () => {
    const c = newCampaign(11, 1, 1, 'hearth');
    const bare = { ...c, territories: c.territories.filter((t) => !t.rim) } as never;
    const { ctx, seen } = pen();
    expect(rimTracks(bare)).toEqual([]);
    expect(paintRimTracks(ctx, bare)).toBe(0);
    expect(seen.strokes).toBe(0);
  });
});
