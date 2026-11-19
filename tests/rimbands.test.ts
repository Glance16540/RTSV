// Bands and the rim of true wilderness (src/sim/rim.ts, bandwilds.ts, bandroam.ts, bandhorde.ts, bandfight.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { WILDS, farWilds, marchOf } from '../src/sim/bandmarch';
import { seenGathering, setOutFromAfar, wayIn } from '../src/sim/bandwilds';
import { roamSeason, waysFrom } from '../src/sim/bandroam';
import { canAttackBand } from '../src/sim/bandfight';
import { hordeSeason } from '../src/sim/bandhorde';
import { appear } from '../src/sim/threats';
import type { Band } from '../src/sim/threats';
import { outOf } from '../src/sim/rim';

/** A world with a rim land a camp could come in from, and a camp of raiders just born there. */
function born(): { c: Campaign; b: Band; rim: number } {
  for (let seed = 1; seed < 200; seed++) {
    const c = newCampaign(seed, 2, 1, 'hearth');
    const rim = farWilds(c).find((id) => c.territories[id].rim && wayIn(c, id));
    if (rim === undefined) continue;
    const b: Band = { id: 501, kind: 'raiders', name: 'the test band', at: rim, strength: 4, since: c.turn, held: [] };
    (c.bands ??= []).push(b);
    return { c, b, rim };
  }
  throw new Error('no world with a way in from the rim');
}

describe('a camp born in the rim of wilderness', () => {
  it('gathers there a season before it sets out, and the towns that look out on the rim see its fires', () => {
    const { c, b, rim } = born();
    expect(setOutFromAfar(c, b)).toBe(true);
    expect(b.afar).toBe(true);
    expect(b.gathers).toBe(c.turn + WILDS.gather);
    const out: string[] = [];
    const saw = seenGathering(c, b, out);
    // Whoever holds a land within two of the rim land is told; where nobody does, nobody is.
    const near = new Set(outOf(c, rim).flatMap((n) => [n, ...c.territories[n].adj]));
    const holders = new Set([...near].map((n) => c.territories[n].owner).filter((o) => o >= 0));
    expect(saw).toBe(holders.size);
    if (saw) { expect(out.join(' ')).toContain('are gathering there'); expect(marchOf(c, b.id)!.seen).toBe(c.turn); }
    // It does not move while it gathers, and is on its way the season after.
    roamSeason(c, []);
    expect(b.at).toBe(rim);
    c.turn += WILDS.gather;
    roamSeason(c, []);
    expect(b.at).not.toBe(rim);
    expect(outOf(c, rim)).toContain(b.at);
  });

  it('once out it never goes back: no camp may stand in the rim, and no way a camp plans runs through it', () => {
    const { c, b, rim } = born();
    setOutFromAfar(c, b);
    c.turn += WILDS.gather;
    roamSeason(c, []);
    for (let i = 0; i < 12; i++) { c.turn++; roamSeason(c, []); if (!c.bands!.includes(b)) break; expect(c.territories[b.at].rim).toBeFalsy(); }
    const probe: Band = { id: 777, kind: 'raiders', name: 'x', at: outOf(c, rim)[0], strength: 3, since: c.turn, held: [] };
    expect(waysFrom(c, probe, 8).some((w) => c.territories[w.to].rim)).toBe(false);
  });

  it('an army in a land the rim looks down on can go up against a camp gathering there, though nobody can march in', () => {
    const { c, b, rim } = born();
    setOutFromAfar(c, b);
    const below = outOf(c, rim)[0];
    c.armies = c.armies.filter((a) => a.owner !== 0);
    c.armies.push({ id: 901, owner: 0, at: below, units: { infantry: 6 }, hero: false, vet: 0, moved: false });
    expect(c.territories[below].adj).not.toContain(rim);
    expect(canAttackBand(c, 901, b.id)).toBe(true);
    c.armies[c.armies.length - 1].at = c.territories.find((t) => !t.rim && t.id !== below && !outOf(c, rim).includes(t.id) && !t.adj.includes(below))!.id;
    expect(canAttackBand(c, 901, b.id)).toBe(false);
  });
});

describe('the other bands and the rim', () => {
  it('no ordinary camp is born in the rim: over many seasons every new camp that is not from afar stands in a land of the world', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      for (let i = 0; i < 60; i++) { c.turn++; const b = appear(c, []); if (b) expect(c.territories[b.at].rim, `seed ${seed} turn ${c.turn}`).toBeFalsy(); }
    }
  });

  it('the marauders never make a camp in the rim, though it is the land farthest from every chief town', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      for (let i = 0; i < 80; i++) { c.turn++; hordeSeason(c, []); }
      for (const t of c.territories.filter((x) => x.rim)) { expect(t.horde).toBeFalsy(); expect(t.owner).toBe(-1); }
      expect((c.bands ?? []).some((b) => c.territories[b.at].rim)).toBe(false);
    }
  });
});

describe('a host out of the wilds is drawn by the richest mark, not the nearest (bandwilds.ts deepWay; report only until the switch)', () => {
  it('never takes a place it need not march to; goes at least as far as the old weighing on the whole; and some of the time takes the farthest of those nearly as good', async () => {
    const { deepWay, wayIn: near, markOf } = await import('../src/sim/bandwilds');
    const { WILDS: W } = await import('../src/sim/bandmarch');
    let n = 0, farther = 0, nearer = 0, sumDeep = 0, sumOld = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      for (const t of c.territories.filter((x) => x.rim)) {
        const old = near(c, t.id), picks = [0, 1, 2, 3, 4, 5, 6, 7].map((salt) => deepWay(c, t.id, 'raiders', salt));
        if (!picks[0]) { continue; }
        for (const d of picks) { expect(d!.steps).toBeGreaterThanOrEqual(2); expect(c.territories[d!.bound].rim).toBeFalsy(); }
        if (!old) continue; // the old weighing's best was one land off: no march in at all
        n++;
        const mean = picks.reduce((k, d) => k + d!.steps, 0) / picks.length;
        sumDeep += mean; sumOld += old.steps;
        if (mean > old.steps) farther++; else if (mean < old.steps) nearer++;
        const m = markOf(c, t.id, picks[0]!, 'raiders');
        expect(m.depth).toBeGreaterThanOrEqual(picks[0]!.steps);
        expect(m.depth).toBeLessThanOrEqual(picks[0]!.steps + 1);
        expect(m.meets).toBeGreaterThanOrEqual(0);
      }
    }
    expect(n).toBeGreaterThan(40);
    expect(sumDeep / n).toBeGreaterThan(sumOld / n);
    expect(farther).toBeGreaterThan(nearer);
    expect(W.near).toBeLessThan(1);
    expect(W.deep).toBeGreaterThan(0);
  });

  it('the same seed and salt make the same choice, and a camp that sets out is recorded with its mark and the march it would have made', async () => {
    const { deepWay } = await import('../src/sim/bandwilds');
    const { c, b, rim } = born();
    expect(deepWay(c, rim, 'raiders', 5)).toEqual(deepWay(c, rim, 'raiders', 5));
    const at = b.at;
    expect(setOutFromAfar(c, b)).toBe(true);
    const m = marchOf(c, b.id)!;
    expect(m.depth).toBeGreaterThanOrEqual(m.lands);
    expect(m.meets).toBeGreaterThanOrEqual(0);
    expect(m.would!.lands).toBeGreaterThanOrEqual(2);
    expect(b.bound).toBe(m.bound); // decided as before: the record's `would` moves nothing
    expect(b.at).toBe(at);
  });
});
