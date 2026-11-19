// A defied rival king may declare war: the truce is over, and he hears of none while the feud runs (src/sim/feudwar.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign, offerTruce } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { AFTER, remember } from '../src/sim/aftermath';
import type { Mark } from '../src/sim/aftermath';
import { FEUDWAR, atWarWith, mayDeclareWar, warUntil } from '../src/sim/feudwar';
import type { Intrigue } from '../src/sim/intriguebase';

const base = JSON.stringify(newCampaign(5, 2));
const world = (): { c: Campaign; rival: number } => {
  const c: Campaign = JSON.parse(base);
  c.turn = 20; c.phase = 'player';
  return { c, rival: c.factions.find((f) => f.id > 0 && f.alive)!.id };
};
const feud = (c: Campaign, rival: number, story = 1): Mark => {
  const m: Mark = { id: 100 + story, kind: 'feud', from: 'rival', story, owner: 0, since: c.turn, until: c.turn + AFTER.feud.seasons, text: 'Temur of the Mongols was defied, and has not forgiven it.', rival, name: 'Temur' };
  (c.marks ??= []).push(m);
  return m;
};
/** A rival king's story, ended with him defied. */
const defied = (c: Campaign, rival: number, id: number): Intrigue => ({ id, kind: 'rival', owner: 0, rival, at: c.territories.find((t) => t.capital === 0)!.id, since: c.turn - 3, ended: { turn: c.turn, how: 'foiled', text: '' }, cast: { king: 'Temur', spouse: 'Ana' } } as unknown as Intrigue);

describe('a defied rival king may declare war', () => {
  it('war ends the truce between them, by his act: the player\'s honour is not touched, and it is told and written down', () => {
    const { c, rival } = world();
    c.truces.push({ with: rival, until: c.turn + 10 });
    const honor = c.honor, m = feud(c, rival);
    expect(mayDeclareWar(c, m, true)).toBe(true);
    expect(m.war).toBe(true);
    expect(c.truces.some((t) => t.with === rival)).toBe(false);
    expect(c.honor).toBe(honor);
    expect(atWarWith(c, rival)).toBe(true);
    expect(warUntil(c, rival)).toBe(c.turn + AFTER.feud.seasons);
    expect(c.log[c.log.length - 1]).toMatch(/^Temur of the .* has declared war on you, and the truce between you is at an end\. He will hear of no truce until it is forgotten\.$/);
    expect(c.intrigueNews!.some((n) => n.turn === c.turn && n.tone === 'bad' && /declared war/.test(n.text))).toBe(true);
    expect(c.chronicle!.some((x) => /defied, declared war/.test(x.text))).toBe(true);
    expect(m.text).toMatch(/He has declared war\.$/);
    expect(mayDeclareWar(c, m, true)).toBe(false); // once
  });
  it('breaks an alliance with him too, and leaves a truce with another people alone', () => {
    const { c, rival } = world(), other = c.factions.find((f) => f.id > 0 && f.id !== rival && f.alive)?.id;
    c.ally = rival;
    if (other !== undefined) c.truces.push({ with: other, until: c.turn + 10 });
    mayDeclareWar(c, feud(c, rival), true);
    expect(c.ally).toBe(-1);
    expect(c.log[c.log.length - 1]).toMatch(/your alliance is at an end/);
    if (other !== undefined) { expect(c.truces.some((t) => t.with === other)).toBe(true); expect(atWarWith(c, other)).toBe(false); }
  });
  it('while the feud runs he will hear of no truce, and nothing is paid for asking; when it is forgotten he may be treated with again', () => {
    const { c, rival } = world();
    c.factions[0].supplies = 999; c.honor = 5;
    mayDeclareWar(c, feud(c, rival), true);
    const had = c.factions[0].supplies;
    expect(offerTruce(c, rival)).toBe(false);
    expect(c.factions[0].supplies).toBe(had);
    expect(c.log[c.log.length - 1]).toMatch(/at war with you over their king's quarrel, and will hear of no truce before turn \d+\.$/);
    c.turn += AFTER.feud.seasons + 1; // the feud has run out
    expect(atWarWith(c, rival)).toBe(false);
    expect(warUntil(c, rival)).toBeUndefined();
    c.factions[rival].refused = -1;
    const log = c.log.length;
    offerTruce(c, rival); // whatever he answers now, it is not the war that answers
    expect(c.log.slice(log).some((l) => /king's quarrel/.test(l))).toBe(false);
  });
  it('a feud in which he did not declare war is as it was: the truce stands and he may be treated with', () => {
    const { c, rival } = world();
    c.truces.push({ with: rival, until: c.turn + 10 });
    feud(c, rival);
    expect(atWarWith(c, rival)).toBe(false);
    expect(c.truces.some((t) => t.with === rival)).toBe(true);
  });
  it('is not for a mark that is no feud, a people that are gone, or a feud that is not the player\'s', () => {
    const { c, rival } = world();
    expect(mayDeclareWar(c, undefined, true)).toBe(false);
    expect(mayDeclareWar(c, { ...feud(c, rival), kind: 'bought' }, true)).toBe(false);
    expect(mayDeclareWar(c, { ...feud(c, rival), owner: rival }, true)).toBe(false);
    c.factions[rival].alive = false;
    expect(mayDeclareWar(c, feud(c, rival, 9), true)).toBe(false);
  });
  it('as a feud begins he declares war about half the time, by a chance of its own', () => {
    let wars = 0, feuds = 0;
    for (let id = 1; id <= 600; id++) {
      const { c, rival } = world();
      c.truces.push({ with: rival, until: c.turn + 10 });
      const rng = c.rngState, m = remember(c, defied(c, rival, id));
      expect(m?.kind).toBe('feud');
      expect(c.rngState).toBe(rng); // none of the campaign's own luck is spent
      feuds++;
      if (m!.war) { wars++; expect(c.truces.some((t) => t.with === rival)).toBe(false); } else expect(c.truces.some((t) => t.with === rival)).toBe(true);
    }
    expect(feuds).toBe(600);
    expect(wars / feuds).toBeGreaterThan(FEUDWAR.chance - 0.07);
    expect(wars / feuds).toBeLessThan(FEUDWAR.chance + 0.07);
  });
});
