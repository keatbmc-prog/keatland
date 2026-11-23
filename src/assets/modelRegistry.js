// GLB/glTF model registry. Every hero object in the slice is built procedurally, but each one is
// registered under an id. To replace it with a real asset, drop a .glb into public/models/ and add
// an entry to public/models/manifest.json, e.g.
//   { "sword": { "url": "models/sword.glb", "scale": 1, "position": [0,0,0], "rotation": [0,0,0], "hideProcedural": true } }
// On load the registry swaps the asset into the same group, so animation and behaviour code keep
// driving it. No code changes needed.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const slots = new Map(); // id -> { group, procedural: Object3D[] }
let manifest = {};

export function registerSlot(id, group, procedural = [...group.children]) {
  slots.set(id, { group, procedural });
}

export async function loadManifest(base = './') {
  try {
    const res = await fetch(base + 'models/manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch { /* no manifest: everything stays procedural */ }
  return manifest;
}

export async function applyOverrides(base = './') {
  const jobs = [];
  for (const [id, spec] of Object.entries(manifest)) {
    if (id.startsWith('_')) continue;
    const slot = slots.get(id);
    if (!slot || !spec?.url) continue;
    jobs.push(loadModel(base + spec.url).then((obj) => {
      obj.scale.setScalar(spec.scale ?? 1);
      if (spec.position) obj.position.fromArray(spec.position);
      if (spec.rotation) obj.rotation.fromArray(spec.rotation);
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      if (spec.hideProcedural !== false) slot.procedural.forEach((p) => (p.visible = false));
      slot.group.add(obj);
      console.info(`[keatland] model override applied: ${id}`);
    }).catch((e) => console.warn(`[keatland] could not load model for ${id}`, e)));
  }
  await Promise.all(jobs);
}

export function loadModel(url) {
  return new Promise((resolve, reject) => loader.load(url, (g) => resolve(g.scene), undefined, reject));
}

export const listSlots = () => [...slots.keys()];
