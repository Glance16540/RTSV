// Decrees (docs/DESIGN.md, "Decrees"). The leader rules by decree as well as by building. A decree is given to one
// town, costs the nation supplies, and holds for some seasons; while it holds it bends how the town drifts
// (drift.ts):
//
//  - church:      the church calls the people back. The town is drawn toward the holy way. Needs a church there.
//  - guards:      guards keep order by force. Whatever strains the town tells half as much, but nothing draws it
//                 toward the holy way while they stand over it.
//  - alms:        grain bought abroad with the nation's gold removes the cause: the town's larder is filled at once
//                 with new food (grain.ts).
//  - closeTavern: the tavern is shut. Nobody drifts to it, and the gold it made stops; a town already given over
//                 to decadence is angered by it and strains the harder.
//  - tavernWomen: half the women are ordered into the tavern (drift.ts keeps them there). It brings in gold every season and lowers the town's
//                 standing. Needs a tavern there.
//
// The leader gives a decree in person in the town where they are (court.ts); anywhere else it goes by messenger
// and is half as strong.
import type { Campaign } from './campaign';
import { leaderAt } from './court';
import { decreeStrength } from './hall';
import { messengerStrength } from './couriers';
import { folkOf } from './township';
import { heardDecree } from './nobles';
import { buyGrain, canSpareGrain, grainBar } from './grain';
import { angersLord } from './nobleweigh';
import { needOf } from './larder';

export type DecreeKind = 'church' | 'guards' | 'alms' | 'closeTavern' | 'tavernWomen' | 'tend';
export interface Decree { kind: DecreeKind; until: number; strength: number }

declare module './campaign' {
  interface Territory { /** Decrees in force in the town. */ decrees?: Decree[] }
  interface Campaign { /** Nobody gives decrees: for trials that measure drift without them (scripts/drift.test.ts). */ decreesOff?: boolean }
}

export const DECREES: Record<DecreeKind, { name: string; cost: number; seasons: number; needs?: string; desc: string }> = {
  church: { name: 'Call them to church', cost: 2, seasons: 4, needs: 'church', desc: 'The church calls the people back: the town is drawn toward the holy way.' },
  guards: { name: 'Post guards', cost: 3, seasons: 4, desc: 'Order kept by force: what strains the town tells half as much, but nothing draws it to the holy way meanwhile.' },
  alms: { name: 'Buy grain abroad', cost: 0, seasons: 1, desc: 'Grain bought from outside the nation with its gold fills the town\'s larder for this season and the next, and removes the cause: new food, not a neighbour\'s. Dearer in a famine year; by messenger, half of it comes.' },
  closeTavern: { name: 'Close the tavern', cost: 1, seasons: 4, needs: 'tavern', desc: 'Nobody drifts to the tavern and it makes no gold; a decadent town is angered by it.' },
  tavernWomen: { name: 'Order the women into the tavern', cost: 0, seasons: 4, needs: 'tavern', desc: 'Gold every season, and the town\'s standing falls.' },
  tend: { name: 'Tend the sick and the mourning', cost: 0, seasons: 4, needs: 'church', desc: 'The church takes in the sick and sits with the bereaved: sickness and grief weigh on the town half as much, and plague kills fewer. Paid in gold from the town.' },
};
export const DECREE_KINDS = Object.keys(DECREES) as DecreeKind[];

/** A decree given by messenger, the leader being elsewhere, is this strong. */
export const MESSENGER = 0.5;
/** Gold the tavern's women bring in a season. */
export const TAVERN_WOMEN_GOLD = 80;
/** What each decree does to drift at full strength (drift.ts reads these). */
export const CHURCH_CARE = 0.5;
export const GUARDS_EASE = 0.5;
export const TAVERN_WOMEN_SWAY = 6;
export const CLOSED_ANGER = 0.3;

/** The most towns a sensible ruler sends food to in a season. */
export const ALMS_A_SEASON = 2;

// Food for a hungry town is grain bought abroad with the nation's gold (grain.ts): new food, not a lean season moved
// from the next larder. (Tried at 192 campaigns before it: food sent from the towns beside it, and from any town of
// the nation keeping four seasons, which left farmed towns hungrier, 2.0% and 2.2% against 1.8% and 1.6%.)

