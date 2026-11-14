// Who is held and how long they can still be got back, in words on a panel. The rules are in
// src/sim/captivity.ts. By the owner's design nothing here is a picture: names, places, times and counts only.
import type { Building, Game } from '../sim/game';
import { CAPTIVE_WARN, CHILD_WORK, campChildren, takenFrom, timeLeft } from '../sim/captivity';

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const full = (c: { name: string; family: string }): string => c.name + (c.family ? ' ' + c.family : '');
const kids = (n: number): string => (n ? `, ${n} ${n === 1 ? 'child' : 'children'} born there` : '');

/** For a camp's panel: each captive this viewer has a stake in (the keeper sees all; another people sees its own) with the time left. */
export function heldPanel(game: Game, b: Building, pid: number): string {
  const keeper = !game.hostile(b.owner, pid) && b.type !== 'lair';
  const held = (b.captives ?? []).filter((c) => keeper || !game.hostile(c.from, pid));
  const timed = held.filter((c) => timeLeft(game, c) !== null);
  if (!timed.length) return '';
  const fate = b.type === 'lair' ? 'dead' : 'sold on';
  const rows = timed.sort((x, y) => timeLeft(game, x)! - timeLeft(game, y)!).map((c) => {
    const left = timeLeft(game, c)!;
    return `<div${left <= CAPTIVE_WARN ? ' class="bad"' : ''}>· ${full(c)} <b>${clock(left)}</b>${kids(c.young?.length ?? 0)}</div>`;
  }).join('');
  const n = campChildren(b);
  const head = keeper
    ? `⏳ Time before each is ${fate}${n ? ` · ${n} ${n === 1 ? 'child' : 'children'} born here add${n === 1 ? 's' : ''} the labour of ${n * CHILD_WORK} ${n * CHILD_WORK === 1 ? 'man' : 'men'}` : ''}`
    : `⏳ Yours held here can still be got back for this long; after it they are ${fate}`;
  return `<div class="record"><b>${head}</b>${rows}</div>`;
}

/** For a town's own Town Center: everyone taken from it who is still held or on the road, soonest lost first. */
export function takenPanel(game: Game, pid: number): string {
  const list = takenFrom(game, pid);
  if (!list.length) return '';
  // A panel has room for a handful of lines: the soonest lost are named, the rest counted.
  const shown = list.slice(0, 4), more = list.length - shown.length;
  return `<div class="record"><b>📜 Taken from this town · time left to get them back</b>${shown.map(({ c, where, left }) =>
    `<div${left !== null && left <= CAPTIVE_WARN ? ' class="bad"' : ''}>· ${full(c)}${left === null ? '' : ` <b>${clock(left)}</b>`} <small>${where}${kids(c.young?.length ?? 0)}</small></div>`).join('')}${more > 0 ? `<div><small>and ${more} more</small></div>` : ''}</div>`;
}
