/**
 * Drift under pressure, and the leader's decrees (docs/DESIGN.md, step 5), for a town on the map.
 * People do as they are set to while they are fed and safe. A town under pressure (hungry, in danger, grieving,
 * held against its will) loses them a few at a time to what is worse for them: women to the taverns, men to the
 * mines, and its walls are left thin. Where a town is well kept they come back, and the holy way draws it.
 * The leader answers by building (a Church, Farmland) or by decree, one to a town: guards who keep order by
 * force, the stores opened, the tavern closed, or the women ordered into the taverns for the gold.
 */
import type { Campaign } from './campaign';
import { armyAt } from './campaign';
import { leaderAt } from './court';
import { resentOf } from './conquered';
import { faithAt, swayTown } from './townfaith';
import { folkOf, headcount } from './township';

/** Who of a town has drifted: women at the taverns, men gone to the mines. `anger`: what a decree has cost in goodwill, 0 to 100. */
export interface Drifted { tavern: number; mines: number; anger?: number }
export type DecreeKind = 'guards' | 'bread' | 'close' | 'tavern';
export interface DecreeDef { name: string; icon: string; cost: number; desc: string }
export const DECREES: Record<DecreeKind, DecreeDef> = {
  guards: { name: 'Set guards', icon: '🛡️', cost: 1, desc: 'Order is kept by force: nobody else drifts, and each season one who has is brought back. It is resented.' },
  bread: { name: 'Open the stores', icon: '🍞', cost: 2, desc: 'Food is sent to the town each season: hunger no longer presses on it.' },
  close: { name: 'Close the tavern', icon: '🚪', cost: 0, desc: 'The women come home and no more go. A worldly town is angered by it.' },
  tavern: { name: 'Send the women to the taverns', icon: '🍷', cost: 0, desc: 'Half the town\'s women serve in the taverns: gold every season, and the town\'s morals fall.' },
};
export const DRIFT = {
  /** Food in store per head below which a town is hungry, and how hard hunger presses at nothing. */
  fed: 12, hunger: 60,
  /** What a famine or hard season adds, a raid, fire or plague, each point of resentment, and a notable person lately lost. */
  famine: 30, struck: 25, resent: 0.25, grief: 10, griefTurns: 4,
  /** What takes pressure off: a Church, the leader in the town, an army in it (against danger only), Farmland (against hunger only). */
  church: 10, leader: 15, garrison: 10, farm: 10,
  /** Above `press` people drift, more the higher it is; at or under `kept` the town is well kept and they come back. */
  press: 30, kept: 15, step: 30, most: 3,
  /** No more than this share of a town's women, or of its men, drift. */
  share: 0.5,
  /** Each season: gold a woman at the taverns brings in, stone and gold a man at the mines does, and how many tavern women move the town a point toward decadence. */
  tavernGold: 4, mineStone: 3, mineGold: 2, perPoint: 2,
  /** Decrees: what guards add to a town's anger each season and what closing a worldly town's tavern does; the food a season of open stores sends; what the ordered taverns cost the town in standing. */
  guardAnger: 3, closeAnger: 20, worldly: -30, bread: 200, ordered: 3,
  /** Anger eases this much a season under no decree. */
  cool: 2,
};
const STRUCK = ['raid', 'carried', 'plague', 'blaze', 'raiders', 'taken', 'fever'];
const HUNGRY = ['famine', 'hard'];

const clamp = (v: number, hi = 100): number => Math.max(0, Math.min(hi, v));
/** Who has drifted from a town (nobody, for a town never under pressure). */
export const driftOf = (c: Campaign, tid: number): Drifted => c.territories[tid]?.drift ?? { tavern: 0, mines: 0 };
/** The decree a town is under, if any. */
export const decreeOf = (c: Campaign, tid: number): DecreeKind | '' => c.territories[tid]?.decree ?? '';

