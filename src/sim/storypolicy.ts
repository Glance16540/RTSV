// A plain way of answering the stories inside the story (intrigue.ts, courtstory.ts), for a player the computer
// plays: what a careful, ordinary ruler would do, with no knowledge the player would not have. It never reads who
// the thief, the killer or the plotter is. The health report uses it (STORIES=answer) to show an attended course
// beside the unattended one; a rival's house could use it when rivals have stories of their own.
//
//   A thief: set a watch; when the thief is taken, set them to work it off.
//   A killer: set a watch, and accuse only when the clues have left one.
//   A rival king: defy the demand, and keep a guard about the leader from then on.
//   A suitor: ask the daughter; give her if she is willing, otherwise decline with gifts (or let him wait).
//   An alliance by marriage: call on it.
//   A plot: keep informers; send gifts once; pardon the plotter when found. Nobody is accused on a guess.
//   A rival's offer of trade: accepted. Of a royal match: accepted only when the player is the weaker.
//   A tale (story.ts): as the people lean, the way a rival people answers its own (storyturn.ts): the upright answer
//   as often as its lean is upright, when the supplies can be spared (STORE_LOW); the other way otherwise.
import type { Campaign } from './campaign';
import { callOn, callable } from './aftermath';
import { Intrigue, choicesFor, choose, openIntrigues, suspected } from './intrigue';
import { sensiblePetition } from './petitions';
import { answerMarriage } from './royalmarriage';
import { answerTrade } from './tradedeal';
import { armyStrength, luck } from './campaignbase';
import { LEANING } from './creed';
import { leaningWith } from './temper';
import { answerTale, canAnswer } from './storyturn';

/** Supplies in hand below which a careful ruler will not pay for the upright answer to a tale. */
export const STORE_LOW = 10;

/** A people's strength under arms, as a careful ruler reckons it. */
const strengthOf = (c: Campaign, f: number): number => c.armies.filter((a) => a.owner === f).reduce((n, a) => n + armyStrength(a), 0);

/** Answer every story of a people's that is waiting on them, by the policy above. Returns the choices made. */
export function sensibleAnswers(c: Campaign, f = 0): string[] {
  const made: string[] = [];
  const can = (it: Intrigue, id: string): boolean => choicesFor(c, it).some((k) => k.id === id && !k.bar);
  const take = (it: Intrigue, id: string): boolean => { if (!can(it, id) || !choose(c, it.id, id)) return false; made.push(`${it.kind}:${id}`); return true; };
  for (const it of openIntrigues(c, f)) {
    if (it.kind === 'thief') { if (it.caught !== undefined) take(it, 'work'); else take(it, 'watch'); }
    else if (it.kind === 'killer' && it.held !== undefined) take(it, 'hang'); // seized on the field: judged as an accusation would be
    else if (it.kind === 'killer') { take(it, 'watch'); const left = suspected(it); if (left.length === 1) take(it, `accuse:${left[0]}`); }
    else if (it.kind === 'rival') { if (it.stage === 1) take(it, 'defy'); if ((it.stage ?? 0) >= 1) take(it, 'watch'); }
    else if (it.kind === 'suitor') { if (!it.asked) take(it, 'ask'); if (it.asked) { if (it.willing) take(it, 'give'); else take(it, 'decline'); } }
    else if (it.kind === 'plot') {
      if (it.wife) { if (!take(it, 'march')) take(it, 'demand'); continue; } // the leader's wife in a lord's house (wifetaken.ts): take him if an army stands there, else ask
      if (it.found) { take(it, 'pardon'); continue; }
      take(it, 'watch');
      if (!it.sweetened) take(it, 'gifts');
    }
  }
  // A noble's petition: answered as a careful ruler would (petitions.ts).
  { const did = sensiblePetition(c, f); if (did) made.push(`petition:${did}`); }
  // A rival's offer of a trade deal is accepted; of a royal match only by the weaker side, which wants the peace: a match
  // binds the stronger player's hands for years (royalmarriage.ts, tradedeal.ts; at 384 campaigns, accepting every match
  // cost the attended player 17 wins).
  if (f === 0 && c.pactOffer) {
    const o = c.pactOffer, weaker = strengthOf(c, 0) < strengthOf(c, o.from);
    if (o.kind === 'trade' ? answerTrade(c, true) : weaker ? answerMarriage(c, true) : answerMarriage(c, false)) made.push(`pact:${o.kind}`);
  }
  // A tale before the player: as the people lean, if the supplies can be spared, else the other way (storyturn.ts, talethreads.ts).
  if (f === 0 && c.tale) {
    const me = c.factions[0], upright = luck(c, 98) < leaningWith(me.civ, LEANING[me.civ] ?? 0.5);
    const k = upright && canAnswer(c, 'a') && (me.supplies ?? 0) >= STORE_LOW ? 'a' : 'b';
    if (answerTale(c, k) || answerTale(c, k === 'a' ? 'b' : 'a')) made.push(`tale:${k}`);
  }
  // An alliance by marriage is called on as soon as there is one: its men are worth most early.
  if (f === 0) for (const m of callable(c, 0)) { const did = callOn(c, m.id); if (did) made.push(`alliance:${did}`); }
  return made;
}
