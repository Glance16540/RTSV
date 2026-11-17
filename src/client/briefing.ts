// The start sheet and the end card of a campaign battle and of a visit (docs/PLAYTEST.md, 2 and 3): the words and
// the count are src/sim/battlecard.ts's; this puts them on the page in place of the skirmish's.
import { UNITS } from '../sim/data';
import type { Game } from '../sim/game';
import { BattleKind, SideTally, Tally, briefingOf, verdictOf } from '../sim/battlecard';
import { besieging } from '../sim/besieger';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const foesOf = (game: Game, pid: number): number[] => game.players.filter((p) => !p.neutral && p.id !== pid && game.hostile(p.id, pid)).map((p) => p.id);
const friendsOf = (game: Game, pid: number): number[] => game.players.filter((p) => !p.neutral && !game.hostile(p.id, pid)).map((p) => p.id);

/** Put this battle's own briefing on the start sheet: its first line, and its own sections where the skirmish's rules stood. */
export function showBriefing(start: HTMLElement, game: Game, pid: number, kind: BattleKind, minutes?: number): void {
  const count = (owners: number[], villagers: boolean): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const u of game.units) if (owners.includes(u.owner) && !u.dead && (villagers || u.type !== 'villager')) out[u.type] = (out[u.type] ?? 0) + 1;
    return out;
  };
  const foes = foesOf(game, pid);
  const leader = game.units.find((u) => u.owner === pid && u.hero)?.name;
  const b = briefingOf({ kind, mine: count([pid], kind === 'visit'), foes: count(foes, false), foe: foes.map((f) => game.players[f].name).join(' and ') || undefined, leader, minutes });
  start.querySelector('.lead')!.textContent = b.lead;
  const col = start.querySelector('.cols > div');
  if (col) col.innerHTML = b.sections.map((s) => `<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>`).join('');
}

const row = (label: string, color: string, s: SideTally): string => {
  const kinds = Object.entries(s.kinds).sort((a, b) => b[1][0] - a[1][0] || a[0].localeCompare(b[0])).map(([type, [began, fell]]) => `${esc(UNITS[type]?.name ?? type)} ${began - fell}/${began}`).join(', ');
  return `<tr><td style="color:${color}">■ ${esc(label)}</td><td>${s.began}</td><td>${s.fell}</td><td>${s.left}</td><td class="bt-kinds">${kinds || 'nobody'}</td></tr>`;
};
/** The end card of a campaign battle: words the size of what happened, the count of both sides, and the fallen who had a name. */
export function endCard(game: Game, pid: number, tally: Tally, win: boolean, colorOf: (n: number) => string): { text: string; html: string } {
  tally.watch(game);
  const mine = friendsOf(game, pid), theirs = foesOf(game, pid);
  const a = tally.of(mine), d = tally.of(theirs);
  const foe = theirs.map((f) => game.players[f].name).join(' and ') || 'the enemy';
  const named = tally.named.filter((x) => mine.includes(x.owner)).map((x) => x.name), foeNamed = tally.named.filter((x) => theirs.includes(x.owner)).map((x) => x.name);
  const list = (who: string, names: string[]): string => (names.length ? `<p class="bt-fell"><b>${who}:</b> ${names.slice(0, 8).map(esc).join(', ')}${names.length > 8 ? `, and ${names.length - 8} more` : ''}.</p>` : '');
  const html = `<table class="bt-tally"><tr><th></th><th>Began</th><th>Fell</th><th>Standing</th><th>By kind (standing of those who came)</th></tr>
    ${row('Your side', colorOf(game.players[pid].color), a)}${theirs.length ? row(foe, colorOf(game.players[theirs[0]].color), d) : ''}</table>
    ${list('Fell by name, of yours', named)}${list('Of theirs', foeNamed)}
    <p class="bt-note">${a.fell ? 'The fallen are their towns\' dead: their houses are told on the map.' : 'Nobody of yours fell.'}</p>`;
  return { text: verdictOf(win, game.field, d.fell, a.fell, foe === 'the enemy' ? foe : `the ${foe.replace(/^the /i, '')}`, game.field ? {} : { took: besieging(game, pid) }), html };
}
