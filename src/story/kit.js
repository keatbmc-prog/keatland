// Small shared helpers for building the story realm.
import * as THREE from 'three';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });

export function box(w, h, d, mat, x = 0, y = 0, z = 0, { cast = true, receive = true, parent = null } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive;
  parent?.add(m);
  return m;
}
export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, { seg = 16, parent = null, cast = true } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent?.add(m); return m;
}
/** Box with world-scale UVs (texture repeats every `tile` metres). */
export function tiledBox(w, h, d, mat, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ax > 0.5) uv.setXY(i, z / tile, y / tile); else if (ay > 0.5) uv.setXY(i, x / tile, z / tile); else uv.setXY(i, x / tile, y / tile);
  }
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
/** Rusty steel with a little variation. */
export function rustMat(c = 0x6e4a32) { return std({ color: c, roughness: 0.75, metalness: 0.45 }); }
