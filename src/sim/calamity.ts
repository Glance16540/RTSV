// Fire that begins without an enemy, and a town that turns out to fight it.
//
// Lightning. While a storm is heavy a bolt falls now and then, and some of them find a building: any standing
// building but a wall, whoever owns it, with the tall ones (towers, churches, wonders) three times as likely. In
// rain the fire it starts is short and cannot spread (game.ts: rain takes fires). In a dust storm it is dry
// lightning: the fire lasts and spreads like any other. Snow brings none.
//
// Fighting it. A villager sent to a burning building of their own (the ordinary right-click, which is the order
// to build or mend) beats the fire down before mending anything: each pair of hands takes FIRE.douse seconds off
// the fire every second, up to FIRE.hands of them. Villagers standing idle within FIRE.turnout tiles turn out by
// themselves. `turnOut` is for whoever plays the town (the computer player): it calls working villagers off
// their jobs to a fire that is short of hands, and they go back to what they were doing when it is out.
//
// Decided without the game's dice, like the spreading of fire, so nothing else in a match is disturbed.
import type { Building, Game, Unit } from './game';
import { famine } from './famine';
import { contagion } from './contagion';
import { wrath } from './wrath';

export const FIRE = {
  /** Seconds of fire one villager at work takes off each second, on top of its burning down by itself. */
  douse: 1.5,
  /** The most villagers who can usefully work on one fire. */
  hands: 5,
  /** Idle villagers this near a burning building of their own town (tiles, centre to centre) go to it unasked. */
  turnout: 9,
  /** `turnOut` calls villagers from this far, and this many to a fire. */
  call: 14, crew: 3,
  /** While a storm is heavy, a bolt falls about once in this many seconds. */
  storm: 45,
  /** The share of bolts that find a building. */
  struck: 0.4,
  /** Seconds a struck building burns (less in rain, which takes any fire two and a half times as fast). */
  bolt: 14,
  /** Buildings a bolt is three times as likely to find. */
  tall: ['tower', 'church', 'wonder'] as string[],
  /** A smithy at work catches from its own forge about once in this many seconds of work. */
  forge: 900,
  /** By night, one of a town's lived-in houses catches from its hearth about once in this many seconds of night, in a town of `hearths` such houses or more; a smaller town in proportion less often. */
  hearth: 400, hearths: 8,
  /** Accidents are this many times as likely in a dust storm, when everything is dry. In heavy rain there are none. */
  dry: 2,
  /** Seconds a building set alight by accident burns. */
  spark: 12,
};

