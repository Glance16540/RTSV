// A rival people marches to hunt a band that holds its people or sits in its land, and weighs the marauders (src/sim/rivalhunt.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Army, Campaign, Territory } from '../src/sim/campaign';
import { armyStrength } from '../src/sim/campaignbase';
import { FIGHT, huntBands } from '../src/sim/bandfight';
import { HUNT, causeOf, heldBy, huntFrom, maraudersFirst, rivalHunts, wayThrough } from '../src/sim/rivalhunt';
import type { Band } from '../src/sim/threats';
import { THREATS } from '../src/sim/threatsbase';

const base = JSON.stringify(newCampaign(5, 2));
/**
 * A rival people holding four lands in a line, a - b - m - z, with nothing else of anyone's about and no bands, in
 * summer; `far`, a land of nobody's beside z and beside none of the others, is where a band may sit.
 */
function world() {
  const c: Campaign = JSON.parse(base);
  c.turn = 21; c.phase = 'ai'; c.bands = []; c.armies = []; c.raids = []; c.truces = [];
  const f = c.factions.find((x) => x.id > 0 && x.alive && x.isAI)!.id;
  const T = c.territories;
  // Five lands made into a line by hand, cut off from every other: the test is of the march, not of this world's shape.
  const five = T.filter((t) => !t.rim).slice(0, 5);
  for (const t of T) { t.adj = t.adj.filter((n) => !five.some((x) => x.id === n)); if (t.owner === f) t.owner = -1; t.horde = false; }
  five.forEach((t, i) => { t.adj = [five[i - 1]?.id, five[i + 1]?.id].filter((n): n is number => n !== undefined); t.capital = -1; t.owner = i < 4 ? f : -1; delete t.free; });
  const line: Territory[] = five.slice(0, 4), far: Territory = five[4];
  const [a, b, m, z] = line;
  const army = (at: number, n: number, id = 900 + c.armies.length): Army => { const x: Army = { id, owner: f, at, units: { infantry: n }, hero: false, vet: 0, moved: false }; c.armies.push(x); return x; };
  const band = (at: number, strength: number, more: Partial<Band> = {}): Band => { const x = { id: 70 + (c.bands ?? []).length, kind: 'raiders', name: 'the Grey Band', at, strength, since: c.turn - 6, held: [], ...more } as Band; (c.bands ??= []).push(x); return x; };
  const holds = (x: Band, owner: number, seasonsAgo: number): void => { x.held.push({ from: z.id, owner, men: [100], women: [90], since: c.turn - seasonsAgo }); };
  return { c, f, a, b, m, z, far, army, band, holds };
}

describe('whose business a band is, and the way to it', () => {
  it('a band that holds a people\'s own is theirs to hunt, and so is one with its place in their land; the marauders never, and nobody else\'s', () => {
    const { c, f, z, far, band, holds } = world();
    const x = band(far.id, 3);
    expect(causeOf(c, x, f)).toBe('');
    expect(heldBy(c, x, f)).toBe(Infinity);
    holds(x, f, 1);
    expect(causeOf(c, x, f)).toBe('theirs');
    expect(heldBy(c, x, f)).toBe(THREATS.holdFor - 1);
    expect(causeOf(c, x, 0)).toBe('');
    const inLand = band(z.id, 3);
    expect(causeOf(c, inLand, f)).toBe('land');
    expect(causeOf(c, { ...inLand, kind: 'marauders' } as Band, f)).toBe('');
    expect(causeOf(c, { ...band(far.id, 2), kind: 'highwaymen', to: z.id } as Band, f)).toBe('land'); // either end of their road
  });
  it('it is fought from a land of the people\'s at its place or beside it, reached through their own lands', () => {
    const { c, f, a, b, m, z, far, band } = world();
    const x = band(far.id, 3);
    expect(huntFrom(c, x, f)).toEqual([z.id]);
    expect(wayThrough(c, f, a.id, [z.id], 4)).toEqual({ steps: 3, next: b.id });
    expect(wayThrough(c, f, m.id, [z.id], 4)).toEqual({ steps: 1, next: z.id });
    expect(wayThrough(c, f, z.id, [z.id], 4)).toEqual({ steps: 0, next: z.id });
    expect(wayThrough(c, f, a.id, [z.id], 2)).toBeNull(); // too far
    m.owner = -1;
    expect(wayThrough(c, f, a.id, [z.id], 9)).toBeNull(); // no way through its own lands
  });
});

