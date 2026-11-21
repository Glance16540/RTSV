// The round of all fifteen: the reference measure of how the peoples stand against one another in battle.
//
// Every people's computer plays every other's, and a people's figure is its share of the games it took part in
// that were DECIDED (most games are not, at thirty minutes): won / (won + lost). It is the measure the board's
// figures for the peoples were read by, and the one to replay before and after a change to a people's gifts.
//
//   ROUND=1 OUT=round.txt npx vitest run scripts/round.test.ts
//
// As it is run by default (the reference):
//   - the 15 peoples of data.ts CIV_IDS, in that order: 105 pairs;
//   - 16 games a pair, numbered k = 0 to 15: 1,680 games;
//   - a map of its own for every game: seed 3000 + 131 i + 17 j + 7 k, where i < j are the two peoples' places in
//     CIV_IDS. No two games of a round are fought on the same ground;
//   - sides swapped on every odd k, so each people sits first in half its games against each other;
//   - both sides the computer at level 1 (AIController.setLevel(1));
//   - 30 minutes of the battle's own clock (MIN), the computer thinking once a second (20 steps);
//   - a game with no winner at the end is undecided, and counts for neither side.
// One process takes about five hours. It is resumable (a game already in OUT is not played again) and splits by k:
// four processes with SEED0=0 SEED1=4, 4 to 8, 8 to 12, 12 to 16, all appending to the same OUT, take about 85
// minutes on four cores. When every game asked for is in OUT, the table is written beside it (OUT + '.md').
//
// What can be asked instead:
//   ONLY=hearth          only the games that people is in (14 pairs). With SEED1=32 that is 448 games: a people's own trial.
//   CIVS=wild,steppe,..  only these peoples, in this order (i and j are then places in this list).
//   SEED0, SEED1         the run of k: from SEED0 up to but not SEED1 (default 0 and 16).
//   MIN, LEVEL           minutes a game, and the computer's level (default 30 and 1).
//   MAPS=few             the other way of choosing ground: seed k + 1 for every pair, so with SEED1=8 the whole round
//                        is fought on eight maps, each pair on each map twice, once each way round. (scripts/trials.test.ts
//                        run over every pair with seeds 1 to 8 is this.)
//   A trial of a change, without editing the rules (each read after the people's own gifts are given):
//   G_<civ>_<mod>=x      multiply that people's mod by x (atk, armor, carry and towerRange are added to instead)
//   U_<unit>_<field>=x   set a unit's number; U_<unit>_cost_<res>=x one part of its price
//   R_<rule>=x, P_<name>=x, F_<name>=x   a style's rule (data.ts STYLE_RULES), how the computer plays it and how it fights (styleplay.ts)
//
// Games are deterministic: the same tree and the same asking give the same file, line for line (tests/determinism.test.ts).
// A people's share rests on about sixty decided games in a round and moves by seven to ten points when rules that
// have nothing to do with it change, so a round ranks the peoples coarsely; a people's own trial of 448 is the finer read.
// Skipped unless ROUND is set. It measures; it judges nothing.
import { it } from 'vitest';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { CIVS, CIV_IDS, CIV_STYLE, STYLE_RULES, UNITS } from '../src/sim/data';
import { STYLE_FIGHT, STYLE_PLAY } from '../src/sim/styleplay';

/** The table of a round's file: each people's games won, lost and undecided, and its share of those decided. */
function table(file: string, asked: string): string {
  const won: Record<string, number> = {}, lost: Record<string, number> = {}, none: Record<string, number> = {};
  let games = 0, decided = 0;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const [a, b, w] = line.split(' ');
    if (!b) continue;
    games++;
    if (w === '-') { none[a] = (none[a] ?? 0) + 1; none[b] = (none[b] ?? 0) + 1; continue; }
    decided++;
    won[w] = (won[w] ?? 0) + 1;
    const l = w === a ? b : a;
    lost[l] = (lost[l] ?? 0) + 1;
  }
  const share = (c: string): number => ((won[c] ?? 0) + (lost[c] ?? 0) ? (100 * (won[c] ?? 0)) / ((won[c] ?? 0) + (lost[c] ?? 0)) : 0);
  const civs = [...new Set([...Object.keys(won), ...Object.keys(lost), ...Object.keys(none)])].sort((x, y) => share(y) - share(x) || x.localeCompare(y));
  const rows = civs.map((c) => `| ${CIVS[c]?.name ?? c} | ${CIV_STYLE[c] ?? ''} | ${won[c] ?? 0} | ${lost[c] ?? 0} | ${none[c] ?? 0} | ${share(c).toFixed(0)}% |`);
  return [`# A round of the peoples`, '', `${asked}. ${games} games, ${decided} decided.`, '', '| People | Style | Won | Lost | Undecided | Share of decided |', '| --- | --- | --- | --- | --- | --- |', ...rows, ''].join('\n');
}

