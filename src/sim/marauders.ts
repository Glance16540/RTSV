// The marauders over a long battle: they keep pace with the age, and a burnt camp is not the end of them.
//
// Strength. The band arms itself as the times do. For every age the most advanced people standing has reached,
// a marauder has 30% more health and strikes 25% harder than in the Stone Age, and the camp's stockade is 30%
// stronger. Men already in the band are brought up to it when the age turns, keeping the wounds they have.
//
// Coming back. Burning the camp frees everyone held, as before; but if any of the band are alive when it falls,
// they make camp again five minutes later, as far from every town as the land allows, and fresh men join them
// there, and not where the last one stood. Hunt down every last one before then and the band is finished for the rest of the battle.
//
// The last part is for whoever plays a town: `partyNear` and `womenAtRisk` say when a party is coming and who
// it could take, `hideWomen` sends those women indoors, and `scoutSpots` lists where the camp could be.
import type { Building, Game, Unit } from './game';

/** More health for a marauder, and for the camp's stockade, per age of the most advanced people. */
export const MARAUDER_HP = 0.3;
/** Harder blows per age. */
export const MARAUDER_ATK = 0.25;
/** Seconds after a camp is burnt before the survivors make another. */
export const LAIR_AGAIN = 300;
/** The new camp is made at least this far from the ashes of the last, if the land allows it within half a minute. */
export const LAIR_AWAY = 20;
/** How near a party must come to a town's buildings before its women should be got indoors. */
export const PARTY_NEAR = 16;

/** What the rule keeps on the game (and in a saved game). */
export interface BandState {
  /** Camps the band has made so far. */
  camps: number;
  /** When the last camp was burnt with some of the band still alive. Not set while a camp stands. */
  burnt?: number;
  /** Where the camp stands, or stood when it was burnt. */
  at?: { x: number; y: number };
  /** Every one of them was killed with no camp standing: they do not come back. */
  over?: boolean;
}

/** The age the band arms itself to: that of the most advanced people still standing. */
export function bandAge(g: Game): number {
  let age = 0;
  for (const p of g.players) if (!p.neutral && !p.defeated && p.id !== g.wild) age = Math.max(age, p.age);
  return age;
}
/** How much harder a unit strikes for being a marauder in this age: 1 for anyone else. */
export const marauderEdge = (g: Game, u: Unit): number => (u.def.marauder ? 1 + MARAUDER_ATK * bandAge(g) : 1);

const band = (g: Game): Unit[] => g.units.filter((u) => u.def.marauder && !u.dead);
const raise = (e: { hp: number; maxHp: number }, base: number, age: number): void => {
  const want = Math.round(base * (1 + MARAUDER_HP * age));
  if (e.maxHp >= want) return; // never weakened: an age is not lost
  e.hp = Math.max(1, Math.round(e.hp * want / e.maxHp));
  e.maxHp = want;
};
const tell = (g: Game, text: string): void => { for (const p of g.players) if (!p.neutral && !p.defeated && p.id !== g.wild) g.events.push({ t: 'msg', player: p.id, text }); };

/** Once a second while a camp stands: bring the band and its stockade up to the age, and note that the camp is there. */
export function tendBand(g: Game, lair: Building): void {
  if (!g.band || g.band.burnt !== undefined) g.band = { camps: (g.band?.camps ?? 0) + 1 };
  g.band.at = { x: lair.x, y: lair.y };
  const age = bandAge(g);
  if (!age) return;
  raise(lair, lair.def.hp, age);
  for (const u of band(g)) raise(u, u.def.hp, age);
}

/**
 * Once a second while no camp stands after one was made: whether the band makes camp again now. The first time it
 * is asked after a burning it tells every people how things stand.
 */
export function bandReturns(g: Game): boolean {
  const s = g.band;
  if (!s || s.over) return false; // never had a camp, or finished
  const left = band(g).length;
  if (!left) {
    s.over = true; s.burnt = undefined;
    tell(g, '🏴 The last of the marauders is dead. The band is finished.');
    return false;
  }
  if (s.burnt === undefined) {
    s.burnt = g.time;
    tell(g, `🏴 The marauders' camp is burnt, but ${left} of the band ${left === 1 ? 'is' : 'are'} still alive. Hunt them down, or they will make camp again.`);
  }
  return g.time - s.burnt >= LAIR_AGAIN;
}

