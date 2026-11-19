// A besieger thrown back from the walls falls back with what it has left (docs/systems-board, "War": an army that
// attacked in person and was beaten was struck from the map whole, however many of its men lived).
//
// A battle settled on the map already left a beaten attacker what the fight left it (mapbattle.ts leftWith). One
// fought in person did not: the battle handed back only the player's survivors, and a repulsed attacker of either
// side was lost to the last man. Now the field hands back both sides' survivors (main.ts `foes`), and an attacker
// thrown back keeps, company by company, the companies whose men lived (a company is as many companies as its men
// still make up, counting men who fought with the better weapons of a later age); the rest are its dead, counted
// to their towns as every army's are (armytown.ts reckonArmies). It falls back to its own land: the one it marched
// from, or, if that is no longer its people's, the nearest of theirs next door with no army in it; or, where its own
// land holds another army of its people, it joins that one as far as there is room. With nothing left, or nowhere of
// its own to go, it is gone.
import type { Army, Campaign } from './campaign';
import { COMPANIES, MAX_ARMY, armyAt, armySize } from './campaignbase';
import { TECHS } from './data';
import { armiesJoined, reckonArmies } from './armytown';

/** The companies of an army that a battle in person left alive: by kind, never more than it had. */
export function companiesLeft(had: Record<string, number>, survivors: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [type, n] of Object.entries(had)) {
    const def = COMPANIES[type];
    if (!def || n <= 0) continue;
    const [unit, per] = Object.entries(def.units)[0];
    // In a later age the company fought with better weapons: count those too.
    let alive = 0;
    for (let u: string | undefined = unit; u; u = Object.values(TECHS).find((t) => t.upgrade?.[0] === u)?.upgrade![1]) alive += survivors[u] ?? 0;
    const left = Math.min(n, Math.ceil(alive / Math.max(1, per)));
    if (left > 0) out[type] = left;
  }
  return out;
}

/**
 * A besieger thrown back: it keeps what lived and falls back to its own land, with its leader if they lived (`leaderLived`). False if it is gone (nothing left, or
 * no land of its own to fall back to): it is for the hub to strike it from the map.
 */
export function beatenBack(c: Campaign, a: Army, survivors: Record<string, number> | undefined, from: number, leaderLived = true): boolean {
  if (!survivors) return false;
  const left = companiesLeft(a.units, survivors);
  if (!Object.keys(left).length) return false;
  // A leader who fell on the field is lost, as with an army struck from the map; one who lived comes back with it.
  if (a.hero && !leaderLived) { a.hero = false; c.factions[a.owner].heroAlive = false; c.factions[a.owner].heroRank = Math.max(0, (c.factions[a.owner].heroRank ?? 0) - 1); }
  a.units = left;
  a.moved = true;
  const home = c.territories[from];
  if (home && home.owner === a.owner && !home.horde && (!armyAt(c, from) || armyAt(c, from) === a)) { a.at = from; return true; }
  const near = (home?.adj ?? []).map((id) => c.territories[id]).find((t) => t.owner === a.owner && !t.horde && !armyAt(c, t.id));
  if (near) { a.at = near.id; return true; }
  // Its own land is held by another army of its people: it joins that one, company for company, as far as there is room.
  const other = home && home.owner === a.owner ? armyAt(c, from) : undefined;
  if (!other || other === a || other.owner !== a.owner) return false;
  reckonArmies(c); // those it lost are counted before its men are shared out
  const KINDS = Object.keys(a.units);
  for (const k of KINDS) while ((a.units[k] ?? 0) > 0 && armySize(other) < MAX_ARMY) { a.units[k]--; other.units[k] = (other.units[k] ?? 0) + 1; }
  for (const k of Object.keys(a.units)) delete a.units[k];
  if (a.hero) { other.hero = true; a.hero = false; }
  other.vet = Math.max(other.vet, a.vet);
  armiesJoined(c, a, other);
  return false;
}
