// A town comes to a battle or a visit as sick and as hungry as the map has it (docs/DESIGN.md, "Towns persist": a town
// loads with the same people it left with; docs/CLOSING.md: "A battle or visit in a land with plague on the map begins
// with nobody sick, and one after a failed harvest with no one hungry").
//
// The map's state reaches the town through its setup (`PlayerSetup.bonus.ailing`, campaign.ts battleConfig and visit.ts),
// as its people, stores and roofs do:
//   - plague in the land (acts.ts, while it lasts): a few of the town's people come to the field sick (`sick`): AILING.share
//     of its grown, one at the least and AILING.most at the most, each sick for CONTAGION.least seconds (contagion.ts) and
//     able to pass it on as any sick villager does. The map has already taken this season's dead by its own count, so
//     what is carried in is the sickness, short and mild, not a second plague;
//   - hunger (the town hungry at the last season's turn, drift.ts, or a failed harvest this season, acts.ts): its people
//     begin hungry (`hungry`): their hunger stands at FAMINE.hungry, the warning given, so that a bare store goes on to
//     famine the sooner. A store that is not bare ends it at once, as ever (famine.ts).
// The town's holder only, and never a field battle (there is no town on it). No child is ever sick or hungry here: only
// grown villagers are chosen, and hunger is the people's.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { CONTAGION } from './contagion';
import { FAMINE } from './famine';
import { folkOf } from './township';

/** What the map sends with a town: how many of its people are sick, and whether it is hungry. */
export interface Ailing { sick?: number; hungry?: boolean }

export const AILING = {
  /** The share of a plagued town's grown who come to the field sick, and the most. */
  share: 0.05, most: 4,
};

/** On the map: what a town brings of the season's ills to a battle or a visit; undefined for nothing. */
export function ailingOf(c: Campaign, tid: number): Ailing | undefined {
  const f = folkOf(c, tid), ev = c.events ?? [];
  const plague = ev.some((e) => e.kind === 'plague' && e.at === tid && e.until >= c.turn);
  const hungry = !!f.drift?.hungry || ev.some((e) => e.kind === 'famine' && e.at === tid && e.turn === c.turn);
  const grown = f.men + f.women + f.elders;
  const sick = plague && grown > 0 ? Math.min(AILING.most, Math.max(1, Math.round(grown * AILING.share))) : 0;
  return sick || hungry ? { ...(sick ? { sick } : {}), ...(hungry ? { hungry: true } : {}) } : undefined;
}

/** In the town, as the sitting begins: so many of this side's grown villagers are sick, and its people hungry. Returns those made sick. */
export function ailingIn(g: Game, owner: number, a: Ailing | undefined): number {
  const p = g.players[owner];
  if (!p || !a || g.field) return 0;
  const n = Math.max(0, Math.min(AILING.most, Math.floor(Number(a.sick) || 0)));
  const grown = g.units.filter((u) => u.owner === owner && !u.dead && !u.inside && u.type === 'villager' && u.growT <= 0).sort((x, y) => x.id - y.id);
  // Spread through the town by a fixed step, not the first few laid, who stand together.
  const step = Math.max(1, Math.floor(grown.length / Math.max(1, n)));
  let k = 0;
  for (let i = 0; i < grown.length && k < n; i += step) { grown[i].plagueT = Math.max(grown[i].plagueT, CONTAGION.least); k++; }
  if (k) { p.plagueAt = g.time; g.events.push({ t: 'msg', player: owner, text: `☠️ Plague is in the land: ${k === 1 ? 'one of your people is' : `${k} of your people are`} sick. Keep the sick away from the rest.` }); }
  if (a.hungry === true) { p.hunger = Math.max(p.hunger ?? 0, FAMINE.hungry); g.events.push({ t: 'msg', player: owner, text: '🍞 The town comes into this season hungry: if the store is bare, famine is not far off.' }); }
  return k;
}
