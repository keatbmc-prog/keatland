// Post-processing: restrained bloom for the luminous accents, then a single finishing pass for
// lens warp / swirl (driven by transitions), chromatic fringe, vignette, film grain and a gentle
// split-tone grade (teal shadows, warm highlights).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uWarp: { value: 0 }, uSwirl: { value: 0 }, uChroma: { value: 0 },
    uFlash: { value: 0 }, uGrain: { value: 0.05 }, uVignette: { value: 1.0 }, uRes: { value: new THREE.Vector2(1, 1) }, uFade: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uWarp; uniform float uSwirl; uniform float uChroma;
    uniform float uFlash; uniform float uGrain; uniform float uVignette; uniform vec2 uRes; uniform float uFade;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      c.x *= uRes.x / uRes.y;
      float r = length(c);
      c *= 1.0 + uWarp * r * r * 1.6;
      float ang = uSwirl * pow(max(0.0, 1.0 - r * 1.2), 2.0);
      c = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * c;
      c.x /= uRes.x / uRes.y;
      vec2 uv = c + 0.5;
      vec2 dir = normalize(c + 1e-5) * (uChroma + 0.0012 * r * r);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;
      // grade
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col += vec3(-0.004, 0.010, 0.016) * (1.0 - smoothstep(0.0, 0.35, l));
      col *= mix(vec3(1.0), vec3(1.04, 1.0, 0.95), smoothstep(0.4, 1.0, l));
      // vignette
      float v = smoothstep(1.05, 0.25, r * uVignette);
      col *= mix(0.25, 1.0, v);
      // grain
      float g = hash(vUv * uRes + fract(uTime * 13.7) * 100.0) - 0.5;
      col += g * uGrain * (0.6 + 0.4 * (1.0 - l));
      col += vec3(1.0, 0.92, 0.75) * uFlash;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// Guards the HDR buffer: any NaN/Inf from a degenerate fragment would otherwise be smeared over
// the whole frame by the bloom mip chain. Also clamps fireflies.
const ScrubShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      c.rgb = min(c.rgb, vec3(40.0));
      gl_FragColor = c; }`,
};

export function createPost(renderer, scene, camera, quality) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (quality.scrub !== false) composer.addPass(new ShaderPass(ScrubShader));
  const size = renderer.getSize(new THREE.Vector2());
  let bloom = null;
  if (quality.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x * quality.bloomRes, size.y * quality.bloomRes), 0.7, 0.55, 0.62);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  finish.uniforms.uGrain.value = quality.grain ? 0.045 : 0;
  composer.addPass(finish);
  return {
    composer, bloom, uniforms: finish.uniforms,
    setSize(w, h, pr) { composer.setPixelRatio(pr); composer.setSize(w, h); finish.uniforms.uRes.value.set(w * pr, h * pr); },
    render(t) { finish.uniforms.uTime.value = t; composer.render(); },
  };
}