/** The church's tending: gold it costs the town, how much less sickness and grief weigh at full strength, and how much less plague kills. */
export const TEND_GOLD = 40;
export const TEND_EASE = 0.5;
export const TEND_PLAGUE = 0.25;
/** The share of plague's toll the church's tending spares in a town this season (acts.ts). */
export const tendedPlague = (c: Campaign, tid: number): number => TEND_PLAGUE * decreesAt(c, tid).filter((d) => d.kind === 'tend').reduce((m, d) => Math.max(m, d.strength), 0);

/** A town whose sick and bereaved are tended already, by a Monastery or an Infirmary standing there: a decree to tend them adds nothing. */
export const tendedAlready = (c: Campaign, tid: number): boolean => !!c.territories[tid]?.town?.b?.some((x) => (x[0] === 'monastery' || x[0] === 'infirmary') && x[4] === undefined);

/** How strong a decree given to this town now would be: whole at the leader's seat, else the messenger's. */
export const strengthAt = (c: Campaign, f: number, tid: number): number => decreeStrength(c, f, tid, messengerStrength(c, f, MESSENGER));

/** The decrees in force in a town. */
export const decreesAt = (c: Campaign, tid: number): Decree[] => (c.territories[tid]?.decrees ?? []).filter((d) => d.until >= c.turn);

/** Why this decree cannot be given to this town now, or '' if it can. */
export function decreeBar(c: Campaign, f: number, tid: number, kind: DecreeKind): string {
  const t = c.territories[tid], d = DECREES[kind], fac = c.factions[f];
  if (!t || !d || !fac) return 'No such decree.';
  if (t.owner !== f) return 'Only a town of your own can be ruled by decree.';
  if (t.horde) return 'Marauders hold this land.';
  if (d.needs && !t.buildings.includes(d.needs)) return `There is no ${d.needs} in ${t.name}.`;
  if (decreesAt(c, tid).some((x) => x.kind === kind)) return 'That decree is already in force here.';
  if (fac.supplies < d.cost) return `It costs ${d.cost} supplies.`;
  if (kind === 'tend' && folkOf(c, tid).stores.gold < TEND_GOLD) return `It costs ${TEND_GOLD} gold from ${t.name}.`;
  if (kind === 'alms') { const bar = grainBar(c, f, tid, strengthAt(c, f, tid)); if (bar) return bar; }
  return '';
}

/** Give a decree to a town. Returns '' when given, or why not. */
export function issueDecree(c: Campaign, f: number, tid: number, kind: DecreeKind): string {
  const bar = decreeBar(c, f, tid, kind);
  if (bar) return bar;
  const t = c.territories[tid], d = DECREES[kind], present = leaderAt(c, f, tid), strength = strengthAt(c, f, tid); // whole at the leader's seat: the leader there, or a Hall of Judgement (hall.ts)
  c.factions[f].supplies -= d.cost;
  // A decree given in the player's part of a season holds through the season's turn that follows, which is when
  // towns drift (drift.ts): it acts in the season it is given, as one given while the season turns does.
  t.decrees = [...decreesAt(c, tid), { kind, until: c.turn + d.seasons - 1 + (c.phase === 'player' ? 1 : 0), strength }];
  if (kind === 'alms') { const g = buyGrain(c, f, tid, strength); if (f === 0) c.log.push(`Grain bought abroad for ${t.name}: ${g.food} food for ${g.gold} gold.`); }
  if (kind === 'tend') folkOf(c, tid).stores.gold -= TEND_GOLD;
  heardDecree(c, f, tid, kind, strength); // it pleases some of the nobles and angers others (nobles.ts)
  if (f === 0) c.log.push(`${d.name}: decreed in ${t.name}${present ? '' : ', by messenger'}.`);
  return '';
}

/** What the decrees in force in a town do to its drift this season. */
export interface DecreeEffect { strainScale: number; strainAdd: number; care: number; holyBarred: boolean; sway: number; gold: number; tavernShut: boolean; /** The strength of an order sending the women into the tavern, 0 if none. */ tavernWomen: number; /** The strength of the church's tending of the sick and the mourning, 0 if none. */ tend: number }
export function decreeEffect(c: Campaign, tid: number, decadent: boolean): DecreeEffect {
  const e: DecreeEffect = { strainScale: 1, strainAdd: 0, care: 0, holyBarred: false, sway: 0, gold: 0, tavernShut: false, tavernWomen: 0, tend: 0 };
  for (const d of decreesAt(c, tid)) {
    const s = d.strength;
    if (d.kind === 'church') e.care += CHURCH_CARE * s;
    if (d.kind === 'guards') { e.strainScale *= 1 - GUARDS_EASE * s; e.holyBarred = true; }
    if (d.kind === 'closeTavern') { e.tavernShut = true; if (decadent) e.strainAdd += CLOSED_ANGER * s; }
    if (d.kind === 'tend') e.tend = Math.max(e.tend, s);
    if (d.kind === 'tavernWomen') { e.tavernWomen = Math.max(e.tavernWomen, s); e.sway -= TAVERN_WOMEN_SWAY * s; e.gold += Math.round(TAVERN_WOMEN_GOLD * s); }
  }
  return e;
}

