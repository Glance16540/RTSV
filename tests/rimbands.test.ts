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
