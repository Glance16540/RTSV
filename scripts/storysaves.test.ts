// Saves for a browser playtest of the stories on the field (src/sim/fieldstory.ts, src/sim/courtfield.ts): the player's
// capital as a visit, with a thief, a killer and a plot, an envoy, a suitor, or all three of the house afoot there.
//
//   STORYSAVES=1 OUT=dir npx vitest run scripts/storysaves.test.ts
//
// Skipped unless STORYSAVES is set. It judges nothing: it writes campaign saves a person (or a browser script) opens.
import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { beginKiller, beginThief } from '../src/sim/intrigue';
import { beginPlot, beginRival, beginSuitor } from '../src/sim/courtstory';
import { HEIR_AGE, houseOf } from '../src/sim/dynasty';
import { kinOf } from '../src/sim/kin';
import { folkOf } from '../src/sim/township';
import { beginVisit } from '../src/sim/visit';

const OUT = process.env.OUT ?? 'storysaves';

/** The player's capital at season 20, with grown people enough for a killer, a spouse, a daughter of age and four nobles, one angry. */
function world(): { c: Campaign; at: number; rival: number } {
  const c = newCampaign(5, 2);
  c.turn = 20; c.phase = 'player';
  const t = c.territories.find((x) => x.owner === 0 && x.capital === 0)!;
  Object.assign(folkOf(c, t.id), { men: 24, women: 24, elders: 4, children: 8 });
  Object.assign(folkOf(c, t.id).stores, { food: 4000, wood: 4000, gold: 4000, stone: 4000 });
  kinOf(c, 0);
  houseOf(c, 0).heirs = [{ name: 'Maren', female: true, born: c.turn - HEIR_AGE - 8 }];
  c.factions[0].nobles = ['Aldric', 'Bram', 'Cyra', 'Dunn'].map((name, i) => ({ key: `lord:${90 + i}:0`, name, female: name === 'Cyra', town: t.id, rank: 'lord' as const, leaning: 'martial' as const, mood: i === 1 ? -80 : 0 }));
  return { c, at: t.id, rival: c.factions.find((f) => f.id > 0 && f.alive)!.id };
}

it.skipIf(!process.env.STORYSAVES)('writes the saves of stories on the field', () => {
  mkdirSync(OUT, { recursive: true });
  const save = (name: string, make: (w: ReturnType<typeof world>) => unknown[]): void => {
    const w = world(), made = make(w);
    const ok = beginVisit(w.c, w.at);
    writeFileSync(`${OUT}/${name}.json`, JSON.stringify(w.c));
    console.log(`${name}: ${made.map((x) => (x ? 'begun' : 'NOT begun')).join(', ')}; visit ${ok ? 'set' : 'NOT set'}`);
  };
  save('thief', ({ c, at }) => { const it = beginThief(c, at); it.robbed = it.people.map((_, i) => (i < 2 ? 1 + i : 0)); it.taken = 60; return [it]; });
  save('killer-plot', ({ c, at }) => [beginKiller(c, at), beginPlot(c, 'lord:91:0')]);
  save('envoy', ({ c, rival }) => { const it = beginRival(c, rival); if (it) { it.stage = 1; it.due = c.turn + 2; } return [it]; });
  save('suitor', ({ c, rival }) => [beginSuitor(c, rival)]);
  save('all-court', ({ c, rival }) => { const r = beginRival(c, rival); if (r) { r.stage = 1; r.due = c.turn + 2; } return [r, beginSuitor(c, rival), beginPlot(c, 'lord:91:0')]; });
}, 120_000);
