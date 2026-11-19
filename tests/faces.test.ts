// A face of one's own (src/sim/faces.ts), and its drawing (src/client/facedraw.ts).
import { describe, expect, it } from 'vitest';
import { faceOf, stationOf } from '../src/sim/faces';
import type { Face } from '../src/sim/faces';
import { NATIONS, bodyOf, captivePortrait, notablePortrait, seedOf, unitPortrait } from '../src/sim/portrait';
import { faceSvg } from '../src/client/facedraw';
import { portraitHtml } from '../src/client/portrait';
import { Game } from '../src/sim/game';
import { setups, villagers } from './helpers';

const light = (hex: string): number => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255); };
/** What makes a face theirs, whatever they feel and wherever they are. */
const own = (f: Face) => ({ skin: f.skin, hair: f.hair, hairStyle: f.hairStyle, beard: f.beard, jaw: f.jaw, nose: f.nose, eyes: f.eyes, brows: f.brows });

describe('a face of one\'s own', () => {
  it('is the same every time for the same person, and differs between people of one people', () => {
    const a = faceOf({ seed: 'Odo|Bertin', sex: 'm', nation: 'hearth', feeling: 'content' });
    expect(faceOf({ seed: 'Odo|Bertin', sex: 'm', nation: 'hearth', feeling: 'content' })).toEqual(a);
    for (const n of NATIONS) {
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) for (const sex of ['m', 'f'] as const) seen.add(JSON.stringify(own(faceOf({ seed: `${n}${i}`, sex, nation: n, feeling: 'content', body: bodyOf(sex, `${n}${i}`) })!)));
      expect(seen.size, n).toBeGreaterThan(30); // of 80 people, most look like nobody else
    }
  });

  it('is drawn within the look of their people', () => {
    const mean = (n: string): number => { let s = 0; for (let i = 0; i < 30; i++) s += light(faceOf({ seed: i, sex: 'f', nation: n, feeling: 'content' })!.skin); return s / 30; };
    expect(mean('wild')).toBeGreaterThan(mean('greece'));
    expect(mean('greece')).toBeGreaterThan(mean('egypt'));
    expect(mean('egypt')).toBeGreaterThan(mean('kush'));
    const bearded = (n: string): number => { let k = 0; for (let i = 0; i < 100; i++) if (faceOf({ seed: i, sex: 'm', nation: n, feeling: 'content' })!.beard !== 'none') k++; return k; };
    expect(bearded('wild')).toBeGreaterThan(60);
    expect(bearded('egypt')).toBeLessThan(25);
    for (const n of NATIONS) for (let i = 0; i < 30; i++) expect(faceOf({ seed: i, sex: 'f', nation: n, feeling: 'content' })!.beard).toBe('none');
    // A people the faces do not know still gets a face.
    expect(faceOf({ seed: 3, sex: 'm', nation: '', feeling: 'angry' })).not.toBeNull();
  });

  it('wears what its station gives: a helmet under arms, a fillet or circlet among the leader\'s kin, bare-headed when held', () => {
    expect(stationOf('veteran')).toBe('soldier');
    expect(stationOf('kin')).toBe('kin');
    expect(stationOf('mother')).toBe('common');
    for (let i = 0; i < 20; i++) {
      expect(faceOf({ seed: i, sex: 'm', nation: 'japan', feeling: 'content', station: 'soldier' })!.headgear).toBe('helm_kabuto');
      expect(faceOf({ seed: i, sex: 'm', nation: 'greece', feeling: 'content', station: 'soldier' })!.headgear).toBe('helm_crest');
      expect(faceOf({ seed: i, sex: 'f', nation: 'arabs', feeling: 'angry', station: 'captive' })!.headgear).toBe('none');
    }
    // The leader's kin and court: most wear a fillet or circlet, the rest what their people wear, and never a helmet.
    const kin = Array.from({ length: 40 }, (_, i) => faceOf({ seed: i, sex: i % 2 ? 'f' : 'm', nation: 'persia', feeling: 'content', station: 'kin' })!.headgear);
    expect(kin.filter((h) => h === 'fillet' || h === 'circlet').length).toBeGreaterThan(15);
    expect(kin.some((h) => h.startsWith('helm_'))).toBe(false);
  });

  it('grows old: grey hair and lines; and a mother who has raised children shows it', () => {
    for (let i = 0; i < 20; i++) {
      const young = faceOf({ seed: i, sex: 'm', nation: 'steppe', feeling: 'content' })!, old = faceOf({ seed: i, sex: 'm', nation: 'steppe', feeling: 'content', old: true })!;
      expect(old.lines).toBeGreaterThanOrEqual(2);
      expect(old.hair).not.toBe(young.hair);
      expect(light(old.hair)).toBeGreaterThan(light(young.hair));
      expect(faceOf({ seed: i, sex: 'f', nation: 'mali', feeling: 'content', mother: true })!.lines).toBeGreaterThanOrEqual(1);
    }
  });

  it('is never given to a child', () => {
    expect(faceOf({ seed: 1, sex: 'f', nation: 'hearth', feeling: 'content', child: true })).toBeNull();
    const g = new Game(3, setups);
    const kid = g.spawnUnit('villager', 0, 20, 20, 'f');
    kid.growT = 100;
    expect(unitPortrait(g, kid)).toBeNull();
  });

  it('is theirs wherever they are shown: in the battle, held captive, and remembered on the roll', () => {
    const g = new Game(3, setups);
    const v = villagers(g, 0).find((u) => u.name)!;
    const here = unitPortrait(g, v)!.face!;
    expect(here).toBeTruthy();
    const held = captivePortrait(g, { name: v.name, family: v.family, gender: v.gender!, people: g.players[0].civ, from: 0, age: 0, lifespan: 0 } as never, 'rival').face!;
    const known = notablePortrait(g.players[0].civ, { name: v.name, family: v.family, gender: v.gender!, kind: 'mother' }, {}).face!;
    expect(own(held)).toEqual(own(here));
    expect(own(known)).toEqual(own(here));
    expect(seedOf(v)).toBe(`${v.name}|${v.family}`); // by name and family, which a save keeps: not by an id made anew each battle
    // A soldier has a face too, under a helmet.
    const s = g.spawnUnit('spearman', 0, 20, 20);
    expect(unitPortrait(g, s)!.face?.headgear).toMatch(/^helm_/);
  });

  it('is drawn as a picture of its own, with the feeling in it', () => {
    const f = faceOf({ seed: 'x', sex: 'm', nation: 'greece', feeling: 'afraid' })!;
    const svg = faceSvg(f);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(f.skin);
    expect(svg).not.toBe(faceSvg({ ...f, feeling: 'content' }));
    const html = portraitHtml({ keys: [], marks: [], nation: 'greece', words: 'afraid', face: f }, 'none');
    expect(html).toContain('<svg');
    expect(portraitHtml({ keys: [], marks: [], nation: 'greece', words: '' }, 'none')).toBe('none');
  });
});