/**
 * Whether a site is too near the ashes of the camp just burnt for the band to settle there. Only for the first
 * half minute it is looking: on a map with nowhere else to go, it goes back to the old ground.
 */
export function nearAshes(g: Game, cx: number, cy: number): boolean {
  const s = g.band;
  if (!s?.at || s.burnt === undefined || g.time - s.burnt > LAIR_AGAIN + 30) return false;
  return Math.hypot(s.at.x - cx - 1.5, s.at.y - cy - 1.5) < LAIR_AWAY;
}

// ---- For whoever plays a town ----

/** The marauders out after this town's women, or leading them away, within PARTY_NEAR tiles of one of its buildings. */
export function partyNear(g: Game, owner: number): Unit[] {
  const mine = g.buildings.filter((b) => b.owner === owner);
  return band(g).filter((u) => {
    const after = u.order?.t === 'capture' ? g.units.find((v) => v.id === (u.order as { id: number }).id) : null;
    if (!(after && after.owner === owner) && !(u.captive && u.captive.from === owner)) return false;
    return mine.some((b) => Math.hypot(b.x - u.x, b.y - u.y) <= PARTY_NEAR);
  });
}

/** The grown women of this town who are out of doors, and so could be carried off. */
export const womenAtRisk = (g: Game, owner: number): Unit[] =>
  g.units.filter((v) => v.owner === owner && v.type === 'villager' && v.gender === 'f' && v.growT <= 0 && !v.inside && !v.dead);

/**
 * When a party is near, sends this town's women into the nearest Town Center or tower of theirs with room, by the
 * same order a player gives. Returns how many were sent. Does nothing when no party is near. They come out again
 * when the town's bell is rung off (`g.cmdBell(owner, false)`), which is for the caller to do once `partyNear` is empty.
 */
export function hideWomen(g: Game, owner: number): number {
  if (!partyNear(g, owner).length) return 0;
  const roofs = g.buildings.filter((b) => b.owner === owner && b.complete && !b.dead && !!b.def.shelter);
  const room = new Map(roofs.map((b) => [b.id, b.def.shelter! - b.sheltered.length]));
  for (const u of g.units) if (u.owner === owner && u.order?.t === 'shelter') room.set(u.order.id, (room.get(u.order.id) ?? 0) - 1);
  let sent = 0;
  for (const w of womenAtRisk(g, owner)) {
    if (w.order?.t === 'shelter') continue;
    const roof = roofs.filter((b) => room.get(b.id)! > 0).sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y))[0];
    if (!roof) break;
    if (!g.cmdShelter(owner, [w.id], roof.id)) continue;
    room.set(roof.id, room.get(roof.id)! - 1);
    sent++;
  }
  return sent;
}

/**
 * Where the camp could be, for a town that has not found it: open ground at least 18 tiles from every town's
 * start, farthest from them first, a few spread across the map. Empty once the camp has been seen by this town
 * (it should march, not look) or when there are no marauders in this battle.
 */
export function scoutSpots(g: Game, owner: number, n = 4): { x: number; y: number }[] {
  if (!g.marauders || g.band?.over) return [];
  const lair = g.buildings.find((b) => b.type === 'lair');
  if (lair && g.units.some((u) => u.owner === owner && Math.hypot(u.x - lair.x, u.y - lair.y) <= u.def.sight)) return [];
  const spots: { x: number; y: number; d: number }[] = [];
  for (let cy = 4; cy < g.size - 7; cy += 3) for (let cx = 4; cx < g.size - 7; cx += 3) {
    if (!g.canPlace('lair', cx, cy) || nearAshes(g, cx, cy)) continue;
    let d = Infinity;
    for (const st of g.spec.starts) d = Math.min(d, Math.hypot(st.x - cx - 1.5, st.y - cy - 1.5));
    if (d >= 18) spots.push({ x: cx + 1.5, y: cy + 1.5, d });
  }
  spots.sort((a, b) => b.d - a.d);
  const out: { x: number; y: number }[] = [];
  for (const s of spots) {
    if (out.length >= n) break;
    if (out.every((o) => Math.hypot(o.x - s.x, o.y - s.y) >= 14)) out.push({ x: s.x, y: s.y });
  }
  return out;
}