export interface Pressure { hunger: number; danger: number; grief: number; total: number; causes: string[] }
/** How hard things press on a town this season, and why. */
export function pressureOf(c: Campaign, tid: number): Pressure {
  const t = c.territories[tid], causes: string[] = [];
  if (!t || t.owner < 0) return { hunger: 0, danger: 0, grief: 0, total: 0, causes };
  const f = folkOf(c, tid), heads = Math.max(1, headcount(f));
  const now = (c.events ?? []).filter((e) => e.at === tid && e.turn >= c.turn - 1);
  const has = (kinds: string[]): boolean => now.some((e) => kinds.includes(e.kind));
  const fed = decreeOf(c, tid) === 'bread';
  let hunger = fed ? 0 : clamp(((DRIFT.fed - f.stores.food / heads) / DRIFT.fed) * DRIFT.hunger) + (has(HUNGRY) ? DRIFT.famine : 0);
  if (hunger > 0 && t.buildings.includes('farm')) hunger = Math.max(0, hunger - DRIFT.farm);
  if (hunger > 0) causes.push('hunger');
  let danger = (has(STRUCK) ? DRIFT.struck : 0) + resentOf(c, tid) * DRIFT.resent + (t.drift?.anger ?? 0) * DRIFT.resent;
  const a = armyAt(c, tid);
  if (danger > 0 && a && a.owner === t.owner) danger = Math.max(0, danger - DRIFT.garrison);
  if (has(STRUCK)) causes.push('danger');
  if (resentOf(c, tid) > 0) causes.push('held against its will');
  if ((t.drift?.anger ?? 0) > 0) causes.push('anger at a decree');
  const grief = f.notables.some((n) => n.lost && n.lost.turn >= c.turn - DRIFT.griefTurns) ? DRIFT.grief : 0;
  if (grief) causes.push('grief');
  const relief = (t.buildings.includes('church') ? DRIFT.church : 0) + (leaderAt(c, t.owner, tid) ? DRIFT.leader : 0);
  return { hunger: Math.round(hunger), danger: Math.round(danger), grief, total: Math.round(clamp(hunger + danger + grief - relief)), causes };
}
/** The share of a town's men still at their posts: the walls are left thin as men go to the mines. */
export function watchOf(c: Campaign, tid: number): number {
  const men = folkOf(c, tid).men;
  return men > 0 ? 1 - Math.min(men, driftOf(c, tid).mines) / men : 1;
}

/** Can this people lay this decree on this town? It must be theirs; the two about the tavern need a Tavern there; setting one must be paid for. */
export function canDecree(c: Campaign, f: number, tid: number, kind: DecreeKind | ''): boolean {
  const t = c.territories[tid];
  if (!t || t.owner !== f) return false;
  if (kind === '') return !!t.decree;
  if (!DECREES[kind] || t.decree === kind) return false;
  if ((kind === 'close' || kind === 'tavern') && !t.buildings.includes('tavern')) return false;
  return c.factions[f].supplies >= DECREES[kind].cost;
}
/** Lay a decree on a town (or lift the one it is under, with ''). A town is under one decree at a time. */
export function decree(c: Campaign, f: number, tid: number, kind: DecreeKind | ''): boolean {
  if (!canDecree(c, f, tid, kind)) return false;
  const t = c.territories[tid], d = (t.drift ??= { tavern: 0, mines: 0 });
  if (kind === '') { delete t.decree; return true; }
  t.decree = kind;
  if (kind === 'close') {
    d.tavern = 0;
    if (faithAt(c, tid) <= DRIFT.worldly) { d.anger = clamp((d.anger ?? 0) + DRIFT.closeAnger); c.log.push(`The tavern at ${t.name} is closed, and the town is angry about it.`); }
  }
  if (kind === 'tavern') d.tavern = Math.max(d.tavern, Math.floor(folkOf(c, tid).women * DRIFT.share));
  return true;
}

export interface DriftNews { at: number; went: { tavern: number; mines: number }; back: { tavern: number; mines: number }; gold: number; stone: number; lapsed?: DecreeKind }
/**
 * A season of drift in every held town: decrees are paid for and take effect, people drift where pressure is
 * high and come back where the town is well kept, and those who have drifted bring in what they bring and cost
 * the town what they cost it.
 */
