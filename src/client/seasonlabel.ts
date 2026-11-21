// The turn as the map shows it: with its season and year (src/sim/seasonsky.ts seasonOfTurn, chroniclethreads.ts yearOf),
// so that a winter is known before the land is looked at ("Turn 31 · ❄️ Winter, year 8").
import { seasonOfTurn } from '../sim/seasonsky';
import { yearOf } from '../sim/chroniclethreads';

const ICON = { spring: '🌱', summer: '☀️', autumn: '🍂', winter: '❄️' } as const;

/** "Winter, year 8", with its sign or without. */
export const seasonWords = (turn: number, sign = true): string => {
  const s = seasonOfTurn(turn);
  return `${sign ? `${ICON[s]} ` : ''}${s[0].toUpperCase()}${s.slice(1)}, year ${yearOf(turn)}`;
};
/** "Turn 31 · ❄️ Winter, year 8". */
export const turnLabel = (turn: number, sign = true): string => `Turn ${turn} · ${seasonWords(turn, sign)}`;
