// 광장 길찾기: 탭·클릭한 곳까지 나무·건물을 비켜 가는 길을 찾는다.
// 광장을 작은 칸(CELL)으로 나누고, 부딪히는 영역(발 상자 크기만큼 넓힌 것)에 걸리는 칸은 막힌 칸으로 둔다.
// A*로 칸 경로를 찾은 뒤, 서로 곧장 갈 수 있는 점은 건너뛰어 꺾이는 곳만 남긴다.

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

const CELL = 16;

export class WalkGrid {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;

  /** pad = 발 상자 반 폭·반 높이 (+ 여유). 그만큼 장애물을 넓혀서 칸 가운데만 지나가도 부딪히지 않게 한다 */
  constructor(width: number, height: number, solids: Rect[], pad: { x: number; y: number }) {
    this.cols = Math.ceil(width / CELL);
    this.rows = Math.ceil(height / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (const r of solids) {
      const x0 = Math.max(0, Math.floor((r.x - pad.x) / CELL));
      const x1 = Math.min(this.cols - 1, Math.floor((r.x + r.w + pad.x) / CELL));
      const y0 = Math.max(0, Math.floor((r.y - pad.y) / CELL));
      const y1 = Math.min(this.rows - 1, Math.floor((r.y + r.h + pad.y) / CELL));
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) this.blocked[cy * this.cols + cx] = 1;
    }
    // 광장 가장자리 칸도 막는다 (발 상자가 세상 밖으로 나가지 않게)
    for (let cx = 0; cx < this.cols; cx++) this.blocked[cx] = this.blocked[(this.rows - 1) * this.cols + cx] = 1;
    for (let cy = 0; cy < this.rows; cy++) this.blocked[cy * this.cols] = this.blocked[cy * this.cols + this.cols - 1] = 1;
  }

  cellOf(p: Point) {
    return { cx: Math.min(this.cols - 1, Math.max(0, Math.floor(p.x / CELL))), cy: Math.min(this.rows - 1, Math.max(0, Math.floor(p.y / CELL))) };
  }

  center(cx: number, cy: number): Point {
    return { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
  }

  isFree(cx: number, cy: number) {
    return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows && !this.blocked[cy * this.cols + cx];
  }

  /** 막힌 칸이면 가장 가까운 빈 칸 (건물 그림을 눌렀을 때 그 앞까지 가게) */
  nearestFree(cx: number, cy: number) {
    if (this.isFree(cx, cy)) return { cx, cy };
    for (let r = 1; r < Math.max(this.cols, this.rows); r++) {
      let best: { cx: number; cy: number; d: number } | null = null;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !this.isFree(cx + dx, cy + dy)) continue;
          const d = dx * dx + dy * dy;
          if (!best || d < best.d) best = { cx: cx + dx, cy: cy + dy, d };
        }
      if (best) return { cx: best.cx, cy: best.cy };
    }
    return null;
  }

  /** 두 점 사이 직선이 막힌 칸을 지나지 않는지 (칸 크기의 절반 간격으로 확인) */
  lineFree(a: Point, b: Point) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / (CELL / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const { cx, cy } = this.cellOf({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      if (!this.isFree(cx, cy)) return false;
    }
    return true;
  }
}

/** 작은 이진 힙 (A* 열린 목록) */
class Heap {
  private items: { i: number; f: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(i: number, f: number) {
    const a = this.items;
    a.push({ i, f });
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (a[p].f <= a[k].f) break;
      [a[p], a[k]] = [a[k], a[p]];
      k = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        k = m;
      }
    }
    return top.i;
  }
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
] as const;

/**
 * from → to 경로 (지나갈 점 목록, 마지막이 도착점). 갈 수 없으면 null.
 * 도착점이 막힌 곳이면 가장 가까운 빈 곳까지 간다.
 */
export function findPath(grid: WalkGrid, from: Point, to: Point): Point[] | null {
  const s0 = grid.cellOf(from);
  const start = grid.nearestFree(s0.cx, s0.cy);
  const t0 = grid.cellOf(to);
  const goal = grid.nearestFree(t0.cx, t0.cy);
  if (!start || !goal) return null;
  const goalPoint = grid.isFree(t0.cx, t0.cy) ? to : grid.center(goal.cx, goal.cy);
  if (grid.lineFree(from, goalPoint)) return [goalPoint];

  const { cols } = grid;
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const startI = idx(start.cx, start.cy);
  const goalI = idx(goal.cx, goal.cy);
  const g = new Float32Array(cols * grid.rows).fill(Infinity);
  const came = new Int32Array(cols * grid.rows).fill(-1);
  const closed = new Uint8Array(cols * grid.rows);
  const h = (i: number) => {
    const dx = Math.abs((i % cols) - goal.cx), dy = Math.abs(Math.floor(i / cols) - goal.cy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const open = new Heap();
  g[startI] = 0;
  open.push(startI, h(startI));
  let found = false;
  while (open.size) {
    const cur = open.pop();
    if (cur === goalI) {
      found = true;
      break;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % cols, cy = Math.floor(cur / cols);
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!grid.isFree(nx, ny)) continue;
      // 대각선은 양옆 칸이 모두 비어 있을 때만 (모서리를 깎지 않게)
      if (dx && dy && (!grid.isFree(cx + dx, cy) || !grid.isFree(cx, cy + dy))) continue;
      const ni = idx(nx, ny);
      const ng = g[cur] + cost;
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        open.push(ni, ng + h(ni));
      }
    }
  }
  if (!found) return null;

  const cells: Point[] = [];
  for (let i = goalI; i !== -1 && i !== startI; i = came[i]) cells.push(grid.center(i % cols, Math.floor(i / cols)));
  cells.reverse();
  cells[cells.length - 1] = goalPoint;

  // 곧장 갈 수 있는 점은 건너뛴다 (꺾이는 곳만 남김)
  const path: Point[] = [];
  let anchor = from;
  for (let i = 0; i < cells.length; i++) {
    const next = cells[i + 1];
    if (!next || !grid.lineFree(anchor, next)) {
      path.push(cells[i]);
      anchor = cells[i];
    }
  }
  return path;
}
