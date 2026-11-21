// Rivals have tales of their own (docs/CLOSING.md, "The same rules, the same losses": the tales told every few turns
// were the player's only, and a rival was moved by a fixed step). When a tale is due (storyturn.ts), each rival led
// by the computer is brought one: a tale that could come to anybody (no thread, no named place), about one of its own
// lands, the people beside it, and a tribe on its border, as the player's are. It answers as the test player does
// (storypolicy.ts): the upright answer (the first) as often as its people lean upright, when it can pay for it; the
// other way otherwise. Unlike the test player it holds back no store first (storypolicy.ts STORE_LOW): read at 384 campaigns in each
// course, with an upright answer that cost given only with that many supplies held, a nation that builds churches and
// keeps its towns fed stood 8.6 and 7.4 toward the holy end where 15 to 40 is wanted (18.8 and 24.6 with the fixed
// step this replaces), the tales' steps being some ten a side to the old six; held back by nothing, 18.3 and 26.1.
//
// What the answer does goes only through rules that already are: what it costs paid at that land (prices.ts); its
// moral standing (townfaith.ts); the goodwill it owes the player, where the tale's other people is the player's
// (Faction.favor); a tribe's men standing down (tribes.ts). The chronicle tells it in a line. What an answer would
// bring in (supplies, a company, a tribe's land joining) a rival does not have: read on fresh seeds (384 campaigns
// each course, 769-1152 and 1153-1536), with it the player won 200 and 204 where 226 and 218 were won with the fixed
// step, rivals 114 and 112 against 99 and 103, and 7.3% and 8.3% stood undecided after 200 seasons against 3.4% and
// 3.9%; with half of it, 202 and 215; with none, 217 and 230, rivals 107 and 95, 6.5% and 5.2% undecided, the
// churches row 22.5 and 30.6 and claimants 2.9 and 2.1 every 100, every row in its band.
import type { Campaign } from './campaign';
import { MAX_FAVOR, luck, tell } from './campaignbase';
import { LEANING } from './creed';
import { canPayFor, payFor } from './prices';
import { TALES } from './story';
import type { Tale, TaleChoice } from './story';
import { leaningWith } from './temper';
import { shiftVirtue } from './townfaith';
import { tribeArms } from './tribes';

/** The tales a rival may be brought: any that could come to anybody, with what it needs there to be had. */
const open = (c: Campaign, f: number, others: number[], tribes: number[]): Tale[] =>
  TALES.filter((x) => !x.after && !x.opens && !x.place && (x.needs !== 'rival' || others.length) && (x.needs !== 'tribe' || tribes.length));

/** A rival's answer: the upright one as often as its people lean upright, when it can spare it; else the other, if it can be paid. */
export function rivalAnswer(c: Campaign, f: number, tale: Tale, land: number): 'a' | 'b' | null {
  const fac = c.factions[f];
  const can = (k: 'a' | 'b'): boolean => tale[k].supplies >= 0 || canPayFor(c, f, 'dealing', -tale[k].supplies, { at: land });
  const upright = luck(c, 80 + f) < leaningWith(fac.civ, LEANING[fac.civ] ?? 0.5); // the draw the fixed step was made by
  const k = upright && can('a') ? 'a' : 'b'; // no store held back first: with it, poor rivals took the low road nearly every time (see above)
  return can(k) ? k : can(k === 'a' ? 'b' : 'a') ? (k === 'a' ? 'b' : 'a') : null;
}

/** Carry out a rival's answer, by the rules that already are. */
function carry(c: Campaign, f: number, ch: TaleChoice, at: { land: number; rival: number; tribe: number }): void {
  const fac = c.factions[f];
  if (ch.supplies < 0) payFor(c, f, 'dealing', -ch.supplies, { at: at.land }); // what an answer costs is paid; what it would bring in is not had (see above)
  if (ch.favor && at.rival === 0) fac.favor = Math.max(-MAX_FAVOR, Math.min(MAX_FAVOR, (fac.favor ?? 0) + ch.favor)); // its goodwill toward the player
  if (ch.militia && c.territories[at.tribe]?.owner < 0) tribeArms(c, at.tribe, ch.militia);
  shiftVirtue(c, f, ch.virtue);
}

/** A tale is due: each rival the computer leads is brought one, and answers it. Returns what each answered. */
export function rivalTales(c: Campaign): { f: number; id: string; choice: 'a' | 'b' }[] {
  const out: { f: number; id: string; choice: 'a' | 'b' }[] = [];
  for (const fac of c.factions) {
    if (!fac.alive || !fac.isAI || fac.id === 0) continue;
    const f = fac.id, lands = c.territories.filter((t) => t.owner === f && !t.horde);
    if (!lands.length) continue;
    const others = c.factions.filter((x) => x.alive && x.id !== f).map((x) => x.id);
    const tribes = [...new Set(lands.flatMap((t) => t.adj))].filter((n) => c.territories[n].owner < 0 && !c.territories[n].horde);
    const tales = open(c, f, others, tribes);
    if (!tales.length) continue;
    const tale = tales[Math.floor(luck(c, 300 + f * 7) * tales.length)];
    const at = {
      land: lands[Math.floor(luck(c, 301 + f * 7) * lands.length)].id,
      rival: others.length ? others[Math.floor(luck(c, 302 + f * 7) * others.length)] : -1,
      tribe: tribes.length ? tribes[Math.floor(luck(c, 303 + f * 7) * tribes.length)] : -1,
    };
    const k = rivalAnswer(c, f, tale, at.land);
    if (!k) continue;
    carry(c, f, tale[k], at);
    tell(c, `Among the ${fac.name}, ${tale.title.charAt(0).toLowerCase()}${tale.title.slice(1)}${tale.needs === 'rival' && at.rival >= 0 ? `, with ${at.rival === 0 ? 'your people' : `the ${c.factions[at.rival].name}`}` : ''}: ${k === 'a' ? 'they took the upright way' : 'they took the other way'}.`);
    out.push({ f, id: tale.id, choice: k });
  }
  return out;
}