it.skipIf(!process.env.ROUND)('the round of all fifteen', () => {
  const E = process.env, OUT = E.OUT ?? 'round.txt';
  for (const [k, v] of Object.entries(E)) {
    if (k.startsWith('R_')) (STYLE_RULES as Record<string, unknown>)[k.slice(2)] = +v!;
    if (k.startsWith('P_')) (STYLE_PLAY as Record<string, unknown>)[k.slice(2)] = +v!;
    if (k.startsWith('F_')) (STYLE_FIGHT as Record<string, unknown>)[k.slice(2)] = v === 'false' ? false : v === 'true' ? true : +v!;
    if (k.startsWith('G_')) { const [, civ, mod] = k.split('_'); const was = CIVS[civ].apply; CIVS[civ].apply = (m) => { was(m); const bag = m as unknown as Record<string, number>; if (['atk', 'armor', 'carry', 'towerRange'].includes(mod)) bag[mod] += +v!; else bag[mod] *= +v!; }; }
    if (k.startsWith('U_')) { const [, unit, field, res] = k.split('_'); if (field === 'cost') (UNITS[unit].cost as Record<string, number>)[res] = +v!; else (UNITS[unit] as unknown as Record<string, number>)[field] = +v!; }
  }
  const civs = E.CIVS ? E.CIVS.split(',') : CIV_IDS, S0 = +(E.SEED0 ?? 0), S1 = +(E.SEED1 ?? 16), MIN = +(E.MIN ?? 30), LEVEL = +(E.LEVEL ?? 1), ONLY = E.ONLY, few = E.MAPS === 'few';
  const played = (tag: string): boolean => existsSync(OUT) && readFileSync(OUT, 'utf8').includes(tag + '\n'); // played before a restart, or by another process
  const play = (a: string, b: string, seed: number, tag: string): void => {
    if (played(tag)) return;
    const g = new Game(seed, [{ name: a, color: 1, isAI: true, civ: a }, { name: b, color: 2, isAI: true, civ: b }]);
    const ais = [0, 1].map((p) => { const c = new AIController(g, p); c.setLevel(LEVEL); return c; });
    let s = 0;
    for (; s < MIN * 60 && g.winner < 0; s++) { for (let q = 0; q < 20; q++) { g.step(); g.events.length = 0; } ais.forEach((c) => c.update()); }
    appendFileSync(OUT, `${a} ${b} ${g.winner === 0 ? a : g.winner === 1 ? b : '-'} ${s}${tag}\n`);
  };
  for (let i = 0; i < civs.length; i++) for (let j = i + 1; j < civs.length; j++) {
    if (ONLY && civs[i] !== ONLY && civs[j] !== ONLY) continue;
    for (let k = S0; k < S1; k++) {
      if (few) { play(civs[i], civs[j], k + 1, ` #${i}.${j}.${k}a`); play(civs[j], civs[i], k + 1, ` #${i}.${j}.${k}b`); continue; } // each pair on each of a few maps, once each way round
      const flip = k % 2 === 1;
      play(flip ? civs[j] : civs[i], flip ? civs[i] : civs[j], 3000 + i * 131 + j * 17 + k * 7, ` #${i}.${j}.${k}`);
    }
  }
  // The table tells of the whole file, which several processes may have filled between them: the run of k is read from it, not from this process's share.
  const ks = existsSync(OUT) ? [...readFileSync(OUT, 'utf8').matchAll(/ #\d+\.\d+\.(\d+)/g)].map((m) => +m[1]) : [];
  const asked = `${ONLY ? `${CIVS[ONLY]?.name ?? ONLY} against the others` : `${civs.length} peoples`}, k ${ks.length ? Math.min(...ks) : S0} to ${ks.length ? Math.max(...ks) : S1 - 1}, ${few ? 'seed k + 1 for every pair, both ways round' : 'a map of its own for every game'}, level ${LEVEL}, ${MIN} minutes`;
  if (existsSync(OUT)) writeFileSync(OUT + '.md', table(OUT, asked));
}, 6 * 3600_000);
