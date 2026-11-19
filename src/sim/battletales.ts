// A battle fought out on the map, told in full for whoever opens it (mapbattle.ts keeps the tales; the player read
// only the one line of each in the log).
//
// A tale is read here into what a panel shows: where and when, who came against whom and who led them, how many
// rounds it was fought and who broke, what each side brought and lost by kind of company, whether the town's walls were
// beaten down, who scattered, the fallen by name, and the man the winners named for how he stood. Plain data in the
// game's plain voice; it changes nothing.
import type { Campaign } from './campaign';
import { COMPANIES } from './campaignbase';
import type { BattleTale } from './mapbattle';
import { peopleName } from './naming';

/** The winners named a man for how he stood: written on the battle's tale, if it was told this season. */
export function noteStood(c: Campaign, who: { name: string; town: number } | undefined): void {
  const t = c.tales?.[c.tales.length - 1];
  if (who && t && t.turn === c.turn && !t.stood) t.stood = { name: who.name, town: who.town };
}

/** The tales a people took part in, newest first. */
export const talesOf = (c: Campaign, f = 0): BattleTale[] => [...(c.tales ?? [])].filter((t) => t.attacker === f || t.defender === f).reverse();
/** The tales fought at one land, newest first. */
export const talesAt = (c: Campaign, tid: number): BattleTale[] => [...(c.tales ?? [])].filter((t) => t.at === tid).reverse();

const nth = (n: number): string => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n - 1] ?? `${n}th`;
const total = (u: Record<string, number> | undefined): number => Object.values(u ?? {}).reduce((n, v) => n + Math.max(0, v), 0);
const kinds = (u: Record<string, number> | undefined): string => {
  const parts = Object.keys(COMPANIES).filter((k) => (u?.[k] ?? 0) > 0).map((k) => `${u![k]} ${(u![k] === 1 ? COMPANIES[k].name.replace(/s$/, '') : COMPANIES[k].name).toLowerCase()}`);
  return parts.length ? parts.join(', ') : 'none';
};

/** One side as the panel shows it. */
export interface TaleSide { who: string; led?: string; began: string; lost: string; lostN: number; scattered: boolean; won: boolean }
/** A tale read for its panel. */
export interface TaleRead { title: string; when: string; how: string; sides: [TaleSide, TaleSide]; walls?: string; fell: string[]; stood?: string; mine: 'won' | 'lost' | 'theirs' }

/** Read a tale for its panel, as the player (`f`) sees it. */
export function readTale(c: Campaign, t: BattleTale, f = 0): TaleRead {
  const name = (x: number): string => (x < 0 ? 'the locals' : x === f ? `your ${peopleName(c, x)}` : `the ${peopleName(c, x)}`);
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  const place = c.territories[t.at]?.name ?? 'a land since lost to the map', A = name(t.attacker), D = name(t.defender);
  const how = t.broke === 'defender' ? `${cap(D)} broke in the ${nth(t.rounds)} round, and ${place} was taken.`
    : t.broke === 'attacker' ? `${cap(A)} broke in the ${nth(t.rounds)} round before ${place}.`
    : `${cap(A)} could not break ${place} in ${t.rounds} ${t.rounds === 1 ? 'round' : 'rounds'}, and drew off.`;
  const side = (who: string, led: string | undefined, began: Record<string, number> | undefined, lost: Record<string, number>, scattered: boolean, won: boolean): TaleSide =>
    ({ who: cap(who), ...(led ? { led } : {}), began: began ? kinds(began) : 'not known', lost: kinds(lost), lostN: total(lost), scattered, won });
  const year = Math.floor(t.turn / 4) + 1, season = ['spring', 'summer', 'autumn', 'winter'][t.turn % 4];
  return {
    title: `The battle of ${place}`,
    when: `In the ${season} of year ${year} (turn ${t.turn}), ${A} came against ${D} at ${place}.`,
    how,
    sides: [side(A, t.ledA, t.beganA, t.lostA, t.scattered === 'attacker', t.attackerWon), side(D, t.ledD, t.beganD, t.lostD, t.scattered === 'defender', !t.attackerWon)],
    ...(t.works !== undefined && t.works > 0 ? { walls: t.works >= 0.5 ? 'Its walls and towers were beaten down.' : 'Its walls were struck, but held.' } : {}),
    fell: t.fell,
    ...(t.stood ? { stood: `${t.stood.name} of ${c.territories[t.stood.town]?.name ?? 'a town of theirs'} was named by the winners for how he stood.` } : {}),
    mine: t.attacker === f ? (t.attackerWon ? 'won' : 'lost') : t.defender === f ? (t.attackerWon ? 'lost' : 'won') : 'theirs',
  };
}
