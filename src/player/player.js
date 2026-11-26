// First-person walker: pointer-lock mouse look, WASD/arrows, Shift to run, smooth acceleration,
// head bob, gravity, stepping, and collision against the CollisionWorld. Touch input (joystick +
// drag-to-look) comes from src/player/touch.js.
import * as THREE from 'three';

export class Player {
  constructor(camera, collision, dom) {
    this.camera = camera; this.collision = collision; this.dom = dom;
    this.position = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.vy = 0;
    this.yaw = 0; this.pitch = 0; this.eye = 1.7; this.radius = 0.45;
    this.keys = new Set(); this.enabled = false; this.locked = false;
    this.bob = 0; this.grounded = true; this.shake = 0; this.lookSmooth = new THREE.Vector2();
    this.onInteract = null;
    addEventListener('keydown', (e) => { this.keys.add(e.code); if (e.code === 'KeyE' && !e.repeat && this.enabled) this.onInteract?.(); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => { if (!this.locked || !this.enabled) return; this.lookSmooth.x += e.movementX; this.lookSmooth.y += e.movementY; });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === dom; });
    // touch input is written here by TouchControls (src/player/touch.js): analog move + run flag
    this.touch = { mv: new THREE.Vector2(), run: false };
  }

  teleport(p, yaw = this.yaw, pitch = 0) {
    this.position.copy(p);
    const g = this.collision.groundAt(p.x, p.z, p.y + 2, 4);
    if (g !== null) this.position.y = g;
    this.yaw = yaw; this.pitch = pitch; this.vel.set(0, 0, 0); this.vy = 0;
    this.applyCamera(0);
  }

  update(dt) {
    if (!this.enabled) return;
    // mouse look (lightly smoothed)
    const take = Math.min(1, dt * 30);
    const dx = this.lookSmooth.x * take, dy = this.lookSmooth.y * take;
    this.lookSmooth.x -= dx; this.lookSmooth.y -= dy;
    this.yaw -= dx * 0.0022; this.pitch -= dy * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    // wish direction
    const k = this.keys;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    f -= this.touch.mv.y; s += this.touch.mv.x;
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || this.touch.run;
    const speed = run ? 7.2 : 3.8;
    const fw = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rt = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = fw.multiplyScalar(f).add(rt.multiplyScalar(s));
    if (wish.lengthSq() > 1) wish.normalize();
    wish.multiplyScalar(speed);
    const accel = wish.lengthSq() > 0 ? 9 : 7;
    this.vel.x += (wish.x - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (wish.z - this.vel.z) * Math.min(1, dt * accel);
    this.move(dt);
    this.applyCamera(dt);
  }

  move(dt) {
    const p = this.position;
    const tryMove = (nx, nz) => {
      const r = this.collision.resolve(nx, nz, this.radius);
      const g = this.collision.groundAt(r.x, r.z, p.y, 0.8);
      // also probe the body edge so we don't stand half over the void
      if (g === null) return false;
      p.x = r.x; p.z = r.z;
      if (g > p.y - 0.01) { p.y = g; this.vy = 0; this.grounded = true; } // step up / level
      else this.grounded = p.y - g < 0.05;
      return true;
    };
    const nx = p.x + this.vel.x * dt, nz = p.z + this.vel.z * dt;
    if (!tryMove(nx, nz)) { if (!tryMove(nx, p.z)) this.vel.x = 0; if (!tryMove(p.x, nz)) this.vel.z = 0; }
    // gravity
    const g = this.collision.groundAt(p.x, p.z, p.y, 0.8);
    if (g !== null && p.y > g + 0.001) { this.vy -= 22 * dt; p.y = Math.max(g, p.y + this.vy * dt); if (p.y === g) this.vy = 0; }
  }

  applyCamera(dt) {
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * sp * 1.9;
    const bobY = Math.sin(this.bob * 2) * 0.045 * Math.min(1, sp / 4);
    const bobX = Math.cos(this.bob) * 0.03 * Math.min(1, sp / 4);
    this.shake = Math.max(0, this.shake - dt * 1.5);
    const sh = this.shake * this.shake;
    const cam = this.camera;
    cam.position.set(this.position.x, this.position.y + this.eye + bobY, this.position.z);
    cam.position.x += Math.cos(this.yaw) * bobX + (Math.random() - 0.5) * sh * 0.25;
    cam.position.y += (Math.random() - 0.5) * sh * 0.2;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch + (Math.random() - 0.5) * sh * 0.02, this.yaw, Math.sin(this.bob) * 0.004 * Math.min(1, sp / 4));
  }
}
