// A people that has died out is beaten (docs/DESIGN.md, "People persist": a town is its people; "A soldier costs a
// person": people come only by birth).
//
// In a campaign battle or a visit nobody is bought (birthonly.ts): a side has the people it brought and those its
// couples bear. A side with no villager left, grown or child, has nobody to bear a child and nobody to grow up: it can
// never have another person. Its soldiers and its hall used to hold the battle open all the same (in forty-eight trial
// sieges, six of the thirteen undecided were like that). Now such a side has died out:
//   - it is told so, and so is every side at war with it, the moment it happens;
//   - it is beaten when its last soldier falls (lastperson.ts already sees to that), or when DIE_OUT.grace seconds
//     have passed, whichever comes first: its soldiers hold the field for a while, not for ever;
//   - should a villager of its own be alive again (a captive freed, a woman come home), the clock stops.
// Not touched: a skirmish or a mission (villagers are bought there), a field battle (no town on it), a war band (its
// own rule), the besieger of a siege (an army, not a people: siegelift.ts ends it when it is spent), and a side with
// nobody at war with it (a visit with no foe).
// Plain data: it reads the field and keeps one number on the player.
import { besieging } from './besieger';
import { reserving } from './reservecamp';
import type { Game } from './game';

declare module './game' {
  interface Player {
    /** The moment this side, died out, is beaten though its soldiers stand (dyingout.ts). Not set while it has people. */
    dieDue?: number;
  }
}

export const DIE_OUT = {
  /** Seconds a side that has died out holds the field with its soldiers before it is beaten. */
  grace: 120,
  /** Warnings when this many seconds are left. */
  warnings: [60, 20],
};

/** Has this side died out: nobody left to bear a child or grow up, though soldiers of its own still stand? */
export function diedOut(g: Game, pid: number): boolean {
  const p = g.players[pid];
  if (!g.bornOnly || g.field || !p || p.neutral || p.defeated || g.warband(pid) || besieging(g, pid) || reserving(g, pid)) return false; // a reserve is an army too (reservecamp.ts)
  if (!g.players.some((q) => !q.neutral && !q.defeated && q.id !== pid && g.hostile(q.id, pid))) return false; // nobody to lose to
  let any = false;
  for (const u of g.units) {
    if (u.owner !== pid || u.dead) continue;
    if (u.type === 'villager') return false; // someone to bear or to grow
    any = true;
  }
  return any; // with nobody at all, lastperson.ts has it beaten already
}

export type DieNews = 'fine' | 'died' | 'warn' | 'revived' | 'beaten';

/** A second of the battle for one side: whether it has died out, is warned, has people again, or is beaten. */
export function dieClock(g: Game, pid: number): DieNews {
  const p = g.players[pid];
  if (!diedOut(g, pid)) {
    if (p?.dieDue === undefined) return 'fine';
    p.dieDue = undefined;
    return p.defeated ? 'fine' : 'revived';
  }
  if (p.dieDue === undefined) { p.dieDue = g.time + DIE_OUT.grace; return 'died'; }
  if (g.time >= p.dieDue) return 'beaten';
  const left = p.dieDue - g.time;
  return DIE_OUT.warnings.some((w) => left <= w && left + 1 > w) ? 'warn' : 'fine';
}

/** Run the clock for every side and tell them; returns the sides that have died out and are beaten. */
export function dyingOut(g: Game): number[] {
  const out: number[] = [];
  for (const p of g.players) {
    if (p.neutral || p.defeated) continue;
    const news = dieClock(g, p.id);
    if (news === 'fine') continue;
    const left = Math.max(0, Math.ceil((p.dieDue ?? g.time) - g.time));
    const foes = g.players.filter((q) => !q.neutral && q.id !== p.id && g.hostile(q.id, p.id));
    if (news === 'died' || news === 'warn') {
      g.msg(p.id, news === 'died'
        ? `Your people have died out: nobody is left to bear a child or to grow up. Your soldiers can hold for ${left} seconds.`
        : `Your people have died out. Your soldiers hold for ${left} seconds more.`);
      for (const q of foes) g.msg(q.id, news === 'died'
        ? `${p.name} have died out: nobody is left among them but soldiers. Hold for ${left} seconds, or cut down the last of them, and they are beaten.`
        : `${p.name} have died out. Hold for ${left} seconds more.`);
    } else if (news === 'revived') g.msg(p.id, 'One of your people is with you again: they have not died out.');
    else if (news === 'beaten') {
      out.push(p.id);
      g.msg(p.id, 'Your people have died out, and their soldiers cannot hold the town alone.');
      for (const q of foes) g.msg(q.id, `${p.name} have died out.`);
    }
  }
  return out;
}
