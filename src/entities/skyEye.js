// An eye the size of a weather system, far out in the dark. It sleeps, opens slowly, wanders,
// finds you, and stares. The sword wakes it at once. One sphere + a shader: sclera, sun-iris and
// eyelids are all drawn analytically so it stays crisp at any distance.
import * as THREE from 'three';
import { getTextures, U } from '../materials/library.js';
import { GLSL_NOISE } from '../core/noise.js';

export class SkyEye {
  constructor(scene, sky) {
    const T = getTextures();
    this.sky = sky;
    this.group = new THREE.Group();
    this.group.position.set(70, 300, -540);
    scene.add(this.group);
    this.open = 0; this.openTarget = 0; this.state = 'sleep'; this.stateT = 0; this.stateDur = 14;
    this.lookDir = new THREE.Vector3(0, -0.4, 1).normalize(); this.wander = this.lookDir.clone();
    this.uniforms = { uTime: U.time, uOpen: { value: 0 }, uIris: { value: T.iris }, uHeart: U.heartbeat, uLook: { value: new THREE.Vector2() } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vP; varying vec3 vN; varying vec3 vV;
        void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`
        varying vec3 vP; varying vec3 vN; varying vec3 vV;
        uniform float uTime; uniform float uOpen; uniform sampler2D uIris; uniform float uHeart; uniform vec2 uLook;
        ${GLSL_NOISE}
        void main(){
          vec3 p = normalize(vP);
          // eye faces +Z in local space; lids are a lens shape in x/y
          float x = p.x, y = p.y;
          float lens = uOpen * 0.62 * (1.0 - x*x*1.15);
          float inside = step(0.0, p.z) * smoothstep(0.0, 0.015, lens - abs(y + 0.03*sin(x*9.0+uTime*0.3)));
          // sclera
          float veins = pow(clamp(1.0 - abs(kl_snoise(p * 6.0)),0.0,1.0), 14.0) + pow(clamp(1.0 - abs(kl_snoise(p * 13.0 + 3.0)),0.0,1.0), 20.0) * 0.6;
          vec3 scl = mix(vec3(0.55, 0.50, 0.42), vec3(0.6, 0.06, 0.08), veins * 0.8) * (0.35 + 0.65 * p.z);
          // iris (projected)
          vec2 iuv = (p.xy - uLook) / 0.36 * 0.5 + 0.5;
          float ir = length(p.xy - uLook);
          vec3 col = scl;
          if (ir < 0.36 && p.z > 0.0) { vec3 ic = texture2D(uIris, iuv).rgb; col = ic * (1.2 + uHeart * 0.5); }
          // lids: heavy dark flesh with creases and lashes-shadow
          float crease = 0.5 + 0.5 * sin(y * 40.0 + kl_snoise(p*4.0)*3.0);
          vec3 lid = vec3(0.07, 0.035, 0.045) * (0.6 + 0.4 * crease);
          float rim = pow(1.0 - max(0.0, dot(normalize(vN), normalize(vV))), 3.0);
          lid += vec3(0.25, 0.08, 0.06) * rim;
          float lidEdge = smoothstep(0.08, 0.0, abs(lens - abs(y)));
          lid += vec3(0.35, 0.12, 0.05) * lidEdge * uOpen;
          vec3 c = mix(lid, col, inside);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(70, 96, 64), mat);
    this.group.add(this.ball);
    // folds of the socket
    const fold = new THREE.Mesh(new THREE.TorusGeometry(72, 16, 24, 96), new THREE.ShaderMaterial({
      fog: false, uniforms: { uTime: U.time },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform float uTime; ${GLSL_NOISE}
        void main(){ vec3 p = position + normal * kl_snoise(position*0.04 + uTime*0.03) * 6.0; vP = p; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(p,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ float rim = pow(1.0 - max(0.0, dot(normalize(vN), normalize(vV))), 2.5); gl_FragColor = vec4(vec3(0.03,0.018,0.024) + vec3(0.16,0.06,0.07)*rim, 1.0); }`,
    }));
    fold.scale.set(1.25, 0.9, 1); fold.position.z = -10;
    this.group.add(fold);
    this.fold = fold;
  }
  wake(strength = 1) { this.state = 'stare'; this.stateT = 0; this.stateDur = 10 * strength + 4; }
  update(dt, t, camera) {
    this.stateT += dt;
    const toCam = camera.position.clone().sub(this.group.position).normalize();
    if (this.stateT > this.stateDur) {
      const order = { sleep: 'opening', opening: 'wander', wander: 'stare', stare: 'sleep' };
      this.state = order[this.state]; this.stateT = 0;
      this.stateDur = { sleep: 22 + Math.random() * 18, opening: 6, wander: 10, stare: 9 }[this.state];
      this.wander = new THREE.Vector3(Math.random() - 0.5, -0.6 + Math.random() * 0.4, 1).normalize();
    }
    this.openTarget = { sleep: 0.0, opening: 0.8, wander: 0.85, stare: 1.0 }[this.state];
    this.open += (this.openTarget - this.open) * Math.min(1, dt * (this.state === 'stare' && this.stateT < 1 ? 2.5 : 0.35));
    const want = this.state === 'stare' ? toCam : this.wander;
    this.lookDir.lerp(want, Math.min(1, dt * 0.5)).normalize();
    // keep the ball facing roughly the hub; move the iris for gaze
    this.group.lookAt(new THREE.Vector3(0, 30, 0));
    const local = this.lookDir.clone().applyQuaternion(this.group.quaternion.clone().invert());
    this.uniforms.uLook.value.set(THREE.MathUtils.clamp(local.x, -0.45, 0.45), THREE.MathUtils.clamp(local.y, -0.3, 0.3));
    // blink now and then
    let o = this.open; const bl = (t % 13.0); if (bl < 0.25) o *= Math.abs(bl - 0.125) / 0.125;
    this.uniforms.uOpen.value = o;
    this.sky.material.uniforms.uEyeDir.value.copy(this.group.position).normalize();
  }
}
