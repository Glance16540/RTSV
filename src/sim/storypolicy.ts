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
import type { Campaign } from './campaign';
import { callOn, callable } from './aftermath';
import { Intrigue, choicesFor, choose, openIntrigues, suspected } from './intrigue';
import { sensiblePetition } from './petitions';

/** Answer every story of a people's that is waiting on them, by the policy above. Returns the choices made. */
export function sensibleAnswers(c: Campaign, f = 0): string[] {
  const made: string[] = [];
  const can = (it: Intrigue, id: string): boolean => choicesFor(c, it).some((k) => k.id === id && !k.bar);
  const take = (it: Intrigue, id: string): boolean => { if (!can(it, id) || !choose(c, it.id, id)) return false; made.push(`${it.kind}:${id}`); return true; };
  for (const it of openIntrigues(c, f)) {
    if (it.kind === 'thief') { if (it.caught !== undefined) take(it, 'work'); else take(it, 'watch'); }
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
  // An alliance by marriage is called on as soon as there is one: its men are worth most early.
  if (f === 0) for (const m of callable(c, 0)) { const did = callOn(c, m.id); if (did) made.push(`alliance:${did}`); }
  return made;
}