/** Spent decrees are struck off. */
export function decreesSeason(c: Campaign): void {
  for (const t of c.territories) if (t.decrees?.length) t.decrees = t.decrees.filter((d) => d.until >= c.turn);
}

/**
 * What a sensible ruler foresees, as well as what struck last season (a decree given after the season it answers acts
 * on the tail of it: at 192 campaigns grain cut drift's hunger 3%, guards its raids 12%, tending its sickness 5%):
 *   - guards where a band has its place at the town or a land beside it, before it strikes;
 *   - grain where the town's food will not see it through a season of its own eating, before it goes hungry;
 *   - the church's tending where plague is in force in a land beside it, before it comes.
 */
export const FORESIGHT = { guards: true, grain: true, tend: true };
/** A band with its place at this town or a land beside it (threats.ts: a road's band at either end). */
export const bandNear = (c: Campaign, tid: number): boolean => {
  const near = new Set([tid, ...(c.territories[tid]?.adj ?? [])]);
  return (c.bands ?? []).some((b) => near.has(b.at) || (b.to !== undefined && near.has(b.to)));
};
/** Plague in force in a land beside this town. */
export const plagueNear = (c: Campaign, tid: number): boolean => {
  const near = new Set(c.territories[tid]?.adj ?? []);
  return (c.events ?? []).some((e) => e.kind === 'plague' && near.has(e.at) && e.until >= c.turn);
};

/**
 * The decrees a sensible ruler gives, one to a town a season besides grain, keeping a few supplies in hand: grain bought
 * abroad where the town is hungry (paid in gold, not supplies, it does not take the town's one decree: taking it, the
 * decrees eased drift 11.0% and 6.3% at 192 campaigns in the two courses, beside it 11.3% and 9.0%), guards where it is raided or rising, the church where it slid last season, the tavern shut where it slid
 * and not already lost to it. Reads how the town stood last season (`strainOf`, from drift.ts). Returns how many were given.
 */
export function sensibleDecrees(c: Campaign, f: number, strainOf: (tid: number) => { hungry: boolean; raided: boolean; moved: number; standing: number; sick?: boolean; grieving?: boolean }, keep = 4): number {
  let given = 0, fed = 0;
  if (c.decreesOff) return 0;
  for (const t of c.territories) {
    if (t.owner !== f || t.horde) continue;
    const s = strainOf(t.id), fac = c.factions[f];
    // Every decree keeps a few supplies in hand, food (paid in goods, which are what supplies are) as well; and a
    // ruler sends food to at most ALMS_A_SEASON towns a season, the hungriest being those it is told of first.
    // A computer-led ruler leaves out a decree that would anger a lord not angry yet (nobleweigh.ts).
    const tryGive = (k: DecreeKind): boolean => fac.supplies - DECREES[k].cost >= (DECREES[k].cost ? keep : 0) && !angersLord(c, f, t.id, k, strengthAt(c, f, t.id)) && issueDecree(c, f, t.id, k) === '';
    // Foresight (FORESIGHT): a sensible ruler answers what is coming, not only what came last season.
    const lean = FORESIGHT.grain && !s.hungry && folkOf(c, t.id).stores.food < needOf(c, t.id);
    if ((s.hungry || lean) && fed < ALMS_A_SEASON && canSpareGrain(c, f, t.id, strengthAt(c, f, t.id)) && tryGive('alms')) { given++; fed++; } // only when the nation can spare the gold (grain.ts); and beside the town's one decree, not instead of it
    if ((s.raided || (FORESIGHT.guards && bandNear(c, t.id))) && tryGive('guards')) { given++; continue; }
    if ((s.sick || s.grieving || (FORESIGHT.tend && plagueNear(c, t.id))) && !tendedAlready(c, t.id) && tryGive('tend')) { given++; continue; } // not where a Monastery or Infirmary tends already
    if (s.moved < 0 && tryGive('church')) { given++; continue; }
    if (s.moved < 0 && s.standing > -70 && tryGive('closeTavern')) given++;
  }
  return given;
}
