// A small architecture kit for interiors built from 1 m cells. Rooms are lists of rectangles,
// each cell is tagged with its room, and walls are generated wherever two different rooms (or a
// room and the outside) meet, except where a doorway is declared. Each wall is a slab whose two
// faces get the material of the room on that side (or the exterior skin), runs are merged so the
// collision and draw calls stay small, and ceilings/floors are merged per room with holes allowed.
import * as THREE from 'three';
import { merge } from '../geometry/generators.js';

const key = (x, z) => x + ',' + z;

export class CellPlan {
  constructor() { this.cells = new Map(); this.rooms = new Map(); this.openings = new Set(); this.holes = new Set(); }
  /** room: { id, rects: [[x0,x1,z0,z1]], wall: Material, floor, ceiling, height, build:false for foreign rooms } */
  addRoom(room) {
    this.rooms.set(room.id, room);
    for (const [x0, x1, z0, z1] of room.rects) for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) this.cells.set(key(x, z), room.id);
    return room;
  }
  /** A doorway along an edge: vertical edge at x from z0..z1, or horizontal edge at z from x0..x1. */
  openX(x, z0, z1) { for (let z = z0; z < z1; z++) this.openings.add('x' + x + ',' + z); }
  openZ(z, x0, x1) { for (let x = x0; x < x1; x++) this.openings.add('z' + z + ',' + x); }
  hole(x, z) { this.holes.add(key(x, z)); }
  at(x, z) { return this.cells.get(key(Math.floor(x), Math.floor(z))) ?? null; }

  /**
   * Build geometry. y = floor height (local), mats.exterior = outside skin, thickness of walls t.
   * Returns { group, walls: [{x1,z1,x2,z2}] (for collision), lights: [Vector3] (fixture centres) }.
   */
  build({ y = 0, t = 0.16, exterior, baseboard, panelMat, fixtureEvery = 3, fixtureFilter = () => true }) {
    const group = new THREE.Group();
    const byMat = new Map(); const push = (mat, g) => { if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push(g); };
    const walls = [], fixtures = [];
    const room = (id) => (id === null ? null : this.rooms.get(id));
    // --- vertical edges (between x-1 and x), merged along z
    const edges = [];
    const xs = [...this.cells.keys()].map((k) => k.split(',').map(Number));
    const minX = Math.min(...xs.map((v) => v[0])) - 1, maxX = Math.max(...xs.map((v) => v[0])) + 2;
    const minZ = Math.min(...xs.map((v) => v[1])) - 1, maxZ = Math.max(...xs.map((v) => v[1])) + 2;
    for (let x = minX; x <= maxX; x++) {
      let run = null;
      for (let z = minZ; z <= maxZ; z++) {
        const a = this.cells.get(key(x - 1, z)) ?? null, b = this.cells.get(key(x, z)) ?? null;
        const ra = room(a), rb = room(b);
        const need = a !== b && !this.openings.has('x' + x + ',' + z) && ((ra && ra.build !== false) || (rb && rb.build !== false));
        const sig = need ? a + '|' + b : null;
        if (run && run.sig !== sig) { edges.push(run); run = null; }
        if (need && !run) run = { dir: 'x', at: x, from: z, to: z + 1, a, b, sig };
        else if (need) run.to = z + 1;
      }
      if (run) edges.push(run);
    }
    for (let z = minZ; z <= maxZ; z++) {
      let run = null;
      for (let x = minX; x <= maxX; x++) {
        const a = this.cells.get(key(x, z - 1)) ?? null, b = this.cells.get(key(x, z)) ?? null;
        const ra = room(a), rb = room(b);
        const need = a !== b && !this.openings.has('z' + z + ',' + x) && ((ra && ra.build !== false) || (rb && rb.build !== false));
        const sig = need ? a + '|' + b : null;
        if (run && run.sig !== sig) { edges.push(run); run = null; }
        if (need && !run) run = { dir: 'z', at: z, from: x, to: x + 1, a, b, sig };
        else if (need) run.to = x + 1;
      }
      if (run) edges.push(run);
    }
    for (const e of edges) {
      const ra = room(e.a), rb = room(e.b);
      const H = Math.max(ra?.height ?? 0, rb?.height ?? 0) || 2.8;
      const matA = ra ? (ra.build === false ? ra.wall ?? exterior : ra.wall) : exterior; // face toward a
      const matB = rb ? (rb.build === false ? rb.wall ?? exterior : rb.wall) : exterior;
      const L = e.to - e.from;
      // slab: faces [px, nx, py, ny, pz, nz]
      let geo, mats;
      if (e.dir === 'x') { geo = new THREE.BoxGeometry(t, H, L); geo.translate(e.at, y + H / 2, e.from + L / 2); mats = { nx: matA, px: matB }; }
      else { geo = new THREE.BoxGeometry(L, H, t); geo.translate(e.from + L / 2, y + H / 2, e.at); mats = { nz: matA, pz: matB }; }
      // split the box into its faces so each side can carry its own material
      const groups = geo.groups; const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, idx = geo.index;
      const faceNames = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
      groups.forEach((gr, gi) => {
        const name = faceNames[gi];
        const mat = mats[name] ?? exterior;
        const g = new THREE.BufferGeometry();
        const ids = idx.array.slice(gr.start, gr.start + gr.count);
        const p = [], n = [], u = [];
        for (const i of ids) {
          p.push(pos.getX(i), pos.getY(i), pos.getZ(i)); n.push(nor.getX(i), nor.getY(i), nor.getZ(i));
          // world-scaled UVs so wallpaper doesn't stretch: u along the wall, v up
          const along = e.dir === 'x' ? pos.getZ(i) : pos.getX(i);
          u.push(along / 1.6, (pos.getY(i) - y) / 2.8);
        }
        g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
        push(mat, g);
      });
      // baseboards on room sides
      if (baseboard) for (const [rr, side] of [[ra, -1], [rb, 1]]) {
        if (!rr || rr.build === false || !rr.baseboard) continue;
        const bb = e.dir === 'x' ? new THREE.BoxGeometry(0.03, 0.12, L) : new THREE.BoxGeometry(L, 0.12, 0.03);
        if (e.dir === 'x') bb.translate(e.at + side * (t / 2 + 0.015), y + 0.06, e.from + L / 2); else bb.translate(e.from + L / 2, y + 0.06, e.at + side * (t / 2 + 0.015));
        push(baseboard, bb);
      }
      walls.push(e.dir === 'x' ? { x1: e.at, z1: e.from, x2: e.at, z2: e.to } : { x1: e.from, z1: e.at, x2: e.to, z2: e.at });
    }
    // --- floors and ceilings per room (one quad per cell, merged), fixtures on a grid
    for (const [id, r] of this.rooms) {
      if (r.build === false) continue;
      const fl = [], ce = [];
      for (const [k, rid] of this.cells) {
        if (rid !== id) continue;
        const [x, z] = k.split(',').map(Number);
        const f = new THREE.PlaneGeometry(1, 1); f.rotateX(-Math.PI / 2); f.translate(x + 0.5, y + 0.005, z + 0.5);
        const fu = f.attributes.uv; for (let i = 0; i < fu.count; i++) fu.setXY(i, (x + (i % 2)) / (r.floorScale ?? 3), (z + (i < 2 ? 0 : 1)) / (r.floorScale ?? 3));
        fl.push(f);
        if (!this.holes.has(k)) { const c = new THREE.PlaneGeometry(1, 1); c.rotateX(Math.PI / 2); c.translate(x + 0.5, y + r.height, z + 0.5); const cu = c.attributes.uv; for (let i = 0; i < cu.count; i++) cu.setXY(i, (x + (i % 2)) / 0.6, (z + (i < 2 ? 0 : 1)) / 0.6); ce.push(c); }
        if (fixtureEvery && (x % fixtureEvery === 1) && (((z % fixtureEvery) + fixtureEvery) % fixtureEvery === 1) && fixtureFilter(x, z, id)) {
          fixtures.push(new THREE.Vector3(x + 0.5, y + r.height - 0.02, z + 0.5));
        }
      }
      if (fl.length && r.floor) push(r.floor, merge(fl));
      if (ce.length && r.ceiling) push(r.ceiling, merge(ce));
    }
    for (const [mat, gs] of byMat) { const m = new THREE.Mesh(merge(gs), mat); m.receiveShadow = true; m.castShadow = mat !== panelMat; group.add(m); }
    // fixture panels
    if (panelMat && fixtures.length) {
      const pg = new THREE.BoxGeometry(0.6, 0.04, 1.2);
      const im = new THREE.InstancedMesh(pg, panelMat, fixtures.length);
      const m4 = new THREE.Matrix4();
      fixtures.forEach((p, i) => { im.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)); });
      group.add(im); group.userData.panels = im;
    }
    return { group, walls, fixtures };
  }
}
