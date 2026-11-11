// Grid A* with rectangle goals and line-of-sight smoothing.

const SQRT2 = Math.SQRT2;
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
] as const;

export function rectDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = Math.max(x0 - px, 0, px - x1);
  const dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy);
}

export class Pathfinder {
  private g: Float32Array;
  private f: Float32Array;
  private from: Int32Array;
  private stamp: Uint32Array; // open/closed marks, versioned to avoid clearing
  private closed: Uint32Array;
  private version = 0;
  private heap: number[] = [];

  /**
   * Whose units are being routed. Cells hold 0 (open), 1 (solid) or 2 + owner id (a gate,
   * open only to that owner).
   */
  pass = 0;

  constructor(public n: number, public blocked: Uint8Array) {
    const size = n * n;
    this.g = new Float32Array(size);
    this.f = new Float32Array(size);
    this.from = new Int32Array(size);
    this.stamp = new Uint32Array(size);
    this.closed = new Uint32Array(size);
  }

  isBlocked(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.n || cy >= this.n) return true;
    const v = this.blocked[cy * this.n + cx];
    return v !== 0 && v !== this.pass;
  }

  /** Nearest walkable cell to a point (spiral search). */
  nearestFree(x: number, y: number): { x: number; y: number } {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (!this.isBlocked(cx, cy)) return { x, y };
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let r = 1; r < this.n; r++) {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.isBlocked(cx + dx, cy + dy)) continue;
          const d = Math.hypot(cx + dx + 0.5 - x, cy + dy + 0.5 - y);
          if (d < bestD) { bestD = d; best = { x: cx + dx + 0.5, y: cy + dy + 0.5 }; }
        }
      if (best) return best;
    }
    return { x, y };
  }

  /**
   * Path from (sx,sy) to any walkable cell whose centre is within `reach` of the
   * target rectangle. Returns flat [x0,y0,x1,y1,...] waypoints. If the goal is
   * unreachable the path leads to the closest reachable cell and `partial` is set.
   */
  find(sx: number, sy: number, x0: number, y0: number, x1: number, y1: number, reach: number): { path: number[]; partial: boolean } {
    const n = this.n;
    const scx = Math.min(n - 1, Math.max(0, Math.floor(sx)));
    const scy = Math.min(n - 1, Math.max(0, Math.floor(sy)));
    const start = scy * n + scx;
    const v = ++this.version;
    const { g, f, from, stamp, closed, heap, blocked } = this;
    heap.length = 0;
    const pass = this.pass;
    const solid = (c: number) => blocked[c] !== 0 && blocked[c] !== pass;
    const h = (c: number) => rectDist((c % n) + 0.5, ((c / n) | 0) + 0.5, x0, y0, x1, y1);

    g[start] = 0;
    f[start] = h(start);
    from[start] = -1;
    stamp[start] = v;
    this.push(start);
    let best = start, bestH = f[start];
    let goal = -1;

    while (heap.length) {
      const c = this.pop();
      if (closed[c] === v) continue;
      closed[c] = v;
      const hc = f[c] - g[c];
      if (hc < bestH) { bestH = hc; best = c; }
      if (hc <= reach && !solid(c)) { goal = c; break; }
      const cx = c % n, cy = (c / n) | 0;
      for (let k = 0; k < 8; k++) {
        const dx = DIRS[k][0], dy = DIRS[k][1];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const ni = ny * n + nx;
        if (solid(ni) || closed[ni] === v) continue;
        if (k >= 4 && (solid(cy * n + nx) || solid(ny * n + cx))) continue;
        const ng = g[c] + DIRS[k][2];
        if (stamp[ni] === v && ng >= g[ni]) continue;
        stamp[ni] = v;
        g[ni] = ng;
        f[ni] = ng + h(ni);
        from[ni] = c;
        this.push(ni);
      }
    }

    const end = goal >= 0 ? goal : best;
    const cells: number[] = [];
    for (let c = end; c !== start && c >= 0; c = from[c]) cells.push(c);
    cells.reverse();
    const pts: number[] = [];
    for (const c of cells) pts.push((c % n) + 0.5, ((c / n) | 0) + 0.5);
    // Already in the goal cell: step to its centre, which is what `reach` was measured from.
    if (goal === start) return { path: [scx + 0.5, scy + 0.5], partial: false };
    return { path: this.smooth(sx, sy, pts), partial: goal < 0 };
  }

  /** True if a unit can walk the straight segment without touching blocked cells. */
  lineClear(ax: number, ay: number, bx: number, by: number): boolean {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return true;
    const nx = (-dy / len) * 0.3, ny = (dx / len) * 0.3;
    const steps = Math.ceil(len / 0.25);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + dx * t, y = ay + dy * t;
      if (this.isBlocked(Math.floor(x), Math.floor(y))) return false;
      if (this.isBlocked(Math.floor(x + nx), Math.floor(y + ny))) return false;
      if (this.isBlocked(Math.floor(x - nx), Math.floor(y - ny))) return false;
    }
    return true;
  }

  private smooth(sx: number, sy: number, pts: number[]): number[] {
    if (pts.length <= 2) return pts;
    const out: number[] = [];
    let ax = sx, ay = sy;
    let i = 0;
    const count = pts.length / 2;
    // If the unit starts inside a blocked cell, do not smooth the first step out of it.
    if (this.isBlocked(Math.floor(sx), Math.floor(sy))) {
      out.push(pts[0], pts[1]);
      ax = pts[0]; ay = pts[1];
      i = 1;
    }
    while (i < count) {
      let j = Math.min(count - 1, i + 24);
      while (j > i && !this.lineClear(ax, ay, pts[j * 2], pts[j * 2 + 1])) j--;
      out.push(pts[j * 2], pts[j * 2 + 1]);
      ax = pts[j * 2]; ay = pts[j * 2 + 1];
      i = j + 1;
    }
    return out;
  }

  private push(c: number): void {
    const { heap, f } = this;
    let i = heap.length;
    heap.push(c);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[heap[p]] <= f[c]) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = c;
  }

  private pop(): number {
    const { heap, f } = this;
    const top = heap[0];
    const last = heap.pop()!;
    const len = heap.length;
    if (len > 0) {
      let i = 0;
      for (;;) {
        let k = i * 2 + 1;
        if (k >= len) break;
        if (k + 1 < len && f[heap[k + 1]] < f[heap[k]]) k++;
        if (f[last] <= f[heap[k]]) break;
        heap[i] = heap[k];
        i = k;
      }
      heap[i] = last;
    }
    return top;
  }
}
