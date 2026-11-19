// The common people's lines in their own faith (src/sim/folkfaith.ts).
import { describe, expect, it } from 'vitest';
import { FOLK, LEANS, folkKey, folkRole } from '../src/sim/folk';
import { BELIEF_NOTES, BELIEF_OF, FAITH_LINES, beliefOf, faithKey, faithVariants, inFaith } from '../src/sim/folkfaith';
import { CIVS } from '../src/sim/data';

const scriptLine = (role: string, moment: string, lean: string): string | undefined =>
  (folkRole(role)?.lines as Record<string, [string, string, string]> | undefined)?.[moment]?.[LEANS.indexOf(lean as never)];

describe('folkfaith', () => {
  it('every people speaks in a faith, and every faith is spoken by someone', () => {
    for (const civ of Object.keys(CIVS)) expect(BELIEF_OF[civ], civ).toBeDefined();
    for (const b of Object.keys(BELIEF_NOTES)) expect(Object.values(BELIEF_OF)).toContain(b);
  });
  it('a line in another faith stands in for a line of the script, of about its length', () => {
    for (const x of faithVariants()) {
      const base = scriptLine(x.role, x.moment, x.lean);
      expect(base, `${x.belief} ${x.role}.${x.moment}.${x.lean}`).toBeDefined();
      expect(x.text.length).toBeLessThanOrEqual(Math.max(40, base!.length * 1.6));
      expect(x.text.length).toBeGreaterThan(0);
    }
  });
  it('no people but the Franks and the English is left speaking of the church, relics or the Lord', () => {
    const christian = /\b(church|relics?|the Lord|sins forgiven)\b/i;
    for (const civ of Object.keys(CIVS)) {
      if (beliefOf(civ) === 'christian') continue;
      for (const r of FOLK) for (const [m, three] of Object.entries(r.lines)) three.forEach((base, li) => {
        const said = inFaith(r.id, m as never, LEANS[li], civ) ?? base;
        expect(christian.test(said), `${civ} ${r.id}.${m}.${LEANS[li]}: ${said}`).toBe(false);
      });
    }
  });
  it('the gods of the many-godded peoples are never spoken of as one God, nor God among the Muslims as gods', () => {
    for (const b of ['nile', 'babylon', 'greek', 'roman', 'norse'] as const) for (const t of Object.values(FAITH_LINES[b])) expect(/\bGod\b|\bHis\b/.test(t!), t).toBe(false);
    for (const t of Object.values(FAITH_LINES.muslim)) expect(/\bgods\b/i.test(t!), t).toBe(false);
  });
  it('the Franks keep the script; a line in another faith is recorded under its own name', () => {
    expect(inFaith('farmer', 'ready', 'pious', 'hearth')).toBeUndefined();
    expect(inFaith('farmer', 'ready', 'pious', 'mali')).toMatch(/God sends the rain/);
    expect(inFaith('farmer', 'ready', 'pious', 'kush')).toMatch(/Hapi/);
    const k = folkKey('farmer', 'pious', 'ready', 'f', 'a');
    expect(faithKey(k, 'farmer', 'ready', 'pious', 'hearth')).toBe(k);
    expect(faithKey(k, 'farmer', 'ready', 'pious', 'japan')).toBe(`${k}_japanese`);
    const w = folkKey('woodcutter', 'pious', 'ready', 'm', 'a'); // a line that speaks of no faith is the same for all
    expect(faithKey(w, 'woodcutter', 'ready', 'pious', 'japan')).toBe(w);
  });
});
