// How long until something, said as a person would say it (docs/PLAYTEST.md, finding 11): "in 14 years", not "in 55".
// Plain data, no DOM.
import { SEASONS_A_YEAR } from './ageing';

/** Seasons from now, in words: "next season", "in 3 seasons", "in a year", "in 14 years". */
export function inTime(seasons: number): string {
  const n = Math.max(0, Math.round(seasons));
  if (n <= 0) return 'now';
  if (n === 1) return 'next season';
  if (n < SEASONS_A_YEAR) return `in ${n} seasons`;
  const years = Math.round(n / SEASONS_A_YEAR);
  return years === 1 ? 'in a year' : `in ${years} years`;
}
