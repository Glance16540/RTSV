// Meeting them face to face (src/sim/encounter.ts): who stands in the window when an army meets a band, or a story
// waits on the leader's word.
import { describe, expect, it } from 'vitest';
import { BAND_DRESS, ENCOUNTER, askerOf, awaiting, awaitsWord, bandLineup, heldOf, menShown, wordKey } from '../src/sim/encounter';
import { newCampaign } from '../src/sim/campaign';
import { UNITS } from '../src/sim/data';
import type { Band, BandKind } from '../src/sim/threats';
import type { Intrigue } from '../src/sim/intriguebase';

const band = (kind: BandKind, strength: number, held: Band['held'] = []): Band => ({ id: 7, kind, name: 'the Black Sail', at: 0, strength, since: 0, held });
const story = (over: Partial<Intrigue>): Intrigue => ({ id: 3, kind: 'thief', owner: 0, at: 0, since: 0, people: [], culprit: -1, victims: [], taken: 0, robbed: [], clues: [], cleared: [], watched: 0, ...over } as Intrigue);

describe('meeting a band', () => {
  it('its leader stands in front, with one of his men for every so much of its strength, never more than a few', () => {
    expect(menShown(0)).toBe(1);
    expect(menShown(3)).toBe(2);
    expect(menShown(99)).toBe(ENCOUNTER.most);
    const c = newCampaign(4, 2);
    const figs = bandLineup(c, band('slavers', 6));
    expect(figs[0]).toMatchObject({ role: 'leader', dress: BAND_DRESS.slavers.leader, pose: 'talk' });
    expect(figs.filter((f) => f.role === 'man')).toHaveLength(menShown(6));
    expect(figs.filter((f) => f.role === 'captive')).toHaveLength(0);
  });

  it('every kind of band is dressed and armed as soldiers the game already has', () => {
    for (const d of Object.values(BAND_DRESS)) for (const t of [d.leader, ...d.men]) expect(UNITS[t], t).toBeTruthy();
  });

  it('a few of those it holds sit at the back, grown and covered; their children are never among them', () => {
    const c = newCampaign(4, 2);
    const b = band('raiders', 4, [{ from: 2, owner: 1, men: [80], women: [70, 90, 100, 110], since: 0, bore: 2, kids: [1, 3] }]);
    expect(heldOf(b)).toEqual({ men: 1, women: 4 });
    const caps = bandLineup(c, b).filter((f) => f.role === 'captive');
    expect(caps).toHaveLength(ENCOUNTER.captives);
    for (const f of caps) expect(f).toMatchObject({ dress: 'villager', pose: 'sit', civ: c.factions[1].civ });
    expect(caps.every((f) => f.female)).toBe(true); // women first, as a band's captives mostly are
    expect(bandLineup(c, b).length).toBe(1 + menShown(4) + ENCOUNTER.captives);
  });

  it('the same band looks the same each time it is met', () => {
    const c = newCampaign(4, 2);
    expect(bandLineup(c, band('pirates', 5))).toEqual(bandLineup(c, band('pirates', 5)));
  });
});

describe('a story that waits on the leader\'s word', () => {
  it('is one of the four met face to face, at the pass where the leader must answer', () => {
    expect(awaitsWord(story({ kind: 'suitor' }))).toBe(true);
    expect(awaitsWord(story({ kind: 'rival', stage: 0 }))).toBe(false);
    expect(awaitsWord(story({ kind: 'rival', stage: 1 }))).toBe(true);
    expect(awaitsWord(story({ kind: 'plot' }))).toBe(false);
    expect(awaitsWord(story({ kind: 'plot', found: true }))).toBe(true);
    expect(awaitsWord(story({ kind: 'thief' }))).toBe(false);
    expect(awaitsWord(story({ kind: 'thief', caught: 4, thief: { name: 'Ada', family: 'Reeve', gender: 'f', trade: 'weaver' } }))).toBe(true);
    expect(awaitsWord(story({ kind: 'killer' }))).toBe(false);
    expect(awaitsWord(story({ kind: 'suitor', owner: 1 }))).toBe(false); // a rival's own stories are not the player's to answer
    expect(awaitsWord(story({ kind: 'suitor', ended: { turn: 3, how: 'wed', text: '' } } as Partial<Intrigue>))).toBe(false);
  });

  it('the one asking is shown as who they are: a suitor or an envoy of the rival people, a noble, the thief', () => {
    const c = newCampaign(4, 2);
    expect(askerOf(c, story({ kind: 'suitor', rival: 1 }))).toMatchObject({ role: 'asker', dress: 'noble', civ: c.factions[1].civ, female: false });
    expect(askerOf(c, story({ kind: 'rival', stage: 1, rival: 1 }))).toMatchObject({ dress: 'envoy', civ: c.factions[1].civ });
    expect(askerOf(c, story({ kind: 'plot', found: true, culprit: 0, nobles: [{ key: 'a', name: 'Edith', title: 'Lady Edith', female: true }] }))).toMatchObject({ dress: 'noble', female: true, civ: c.factions[0].civ });
    expect(askerOf(c, story({ kind: 'thief', caught: 2, thief: { name: 'Ada', family: 'Reeve', gender: 'f', trade: 'weaver' } }))).toMatchObject({ dress: 'villager', female: true });
    expect(askerOf(c, story({ kind: 'thief' }))).toBeNull();
  });

  it('comes up again only at a new pass', () => {
    expect(wordKey(story({ kind: 'rival', stage: 1 }))).not.toBe(wordKey(story({ kind: 'rival', stage: 2 })));
    expect(wordKey(story({ kind: 'plot', found: true }))).toBe(wordKey(story({ kind: 'plot', found: true })));
  });

  it('reading who stands there changes nothing in the campaign', () => {
    const c = newCampaign(9, 2);
    c.intrigues = [story({ kind: 'suitor', rival: 1 })];
    c.bands = [band('highwaymen', 3, [{ from: 1, owner: 0, men: [80], women: [90], since: 0 }])];
    const before = JSON.stringify(c);
    awaiting(c).forEach((it) => askerOf(c, it));
    bandLineup(c, c.bands[0]);
    expect(JSON.stringify(c)).toBe(before);
  });
});
