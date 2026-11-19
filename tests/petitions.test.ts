// Nobles ask things of the leader (src/sim/petitions.ts): a petition now and then, granted or refused, moving the
// noble's mood and leaving a bond; rivals' rulers answer theirs by the same rule.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { houseOf } from '../src/sim/dynasty';
import { noblesOf, noblesSeasons } from '../src/sim/nobles';
import type { Noble } from '../src/sim/nobles';
import { PETITION, Petition, PetitionKind, grant, grantBar, petitionSeason, petitionText, refuse, sensiblePetition } from '../src/sim/petitions';
import { sensibleAnswers } from '../src/sim/storypolicy';
import { folkOf } from '../src/sim/township';

function world(): { c: Campaign; n: Noble } {
  const c = newCampaign(7, 2, 1, 'hearth');
  c.turn = 20;
  noblesSeasons(c);
  const n = noblesOf(c, 0).find((x) => x.rank !== 'close')!;
  c.factions[0].supplies = 50;
  for (const t of c.territories) if (t.owner === 0) Object.assign(folkOf(c, t.id).stores, { food: 900, wood: 900, gold: 900, stone: 900 });
  return { c, n };
}
const ask = (c: Campaign, n: Noble, kind: PetitionKind, more: Partial<Petition> = {}): Petition => (c.factions[0].petition = { id: 1, key: n.key, name: n.name, town: n.town, kind, since: c.turn, ...more });

describe('petitions', () => {
  it('nobles come with petitions now and then, one at a time, about once in the chance given', () => {
    const { c } = world();
    let came = 0;
    for (let t = 0; t < 200; t++) {
      c.turn++;
      const had = c.factions[0].petition?.id;
      const p = petitionSeason(c, 0);
      if (p && p.id !== had) { came++; expect(petitionText(c, 0, p).length).toBeGreaterThan(5); }
      if (c.factions[0].petition && t % 3 === 0) refuse(c, 0);
    }
    expect(came).toBeGreaterThan(10);
    expect(came).toBeLessThan(60);
  });

  it('an estate granted costs supplies, lifts the noble and leaves a bond; refused, it sours them and leaves another', () => {
    const { c, n } = world();
    ask(c, n, 'estate');
    const mood = n.mood;
    expect(grantBar(c, 0)).toBe('');
    expect(grant(c, 0)).toBe('');
    expect(n.mood).toBe(Math.min(100, mood + PETITION.grant.estate.mood));
    expect(n.bonds!.at(-1)).toMatchObject({ kind: 'estate', rest: PETITION.grant.estate.rest });
    expect(c.factions[0].petition).toBeUndefined();
    ask(c, n, 'estate');
    const before = n.mood;
    expect(refuse(c, 0)).toBe(true);
    expect(n.mood).toBe(Math.max(-100, before + PETITION.refuse.mood));
    expect(n.bonds!.at(-1)).toMatchObject({ kind: 'refused', rest: PETITION.refuse.rest });
  });

  it('a petition left unanswered lapses, and sours them half as much', () => {
    const { c, n } = world();
    ask(c, n, 'estate');
    const mood = n.mood;
    c.turn += PETITION.wait;
    petitionSeason(c, 0);
    expect(c.factions[0].petition).toBeUndefined();
    expect(n.mood).toBe(Math.max(-100, mood + Math.round(PETITION.refuse.mood * 0.5)));
  });

  it('help sends goods to the town; a pardon sits ill with the pious of the town', () => {
    const { c, n } = world();
    ask(c, n, 'help');
    const food = folkOf(c, n.town).stores.food;
    expect(grant(c, 0)).toBe('');
    expect(folkOf(c, n.town).stores.food).toBeGreaterThan(food);
    const other = noblesOf(c, 0).find((x) => x !== n && x.town === n.town);
    if (other) {
      other.leaning = 'pious';
      const was = other.mood;
      ask(c, n, 'pardon', { who: 'Wat', why: 'a debt unpaid' });
      expect(grant(c, 0)).toBe('');
      expect(other.mood).toBe(Math.max(-100, was + PETITION.grant.pardon.pious));
    }
  });

  it('a match is between grown people only: it needs an unwed child of the house who is of age', () => {
    const { c, n } = world();
    const house = houseOf(c, 0);
    house.heirs = [{ name: 'Edda', female: true, born: c.turn - 2 }]; // a child
    for (let t = 0; t < 120; t++) { c.turn++; house.heirs[0].born = c.turn - 2; delete c.factions[0].petition; const p = petitionSeason(c, 0); expect(p?.kind).not.toBe('match'); } // she stays a child throughout
    house.heirs = [{ name: 'Edda', female: true, born: c.turn - 200 }]; // grown
    ask(c, n, 'match', { who: 'Odo', female: false, heir: 'Edda' });
    expect(grantBar(c, 0)).toBe('');
    expect(grant(c, 0)).toBe('');
    expect(house.heirs[0].wedTo?.name).toContain('Odo');
    ask(c, n, 'match', { who: 'Odo', female: false, heir: 'Edda' });
    expect(grantBar(c, 0)).toContain('not free'); // already wed
  });

  it('a computer-led ruler answers its noble the season the petition comes; a careful ruler helps a town in want', () => {
    const { c, n } = world();
    const rival = c.factions.find((f) => f.id > 0 && f.alive)!;
    for (let t = 0; t < 120; t++) { c.turn++; petitionSeason(c, rival.id); expect(rival.petition).toBeUndefined(); }
    ask(c, n, 'help');
    expect(sensiblePetition(c, 0)).toBe('grant');
    ask(c, n, 'match', { who: 'Odo', female: false, heir: 'Nobody' });
    n.mood = 60;
    expect(sensiblePetition(c, 0)).toBe('refuse');
    ask(c, n, 'estate');
    expect(sensibleAnswers(c, 0)).toContain('petition:grant');
  });
});
