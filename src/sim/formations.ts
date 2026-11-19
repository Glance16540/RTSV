// A group of soldiers set in an order (docs/systems-board, "War": there were no formations; a group sent somewhere
// stood wherever its paths ended, in a square).
//
// A selected group can be set in a line, a column or a loose order (game.ts cmdFormation). Each of its men keeps it
// (Unit `form`) until it is changed. When the group is sent somewhere, every man is given his own place in the
// order, laid out facing the way the group is going (from where it stands to where it is sent), and they march at
// the pace of the slowest of them, so that an order formed goes as one; on arriving each man turns to face that way.
//   - line: two ranks deep (one for a handful), as wide as it needs, shoulder to shoulder: the most men at the front;
//   - column: two abreast, as deep as it needs: narrow, for roads and gaps;
//   - loose: spread wide with room between, so a volley, a charge or a plague takes fewer.
// The computer sets its army in a line before it goes out to attack (ai.ts).
// A group with no order is sent as before: in a square about the point.

export type Formation = 'line' | 'column' | 'loose';
export const FORMATIONS: Formation[] = ['line', 'column', 'loose'];

/** Room between men in an order, in tiles: shoulder to shoulder, rank to rank, and in a loose order. */
export const FORM = { gap: 0.85, rank: 0.95, loose: 1.7 };

/** The words for each order, for the buttons. */
export const FORM_WORDS: Record<Formation, { name: string; desc: string }> = {
  line: { name: 'Line', desc: 'Two ranks, shoulder to shoulder: the most men at the front.' },
  column: { name: 'Column', desc: 'Two abreast and deep: narrow, for roads, gates and gaps.' },
  loose: { name: 'Loose order', desc: 'Spread wide with room between, so arrows, a charge or a plague find fewer.' },
};

/**
 * The places of `n` men in an order about a point, facing `facing` (radians, as a unit faces: 0 is +y): each place
 * is [across, along] turned to the facing, as offsets in the map's x and y. The first places are the front rank,
 * from the middle out.
 */
export function slots(n: number, kind: Formation, facing: number): [number, number][] {
  const fx = Math.sin(facing), fy = Math.cos(facing), rx = Math.cos(facing), ry = -Math.sin(facing);
  const ranks = kind === 'line' ? (n > 5 ? 2 : 1) : kind === 'column' ? Math.ceil(n / 2) : Math.ceil(Math.sqrt(n));
  const wide = Math.ceil(n / ranks), gap = kind === 'loose' ? FORM.loose : FORM.gap, deep = kind === 'loose' ? FORM.loose : FORM.rank;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const rank = Math.floor(i / wide), file = i % wide, inRank = Math.min(wide, n - rank * wide);
    // From the middle of the rank outward, and a loose order's men off the straight a little, each his own way.
    const across = (file - (inRank - 1) / 2) * gap + (kind === 'loose' ? ((i * 37) % 7 - 3) * 0.06 : 0);
    const along = -(rank - (ranks - 1) / 2) * deep + (kind === 'loose' ? ((i * 53) % 5 - 2) * 0.08 : 0);
    out.push([rx * across + fx * along, ry * across + fy * along]);
  }
  return out;
}

/** The order a group keeps: the one most of its men are set in, if most are. */
export function formOf(us: readonly { form?: Formation }[]): Formation | null {
  const n: Partial<Record<Formation, number>> = {};
  for (const u of us) if (u.form) n[u.form] = (n[u.form] ?? 0) + 1;
  const best = FORMATIONS.reduce<Formation | null>((b, k) => ((n[k] ?? 0) > (b ? n[b] ?? 0 : 0) ? k : b), null);
  return best && (n[best] ?? 0) * 2 > us.length ? best : null;
}

interface Man { x: number; y: number; form?: Formation; def: { speed: number } }

/**
 * A group sent to (x, y) in its order: each man's place, the pace they keep (the slowest's), and the way they face
 * when they get there (the way from where they stand to the point, unless `facing` is given). Null for a group with no
 * order, or a single man.
 */
export function formationPlan(us: readonly Man[], x: number, y: number, facing?: number): { places: [number, number][]; pace: number; face: number } | null {
  const kind = formOf(us);
  if (!kind || us.length < 2) return null;
  const cx = us.reduce((a, u) => a + u.x, 0) / us.length, cy = us.reduce((a, u) => a + u.y, 0) / us.length;
  const face = facing ?? (Math.hypot(x - cx, y - cy) > 0.5 ? Math.atan2(x - cx, y - cy) : 0);
  const off = slots(us.length, kind, face);
  // Each man to the nearest place still free, the front first: the men nearest the front take it.
  const free = off.map((o, i) => ({ i, at: [x + o[0], y + o[1]] as [number, number] }));
  const places: [number, number][] = new Array(us.length);
  const order = us.map((u, i) => ({ u, i })).sort((a, b) => Math.hypot(b.u.x - x, b.u.y - y) - Math.hypot(a.u.x - x, a.u.y - y));
  for (const { u, i } of order.reverse()) {
    let best = 0, bd = Infinity;
    free.forEach((f, k) => { const d = Math.hypot(f.at[0] - u.x, f.at[1] - u.y); if (d < bd) { bd = d; best = k; } });
    places[i] = free.splice(best, 1)[0].at;
  }
  return { places, pace: Math.min(...us.map((u) => u.def.speed)), face };
}
