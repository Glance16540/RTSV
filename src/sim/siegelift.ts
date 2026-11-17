// A siege is lifted when the besieging army is spent (the gathering session's playtest finding: a grown town's siege that
// the player sat through never ended).
//
// The besieger of a campaign siege comes with an army and a camp of a few villagers (besieger.ts). It assaults; if the
// assault fails, it is left with a handful of fighters or none, and its camp can raise no more: it has no barracks, too
// few people to want one, and people come only by birth (birthonly.ts). It still has people, so it is not beaten
// (lastperson.ts); its hall stands, so the hall clock never runs (beaten.ts). The battle stood open until the defender
// marched out and killed the last of the camp. A player who held the town and waited sat in it for ever; and among the
// computer's own sieges five in six were undecided at eight minutes.
//
// So a besieger whose army is spent lifts the siege, and has lost it. Spent: after it has formed up (BESIEGE.form), it
// has fewer fighters than LIFT.fewest on the field, and nothing to raise more with (no work of its own, standing or
// begun, that trains fighters, or nobody to train). Once spent it has LIFT.grace seconds, warned, to raise or bring up
// more; if it does, the clock stops. A besieger still in strength, the defender, a skirmish, a field battle and a visit
// are not touched.
import { BUILDINGS, UNITS } from './data';
import { besieging, BESIEGE } from './besieger';
import type { Game } from './game';

declare module './game' {
  interface Player {
    /** The moment this besieger, its army spent, lifts the siege (siegelift.ts). Not set while it is in strength. */
    liftDue?: number;
  }
}

export const LIFT = {
  /** A besieger with fewer fighters than this, and no means to raise more, is spent: the computer marches with no fewer than four. */
  fewest: 4,
  /** Seconds a spent besieger has to raise or bring up more before the siege is lifted. */
  grace: 60,
  /** Warnings when this many seconds are left. */
  warnings: [30],
};

/** Does any of this side's works, standing or begun, train fighters (not the hall, whose leaders are no army)? */
function canRaise(g: Game, pid: number): boolean {
  if (!g.units.some((u) => u.owner === pid && !u.dead && u.type === 'villager')) return false; // nobody to put under arms
  return g.buildings.some((b) => b.owner === pid && !b.dead && b.type !== 'towncenter' && BUILDINGS[b.type]?.trains.some((t) => UNITS[t] && UNITS[t].cls !== 'villager' && UNITS[t].cls !== 'support'));
}

/** Is this besieger's army spent? */
export function spent(g: Game, pid: number): boolean {
  const p = g.players[pid];
  if (!p || p.defeated || !besieging(g, pid) || g.field || g.time < BESIEGE.form) return false;
  const fighters = g.units.filter((u) => u.owner === pid && !u.dead && g.isMilitary(u)).length;
  return fighters < LIFT.fewest && !canRaise(g, pid);
}

export type LiftNews = 'fine' | 'spent' | 'warn' | 'eased' | 'lifted';

/** A second of the siege for one side: whether its army is spent, warned, recovered, or the siege lifted. */
export function liftClock(g: Game, pid: number): LiftNews {
  const p = g.players[pid];
  if (!spent(g, pid)) {
    if (p?.liftDue === undefined) return 'fine';
    p.liftDue = undefined;
    return 'eased';
  }
  if (p.liftDue === undefined) { p.liftDue = g.time + LIFT.grace; return 'spent'; }
  if (g.time >= p.liftDue) return 'lifted';
  const left = p.liftDue - g.time;
  return LIFT.warnings.some((w) => left <= w && left + 1 > w) ? 'warn' : 'fine';
}

/** Run the clock for every besieger and tell both sides; returns the sides that have lifted the siege and are beaten. */
export function liftSieges(g: Game): number[] {
  const out: number[] = [];
  for (const p of g.players) {
    if (p.neutral || p.defeated) continue;
    const news = liftClock(g, p.id);
    if (news === 'fine') continue;
    const left = Math.max(0, Math.ceil((p.liftDue ?? g.time) - g.time));
    const foes = g.players.filter((q) => !q.neutral && q.id !== p.id && g.hostile(q.id, p.id));
    if (news === 'spent' || news === 'warn') {
      g.msg(p.id, `Your army is spent and can raise no more. Bring up fighters within ${left} seconds or the siege is lifted.`);
      for (const q of foes) g.msg(q.id, `${p.name}'s army is spent. Hold for ${left} seconds and they lift the siege.`);
    } else if (news === 'eased') g.msg(p.id, 'Fighters are raised: the siege goes on.');
    else if (news === 'lifted') {
      out.push(p.id);
      g.msg(p.id, 'Your army is spent: the siege is lifted.');
      for (const q of foes) g.msg(q.id, `${p.name} lift the siege: the town has held.`);
    }
  }
  return out;
}
