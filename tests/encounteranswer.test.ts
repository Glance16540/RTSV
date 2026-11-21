// The ones met face to face answer the choice (src/sim/encounter.ts reactionTo, reactionWords; drawn in src/client/encounter.ts).
import { describe, expect, it } from 'vitest';
import { REACTIONS, reactionTo, reactionWords } from '../src/sim/encounter';
import { newCampaign } from '../src/sim/campaign';
import { beginThief, choicesFor } from '../src/sim/intrigue';

const CHILD = /\b(child|children|baby|infant|boy|girl|son|daughter|kid|orphan)\b/i;

describe('the one met answers the choice', () => {
  it('a pardon is bowed to, one set to work is led away, the banished leave, and a hanging is told, not shown', () => {
    expect(reactionTo('pardon')).toBe('bow');
    expect(reactionTo('work')).toBe('led');
    expect(reactionTo('banish')).toBe('leave');
    expect(reactionTo('hang')).toBe('told');
    expect(reactionTo('death')).toBe('told');
    expect(reactionTo('accuse:2')).toBeUndefined();
    expect(reactionTo('watch')).toBeUndefined();
    expect(reactionTo('ask')).toBeUndefined();
  });

  it('every choice a thief held can be given has an answer, and the words name no child and show no harm', () => {
    const c = newCampaign(5, 1), t = c.territories.find((x) => x.capital === 0)!;
    const it = beginThief(c, t.id);
    it.caught = c.turn; it.thief = { name: 'Odo', family: 'Reeve', gender: 'm', trade: 'carter' }; it.why = 'hunger';
    for (const k of choicesFor(c, it)) expect(reactionTo(k.id), k.id).toBeTruthy();
    for (const r of new Set(Object.values(REACTIONS))) {
      const w = reactionWords(r, 'Odo Reeve');
      expect(w).toMatch(/^Odo Reeve /);
      expect(w).not.toMatch(CHILD);
      expect(w).not.toMatch(/\b(rope|noose|gallows|blood|neck)\b/i);
    }
    expect(reactionWords('told', 'the plotter', true)).toContain('she is not seen again');
  });
});
