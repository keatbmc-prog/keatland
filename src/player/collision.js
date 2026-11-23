// Minimal, robust spatial collision for a walking player:
//   grounds   : analytic height providers fn(x,z) -> height | null (null = no floor here)
//   obstacles : vertical cylinders {x, z, r} (pillars, stones, creatures - dynamic ones update)
//   walls     : vertical slabs along a segment {x1, z1, x2, z2, r} (r = half thickness), for rooms
// Any obstacle or wall with `off: true` is ignored (doors that open, walls that appear).
// Walking off any edge into the void is prevented; small steps are climbed automatically.
export class CollisionWorld {
  constructor() { this.grounds = []; this.obstacles = []; this.dynamic = []; this.walls = []; }
  addWall(w) { this.walls.push(w); return w; }
  addGround(fn) { this.grounds.push(fn); return fn; }
  addObstacle(o) { this.obstacles.push(o); return o; }
  addDynamic(getter) { this.dynamic.push(getter); }
  groundAt(x, z, nearY = Infinity, step = 0.7) {
    let best = null;
    for (const g of this.grounds) {
      const h = g(x, z);
      if (h === null || h === undefined) continue;
      if (h > nearY + step) continue; // too high to step onto
      if (best === null || h > best) best = h;
    }
    return best;
  }
  /** Push a circle of radius r at (x,z) out of all obstacles. Returns corrected {x,z}. */
  resolve(x, z, r) {
    const all = this.obstacles.concat(this.dynamic.flatMap((d) => d()));
    for (let iter = 0; iter < 3; iter++) {
      for (const o of all) {
        if (o.off) continue;
        const dx = x - o.x, dz = z - o.z; const d = Math.hypot(dx, dz); const m = r + o.r;
        if (d < m && d > 1e-5) { x = o.x + (dx / d) * m; z = o.z + (dz / d) * m; }
      }
      for (const w of this.walls) {
        if (w.off) continue;
        const ex = w.x2 - w.x1, ez = w.z2 - w.z1, L2 = ex * ex + ez * ez;
        const t = Math.max(0, Math.min(1, ((x - w.x1) * ex + (z - w.z1) * ez) / L2));
        const px = w.x1 + ex * t, pz = w.z1 + ez * t, dx = x - px, dz = z - pz, d = Math.hypot(dx, dz), m = r + w.r;
        if (d < m) {
          if (d > 1e-5) { x = px + (dx / d) * m; z = pz + (dz / d) * m; }
          else { const L = Math.sqrt(L2); x = px - ez / L * m; z = pz + ex / L * m; }
        }
      }
    }
    return { x, z };
  }
}
