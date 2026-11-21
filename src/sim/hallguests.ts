// Who stands at the hall in a court visit (docs/DESIGN.md, "Stories inside the story": the envoy, the suitor and the
// daughter were named at the hall but were no figures on the field).
//
// A story of the leader's house comes into a visit to the town where the court is kept (courtvisit.ts, courtfield.ts).
// Here, from that story as the field keeps it, the people who stand at the hall:
//   - a rival's envoy, while the answer to his king is not given;
//   - a suitor, while the answer to him is not given;
//   - the leader of a claimant's rising the town stands in, where no soldier on the field is them (claimantcaptain.ts);
//   - the daughter he asks for, once she has been asked what she wants: she comes to the hall to say it, and stays
//     while the answer is not given. She is a grown woman of the house (courtstory.ts asks for no child), dressed as
//     the town's women are.
// When the answer is given the story is ended at the hall, and they go. Nothing else: they are figures for the eye, by
// name, and no people of the field. They are not counted with the town, take no orders and do no work, and nothing
// that reads the town's people sees them. It reads the story and writes nothing.
import type { Game } from './game';
import { courtsOf } from './courtfield';

/** One who stands at the hall: what they are there as, by what name, a man or a woman, and of which people. */
export interface HallGuest {
  /** The same for as long as they stand there: the story's number and what they are in it. */
  key: string;
  role: 'envoy' | 'suitor' | 'daughter' | 'captain' | 'claimant' | 'lord';
  name: string;
  female: boolean;
  /** Of which people they are, for their dress: the rival's for an envoy or a suitor, the town's for the daughter. */
  civ: string;
}

const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** Those who stand at the hall of this side's town now, in the order they stand. Nobody where there is no story and no rising. */
export function hallGuests(g: Game, owner: number): HallGuest[] {
  const out: HallGuest[] = [], home = g.players[owner]?.civ ?? '';
  // The leader of a claimant's rising, where no soldier on the field is them (claimantcaptain.ts).
  const leader = g.players[owner]?.captain;
  if (leader) out.push({ key: 'captain', role: 'captain', name: leader.name, female: leader.female, civ: home });
  // A grown claimant to the throne and the lord behind them (claimantfigures.ts).
  for (const f of g.players[owner]?.claimFigures ?? []) out.push({ key: `claim:${f.id}:${f.role}`, role: f.role, name: f.name, female: f.female, civ: home });
  for (const s of courtsOf(g, owner)) {
    if (s.answer || s.kind === 'plot') continue; // answered: the story is ended at the hall; a plot has nobody waiting there
    const theirs = s.civ ?? home;
    if (s.kind === 'rival') out.push({ key: `${s.id}:envoy`, role: 'envoy', name: cap(s.guest ?? 'the envoy'), female: false, civ: theirs });
    if (s.kind === 'suitor') {
      out.push({ key: `${s.id}:suitor`, role: 'suitor', name: s.guest ?? 'A suitor', female: false, civ: theirs });
      if (s.asked && s.daughter) out.push({ key: `${s.id}:daughter`, role: 'daughter', name: s.daughter, female: true, civ: home });
    }
  }
  return out;
}
