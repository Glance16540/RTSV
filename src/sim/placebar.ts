// Why a building cannot be placed on a spot (docs/DESIGN.md, the board's "Town and economy": buildings need nearly level
// ground, and nothing told the player why a spot was refused). The same tests as Game.canPlace, in the same order, each
// with its reason in words, so that the cursor can say it and an order refused can be told why:
//   - the map's edge; ground the player has never seen;
//   - water, bare rock, a building standing there (named), or trees, stone, gold or a bush in the way (named);
//   - ground too uneven for it (it needs nearly level ground: a rise of 0.4 at most under a building of more than a tile);
//   - a dock with no water beside it.
// Reads the game and changes nothing.
import type { Game } from './game';
import { BUILDINGS } from './data';
import { T_ROCK, T_WATER } from './map';

const NODE_WORDS: Record<string, string> = { tree: 'Trees are in the way', berries: 'A berry bush is in the way', gold: 'A gold seam is in the way', stone: 'A stone outcrop is in the way', carcass: 'A carcass is in the way', fish: 'Fish are in the way' };

/** The rise the ground under a building may have: nearly level under one of more than a tile (Game.tooSteep). */
export const LEVEL = { big: 0.4, small: 0.6 };

/** Why a building of this type cannot be placed with its corner at (cx, cy), or '' where it can. As Game.canPlace. */
export function placeBar(g: Game, type: string, cx: number, cy: number, forHuman = false): string {
  const def = BUILDINGS[type];
  if (!def) return 'There is no such building.';
  const s = def.size, N = g.size;
  if (cx < 1 || cy < 1 || cx + s > N - 1 || cy + s > N - 1) return 'Too near the edge of the land.';
  if (g.relief) {
    let lo = Infinity, hi = -Infinity;
    for (let y = cy; y < cy + s; y++) for (let x = cx; x < cx + s; x++) { const h = g.spec.height[y * N + x]; lo = Math.min(lo, h); hi = Math.max(hi, h); }
    if (hi - lo > (s > 1 ? LEVEL.big : LEVEL.small)) return 'Too steep: a building needs nearly level ground.';
  }
  for (let y = cy; y < cy + s; y++)
    for (let x = cx; x < cx + s; x++) {
      const i = y * N + x;
      if (g.occupied[i]) {
        if (g.terrain[i] === T_WATER) return 'Water: it cannot be built on.';
        if (g.terrain[i] === T_ROCK) return 'Bare rock: it cannot be built on.';
        const b = g.buildings.find((o) => !o.dead && x >= o.cx && x < o.cx + o.size && y >= o.cy && y < o.cy + o.size);
        if (b) return `${b.owner === g.humanId ? 'Your' : 'A'} ${b.def.name.toLowerCase()} stands there.`;
        const r = g.resources.find((o) => !o.dead && x >= o.cx && x < o.cx + o.size && y >= o.cy && y < o.cy + o.size);
        if (r) return `${NODE_WORDS[r.type] ?? 'Something is in the way'}.`;
        return 'Something is in the way.';
      }
      if (forHuman && g.vis[i] === 0) return 'You have not seen this ground.';
    }
  if (type === 'dock') {
    let shore = false;
    for (let y = cy - 1; y <= cy + s && !shore; y++)
      for (let x = cx - 1; x <= cx + s; x++) if ((x < cx || x >= cx + s) !== (y < cy || y >= cy + s) && g.terrain[y * N + x] === T_WATER) { shore = true; break; }
    if (!shore) return 'A dock must stand beside water.';
  }
  return '';
}
