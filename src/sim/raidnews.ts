// The season's news of the threats of men: one entry point, plain data, for whatever shows it to the player.
//
// `seasonNews(c)` gathers everything the bands did in a season that concerns one people: every strike on a town of
// theirs, with its whole report, and everything else a band did that touches them (it came, moved, fled, settled,
// was broken or beaten off, freed or lost its captives). Each item says where it happened, so that whoever shows
// it can open that land. Nothing here draws anything.
import type { Campaign } from './campaign';
import { BANDS, Raid, note, reportLine, reportText, softest } from './threats';
import { keepsHeralds, warn } from './heralds';

export interface NewsItem {
  turn: number;
  /** A strike on a town ('raid'), or what else a band did. */
  kind: 'raid' | 'came' | 'moved' | 'fled' | 'settled' | 'gone' | 'broken' | 'beaten' | 'freed' | 'lost' | 'warned' | 'overran' | 'ambush';
  /** The land it happened in: open this one. */
  at: number; land: string;
  band: number;
  /** Whether it is good or bad news for the people asking. */
  tone: 'good' | 'bad' | 'plain';
  /** One line. */
  headline: string;
  /** The whole of it, line by line: for a strike, the report. */
  lines: string[];
  /** A strike's report as data, for anyone who wants more than the words. */
  raid?: Raid;
}

const TONE: Record<string, NewsItem['tone']> = { came: 'bad', moved: 'plain', fled: 'good', settled: 'bad', gone: 'good', broken: 'good', beaten: 'bad', freed: 'good', lost: 'bad', warned: 'bad', overran: 'bad', ambush: 'bad' };

/** The season's news for a people (the player by default): strikes on their towns first, then the rest, in the order it happened. */
export function seasonNews(c: Campaign, turn = c.turn, f = 0): NewsItem[] {
  const raids = (c.raids ?? []).filter((r) => r.turn === turn && r.owner === f).map((r): NewsItem => ({
    turn, kind: 'raid', at: r.at, land: c.territories[r.at].name, band: r.band, tone: r.outcome === 'held' ? 'good' : 'bad',
    headline: reportLine(c, r), lines: reportText(c, r), raid: r,
  }));
  const notes = (c.bandNews ?? []).filter((n) => n.turn === turn && n.owners.includes(f)).map((n): NewsItem => ({
    turn, kind: n.kind, at: n.at, land: c.territories[n.at].name, band: n.band, tone: TONE[n.kind] ?? 'plain', headline: n.text, lines: [n.text],
  }));
  return [...raids, ...notes];
}

/** The counts of a campaign so far, for a summary: strikes by outcome, people taken, got back and lost. */
export function tally(c: Campaign): { raids: number; held: number; raided: number; taken: number; carried: number; killed: number; bands: number } {
  const r = c.raids ?? [];
  return {
    raids: r.length, held: r.filter((x) => x.outcome === 'held').length, raided: r.filter((x) => x.outcome === 'raided').length, taken: r.filter((x) => x.outcome === 'taken').length,
    carried: r.reduce((n, x) => n + x.taken.men + x.taken.women, 0), killed: r.reduce((n, x) => n + x.killed, 0), bands: (c.bands ?? []).length,
  };
}
export const bandIcon = (kind: keyof typeof BANDS): string => BANDS[kind].icon;

/**
 * The heralds' season (heralds.ts), as the bands' season ends: every band that has for its mark a town of a people
 * who keep heralds is told of to that people, a season before it can strike, and the town is warned. Returns the
 * towns warned. (The marauders hold land and overrun their neighbours by another rule: no herald tells of that.)
 */
export function heraldSeason(c: Campaign, out: string[] = []): number[] {
  const told: number[] = [];
  for (const b of c.bands ?? []) {
    if (b.kind === 'marauders') continue;
    const mark = softest(c, b);
    const t = mark ? c.territories[mark.id] : undefined;
    if (!t || !keepsHeralds(c, t.owner) || told.includes(t.id)) continue;
    warn(c, t.id);
    told.push(t.id);
    note(c, out, 'warned', b, t.id, `Heralds bring word: ${b.name}, ${BANDS[b.kind].name.toLowerCase()} of strength ${b.strength}, have ${t.name} for their mark. It stands to.`, [t.owner]);
  }
  return told;
}
