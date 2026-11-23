// The way into the story from the hub: a sun-faded maroon sedan parked in the dark on a patch of
// cracked desert asphalt that should not be there, its catalytic converter sawn off (the cut
// exhaust hangs under the sills), driver's door open, under a buzzing KEATLAND MOTORS pylon:
// "PRE-OWNED · PRE-JACKED · POST-CATALYTIC". Get in, and the sign flares, and you come out where
// this car used to be: the empty valet curb in front of Keatland Reception.
import * as THREE from 'three';
import { V, std, box, cyl } from './kit.js';
import { signTexture, signPlane, asphaltTexture, rngOf } from './paint.js';
import { canvasTexture } from '../materials/textures.js';
import { SIGNS } from '../data/storyLines.js';

export const HUB_CAR = { x: -18.5, z: -13.5, yaw: 0.95 }; // car faces roughly toward the ritual bowl

export function buildHubEntrance({ scene, collision, ground }) {
  const g = new THREE.Group(); g.name = 'story-entrance'; scene.add(g);
  const y0 = ground(HUB_CAR.x, HUB_CAR.z) ?? 0;
  g.position.set(HUB_CAR.x, y0, HUB_CAR.z); g.rotation.y = HUB_CAR.yaw;
  const rng = rngOf(404);
  // --- the patch of lot: cracked asphalt with a faded stall line, fading out into the hub floor
  {
    const tex = asphaltTexture({ size: 1024, metres: 12, seed: 41, paintLines: (c, m) => { c.strokeStyle = 'rgba(235,225,190,0.55)'; c.lineWidth = m * 0.12; for (const x of [-1.6, 1.6]) { c.beginPath(); c.moveTo((6 + x) * m, 1.5 * m); c.lineTo((6 + x) * m, 10 * m); c.stroke(); } } });
    const mask = canvasTexture(256, 256, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w / 2); gr.addColorStop(0, '#fff'); gr.addColorStop(0.7, '#888'); gr.addColorStop(1, '#000'); c.fillStyle = gr; c.fillRect(0, 0, w, h); const r = rngOf(5); c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 60; i++) { c.beginPath(); c.arc(r() * w, r() * h, 4 + r() * 18, 0, 7); c.fill(); } }, { wrap: false, srgb: false });
    const m = new THREE.MeshStandardMaterial({ map: tex, alphaMap: mask, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(12, 12, 24, 24), m); pl.rotation.x = -Math.PI / 2; pl.position.y = 0.04; pl.receiveShadow = true; g.add(pl);
    // follow the uneven hub floor
    const pa = pl.geometry.attributes.position, wv = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) { wv.set(pa.getX(i), 0, -pa.getY(i)).applyAxisAngle(V(0, 1, 0), HUB_CAR.yaw).add(g.position); const h = ground(wv.x, wv.z); pa.setZ(i, (h ?? y0) - y0); }
    pl.geometry.computeVertexNormals();
  }
  // --- the sedan (faces +Z locally; the driver's side is +X... American: driver on the left = -X when facing +Z? facing +Z, left is +X)
  const car = new THREE.Group(); car.position.y = 0; g.add(car);
  const paint = std({ color: 0x7a3a3a, roughness: 0.55, metalness: 0.35 });
  const faded = canvasTexture(512, 512, (c, w, h) => { c.fillStyle = '#7a3a3a'; c.fillRect(0, 0, w, h); const r = rngOf(9); for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${200 + r() * 40},${150 + r() * 40},${140 + r() * 30},${r() * 0.12})`; c.beginPath(); c.arc(r() * w, r() * h * 0.6, 8 + r() * 40, 0, 7); c.fill(); } for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(90,50,25,${0.3 + r() * 0.4})`; c.beginPath(); c.arc(r() * w, h * (0.7 + r() * 0.3), 2 + r() * 8, 0, 7); c.fill(); } });
  const roofPaint = std({ map: faded, roughness: 0.75, metalness: 0.15 });
  const chrome = std({ color: 0xc8c8c8, metalness: 0.9, roughness: 0.25 });
  const rubber = std({ color: 0x1a1a1a, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2228, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.55 });
  const interior = std({ color: 0x5a4a3a, roughness: 0.9 });
  // body: lower tub with rounded profile (extruded side silhouette)
  const side = new THREE.Shape();
  side.moveTo(-2.35, 0.32); side.lineTo(2.3, 0.32); side.quadraticCurveTo(2.42, 0.36, 2.42, 0.55); side.lineTo(2.38, 0.82); side.quadraticCurveTo(2.2, 0.9, 1.3, 0.92); side.lineTo(-1.6, 0.94); side.quadraticCurveTo(-2.3, 0.94, -2.4, 0.85); side.lineTo(-2.42, 0.5); side.quadraticCurveTo(-2.42, 0.34, -2.35, 0.32);
  const body = new THREE.ExtrudeGeometry(side, { depth: 1.76, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
  body.translate(0, 0, -0.88); body.rotateY(-Math.PI / 2);
  const bodyM = new THREE.Mesh(body, paint); bodyM.castShadow = true; bodyM.receiveShadow = true; car.add(bodyM);
  // cabin (greenhouse)
  const cab = new THREE.Shape(); cab.moveTo(-1.45, 0); cab.lineTo(1.0, 0); cab.lineTo(0.35, 0.5); cab.lineTo(-0.95, 0.52); cab.lineTo(-1.45, 0);
  const cabG = new THREE.ExtrudeGeometry(cab, { depth: 1.52, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }); cabG.translate(0, 0, -0.76); cabG.rotateY(-Math.PI / 2);
  const cabM = new THREE.Mesh(cabG, glass); cabM.position.y = 0.94; car.add(cabM);
  const roof = box(1.5, 0.05, 1.25, roofPaint, 0, 1.47, -0.3, { parent: car }); roof.scale.set(1, 1, 1);
  // pillars
  for (const sx of [-0.77, 0.77]) { const a = box(0.06, 0.62, 0.08, paint, sx, 1.2, 0.68, { parent: car }); a.rotation.x = -0.9; const c = box(0.06, 0.58, 0.08, paint, sx, 1.2, -1.2, { parent: car }); c.rotation.x = 0.75; box(0.05, 0.5, 0.06, paint, sx, 1.2, -0.25, { parent: car }); }
  // seats + steering wheel visible through the glass
  box(0.55, 0.12, 0.55, interior, 0.4, 0.62, -0.35, { parent: car }); box(0.55, 0.6, 0.12, interior, 0.4, 0.95, -0.66, { parent: car });
  box(0.55, 0.12, 0.55, interior, -0.4, 0.62, -0.35, { parent: car }); box(0.55, 0.6, 0.12, interior, -0.4, 0.95, -0.66, { parent: car });
  box(1.4, 0.12, 0.5, interior, 0, 0.62, -1.35, { parent: car }); box(1.4, 0.5, 0.12, interior, 0, 0.92, -1.6, { parent: car });
  box(1.5, 0.22, 0.4, std({ color: 0x2a2420, roughness: 0.6 }), 0, 0.98, 0.62, { parent: car });
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 24), rubber); wheel.position.set(0.4, 1.05, 0.32); wheel.rotation.x = -0.5; car.add(wheel);
  // wheels
  for (const [x, z] of [[-0.8, 1.45], [0.8, 1.45], [-0.8, -1.45], [0.8, -1.45]]) { const w = cyl(0.33, 0.33, 0.24, rubber, x, 0.33, z, { seg: 20, parent: car }); w.rotation.z = Math.PI / 2; const hub = cyl(0.17, 0.17, 0.25, chrome, x, 0.33, z, { seg: 14, parent: car }); hub.rotation.z = Math.PI / 2; }
  // bumpers, lights, grille, plate
  box(1.86, 0.16, 0.12, chrome, 0, 0.45, 2.45, { parent: car }); box(1.86, 0.16, 0.12, chrome, 0, 0.45, -2.45, { parent: car });
  box(1.0, 0.2, 0.04, std({ color: 0x151515, roughness: 0.5 }), 0, 0.68, 2.44, { parent: car });
  for (const sx of [-0.68, 0.68]) { box(0.32, 0.14, 0.04, std({ color: 0xfff6e0, emissive: 0xfff0c0, emissiveIntensity: 0.25 }), sx, 0.7, 2.43, { parent: car }); box(0.32, 0.12, 0.04, std({ color: 0x5a0a0a, emissive: 0x8a0a0a, emissiveIntensity: 0.5 }), sx, 0.72, -2.45, { parent: car }); }
  { const plate = signPlane(signTexture(['KEATLND'], { w: 512, h: 256, bg: '#e8e2cc', fg: '#2a3a6a', font: 'Oswald', weight: '600', weather: 0.4, seed: 44, border: 8 }), 0.32, 0.16); plate.position.set(0, 0.62, -2.48); plate.rotation.y = Math.PI; car.add(plate); }
  // driver's door, open (hinged at its front edge, on the left = +X side)
  const doorHinge = new THREE.Group(); doorHinge.position.set(0.92, 0, 0.55); car.add(doorHinge);
  { const d = box(0.07, 0.6, 1.05, paint, 0, 0.62, -0.53, { parent: doorHinge }); const dg = box(0.03, 0.44, 0.9, glass, 0, 1.15, -0.5, { parent: doorHinge }); box(0.04, 0.03, 0.14, chrome, 0.04, 0.8, -0.9, { parent: doorHinge }); }
  doorHinge.rotation.y = 1.0;
  // underneath: the exhaust, sawn through where the converter was (bright cut ends, a little rust)
  { const pipe = std({ color: 0x5a4a3e, metalness: 0.7, roughness: 0.6 }), cut = std({ color: 0xd8d0c8, metalness: 1, roughness: 0.2 });
    const p1 = cyl(0.04, 0.04, 1.3, pipe, 0.25, 0.2, 1.3, { parent: car, seg: 10 }); p1.rotation.x = Math.PI / 2;
    const p2 = cyl(0.04, 0.04, 1.6, pipe, 0.25, 0.2, -1.55, { parent: car, seg: 10 }); p2.rotation.x = Math.PI / 2;
    for (const z of [0.64, -0.74]) { const c = cyl(0.041, 0.041, 0.01, cut, 0.25, 0.2, z, { parent: car, seg: 10 }); c.rotation.x = Math.PI / 2; }
    const sag = cyl(0.04, 0.04, 0.5, pipe, 0.25, 0.08, -0.95, { parent: car, seg: 10 }); sag.rotation.x = Math.PI / 2 - 0.4;
    // metal shavings under the gap
    for (let i = 0; i < 14; i++) { const s = box(0.03, 0.004, 0.01, cut, 0.25 + (rng() - 0.5) * 0.5, 0.045, (rng() - 0.5) * 1.2, { parent: car }); s.rotation.y = rng() * 3; }
  }
  // a dusty layer: the hub's glow doesn't touch it, so a soft warm light from the sign does
  // --- the pylon: KEATLAND MOTORS, lit, buzzing, one tube on the fritz
  const pylon = new THREE.Group(); pylon.position.set(-2.0, 0, 8.5); pylon.rotation.y = Math.PI - 0.35; g.add(pylon); // ahead of the windshield
  const pole = std({ color: 0x6a5a4a, metalness: 0.6, roughness: 0.55 });
  cyl(0.14, 0.18, 6.2, pole, 0, 3.1, 0, { parent: pylon });
  const signMats = [];
  const mkSign = (lines, w, h, y, o) => { const tex = signTexture(lines, { w: 1024, h: Math.round(1024 * h / w), weather: 0.5, ...o }); const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3, roughness: 0.6 }); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(0, y, 0.13); pylon.add(p); const b = p.clone(); b.position.z = -0.13; b.rotation.y = Math.PI; pylon.add(b); box(w + 0.15, h + 0.15, 0.24, pole, 0, y, 0, { parent: pylon }); signMats.push(m); return p; };
  mkSign(SIGNS.motorsPylon, 3.2, 1.5, 6.6, { bg: '#f2e6c8', fg: '#a3261c', font: 'Rye', sizes: [1.15, 1.15], seed: 45, border: 14, borderColor: '#a3261c' });
  mkSign(['PRE-OWNED · PRE-JACKED · POST-CATALYTIC'], 3.2, 0.42, 5.6, { bg: '#1d2a44', fg: '#f2e6c8', font: 'Oswald', weight: '600', seed: 46 });
  const glow = new THREE.PointLight(0xffd8a0, 4, 16, 1.6); glow.position.set(0, 5.0, 1.4); pylon.add(glow);
  const fill = new THREE.PointLight(0xffc890, 3.5, 9, 1.8); fill.position.set(0, 2.6, 0); g.add(fill);
  // obstacles: the car (three circles along its length) and the pylon
  const toW = (x, z) => V(x, 0, z).applyAxisAngle(V(0, 1, 0), HUB_CAR.yaw).add(g.position);
  const obs = [];
  for (const z of [-1.5, 0, 1.5]) { const p = toW(0, z); obs.push(collision.addObstacle({ x: p.x, z: p.z, r: 1.05 })); }
  { const p = toW(-2.0, 8.5); collision.addObstacle({ x: p.x, z: p.z, r: 0.35 }); }

  const doorPos = toW(1.75, 0.0); // stand here (outside the open driver's door)
  const seat = toW(0.4, -0.3).setY(y0 + 1.12);
  const flare = { v: 0 };
  return {
    group: g, car, doorHinge, pylon,
    doorPos, seat, forward: V(0, 0, 1).applyAxisAngle(V(0, 1, 0), HUB_CAR.yaw),
    /** where to stand when you come back: beside the car, facing out toward the bowl */
    returnPos: toW(4.0, 1.6), returnYaw: (() => { const p = toW(4.0, 1.6); return Math.atan2(-(0 - p.x), -(-3 - p.z)); })(),
    near(p, r = 2.6) { return Math.hypot(p.x - doorPos.x, p.z - doorPos.z) < r; },
    flare(v) { flare.v = v; },
    update(dt, t) {
      const fl = (Math.sin(t * 17) > 0.92 || Math.sin(t * 3.1 + Math.sin(t * 7)) > 0.97) ? 0.35 : 1;
      signMats.forEach((m, i) => (m.emissiveIntensity = (i === 1 ? fl : 1) * 0.3 + flare.v * 5));
      glow.intensity = 4 * (0.8 + 0.2 * fl) + flare.v * 60; fill.intensity = 3.5 + flare.v * 20;
    },
  };
}