/** A chance in [0, 1) from the tick, the match's seed and a number of its own, each one unrelated to the others. */
export const roll = (g: Game, salt: number): number => {
  let h = Math.imul(g.tick ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(g.seed + salt, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

const fit = (u: Unit): boolean => !u.dead && u.type === 'villager' && u.growT <= 0 && !u.inside;
const near = (u: Unit, b: Building): number => Math.hypot(u.x - b.x, u.y - b.y);
/** Is this villager already on their way to a fire, or at one? */
const atFire = (g: Game, u: Unit): boolean => {
  if (u.order?.t !== 'build') return false;
  const e = g.entities.get(u.order.id);
  return !!e && e.kind === 'building' && e.burnT > 0;
};
const tell = (g: Game, owner: number, text: string): void => {
  if (!g.players[owner] || g.players[owner].neutral) return;
  g.events.push({ t: 'msg', player: owner, text });
};

/** Villagers at work on this fire right now. */
export function fighting(g: Game, b: Building): number {
  return b.douseAt !== undefined && g.tick - b.douseAt <= 1 ? b.douseN ?? 0 : 0;
}

/** Villagers on their way to this fire or at it. */
export function sentTo(g: Game, b: Building): number {
  let n = 0;
  for (const u of g.units) if (fit(u) && u.order?.t === 'build' && u.order.id === b.id) n++;
  return n;
}

/**
 * One villager, standing at a burning building, beats at the fire for one tick. Called from the build order in
 * place of building or mending while the fire lasts. Returns false if there were hands enough already.
 */
export function douse(g: Game, b: Building): boolean {
  if (b.burnT <= 0) return false;
  if (b.douseAt !== g.tick) { b.douseAt = g.tick; b.douseN = 0; }
  if ((b.douseN ?? 0) >= FIRE.hands) return false;
  b.douseN = (b.douseN ?? 0) + 1;
  b.burnT = Math.max(0, b.burnT - FIRE.douse / 20); // a tick is a twentieth of a second
  if (b.burnT <= 0) tell(g, b.owner, `The fire at your ${b.def.name} is out.`);
  return true;
}

/** A bolt out of the storm. Returns the building it set alight, or null if it found none. */
export function lightning(g: Game, salt = 0): Building | null {
  if (roll(g, 11 + salt) >= FIRE.struck) return null;
  // Every standing building is a mark, weighed by its height and by how its people stand with heaven (wrath.ts).
  const marks: Building[] = [], weights: number[] = [];
  let all = 0;
  for (const b of g.buildings) {
    if (b.dead || b.def.wall || b.burnT > 0) continue;
    const w = (FIRE.tall.includes(b.type) ? 3 : 1) * wrath(g, b.owner);
    marks.push(b); weights.push(w); all += w;
  }
  if (!marks.length || all <= 0) return null;
  let at = roll(g, 23 + salt) * all, i = 0;
  while (i < marks.length - 1 && at >= weights[i]) at -= weights[i++];
  const b = marks[i];
  b.burnT = FIRE.bolt * wrath(g, b.owner);
  b.litAt = g.time;
  g.events.push({ t: 'fire', x: b.x, y: b.y });
  tell(g, b.owner, `⚡ Lightning has struck your ${b.def.name} and set it alight! Send villagers to fight the fire.`);
  return b;
}

/**
 * Fire by accident, once a second (as often and as long as the people's standing with heaven makes it: wrath.ts): a Blacksmith with work in hand may catch from its forge, and by night one of a
 * town's lived-in houses may catch from its hearth. Never in heavy rain, twice as often in a dust storm, and not
 * in a field battle, where there is no town. Returns the building set alight, or null.
 */
export function accident(g: Game): Building | null {
  if (g.field || g.foul === 'rain') return null;
  const k = g.foul === 'dust' ? FIRE.dry : 1;
  let lit: Building | null = null;
  const light = (b: Building, text: string): void => {
    b.burnT = FIRE.spark * wrath(g, b.owner);
    b.litAt = g.time;
    g.events.push({ t: 'fire', x: b.x, y: b.y });
    tell(g, b.owner, text);
    lit = b;
  };
  for (const b of g.buildings) {
    if (b.dead || !b.complete || b.burnT > 0 || b.type !== 'blacksmith' || !b.queue.length || g.players[b.owner]?.neutral !== false) continue;
    if (roll(g, 41 + b.id * 131) < (k * wrath(g, b.owner)) / FIRE.forge) light(b, '🔥 A spark from the forge has set your Blacksmith alight! Send villagers to fight the fire.');
  }
  if (g.night) for (const p of g.players) {
    if (p.neutral || p.defeated) continue;
    const homes = g.buildings.filter((b) => !b.dead && b.complete && b.owner === p.id && b.type === 'house' && b.burnT <= 0 && (b.residents.m || b.residents.f));
    // A hamlet of a house or two is seldom caught out: the chance grows with the hearths, up to FIRE.hearths of them.
    if (!homes.length || roll(g, 59 + p.id * 257) >= ((k * wrath(g, p.id)) / FIRE.hearth) * Math.min(1, homes.length / FIRE.hearths)) continue;
    const b = homes[Math.floor(roll(g, 71 + p.id * 263) * homes.length)];
    light(b, `🔥 A hearth fire has got out of hand: ${b.family ? `the ${b.family} house` : 'one of your houses'} is alight! Send villagers to fight the fire.`);
  }
  return lit;
}

/**
 * Call villagers off their work to the fires in a town that are short of hands: the nearest FIRE.crew to each,
 * from within FIRE.call tiles. They go back to their jobs when the fire is out. Returns how many were sent.
 */
export function turnOut(g: Game, owner: number, reach = FIRE.call, crew = FIRE.crew): number {
  let sent = 0;
  for (const b of g.buildings) {
    if (b.dead || b.owner !== owner || b.burnT <= 0 || b.hp >= b.maxHp) continue;
    let want = crew - sentTo(g, b);
    if (want <= 0) continue;
    const free = g.units
      .filter((u) => u.owner === owner && fit(u) && near(u, b) <= reach && !atFire(g, u))
      .sort((p, q) => near(p, b) - near(q, b) || p.id - q.id);
    for (const u of free) {
      if (want-- <= 0) break;
      g.cmdTarget(owner, [u.id], b.id);
      sent++;
    }
  }
  return sent;
}

/** Once a second: hunger (famine.ts), plague crossing between peoples (contagion.ts), fire by accident, lightning while a storm is heavy, and idle villagers turning out to fires near them. */
export function calamity(g: Game): void {
  famine(g);
  contagion(g);
  accident(g);
  if ((g.foul === 'rain' || g.foul === 'dust') && roll(g, 3) < 1 / FIRE.storm) lightning(g);
  for (const b of g.buildings) {
    if (b.dead || b.burnT <= 0 || b.hp >= b.maxHp || g.players[b.owner]?.neutral) continue;
    let room = FIRE.hands - sentTo(g, b);
    if (room <= 0) continue;
    for (const u of g.units) {
      if (room <= 0) break;
      if (u.owner !== b.owner || u.order || !fit(u) || near(u, b) > FIRE.turnout) continue;
      g.cmdTarget(b.owner, [u.id], b.id);
      room--;
    }
  }
}
