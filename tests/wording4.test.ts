// The small words of the fourth playtest (docs/PLAYTEST.md 4.8, 4.10): the end card of a fight for a town, the season's
// report of men lost with the army, and a count that grew because a man came home.
import { describe, expect, it } from 'vitest';
import { verdictOf } from '../src/sim/battlecard';
import { reportLines, SeasonReport } from '../src/sim/seasonreport';

describe('the end card of a fight for a town', () => {
  it('says what became of the town, not "taken or held", and calls no town fight a skirmish', () => {
    expect(verdictOf(true, false, 4, 1, 'the Malians', { took: false })).toBe('The town has held at the cost of 1 man, and 4 men of the Malians are down. It will be remembered by those who were there.');
    expect(verdictOf(true, false, 8, 1, 'the locals', { took: true })).toBe('The town is taken at the cost of 1 man, and 8 men of the locals are down. It will be remembered by those who were there.');
    expect(verdictOf(false, false, 3, 20, 'the Malians', { took: false })).toBe('The town has fallen: 20 men of yours are down, and the Malians lost 3. The town is theirs.');
    expect(verdictOf(false, false, 1, 9, 'the Malians', { took: true })).toBe('The assault has failed: 9 men of yours are down, and the Malians lost 1. The town is still theirs.');
    for (const took of [true, false]) expect(verdictOf(true, false, 8, 1, 'the locals', { took })).not.toMatch(/skirmish|taken or held/);
  });
  it('a field battle is told as before', () => {
    expect(verdictOf(false, true, 0, 6, 'the Kushites', { took: true })).toBe('A skirmish lost: 6 men of yours are down, and the Kushites lost nobody. The field is theirs.');
  });
});

describe("the season's report", () => {
  it('men lost with the army are not said to have been killed in battle (a plague in camp takes them too)', () => {
    const r = { fell: 1, born: 0, grew: 0, aged: 0, starved: 0, sick: 0, raidDead: 0, taken: 0, back: 0, lostForGood: 0, raids: [], drifted: { tavern: 0, mines: 0, home: 0 }, rose: [], lost: [], won: [], made: [], gone: [], open: [], openNear: [] } as unknown as SeasonReport;
    const lines = reportLines(r).map((l) => l.text);
    expect(lines).toContain('1 man died with the army.');
    expect(lines.join(' ')).not.toMatch(/killed in battle/);
  });
});
