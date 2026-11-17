// What a town will really work by, in words (docs/PLAYTEST.md, "Shares in two voices").
//
// The panel said a town's work as its orders have it (governor.ts ordersText: "50% food, 25% wood, …"), while the town
// in fact works by `shareOf`: the same shares unless the governor has changed them for the season. With food short he
// sends four in five to the fields whatever the orders were; with a full granary and nobody's orders he takes hands
// from the fields to work that keeps. A player read one thing on the map and saw another in the town.
// So the panel's line is the shares the town works by this season, and where those are not the orders', a word of why.
// Words only: nothing here changes what a town does.
import type { Campaign } from './campaign';
import { BUILDINGS } from './data';
import { shareOf, workOf } from './governor';
import type { Stores } from './township';

const KINDS = ['food', 'wood', 'gold', 'stone'] as const;
const pct = (w: Stores): string => KINDS.filter((k) => w[k] > 0.01).sort((a, b) => w[b] - w[a]).map((k) => `${Math.round(w[k] * 100)}% ${k}`).join(', ');

/** Why the town does not work by its orders' shares this season, or nothing if it does. */
export function workReason(c: Campaign, tid: number): '' | 'short' | 'full' {
  const t = c.territories[tid], by = workOf(t), now = shareOf(c, tid);
  if (now.fields) return 'short';
  return KINDS.some((k) => Math.abs(now.share[k] - by[k]) > 0.005) ? 'full' : '';
}

/** What a town's people work by this season, what it is building and training, in words: the panel's line. */
export function workText(c: Campaign, tid: number): string {
  const t = c.territories[tid], o = t.orders, now = shareOf(c, tid).share, why = workReason(c, tid);
  const head = o?.work ? 'By your last orders its people work' : 'A governor keeps it; its people work';
  const said = why === 'short' ? ` Food is short, so the governor has sent hands to the fields${o?.work ? `; your orders were ${pct(workOf(t))}` : ''}.`
    : why === 'full' ? ' The granary is full, so he has taken hands from the fields for work that keeps.' : '';
  return `${head}: ${pct(now)}.${said}${o?.build?.length ? ` Building: ${o.build.map((b: string) => BUILDINGS[b]?.name ?? b).join(', ')}.` : ''}${o?.train?.length ? ` Was training: ${o.train.join(', ')}.` : ''}`;
}
