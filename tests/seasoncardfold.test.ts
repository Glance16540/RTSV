// The season's card does not tell twice a raid already told face to face (src/client/seasoncard.ts foldTold).
import { expect, it } from 'vitest';
import { foldTold } from '../src/client/seasoncard';

const raid = (tone: 'good' | 'bad', text: string) => ({ kind: 'raid' as const, tone, text });
const born = { kind: 'people' as const, tone: 'good' as const, text: '2 children were born.' };

it('folds the raids that got in into one line where the first stood, keeps those beaten off, and leaves all alone when nothing was told', () => {
  const lines = [born, raid('bad', 'Raiders raided Ironcrag.'), raid('good', 'Slavers came against Mistfen and were beaten back.'), raid('bad', 'Raiders sacked Holt.')];
  expect(foldTold(lines, false)).toEqual(lines);
  const f = foldTold(lines, true);
  expect(f.map((l) => l.text)).toEqual(['2 children were born.', 'The 2 raids on your towns, as you were told when the season turned.', 'Slavers came against Mistfen and were beaten back.']);
  expect(foldTold([born, raid('bad', 'x')], true)[1].text).toMatch(/^The raid on your towns/);
  expect(foldTold([born], true)).toEqual([born]);
});
