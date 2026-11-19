// A claimant of both houses comes to the throne when a line fails (src/sim/bothhouses.ts).
import { describe, expect, it } from 'vitest';
import { SUCCESSION, bloodClaim, lineFails, passedOver, pressClaims } from '../src/sim/bothhouses';
import { HEIR_AGE, autoSucceed, canSucceed, claimants, houseOf, succeed, strangerLeads } from '../src/sim/dynasty';
import { MARRY } from '../src/sim/royalmarriage';
import { wedPeace } from '../src/sim/pacts';
import type { Pact } from '../src/sim/pacts';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';

/** A campaign in which the houses of `a` and `b` were joined by a marriage, with a child of both born `age` seasons ago. */
function wedded(a: number, b: number, age: number): { c: Campaign; p: Pact } {
  const c = newCampaign(5, 2, 1, 'hearth');
  c.turn = 80;
  const p: Pact = { kind: 'marriage', a, b, since: c.turn - age - 4, until: c.turn - 2, wed: ['Ada', 'Bran'], child: { name: 'Hugo', female: false, born: c.turn - age } };
  (c.pacts ??= []).push(p);
  return { c, p };
}
/** People `f`'s leader has fallen, and their house has no heir of age (a young one at most). */
function fallen(c: Campaign, f: number, young = true): void {
  c.factions[f].heroAlive = false;
  houseOf(c, f).heirs = young ? [{ name: 'Little', female: true, born: c.turn - 3 }] : [];
}

describe('a claimant of both houses', () => {
  it('is grown before they have any claim: a child of both houses never rules', () => {
    const { c } = wedded(0, 1, HEIR_AGE - 1);
    fallen(c, 0);
    expect(bloodClaim(c, 0)).toBeUndefined();
    expect(claimants(c, 0).some((x) => x.kind === 'blood')).toBe(false);
    c.turn += 1;
    expect(bloodClaim(c, 0)?.name).toBe('Hugo');
  });

  it('comes after an heir of age, and before any captain', () => {
    const { c } = wedded(0, 1, HEIR_AGE + 4);
    fallen(c, 0);
    c.armies.push({ id: 900, owner: 0, at: c.territories.find((t) => t.owner === 0)!.id, units: { spearman: 3 }, hero: false, vet: 3, moved: false });
    expect(lineFails(c, 0)).toBe(true);
    expect(claimants(c, 0).map((x) => x.kind)).toEqual(['blood', 'captain']);
    houseOf(c, 0).heirs.push({ name: 'Eldest', female: false, born: c.turn - HEIR_AGE - 2 });
    expect(lineFails(c, 0)).toBe(false);
    expect(claimants(c, 0).map((x) => x.kind)).toEqual(['heir', 'captain']); // the line has not failed: theirs is not asked for
  });

  it('taken up on the player\'s throne: rules them, the houses are joined, and the two peoples are at peace', () => {
    const { c, p } = wedded(0, 1, HEIR_AGE + 4);
    fallen(c, 0);
    const claim = claimants(c, 0).find((x) => x.kind === 'blood')!;
    expect(claim.what).toContain('press the claim by war');
    expect(canSucceed(c, 0, claim)).toBe(true);
    expect(succeed(c, 0, claim)).toBe(true);
    expect(c.factions[0].heroAlive).toBe(true);
    expect(c.factions[0].hero?.name).toBe('Hugo');
    expect(p.ruled).toBe(0);
    expect(SUCCESSION.peace).toBe(MARRY.seasons); // the houses joined keep a marriage's peace
    expect(p.until).toBeGreaterThanOrEqual(c.turn + MARRY.seasons);
    expect(wedPeace(c, 0, 1)).toBe(true);
    expect(c.truces.some((t) => t.with === 1 && t.until >= c.turn + MARRY.seasons)).toBe(true);
    expect((c.chronicle ?? []).some((l) => l.text.includes('Hugo') && l.text.includes('takes up the rule'))).toBe(true);
    expect(bloodClaim(c, 0)).toBeUndefined(); // one who rules has no claim left to press
    expect(bloodClaim(c, 1)).toBeUndefined();
  });

  it('is the rival\'s choice before a captain; a child of the player\'s house on a rival\'s throne brings peace with the player', () => {
    const { c } = wedded(0, 1, HEIR_AGE + 4);
    fallen(c, 1);
    c.armies.push({ id: 901, owner: 1, at: c.territories.find((t) => t.owner === 1)!.id, units: { spearman: 3 }, hero: false, vet: 3, moved: false });
    expect(autoSucceed(c, 1)).toBe(true);
    expect(c.factions[1].hero?.name).toBe('Hugo');
    expect(c.truces.some((t) => t.with === 1)).toBe(true);
    expect(wedPeace(c, 0, 1)).toBe(true);
  });

  it('passed over on the player\'s throne: the peace is broken and the other house presses the claim by war, for a while', () => {
    const { c, p } = wedded(0, 2, HEIR_AGE + 4);
    p.until = c.turn + 5; // the marriage's peace still holds
    c.truces.push({ with: 2, until: c.turn + 5 });
    fallen(c, 0);
    const favor = c.factions[2].favor ?? 0;
    strangerLeads(c, 0);
    expect(wedPeace(c, 0, 2)).toBe(false);
    expect(c.truces.some((t) => t.with === 2)).toBe(false);
    expect(c.factions[2].favor).toBe(Math.max(-3, favor - SUCCESSION.favor));
    expect(c.successionWars).toEqual([{ by: 2, against: 0, until: c.turn + SUCCESSION.war, claimant: 'Hugo' }]);
    expect(bloodClaim(c, 0)).toBeUndefined(); // pressed once, not again
    passedOver(c, 0, () => 'someone');
    expect(c.successionWars).toHaveLength(1);
    // Each season of the war, the house marches on the player at worse odds; then it is over.
    c.factions[2].angry = false;
    pressClaims(c);
    expect(c.factions[2].angry).toBe(true);
    c.turn += SUCCESSION.war + 1;
    c.factions[2].angry = false;
    pressClaims(c);
    expect(c.factions[2].angry).toBe(false);
    expect(c.successionWars).toHaveLength(0);
  });

  it('is not passed over where an heir of age was set aside instead, nor where there is no claimant', () => {
    const { c } = wedded(0, 1, HEIR_AGE + 4);
    fallen(c, 0, false);
    houseOf(c, 0).heirs.push({ name: 'Eldest', female: false, born: c.turn - HEIR_AGE - 2 });
    passedOver(c, 0, () => 'someone');
    expect(c.successionWars ?? []).toHaveLength(0);
    const plain = newCampaign(6, 2, 1, 'hearth');
    plain.factions[0].heroAlive = false;
    strangerLeads(plain, 0);
    expect(plain.successionWars ?? []).toHaveLength(0);
  });
});