describe('a rival marches for its own people', () => {
  it('an army two lands off sets out, a land a season, and gives battle when it comes beside the band; their people come home', () => {
    const { c, f, b, m, z, far, army, band, holds } = world();
    const x = band(far.id, 3), host = army(b.id, 9);
    holds(x, f, 1); // three seasons left
    expect(rivalHunts(c, f)).toEqual([{ army: host.id, band: x.id, to: m.id, cause: 'theirs' }]);
    expect(host.at).toBe(m.id);
    expect(host.moved).toBe(true);
    expect(huntBands(c, [])).toBe(0); // not there yet
    c.turn++; host.moved = false;
    expect(rivalHunts(c, f)).toEqual([{ army: host.id, band: x.id, to: z.id, cause: 'theirs' }]);
    c.turn++; host.moved = false;
    expect(rivalHunts(c, f)).toEqual([]); // it is there: the season's hunt finds the band
    const out: string[] = [];
    expect(huntBands(c, out)).toBe(1);
    expect((c.bands ?? []).some((k) => k.id === x.id && k.held.some((h) => h.owner === f))).toBe(false); // broken, or its captives lost to it: none of theirs is held
  });
  it('does not set out if it cannot be there before their time is up, nor from farther than it will go', () => {
    const { c, f, a, far, army, band, holds } = world();
    const x = band(far.id, 3);
    army(a.id, 9); // three lands off
    holds(x, f, THREATS.holdFor - 2); // two seasons left
    expect(rivalHunts(c, f)).toEqual([]);
    x.held[0].since = c.turn - 1; // three left: it can be there
    expect(rivalHunts(c, f).length).toBe(1);
    expect(HUNT.far).toBeGreaterThanOrEqual(3);
  });
  it('an army too weak for the band stays, and goes at shorter odds as their seasons run out (rivalcaptives.ts)', () => {
    const { c, f, m, far, army, band, holds } = world();
    const x = band(far.id, 5), host = army(m.id, 7);
    holds(x, f, 0); // just taken: FIGHT.theirs
    expect(armyStrength(host, c)).toBeLessThan(5 * FIGHT.theirs);
    expect(rivalHunts(c, f)).toEqual([]);
    x.held[0].since = c.turn - (THREATS.holdFor - 1); // their last season
    expect(rivalHunts(c, f).length).toBe(1);
  });
  it('sends one army to a band, the nearest, and none when one strong enough is already beside it', () => {
    const { c, f, a, m, z, far, army, band, holds } = world();
    const x = band(far.id, 3);
    holds(x, f, 0);
    const nearer = army(m.id, 9), farther = army(a.id, 12);
    const went = rivalHunts(c, f);
    expect(went.map((w) => w.army)).toEqual([nearer.id]);
    expect(farther.at).toBe(a.id);
    nearer.at = z.id; nearer.moved = false;
    expect(rivalHunts(c, f)).toEqual([]);
  });
  it('an army already ordered this season, or holding a town that wants it (rivalrule.ts marks it so), is not sent; and the player\'s armies are never moved', () => {
    const { c, f, m, far, army, band, holds } = world();
    const x = band(far.id, 3), host = army(m.id, 9);
    holds(x, f, 0);
    host.moved = true;
    expect(rivalHunts(c, f)).toEqual([]);
    expect(rivalHunts(c, 0)).toEqual([]);
  });
});

describe('a rival clears a band out of its own land', () => {
  it('an army behind the lines within two lands marches; one at the front does not, and none from farther', () => {
    const { c, f, a, b, m, z, army, band } = world();
    const x = band(z.id, 3);
    expect(huntFrom(c, x, f)).toContain(m.id);
    const host = army(a.id, 9); // a is two lands from m, which is beside the band
    const went = rivalHunts(c, f);
    expect(went).toEqual([{ army: host.id, band: x.id, to: b.id, cause: 'land' }]);
    // The same army at the front (a land of another people beside it) keeps to the war.
    const again = world();
    const y = again.band(again.z.id, 3), front = again.army(again.a.id, 9);
    const beside = again.c.territories.find((t) => !t.rim && t.owner !== again.f && t.id !== again.far.id && !t.adj.length) ?? again.c.territories.find((t) => !t.rim && t.owner !== again.f && t.id !== again.far.id)!;
    beside.owner = 0; beside.horde = false; beside.adj.push(again.a.id); again.c.territories[again.a.id].adj.push(beside.id); // the player's land beside it: a front
    expect(rivalHunts(again.c, again.f)).toEqual([]);
    expect(front.at).toBe(again.a.id);
    expect(y.strength).toBe(3);
    expect(HUNT.near).toBeLessThan(HUNT.far);
  });
});

describe('a rival weighs the marauders among the lands it could march on', () => {
  it('a camp that holds its people in their last seasons goes first, then one that has struck its towns of late; the rest as they were', () => {
    const { c, f, z, far } = world();
    const T = c.territories, others = T.filter((t) => t.id !== far.id && t.owner !== f && !t.rim).slice(0, 2).map((t) => t.id);
    far.horde = true;
    const camp = { id: 88, kind: 'marauders', name: 'the marauders', at: far.id, strength: 5, since: 1, held: [] } as unknown as Band;
    c.bands = [camp];
    const targets = [others[0], far.id, others[1]];
    expect(maraudersFirst(c, f, targets)).toEqual(targets); // no quarrel with them: as it was
    c.raids = [{ turn: c.turn - 3, band: camp.id, kind: 'marauders', name: camp.name, at: z.id, owner: f } as never];
    expect(maraudersFirst(c, f, targets)).toEqual([far.id, others[0], others[1]]);
    c.raids[0].turn = c.turn - HUNT.grudge - 1; // long ago
    expect(maraudersFirst(c, f, targets)).toEqual(targets);
    camp.held.push({ from: z.id, owner: f, men: [], women: [90], since: c.turn - 1 }); // time left yet
    expect(maraudersFirst(c, f, targets)).toEqual(targets);
    camp.held[0].since = c.turn - (THREATS.holdFor - 1); // her last season
    expect(maraudersFirst(c, f, targets)).toEqual([far.id, others[0], others[1]]);
    expect(maraudersFirst(c, 0, targets)).toEqual(targets); // another people's are nothing to it
  });
});
