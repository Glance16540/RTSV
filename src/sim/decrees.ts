// Decrees (docs/DESIGN.md, "Decrees"). The leader rules by decree as well as by building. A decree is given to one
// town, costs the nation supplies, and holds for some seasons; while it holds it bends how the town drifts
// (drift.ts):
//
//  - church:      the church calls the people back. The town is drawn toward the holy way. Needs a church there.
//  - guards:      guards keep order by force. Whatever strains the town tells half as much, but nothing draws it
//                 toward the holy way while they stand over it.
//  - alms:        food from the nation's stores removes the cause: the town's larder is filled at once.
//  - closeTavern: the tavern is shut. Nobody drifts to it, and the gold it made stops; a town already given over
//                 to decadence is angered by it and strains the harder.
//  - tavernWomen: half the women are ordered into the tavern (drift.ts keeps them there). It brings in gold every season and lowers the town's
//                 standing. Needs a tavern there.
//
// The leader gives a decree in person in the town where they are (court.ts); anywhere else it goes by messenger
// and is half as strong.
import type { Campaign } from './campaign';
import { leaderAt } from './court';
import { folkOf } from './township';
import { heardDecree } from './nobles';
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
  alms: { name: 'Give food', cost: 0, seasons: 1, desc: 'Food from the towns beside it fills the town\'s larder and removes the cause: what they have beyond two seasons of their own eating.' },
  closeTavern: { name: 'Close the tavern', cost: 1, seasons: 4, needs: 'tavern', desc: 'Nobody drifts to the tavern and it makes no gold; a decadent town is angered by it.' },
  tavernWomen: { name: 'Order the women into the tavern', cost: 0, seasons: 4, needs: 'tavern', desc: 'Gold every season, and the town\'s standing falls.' },
  tend: { name: 'Tend the sick and the mourning', cost: 0, seasons: 4, needs: 'church', desc: 'The church takes in the sick and sits with the bereaved: sickness and grief weigh on the town half as much, and plague kills fewer. Paid in gold from the town.' },
};
export const DECREE_KINDS = Object.keys(DECREES) as DecreeKind[];

/** A decree given by messenger, the leader being elsewhere, is this strong. */
export const MESSENGER = 0.5;
/** Food a decree of alms puts in the larder (at full strength), and gold the tavern's women bring in a season. */
export const ALMS_FOOD = 300;
export const TAVERN_WOMEN_GOLD = 80;
/** What each decree does to drift at full strength (drift.ts reads these). */
export const CHURCH_CARE = 0.5;
export const GUARDS_EASE = 0.5;
export const TAVERN_WOMEN_SWAY = 6;
export const CLOSED_ANGER = 0.3;

/** The most towns a sensible ruler sends food to in a season. */
export const ALMS_A_SEASON = 2;
/** The least food a decree of alms must find to be given. */
export const ALMS_LEAST = 50;
/** Seasons of their own eating the towns beside it keep before they send any. */
export const ALMS_KEEP = 2;

// Food for a hungry town is food, not supplies (stores.ts): the towns of the nation beside it send what they have
// beyond ALMS_KEEP seasons of their own eating. Nothing is bought with the nation's gold, wood or stone, which are
// its war chest.
const givers = (c: Campaign, f: number, tid: number): number[] => (c.territories[tid]?.adj ?? []).filter((n) => c.territories[n].owner === f && !c.territories[n].horde);
const spareFood = (c: Campaign, tid: number): number => Math.max(0, Math.floor(folkOf(c, tid).stores.food - ALMS_KEEP * needOf(c, tid)));
/** How much food a decree of alms could find for a town now. */
export function almsCanFind(c: Campaign, f: number, tid: number): number {
  return givers(c, f, tid).reduce((n, g) => n + spareFood(c, g), 0);
}
/** Find `want` food for a town, as far as it can be had, and put it in its larder. Returns how much came. */
export function sendAlms(c: Campaign, f: number, tid: number, want: number): number {
  const s = folkOf(c, tid).stores;
  let left = want;
  for (const g of givers(c, f, tid).sort((a, b) => spareFood(c, b) - spareFood(c, a) || a - b)) {
    if (left <= 0) break;
    const take = Math.min(spareFood(c, g), left);
    folkOf(c, g).stores.food -= take; left -= take;
  }
  const came = want - left;
  s.food += came;
  return came;
}

/** The church's tending: gold it costs the town, how much less sickness and grief weigh at full strength, and how much less plague kills. */
export const TEND_GOLD = 40;
export const TEND_EASE = 0.5;
export const TEND_PLAGUE = 0.25;
/** The share of plague's toll the church's tending spares in a town this season (acts.ts). */
export const tendedPlague = (c: Campaign, tid: number): number => TEND_PLAGUE * decreesAt(c, tid).filter((d) => d.kind === 'tend').reduce((m, d) => Math.max(m, d.strength), 0);

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
  if (kind === 'alms' && almsCanFind(c, f, tid) < ALMS_LEAST) return `There is no food to be had for ${t.name}: the towns beside it have none to spare.`;
  return '';
}

/** Give a decree to a town. Returns '' when given, or why not. */
export function issueDecree(c: Campaign, f: number, tid: number, kind: DecreeKind): string {
  const bar = decreeBar(c, f, tid, kind);
  if (bar) return bar;
  const t = c.territories[tid], d = DECREES[kind], present = leaderAt(c, f, tid), strength = present ? 1 : MESSENGER;
  c.factions[f].supplies -= d.cost;
  // A decree given in the player's part of a season holds through the season's turn that follows, which is when
  // towns drift (drift.ts): it acts in the season it is given, as one given while the season turns does.
  t.decrees = [...decreesAt(c, tid), { kind, until: c.turn + d.seasons - 1 + (c.phase === 'player' ? 1 : 0), strength }];
  if (kind === 'alms') sendAlms(c, f, tid, Math.round(ALMS_FOOD * strength));
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
 * The decrees a sensible ruler gives, one to a town a season, keeping a few supplies in hand: food where the town is
 * hungry, guards where it is raided or rising, the church where it slid last season, the tavern shut where it slid
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
    const tryGive = (k: DecreeKind): boolean => fac.supplies - DECREES[k].cost >= (DECREES[k].cost ? keep : 0) && issueDecree(c, f, t.id, k) === '';
    if (s.hungry && fed < ALMS_A_SEASON && tryGive('alms')) { given++; fed++; continue; }
    if (s.raided && tryGive('guards')) { given++; continue; }
    if ((s.sick || s.grieving) && tryGive('tend')) { given++; continue; }
    if (s.moved < 0 && tryGive('church')) { given++; continue; }
    if (s.moved < 0 && s.standing > -70 && tryGive('closeTavern')) given++;
  }
  return given;
}
