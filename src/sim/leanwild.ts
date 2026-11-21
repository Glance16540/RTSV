// A lean season for a town that lives by hunting, fishing or its herds (docs/DESIGN.md, "Acts of God": famine and the like
// come at random and spare nobody; docs/CLOSING.md: "A failed harvest strikes only fields").
//
// In a town a harvest fails by chance on its fields (famine.ts leanYear). A people with no field of its own, living off
// the game it hunts, the fish of its waters and the beasts it keeps, was never struck: nothing of theirs could fail. Now
// it can. By the same chance and the same measure of the people's creed (wrath.ts) as a failed harvest, a town with no
// farm standing has a lean season: the game is thin, the fish have gone from the water, the herds sicken. For
// FAMINE.barren seconds (by the creed's measure, as the barren fields lie) its hunters, fishers and herders bring in
// LEAN_WILD.pace of what they would (`wildPace`, game.ts gathering). Crop Rotation does nothing for it: it is no crop.
// Not before FAMINE.lean seconds have passed, so that a town is not struck before it could have sown. A town with any
// farm standing is the fields' to fail, as before. Nobody is harmed by it but through hunger.
import type { Game } from './game';
import { FAMINE } from './famine';
import { roll, wrath } from './wrath';

export const LEAN_WILD = {
  /** What a hunter, a fisher or a herder brings in during a lean season, as a share. */
  pace: 0.5,
};

declare module './game' {
  interface Player { /** Seconds left of a lean season for its hunters, fishers and herders (leanwild.ts). */ leanT?: number }
}

/** The kinds of food that are not fields': the game hunted and the beasts kept (a carcass), fish, and berries gathered wild. */
const WILD = new Set(['carcass', 'fish', 'berries']);

/** One second of it, for every people: a lean season may begin for a town with no farm, and one under way runs down. Returns who was struck. */
export function leanWild(g: Game): number[] {
  const struck: number[] = [];
  if (g.field) return struck;
  for (const p of g.players) {
    if (p.neutral || p.defeated) continue;
    if (p.leanT) { p.leanT = Math.max(0, p.leanT - 1); continue; }
    if (g.foul === 'rain' || g.time < FAMINE.lean) continue; // not in a town's first stretch, before any people has had time to sow
    const k = g.foul === 'dust' ? FAMINE.drought : 1, w = wrath(g, p.id);
    if (roll(g, 131 + p.id * 401) >= (k * w) / FAMINE.lean) continue;
    if (g.buildings.some((b) => !b.dead && b.owner === p.id && b.type === 'farm' && b.complete)) continue; // fields: their harvest is the one that fails
    if (!g.buildings.some((b) => !b.dead && b.owner === p.id && b.type === 'towncenter')) continue; // a war band that has not settled lives off the land
    p.leanT = Math.round(FAMINE.barren * w);
    struck.push(p.id);
    g.events.push({ t: 'msg', player: p.id, text: `🦌 A lean season: the game is thin, the fish have gone from the water and the herds sicken. For ${Math.round(p.leanT / 10) * 10} seconds your hunters and fishers bring in half as much. Lay in food, or sow a field.` });
  }
  return struck;
}

/** How much a gatherer of this kind brings in for this people now: LEAN_WILD.pace in a lean season for the wild kinds, else 1. */
export const wildPace = (g: Game, owner: number, kind: string): number => ((g.players[owner]?.leanT ?? 0) > 0 && WILD.has(kind) ? LEAN_WILD.pace : 1);
