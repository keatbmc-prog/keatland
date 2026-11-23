// Camera-driven spatial transitions. Nothing cuts: the camera is physically carried through the
// world - swallowed by the mouth, squeezed down the real gullet tunnel, spat out over the void and
// tumbled onto the floating stairs; and on the way back, flung up and around the outside of the
// whole hub while the world folds over, before being set down at the entrance.
import * as THREE from 'three';
import { GULLET } from '../world/below.js';
import { L } from '../world/layout.js';

const ease = (t) => t * t * (3 - 2 * t);
const easeIn = (t) => t * t * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export class Transitions {
  constructor({ camera, player, post, audio, sky, below, heart, hub }) {
    Object.assign(this, { camera, player, post, audio, sky, below, heart, hub });
    this.active = null; this.t = 0;
    this.baseFov = camera.fov;
  }
  get busy() { return !!this.active; }

  swallow() {
    if (this.active) return;
    const cam = this.camera;
    const start = cam.position.clone();
    const startQ = cam.quaternion.clone();
    const mouth = GULLET.getPointAt(0.0).clone();
    this.player.enabled = false;
    this.audio?.gulp(); this.audio?.whoosh(9, true);
    this.heart.excite = 1;
    const exitT = 0.985;
    const exit = GULLET.getPointAt(exitT), exitDir = GULLET.getTangentAt(exitT);
    const land = L.below.stairsTop.clone().add(new THREE.Vector3(0, 1.7, 0));
    const tmpM = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
    this.active = {
      name: 'swallow', dur: 11,
      step: (t) => {
        const P = this.post.uniforms;
        if (t < 1.8) { // pulled in
          const k = ease(t / 1.8);
          cam.position.lerpVectors(start, mouth, k);
          tmpM.lookAt(cam.position, GULLET.getPointAt(0.03), up); q.setFromRotationMatrix(tmpM);
          cam.quaternion.slerpQuaternions(startQ, q, k);
          cam.fov = this.baseFov + 30 * k;
          P.uWarp.value = 0.35 * k; P.uChroma.value = 0.004 * k;
          this.below.tunnelMat.uniforms.uSwallow.value = k;
        } else if (t < 8.0) { // the gullet
          const u = (t - 1.8) / 6.2;
          const s = clamp01(u * u * (3 - 2 * u)) * exitT;
          const p = GULLET.getPointAt(s), tan = GULLET.getTangentAt(Math.min(1, s + 0.01));
          cam.position.copy(p);
          tmpM.lookAt(p, p.clone().add(tan), up); cam.quaternion.setFromRotationMatrix(tmpM);
          cam.rotateZ(Math.sin(u * Math.PI * 3) * 0.9 + u * Math.PI * 2);
          cam.fov = this.baseFov + 30 + 12 * Math.sin(t * 5.5);
          P.uWarp.value = 0.35 + 0.25 * Math.sin(u * Math.PI); P.uChroma.value = 0.004 + 0.006 * Math.sin(u * Math.PI);
          this.below.tunnelMat.uniforms.uSwallow.value = 1;
        } else { // spat out, tumbling, landing on the stairs
          const u = clamp01((t - 8.0) / 3.0);
          const arc = exit.clone().lerp(land, ease(u)); arc.y += Math.sin(u * Math.PI) * 6 * (1 - u);
          cam.position.copy(arc);
          const look = land.clone().add(new THREE.Vector3(8, -6, -12));
          tmpM.lookAt(arc, exit.clone().addScaledVector(exitDir, 30).lerp(look, ease(u)), up); cam.quaternion.setFromRotationMatrix(tmpM);
          cam.rotateX((1 - ease(u)) * Math.PI * 2 * 0.75);
          cam.rotateZ((1 - ease(u)) * 1.2);
          cam.fov = this.baseFov + 42 * (1 - ease(u));
          P.uWarp.value = 0.6 * (1 - u); P.uChroma.value = 0.01 * (1 - u);
          if (u > 0.96 && !this.active.landed) { this.active.landed = true; this.player.shake = 1.0; this.audio?.heartbeat(1.6); }
        }
        cam.updateProjectionMatrix();
      },
      end: () => {
        // face down the stairs
        const d = new THREE.Vector3(83, -133, -178).sub(L.below.stairsTop);
        this.player.teleport(L.below.stairsTop.clone(), Math.atan2(-d.x, -d.z), -0.25);
        this.player.shake = 0.8;
        this.below.tunnelMat.uniforms.uSwallow.value = 0;
      },
    };
    this.t = 0;
  }

  fold() {
    if (this.active) return;
    const cam = this.camera;
    const start = cam.position.clone();
    this.player.enabled = false;
    this.audio?.whoosh(7.5, false);
    const path = new THREE.CatmullRomCurve3([
      start.clone(), L.below.door.clone().add(new THREE.Vector3(0, 3, -4)), new THREE.Vector3(95, -110, -190), new THREE.Vector3(130, -30, -90),
      new THREE.Vector3(105, 55, 40), new THREE.Vector3(30, 40, 75), new THREE.Vector3(0, 12, 42), L.spawn.clone().add(new THREE.Vector3(0, 1.7, 0)),
    ], false, 'centripetal');
    const tmpM = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
    this.active = {
      name: 'fold', dur: 10,
      step: (t) => {
        const P = this.post.uniforms;
        const u = t / 10;
        const s = ease(u);
        const p = path.getPointAt(s);
        cam.position.copy(p);
        // look toward the hub's heart, blending to straight ahead at the end
        const ahead = path.getPointAt(Math.min(1, s + 0.02));
        const target = L.heart.clone().lerp(ahead.clone().add(new THREE.Vector3(0, -0.3, -8)), clamp01((u - 0.82) / 0.18));
        if (u < 0.12) target.copy(L.below.door).add(new THREE.Vector3(0, 3, -10));
        tmpM.lookAt(p, target, up); const q = new THREE.Quaternion().setFromRotationMatrix(tmpM);
        if (u < 0.12) cam.quaternion.copy(q); else cam.quaternion.slerp(q, 0.12);
        // the fold: the world turns over once
        const fold = Math.sin(clamp01((u - 0.1) / 0.75) * Math.PI);
        cam.rotateZ(fold * Math.PI * 0.9 * Math.sin(u * Math.PI));
        cam.fov = this.baseFov + 35 * fold;
        P.uWarp.value = -0.45 * fold; P.uSwirl.value = 1.4 * fold; P.uChroma.value = 0.008 * fold;
        P.uFlash.value = Math.max(0, 1 - t / 0.9) * 0.9;
        this.sky.material.uniforms.uFold.value = fold * 0.6;
        cam.updateProjectionMatrix();
      },
      end: () => {
        this.player.teleport(L.spawn.clone(), L.spawnYaw, 0);
        this.sky.material.uniforms.uFold.value = 0;
      },
    };
    this.t = 0;
  }

  // ---------------------------------------------------------------- the photo cube portal
  // Dive: the cube swells around you (you shrink toward it) until one photo-sticker fills your sight.
  _dive(cube, start, startQ, u) {
    const cam = this.camera;
    const f = this._diveFace;
    const S = Math.exp(Math.log(46) * Math.pow(u, 2.2));
    cube.group.scale.setScalar(S);
    const half = cube.step * 1.5 * S;
    const dEnd = cube.size * 0.84 * S * 0.36;
    const k = u * u * (3 - 2 * u);
    const axisPos = f.center.clone().addScaledVector(f.normal, half + THREE.MathUtils.lerp(this._diveD0, dEnd, k));
    cam.position.copy(start).lerp(axisPos, Math.min(1, k * 1.25));
    const m = new THREE.Matrix4().lookAt(cam.position, f.center, new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.copy(startQ).slerp(q, Math.min(1, k * 2.2));
    cam.rotateZ(Math.sin(u * Math.PI) * 0.35 * u);
    cam.fov = this.baseFov + 18 * Math.sin(u * Math.PI * 0.9);
    cam.updateProjectionMatrix();
    const P = this.post.uniforms;
    P.uSwirl.value = 0.7 * Math.pow(u, 2); P.uChroma.value = 0.006 * u; P.uWarp.value = 0.25 * u * u;
    P.uFlash.value = Math.max(0, (u - 0.8) / 0.2) * 0.95;
  }

  _beginDive(cube) {
    cube.frozen = true; cube.group.updateMatrixWorld(true);
    this._diveFace = cube.faceToward(this.camera.position);
    this._diveD0 = Math.max(0.4, this.camera.position.distanceTo(this._diveFace.center) - cube.step * 1.5);
  }

  /** Hub cube -> gallery. */
  portalIn({ cube, gallery, setRealm }) {
    if (this.active) return;
    const cam = this.camera;
    this.player.enabled = false;
    this.audio?.whoosh(6, false);
    const start = cam.position.clone(), startQ = cam.quaternion.clone();
    this._beginDive(cube);
    const frame = gallery.frames[this._diveFace.photo % gallery.frames.length];
    const eyeY = frame.stand.y + 1.7;
    let swapped = false;
    const A = 3.4;
    this.active = {
      name: 'portal-in', dur: 7,
      step: (t) => {
        const P = this.post.uniforms;
        if (t < A) { this._dive(cube, start, startQ, t / A); return; }
        if (!swapped) {
          swapped = true; setRealm('gallery');
          cube.group.scale.setScalar(1); cube.frozen = false;
          this.audio?.whoosh(3, true);
        }
        const v = Math.min(1, (t - A) / (7 - A)), k = v * v * (3 - 2 * v);
        gallery.scaleAbout(frame.center, THREE.MathUtils.lerp(0.08, 1, Math.pow(k, 0.8)));
        const dist = THREE.MathUtils.lerp(0.11, 2.9, k);
        cam.position.copy(frame.center).addScaledVector(frame.normal, dist);
        cam.position.y = THREE.MathUtils.lerp(frame.center.y, eyeY, k);
        cam.lookAt(frame.center.x, THREE.MathUtils.lerp(frame.center.y, frame.center.y, k), frame.center.z);
        cam.rotateZ((1 - k) * 0.3 * Math.sin(v * 9));
        cam.fov = this.baseFov + 20 * (1 - k); cam.updateProjectionMatrix();
        P.uFlash.value = Math.max(0, 0.95 - v * 3);
        P.uSwirl.value = 0.7 * Math.pow(1 - k, 2); P.uChroma.value = 0.006 * (1 - k); P.uWarp.value = 0.25 * (1 - k);
      },
      end: () => {
        gallery.scaleAbout(frame.center, 1);
        const eye = frame.stand.clone().setY(eyeY), d = frame.center.clone().sub(eye);
        this.player.teleport(frame.stand.clone(), Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)));
      },
    };
    this.t = 0;
  }

  /** Gallery (its little cube) -> back out of the hub cube. */
  portalOut({ exitCube, cube, gallery, shrineCenter, standAt, setRealm }) {
    if (this.active) return;
    const cam = this.camera;
    this.player.enabled = false;
    this.audio?.whoosh(6, false);
    const start = cam.position.clone(), startQ = cam.quaternion.clone();
    this._beginDive(exitCube);
    let swapped = false, f = null, C = null, eye = null;
    const A = 3.2;
    this.active = {
      name: 'portal-out', dur: 6.6,
      step: (t) => {
        const P = this.post.uniforms;
        if (t < A) { this._dive(exitCube, start, startQ, t / A); return; }
        if (!swapped) {
          swapped = true; setRealm('hub');
          exitCube.group.scale.setScalar(1); exitCube.frozen = false;
          cube.frozen = true; cube.group.updateMatrixWorld(true);
          eye = standAt.clone().setY(standAt.y + 1.7);
          f = cube.faceToward(eye); C = f.center;
          this.audio?.whoosh(3, true);
        }
        const v = Math.min(1, (t - A) / (6.6 - A)), k = v * v * (3 - 2 * v);
        // spat back out: the cube shrinks back to its size while you are pushed out of its face
        const S = Math.exp(Math.log(34) * Math.pow(1 - k, 1.6));
        cube.group.scale.setScalar(S);
        const half = cube.step * 1.5 * S;
        const along = C.clone().addScaledVector(f.normal, half + THREE.MathUtils.lerp(cube.size * 0.84 * S * 0.36, eye.distanceTo(C) - cube.step * 1.5, k));
        cam.position.copy(along).lerp(eye, k * k);
        cam.lookAt(C);
        cam.rotateZ((1 - k) * 0.4 * Math.sin(v * 7));
        cam.fov = this.baseFov + 20 * (1 - k); cam.updateProjectionMatrix();
        P.uFlash.value = Math.max(0, 0.95 - v * 3);
        P.uSwirl.value = 0.7 * Math.pow(1 - k, 2); P.uChroma.value = 0.006 * (1 - k); P.uWarp.value = 0.25 * (1 - k);
      },
      end: () => {
        cube.group.scale.setScalar(1); cube.frozen = false;
        const d = C.clone().sub(eye);
        this.player.teleport(standAt.clone(), Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)));
      },
    };
    this.t = 0;
  }

  // ---------------------------------------------------------------- the leaf portal
  // In: you push through the curtain and the leaves close over you, thicker and thicker, until there
  // is nothing but leaves - then they thin out and you are standing somewhere green and close.
  _leafRide({ name, from, toPos, toYaw, swarm, setRealm, realm, emergeFrom, onEnd }) {
    if (this.active) return;
    const cam = this.camera;
    this.player.enabled = false;
    this.audio?.whoosh(5, false);
    const start = cam.position.clone(), startQ = cam.quaternion.clone();
    const A = 2.9, DUR = 6.4;
    // through the arch: in front of it -> just behind it
    const through = from.center.clone().addScaledVector(from.front, -2.2); through.y = start.y;
    const mid = from.center.clone().addScaledVector(from.front, 0.6); mid.y = start.y;
    const lookIn = from.center.clone().addScaledVector(from.front, -8); lookIn.y = start.y - 0.2;
    const endEye = toPos.clone().setY(toPos.y + 1.7);
    const endDir = new THREE.Vector3(-Math.sin(toYaw), 0, -Math.cos(toYaw));
    const emergeStart = emergeFrom ? emergeFrom.clone().setY(endEye.y) : endEye.clone().addScaledVector(endDir, -3.2);
    let swapped = false;
    this.active = {
      name, dur: DUR,
      step: (t) => {
        const P = this.post.uniforms;
        if (t < A) {
          const u = t / A, k = u * u * (3 - 2 * u);
          const p = k < 0.5 ? start.clone().lerp(mid, k * 2) : mid.clone().lerp(through, (k - 0.5) * 2);
          cam.position.copy(p);
          const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p, lookIn, new THREE.Vector3(0, 1, 0)));
          cam.quaternion.copy(startQ).slerp(q, Math.min(1, k * 2));
          cam.rotateZ(Math.sin(t * 2.3) * 0.05 * u);
          swarm.update(1 / 30, cam, Math.max(0, (u - 0.25) / 0.75), 3 + u * 5);
          P.uFade.value = Math.max(0, (u - 0.75) / 0.25) * 0.92; P.uChroma.value = 0.003 * u;
          return;
        }
        if (!swapped) { swapped = true; setRealm(realm); this.audio?.whoosh(3, true); }
        const v = Math.min(1, (t - A) / (DUR - A)), k = v * v * (3 - 2 * v);
        cam.position.copy(emergeStart).lerp(endEye, k);
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(cam.position, cam.position.clone().add(endDir), new THREE.Vector3(0, 1, 0)));
        cam.quaternion.copy(q);
        cam.rotateZ(Math.sin(t * 2.1) * 0.04 * (1 - k));
        swarm.update(1 / 30, cam, Math.max(0, 1 - k * 1.3), 2 + (1 - k) * 4);
        P.uFade.value = Math.max(0, 0.92 - v * 2.2); P.uChroma.value = 0.003 * (1 - k);
      },
      end: () => { swarm.update(0, cam, 0); this.post.uniforms.uFade.value = 0; this.player.teleport(toPos.clone(), toYaw, 0); onEnd?.(); },
    };
    this.t = 0;
  }
  jungleIn({ portal, jungle, swarm, setRealm }) {
    this._leafRide({ name: 'jungle-in', from: portal, toPos: jungle.arrival.pos, toYaw: jungle.arrival.yaw, swarm, setRealm, realm: 'jungle' });
  }
  jungleOut({ jungle, portal, swarm, setRealm }) {
    // come back out of the hub's curtain, walking away from it
    const out = portal.center.clone().addScaledVector(portal.front, 3.4); out.y = portal.center.y;
    const yaw = Math.atan2(-portal.front.x, -portal.front.z);
    const emerge = portal.center.clone().addScaledVector(portal.front, -0.8);
    this._leafRide({ name: 'jungle-out', from: jungle.exitPortal, toPos: out, toYaw: yaw, swarm, setRealm, realm: 'hub', emergeFrom: emerge });
  }

  // ---------------------------------------------------------------- the story: the stolen car
  // In: you get into the maroon sedan under the KEATLAND MOTORS sign, the door shuts, the sign
  // flares until everything is warm white - and you are sitting where the car used to be, at the
  // empty valet curb in the desert sun, and you stand up facing the lectern.
  storyIn({ entrance, story, setRealm }) {
    if (this.active) return;
    const cam = this.camera; this.player.enabled = false;
    const start = cam.position.clone(), startQ = cam.quaternion.clone();
    const seat = entrance.seat.clone(), look = seat.clone().addScaledVector(entrance.forward, 10).add(new THREE.Vector3(0, 3.6, 0));
    const seatQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(seat, look, new THREE.Vector3(0, 1, 0)));
    const door0 = entrance.doorHinge.rotation.y;
    const A = 2.1, B = 3.4, DUR = 7.0;
    const endPos = story.arrival.pos.clone(), endYaw = story.arrival.yaw;
    const endEye = endPos.clone().setY(endPos.y + 1.7), endDir = new THREE.Vector3(-Math.sin(endYaw), 0, -Math.cos(endYaw));
    const spot = story.emptySpot.clone().setY(story.emptySpot.y + 1.12);
    let swapped = false, closed = false;
    this.active = {
      name: 'story-in', dur: DUR,
      step: (t) => {
        const P = this.post.uniforms;
        if (t < A) { // into the driver's seat
          const k = ease(t / A);
          const p = start.clone().lerp(seat, k); p.y += Math.sin(k * Math.PI) * -0.25; cam.position.copy(p);
          cam.quaternion.copy(startQ).slerp(seatQ, k);
          entrance.doorHinge.rotation.y = door0 * (1 - ease(Math.max(0, (t - A * 0.6) / (A * 0.4))));
          if (t > A * 0.95 && !closed) { closed = true; this.audio?.whoosh(2, true); }
          return;
        }
        if (t < B) { // the sign flares
          const u = (t - A) / (B - A);
          cam.position.copy(seat); cam.quaternion.copy(seatQ); cam.rotateZ(Math.sin(t * 40) * 0.004 * u);
          entrance.flare(u * u);
          P.uFlash.value = Math.pow(u, 2.2) * 1.4; P.uChroma.value = 0.002 * u;
          cam.fov = this.baseFov - 6 * u; cam.updateProjectionMatrix();
          return;
        }
        if (!swapped) { swapped = true; entrance.flare(0); entrance.doorHinge.rotation.y = door0; setRealm('story'); story.reset(); this.audio?.whoosh(3, false); }
        const v = Math.min(1, (t - B) / (DUR - B)), k = ease(v);
        // sitting where the car was, then standing up and stepping toward the curb
        const p = spot.clone().lerp(endEye, k); p.y = spot.y + (endEye.y - spot.y) * ease(Math.min(1, v * 1.6)); cam.position.copy(p);
        const tgt = p.clone().addScaledVector(endDir, 10); tgt.y = p.y - 0.4 * (1 - k);
        cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(p, tgt, new THREE.Vector3(0, 1, 0)));
        P.uFlash.value = 1.4 * Math.pow(Math.max(0, 1 - v * 1.8), 2); P.uChroma.value = 0.002 * (1 - k);
        cam.fov = this.baseFov - 6 * (1 - k); cam.updateProjectionMatrix();
      },
      end: () => { this.player.teleport(endPos, endYaw, 0); },
    };
    this.t = 0;
  }
  // Out: the sun flares white (from the lectern, or through the EXIT to Tomorrow), and you are back
  // in the dark hub, climbing out of the car.
  storyOut({ entrance, setRealm }) {
    if (this.active) return;
    const cam = this.camera; this.player.enabled = false;
    const start = cam.position.clone(), startQ = cam.quaternion.clone();
    const A = 1.6, DUR = 5.0;
    const seat = entrance.seat.clone(), endPos = entrance.returnPos.clone(), endYaw = entrance.returnYaw;
    const endEye = endPos.clone().setY(endPos.y + 1.7), endDir = new THREE.Vector3(-Math.sin(endYaw), 0, -Math.cos(endYaw));
    const door0 = entrance.doorHinge.rotation.y;
    let swapped = false;
    this.audio?.whoosh(3, true);
    this.active = {
      name: 'story-out', dur: DUR,
      step: (t) => {
        const P = this.post.uniforms;
        if (t < A) { const u = t / A; cam.position.copy(start); cam.quaternion.copy(startQ); cam.rotateX(0.25 * ease(u)); P.uFlash.value = Math.pow(u, 2) * 1.4; return; }
        if (!swapped) { swapped = true; setRealm('hub'); entrance.flare(1); }
        const v = Math.min(1, (t - A) / (DUR - A)), k = ease(v);
        const p = seat.clone().lerp(endEye, k); cam.position.copy(p);
        const tgt = p.clone().addScaledVector(endDir, 10); tgt.y = p.y - 0.3;
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p, tgt, new THREE.Vector3(0, 1, 0)));
        cam.quaternion.copy(q);
        entrance.flare(Math.max(0, 1 - v * 2)); entrance.doorHinge.rotation.y = door0;
        P.uFlash.value = 1.4 * Math.pow(Math.max(0, 1 - v * 2.2), 2);
      },
      end: () => { entrance.flare(0); this.player.teleport(endPos, endYaw, 0); },
    };
    this.t = 0;
  }

  // ---------------------------------------------------------------- generic scripted camera ride
  /** a short camera move owned by a zone (e.g. the Works' flood carrying you); same contract as the
   *  transitions: the player controller is paused until it ends; `end` must teleport the player. */
  ride({ name = 'ride', dur, step, end }) {
    if (this.active && !this.active.ride) return false;
    if (this.active?.ride) { try { this.active.end(); } catch { /* replaced */ } }
    this.player.enabled = false;
    this.active = { name, dur, step, end, ride: true }; this.t = 0;
    return true;
  }

  // ---------------------------------------------------------------- the Catecholamine Works
  // In: you walk up to the steel double door in the Backrooms; it swings open into light so bright it
  // whites everything out - and you are standing in a doorway high in the north wall of the factory,
  // looking out over the vats; then down the spiral staircase behind Keaten's cane, onto the floor.
  worksIn({ story, works, setRealm }) {
    if (this.active) return;
    const cam = this.camera; this.player.enabled = false;
    const S0 = cam.position.clone(), Q0 = cam.quaternion.clone();
    const doorW = story.back.worksDoor.clone().add(story.root.position); // world, in front of the door (corridor side)
    const front = doorW.clone().setY(doorW.y + 1.7).add(new THREE.Vector3(0, 0, -0.8));
    const into = front.clone().add(new THREE.Vector3(0, 0, 1.6));
    const qDoor = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0, 'YXZ'));
    const ST = works.stair, Wo = works.root.position;
    const door = works.door.clone(); // world: the doorway high in the north wall
    const landing = door.clone().add(new THREE.Vector3(0, 1.7, 1.2)), edge = new THREE.Vector3(ST.c.x, ST.y0, ST.c.z - ST.r - 0.6).add(Wo).add(new THREE.Vector3(0, 1.7, 0));
    const nTurn = ST.turns * Math.PI * 2;
    const stairAt = (u) => { const a = ST.aTop - u * nTurn, y = ST.y0 * (1 - u); return { a, p: new THREE.Vector3(ST.c.x + Math.cos(a) * ST.r * 0.6, y, ST.c.z + Math.sin(a) * ST.r * 0.6).add(Wo) }; };
    const endPos = works.arrival.pos.clone(), endYaw = works.arrival.yaw;
    const endEye = endPos.clone().setY(endPos.y + 1.7);
    const A = 1.3, B = 3.2, C = 6.2, Dd = 15.5, DUR = 17.5;
    const leaves = story.back.worksLeaves || [];
    let swapped = false, opened = false, lastStep = -1;
    const K = works.cast.keaten;
    this.active = {
      name: 'works-in', dur: DUR,
      step: (t) => {
        const P = this.post.uniforms;
        if (t < A) { const k = ease(t / A); cam.position.lerpVectors(S0, front, k); cam.quaternion.copy(Q0).slerp(qDoor, k); return; }
        if (t < B) {
          const u = (t - A) / (B - A);
          if (!opened) { opened = true; story.sAudio.doorSwing(doorW.clone().setY(doorW.y + 1.2)); this.audio?.whoosh(3, true); }
          leaves.forEach((l) => { l.hinge.rotation.y = l.s * ease(Math.min(1, u * 1.6)) * Math.PI * 0.45; });
          cam.position.lerpVectors(front, into, ease(u)); cam.quaternion.copy(qDoor);
          P.uFlash.value = Math.pow(u, 1.6) * 1.6; P.uChroma.value = 0.002 * u;
          return;
        }
        if (!swapped) { swapped = true; leaves.forEach((l) => { l.hinge.rotation.y = 0; }); setRealm('works'); works.reset(); }
        if (t < C) { // the doorway: the hall opens out below you
          const u = (t - B) / (C - B), k = ease(u);
          const p = landing.clone().lerp(edge, k); cam.position.copy(p);
          const look = new THREE.Vector3(Wo.x - 2, Wo.y + 3 + 6 * (1 - k), Wo.z + 8);
          cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(p, look, new THREE.Vector3(0, 1, 0)));
          P.uFlash.value = 1.6 * Math.pow(Math.max(0, 1 - u * 1.4), 2);
          K.visible = true; const ks = stairAt(Math.min(1, 0.02 + u * 0.05)); K.place(ks.p.clone().sub(Wo), -ks.a + Math.PI); K.fig.pose = 'walk'; K.fig.speed = 1;
          return;
        }
        if (t < Dd) { // down the spiral behind Keaten
          const u = (t - C) / (Dd - C), k = u; // constant pace on the steps
          const s = stairAt(k), ahead = stairAt(Math.min(1, k + 0.035));
          const p = s.p.clone().setY(s.p.y + 1.7 + Math.abs(Math.sin(k * 120)) * 0.03); cam.position.copy(p);
          const ka = stairAt(Math.min(1, k + 0.07)); K.place(ka.p.clone().sub(Wo), Math.atan2(ahead.p.x - s.p.x, ahead.p.z - s.p.z)); K.fig.pose = 'walk'; K.fig.speed = 1;
          const look = ahead.p.clone().setY(ahead.p.y + 1.2).lerp(new THREE.Vector3(Wo.x, Wo.y + 1, Wo.z + 6), 0.35);
          cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(p, look, new THREE.Vector3(0, 1, 0)));
          const stepI = Math.floor(k * 60); if (stepI !== lastStep) { lastStep = stepI; if (stepI % 2 === 0) works.wAudio.tch(K.fig.group.getWorldPosition(new THREE.Vector3()), 0.18); }
          return;
        }
        const u = Math.min(1, (t - Dd) / (DUR - Dd)), k = ease(u);
        const s = stairAt(1); const p0 = s.p.clone().setY(s.p.y + 1.7);
        const p = p0.lerp(endEye, k); cam.position.copy(p);
        const dir = new THREE.Vector3(-Math.sin(endYaw), 0, -Math.cos(endYaw));
        const look = p.clone().addScaledVector(dir, 10); look.y -= 0.6 * (1 - k);
        cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(p, look, new THREE.Vector3(0, 1, 0)));
      },
      end: () => { this.player.teleport(endPos, endYaw, 0); works.start(); },
    };
    this.t = 0;
  }
  // Out: back up the spiral at a clip, into the white doorway, and out into the Backrooms corridor.
  worksOut({ story, works, setRealm }) {
    if (this.active) return;
    const cam = this.camera; this.player.enabled = false;
    const S0 = cam.position.clone(), Q0 = cam.quaternion.clone();
    const ST = works.stair, Wo = works.root.position, nTurn = ST.turns * Math.PI * 2;
    const stairAt = (u) => { const a = ST.aTop - u * nTurn, y = ST.y0 * (1 - u); return new THREE.Vector3(ST.c.x + Math.cos(a) * ST.r * 0.6, y + 1.7, ST.c.z + Math.sin(a) * ST.r * 0.6).add(Wo); };
    const doorW = story.back.worksDoor.clone().add(story.root.position);
    const endPos = doorW.clone().add(new THREE.Vector3(0, 0, -0.4)), endYaw = -Math.PI / 2; // facing on down the corridor
    const A = 0.8, B = 5.2, DUR = 7.2;
    let swapped = false;
    this.audio?.whoosh(2, true);
    this.active = {
      name: 'works-out', dur: DUR,
      step: (t) => {
        const P = this.post.uniforms;
        if (t < A) { const k = ease(t / A); cam.position.lerpVectors(S0, stairAt(1), k); cam.quaternion.copy(Q0); return; }
        if (t < B) {
          const u = (t - A) / (B - A), k = ease(u);
          const p = stairAt(1 - k), q = stairAt(Math.max(0, 1 - k - 0.05)); cam.position.copy(p);
          cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(p, q.setY(q.y + 0.4), new THREE.Vector3(0, 1, 0)));
          P.uFlash.value = Math.pow(Math.max(0, (u - 0.7) / 0.3), 2) * 1.6;
          return;
        }
        if (!swapped) { swapped = true; setRealm('story'); }
        const v = Math.min(1, (t - B) / (DUR - B));
        const p = endPos.clone().setY(endPos.y + 1.7).add(new THREE.Vector3(0, 0, 0.6 * (1 - ease(v)))); cam.position.copy(p);
        cam.quaternion.setFromEuler(new THREE.Euler(0, endYaw, 0, 'YXZ'));
        P.uFlash.value = 1.6 * Math.pow(Math.max(0, 1 - v * 1.6), 2);
      },
      end: () => { this.player.teleport(endPos, endYaw, 0); },
    };
    this.t = 0;
  }

  update(dt) {
    if (!this.active) return false;
    this.t += dt;
    const a = this.active;
    a.step(Math.min(this.t, a.dur));
    if (this.t >= a.dur) {
      a.end(); this.active = null;
      const P = this.post.uniforms; P.uWarp.value = 0; P.uChroma.value = 0; P.uSwirl.value = 0; P.uFlash.value = 0; P.uFade.value = 0;
      this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
      this.player.enabled = true;
    }
    return true;
  }
}
