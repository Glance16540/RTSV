// Threads of tales three to five tellings long, told whole when they end (src/sim/threadtales.ts, src/sim/talethreads.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, answerDemand, answerTale, continueAI, endTurn, newCampaign, resolvePending, taleNow, taleText } from '../src/sim/campaign';
import { TALES, Tale } from '../src/sim/story';
import { THREAD_NAMES, THREAD_TALES } from '../src/sim/threadtales';
import { WORLD_THREAD_NAMES } from '../src/sim/worldtales';
import { leadsOn, rootOf, threadOf } from '../src/sim/talethreads';
import { sensibleAnswers } from '../src/sim/storypolicy';

const CHILD = /\b(child|children|childhood|baby|babies|infant|boy|boys|girl|girls|son|sons|daughter|daughters|kid|kids|youngster|orphan)\b/i;
const SUGGESTIVE = /\b(bed|bedded|naked|lust|kiss|seduce|harlot|whore|brothel|mistress)\b/i;

const still = new WeakSet<Campaign>();
const turn = (c: Campaign) => {
  if (still.has(c)) { c.armies = c.armies.filter((a) => a.owner === 0); for (const f of c.factions) if (f.id > 0) f.supplies = 0; for (const t of c.territories) t.horde = false; }
  endTurn(c);
  for (let i = 0; i < 40 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
};
const toTale = (c: Campaign) => { do turn(c); while (c.phase !== 'over' && !c.tale); };
const quiet = (seed = 7) => { const c = newCampaign(seed, 1, 0, 'steppe'); c.truces = [{ with: 1, until: 999 }]; still.add(c); return c; };
const put = (id: string) => {
  const c = quiet();
  const cap = c.territories.find((t) => t.capital === 0)!;
  const tribe = cap.adj.map((n) => c.territories[n]).find((t) => t.owner < 0)!;
  tribe.militia = 3; tribe.horde = false;
  c.factions[0].supplies = 60;
  c.tale = { id, land: cap.id, rival: 1, tribe: tribe.id };
  return { c, cap, tribe };
};
const next = (id: string, k: 'a' | 'b'): Tale[] => TALES.filter((x) => x.after?.id === id && x.after.choice === k);
/** Every road a thread can take from its first tale: the tales in it, and the answer given at each. */
function roads(id: string): [string, 'a' | 'b'][][] {
  const out: [string, 'a' | 'b'][][] = [];
  for (const k of ['a', 'b'] as const) {
    const on = next(id, k);
    if (!on.length) out.push([[id, k]]);
    for (const t of on) for (const r of roads(t.id)) out.push([[id, k], ...r]);
  }
  return out;
}
const roots = TALES.filter((t) => !t.after && TALES.some((x) => x.after?.id === t.id));

describe('threads of tales', () => {
  it('each thread, once begun, runs three to five tellings whichever way it is answered', () => {
    expect(roots.map((t) => t.id).sort()).toEqual([...Object.keys(THREAD_NAMES), ...Object.keys(WORLD_THREAD_NAMES)].sort());
    for (const t of THREAD_TALES) expect(TALES, t.id).toContain(t);
    for (const root of roots) for (const road of roads(root.id)) {
      if (road.length === 1) continue; // an answer that begins nothing
      expect(road.length, road.map((x) => x.join('')).join(' ')).toBeGreaterThanOrEqual(3);
      expect(road.length, road.map((x) => x.join('')).join(' ')).toBeLessThanOrEqual(5);
    }
    // One telling for each answer at most, every thread hangs from a real tale, and each answer says what was done.
    for (const t of TALES.filter((x) => x.after)) {
      expect(next(t.after!.id, t.after!.choice).length, t.id).toBe(1);
      expect(TALES.some((x) => x.id === t.after!.id), t.id).toBe(true);
      expect(rootOf(t.id), t.id).toBeTruthy();
      for (const k of ['a', 'b'] as const) {
        expect(t[k].told, `${t.id} ${k}`).toBeTruthy();
        if (!leadsOn(t.id, k)) expect(t[k].fate, `${t.id} ${k}: an answer that ends a thread says how it ended`).toBeTruthy();
      }
    }
    for (const r of roots) for (const k of ['a', 'b'] as const) if (leadsOn(r.id, k)) expect(r[k].told, r.id).toBeTruthy();
  });

  it('name no child, say nothing suggestive, and keep the upright answer first', () => {
    for (const t of TALES) {
      const words = [t.title, t.text, t.a.label, t.a.result, t.a.told ?? '', t.a.fate ?? '', t.b.label, t.b.result, t.b.told ?? '', t.b.fate ?? ''].join(' ');
      expect(words, t.id).not.toMatch(CHILD);
      expect(words, t.id).not.toMatch(SUGGESTIVE);
      expect(t.a.virtue, t.id).toBeGreaterThan(0);
      expect(t.b.virtue, t.id).toBeLessThan(0);
    }
  });

  it('a thread is played to its end, each telling about the same people, and the chronicle tells it whole', () => {
    const { c, cap } = put('exile');
    const road: [string, 'a' | 'b'][] = [['exile', 'a'], ['exile_home', 'a'], ['exile_crowned', 'a'], ['exile_oath', 'a'], ['exile_heir', 'b']];
    for (const [id, k] of road) {
      expect(c.tale?.id).toBe(id);
      expect(c.tale!.rival).toBe(1);
      expect(c.tale!.land).toBe(cap.id);
      expect(taleText(c, taleNow(c)!.text + taleNow(c)![k].result)).not.toMatch(/[{}]/);
      c.factions[0].supplies = 60;
      expect(answerTale(c, k)).toBe(true);
      if (id !== 'exile_heir') { expect(c.threadEnds ?? []).toEqual([]); toTale(c); }
    }
    expect(threadOf(c, c.answers!.at(-1)!).map((a) => a.id)).toEqual(road.map((x) => x[0]));
    const line = c.chronicle!.at(-1)!.text;
    expect(line).toMatch(/^So ended the matter of the exile at the gate, (from year \d+ to year \d+|in year \d+): you gave the prince shelter, blessed his going home with his own, swore to stand with him, kept your oath when he called on it and asked tribute of his heir\. The prince died old/);
    expect(line).not.toMatch(/[{}]/);
    expect(c.threadEnds).toEqual([expect.objectContaining({ root: 'exile', last: 'exile_heir', choice: 'b', how: 'ended', steps: 5, rival: 1, land: cap.id })]);
  }, 60_000);

  it('the answer given picks the road: the other way is never told', () => {
    const { c } = put('relics');
    answerTale(c, 'b'); toTale(c);
    expect(c.tale?.id).toBe('relics_sold');
    answerTale(c, 'b'); toTale(c);
    expect(c.tale?.id).toBe('relics_false');
    answerTale(c, 'a');
    expect(c.chronicle!.at(-1)!.text).toContain('you sold the bones, raised a shrine over other bones and owned to the false bones from the church steps.');
    for (let i = 0; i < 8 && c.phase !== 'over'; i++) { toTale(c); expect(['cure', 'relics_home', 'shrine_crowd', 'shrine_doubt', 'shrine_saint']).not.toContain(c.tale?.id); c.tale = null; }
  }, 60_000);

  it('a thread whose rival has fallen is told as left unfinished, and why', () => {
    const { c } = put('exile');
    answerTale(c, 'a'); toTale(c);
    expect(c.tale?.id).toBe('exile_home');
    answerTale(c, 'a');
    c.factions[1].alive = false;
    toTale(c);
    expect(c.tale?.id).not.toBe('exile_crowned');
    const line = c.chronicle!.find((l) => l.text.startsWith('The matter of the exile at the gate was left unfinished'))!.text;
    expect(line).toMatch(/you gave the prince shelter and blessed his going home with his own, and then the .+ were no more\.$/);
    expect(c.threadEnds?.[0]).toMatchObject({ how: 'dropped', steps: 2 });
  }, 60_000);

  it('a careful ruler answers a tale upright when the supplies can be spared, and the other way when not', () => {
    const { c } = put('pilgrims');
    expect(sensibleAnswers(c, 0)).toContain('tale:a');
    expect(c.answers!.at(-1)).toMatchObject({ id: 'pilgrims', choice: 'a' });
    const low = put('pilgrims').c;
    low.factions[0].supplies = 2;
    sensibleAnswers(low, 0);
    expect(low.answers!.at(-1)).toMatchObject({ id: 'pilgrims', choice: 'b' });
  });

  it('a thread\'s answers are kept with a saved campaign', () => {
    const { c } = put('hunger');
    answerTale(c, 'b'); toTale(c);
    answerTale(c, 'b'); toTale(c);
    expect(c.tale?.id).toBe('tribe_mourner');
    answerTale(c, 'b');
    const back = JSON.parse(JSON.stringify(c)) as Campaign;
    expect(back.threadEnds).toEqual(c.threadEnds);
    expect(back.chronicle!.at(-1)!.text).toContain('its men waited for their day');
  }, 60_000);
});