export function seasonOfDrift(c: Campaign): DriftNews[] {
  const out: DriftNews[] = [];
  for (const t of c.territories) {
    if (t.owner < 0 || t.horde) { delete t.drift; delete t.decree; continue; }
    const x = c.factions[t.owner];
    if (!x?.alive) continue;
    if (x.isAI) rivalDecree(c, t.id);
    const f = folkOf(c, t.id), d = (t.drift ??= { tavern: 0, mines: 0 });
    const news: DriftNews = { at: t.id, went: { tavern: 0, mines: 0 }, back: { tavern: 0, mines: 0 }, gold: 0, stone: 0 };
    // A decree that cannot be paid for lapses.
    const kind = decreeOf(c, t.id);
    if (kind && x.supplies < DECREES[kind].cost) { delete t.decree; news.lapsed = kind; if (t.owner === 0) c.log.push(`There is nothing to pay for it: the decree at ${t.name} (${DECREES[kind].name.toLowerCase()}) has lapsed.`); }
    const law = decreeOf(c, t.id);
    if (law) x.supplies -= DECREES[law].cost;
    if (law === 'bread') f.stores.food += DRIFT.bread;
    if (law === 'guards') d.anger = clamp((d.anger ?? 0) + DRIFT.guardAnger); else if (d.anger) d.anger = Math.max(0, d.anger - DRIFT.cool);
    const p = pressureOf(c, t.id);
    const capW = Math.floor(f.women * DRIFT.share), capM = Math.floor(f.men * DRIFT.share);
    if (p.total > DRIFT.press && law !== 'guards') {
      // Hunger sends women to the taverns and men to the mines, by turns, more of them the harder it presses.
      let go = Math.min(DRIFT.most, Math.ceil((p.total - DRIFT.press) / DRIFT.step));
      for (let i = 0; go > 0 && i < 2 * DRIFT.most; i++) {
        const woman = (c.turn + t.id + i) % 2 === 0;
        if (woman && law !== 'close' && d.tavern < capW) { d.tavern++; news.went.tavern++; go--; }
        else if (!woman && d.mines < capM) { d.mines++; news.went.mines++; go--; }
      }
    } else if (p.total <= DRIFT.kept || law === 'guards') {
      // Well kept (or under guard), they come back: sooner where there is a church or the town is pious.
      const n = law !== 'guards' && (t.buildings.includes('church') || faithAt(c, t.id) >= 30) ? 2 : 1;
      const w = law === 'tavern' ? 0 : Math.min(d.tavern, n), m = Math.min(d.mines, n);
      d.tavern -= w; d.mines -= m; news.back = { tavern: w, mines: m };
      if (p.total <= DRIFT.kept && w + m > 0) swayTown(c, t.id, t.buildings.includes('church') ? 2 : 1); // in a town well kept the holy way is the more attractive: those who come back come back to it
    }
    if (law === 'tavern') d.tavern = Math.max(d.tavern, capW);
    d.tavern = Math.min(d.tavern, f.women); d.mines = Math.min(d.mines, f.men);
    // What they bring in, and what it costs.
    news.gold = d.tavern * DRIFT.tavernGold + d.mines * DRIFT.mineGold; news.stone = d.mines * DRIFT.mineStone;
    f.stores.gold += news.gold; f.stores.stone += news.stone;
    const fall = (d.tavern ? Math.max(1, Math.floor(d.tavern / DRIFT.perPoint)) : 0) + (law === 'tavern' ? DRIFT.ordered : 0);
    if (fall) swayTown(c, t.id, -fall);
    if (t.owner === 0 && (news.went.tavern || news.went.mines)) c.log.push(`${t.name} is under strain (${p.causes.join(', ') || 'hard times'}): ${[news.went.tavern ? `${news.went.tavern} of its women ${news.went.tavern === 1 ? 'has' : 'have'} gone to the taverns` : '', news.went.mines ? `${news.went.mines} of its men to the mines` : ''].filter(Boolean).join(' and ')}.`);
    if (t.owner === 0 && (news.back.tavern || news.back.mines)) c.log.push(`${t.name} is well kept: ${news.back.tavern + news.back.mines} of those who had drifted ${news.back.tavern + news.back.mines === 1 ? 'has' : 'have'} come back to their work.`);
    if (!d.tavern && !d.mines && !d.anger) delete t.drift;
    if (news.went.tavern || news.went.mines || news.back.tavern || news.back.mines || news.gold || news.lapsed) out.push(news);
  }
  return out;
}
/** A rival's rule of a town: feed it when it is hungry and there is plenty, set guards when many have drifted, and lift a decree that has done its work. */
export function rivalDecree(c: Campaign, tid: number): void {
  const t = c.territories[tid], x = c.factions[t.owner], law = decreeOf(c, tid), d = driftOf(c, tid);
  const p = pressureOf(c, tid);
  if (law === 'bread' && folkOf(c, tid).stores.food / Math.max(1, headcount(folkOf(c, tid))) > DRIFT.fed * 2) { decree(c, t.owner, tid, ''); return; }
  if (law === 'guards' && !d.tavern && !d.mines) { decree(c, t.owner, tid, ''); return; }
  if (law) return;
  if (p.hunger >= DRIFT.press && x.supplies >= 10) decree(c, t.owner, tid, 'bread');
  else if (d.tavern + d.mines >= 3 && x.supplies >= 6) decree(c, t.owner, tid, 'guards');
}
