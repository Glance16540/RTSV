// A story of the leader's house, carried into a visit to the town where the court is kept, and back (docs/DESIGN.md,
// "Stories inside the story"). The map side of courtfield.ts, as storyvisit.ts is of fieldstory.ts:
//   `courtForVisit` hands the visit the player's rival king, suitor or plot when the town visited is where the court is;
//   `courtFromVisit` writes what came of it on the field back to the story on the map.
// What comes back from the field is not believed blindly: an answer is given only if the map would offer it now and
// nothing bars it, and then by the map's own rule (courtstory.ts `courtChoose`), so that it costs and does exactly what
// it would from the map; one of the great is shown true only if they are spoken of still and are not the plotter.
// A plot already laid bare waits on judgement, which is given on the map: nothing of it goes to the field.
import type { Campaign } from './campaign';
import { heroFor } from './campaignbase';
import { intriguesAt } from './intrigue';
import { courtChoices, courtChoose, shownTrue } from './courtstory';
import type { Intrigue } from './intriguebase';
import { FIELD_ANSWERS, type FieldCourt, type FieldCourtOut } from './courtfield';

/** The player's open stories of the house in this town, if the court is kept here: all that are afoot at once. */
function courtsAt(c: Campaign, tid: number) {
  return intriguesAt(c, tid).filter((x) => x.owner === 0 && (x.kind === 'rival' || x.kind === 'suitor' || x.kind === 'plot'));
}

/**
 * The player's stories of the house as the field takes them, or undefined: the first, with the others afoot at once
 * riding in it (`also`), so that an envoy, a suitor and a plot are all in the town together.
 */
export function courtForVisit(c: Campaign, tid: number): FieldCourt | undefined {
  const all = courtsAt(c, tid).map((it) => one(c, it)).filter((x): x is FieldCourt => !!x).map((x) => ({ ...x, turn: c.turn }));
  if (!all.length) return undefined;
  const [first, ...rest] = all;
  return rest.length ? { ...first, also: rest } : first;
}
/** One story as the field takes it; a plot already laid bare waits on the map's judgement and brings nothing. */
function one(c: Campaign, it: Intrigue): FieldCourt | undefined {
  if (it.kind === 'plot') {
    if (it.found || !it.nobles?.length) return undefined;
    return { id: it.id, kind: 'plot', answers: [], nobles: it.nobles.map((n) => ({ name: n.name, title: n.title, female: n.female })), culprit: it.culprit, cleared: [...it.cleared], ...(it.watch ? { informers: true } : {}) };
  }
  const r = c.factions[it.rival ?? -1], king = it.cast?.king ?? 'a rival', of = r ? ` of the ${r.name}` : '';
  const answers = courtChoices(c, it).filter((x) => FIELD_ANSWERS[it.kind as 'rival' | 'suitor'].includes(x.id)).map((x) => ({ id: x.id, label: x.label, ...(x.bar ? { bar: x.bar } : {}) }));
  if (it.kind === 'rival') {
    const queen = !!heroFor(c, it.rival ?? 0).female, spouse = it.cast?.spouse ?? 'your consort';
    return {
      id: it.id, kind: 'rival', guest: `the envoy of ${king}${of}`, answers, ...(r ? { civ: r.civ } : {}), // of his people's dress at the hall (hallguests.ts)
      errand: it.stage === 1 ? `${queen ? 'She' : 'He'} demands that ${spouse} be sent over the border, and waits for your answer.`
        : it.stage === 0 ? `${king} has sworn to have your head, and ${spouse} for ${queen ? 'her' : 'his'} own. The envoy has said so, and stays to see how it is taken.`
        : `${king} has been defied. The envoy is making ready to go.`,
    };
  }
  const suitor = it.cast?.suitor ?? 'a suitor', daughter = it.cast?.daughter ?? 'your daughter';
  return {
    id: it.id, kind: 'suitor', guest: `${suitor} of the house of ${king}${of}`, answers, ...(r ? { civ: r.civ } : {}), daughter, willing: !!it.willing, ...(it.asked ? { asked: true } : {}),
    errand: `He asks for your daughter ${daughter}, and waits for your answer.`,
  };
}

/** Write what came of the stories on the field back to them on the map, each checked. Returns whether anything changed. */
export function courtFromVisit(c: Campaign, tid: number, out: unknown): boolean {
  if (!out || typeof out !== 'object') return false;
  const o = out as Partial<FieldCourtOut>, also = Array.isArray(o.also) ? o.also.slice(0, 8) : [];
  let any = false;
  for (const x of [o, ...also]) any = backOne(c, tid, x) || any;
  return any;
}
function backOne(c: Campaign, tid: number, out: unknown): boolean {
  if (!out || typeof out !== 'object') return false;
  const o = out as Partial<FieldCourtOut>, it = courtsAt(c, tid).find((x) => x.id === o.id);
  if (!it) return false;
  let any = false;
  if (it.kind === 'plot') {
    if (!Array.isArray(o.cleared)) return false;
    for (const i of o.cleared) {
      if (!Number.isInteger(i) || i < 0 || it.ended || it.found) continue;
      const n = it.nobles?.[i];
      if (n && shownTrue(c, it, i, `Watched by your soldiers in ${c.territories[tid].name}, ${n.title} is true.`)) any = true;
    }
    return any;
  }
  const may = (id: string): boolean => courtChoices(c, it).some((x) => x.id === id && !x.bar);
  if (o.asked === true && may('ask')) any = courtChoose(c, it, 'ask') || any;
  if (typeof o.answer === 'string' && FIELD_ANSWERS[it.kind as 'rival' | 'suitor'].includes(o.answer) && !it.ended && may(o.answer)) any = courtChoose(c, it, o.answer) || any;
  return any;
}
