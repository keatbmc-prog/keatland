// Global atmospheric fog: exponential distance fog * analytic height fog + slow drifting banks.
// We override three's fog shader chunks once, so EVERY material (built-in or custom ShaderMaterial
// with `fog: true`) gets the same atmosphere. scene.fog is a THREE.Fog whose fields are re-purposed:
//   fog.near -> density, fog.far -> time (seconds). fog.color is the base haze colour.
// A NEGATIVE density switches to plain daylight haze (no height fog, no drifting banks, no tint),
// used by the sunlit story realm.
import * as THREE from 'three';

export function installFogChunks({ cheap = false } = {}) {
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;
  THREE.ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vec4 klFogWP = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    klFogWP = instanceMatrix * klFogWP;
  #endif
  klFogWP = modelMatrix * klFogWP;
  vFogWorld = klFogWP.xyz;
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  uniform float fogNear; // density
  uniform float fogFar;  // time
  float klFogHash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float klFogVN(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(klFogHash(i+vec3(0,0,0)),klFogHash(i+vec3(1,0,0)),f.x),mix(klFogHash(i+vec3(0,1,0)),klFogHash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(klFogHash(i+vec3(0,0,1)),klFogHash(i+vec3(1,0,1)),f.x),mix(klFogHash(i+vec3(0,1,1)),klFogHash(i+vec3(1,1,1)),f.x),f.y),f.z); }
#endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
  {
    if (fogNear < 0.0) {
      float dd = length(vFogWorld - cameraPosition);
      float ff = 1.0 - exp(-(-fogNear) * dd);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, clamp(ff, 0.0, 1.0));
    } else {
    vec3 ro = cameraPosition;
    vec3 rd = vFogWorld - ro;
    float dist = length(rd);
    // height fog: density falls off above h0, thickens in the void below the hub
    const float h0 = 4.0; const float k = 0.035;
    float ya = ro.y - h0, yb = vFogWorld.y - h0;
    float dy = yb - ya;
    float hf = abs(dy) > 0.01 ? (exp(-k*ya) - exp(-k*yb)) / (k*dy) : exp(-k*ya);
    hf = clamp(hf, 0.05, 1.8);
    // slow drifting banks
    vec3 q = vFogWorld * 0.025 + vec3(fogFar*0.012, -fogFar*0.004, fogFar*0.008);
    float banks = ${cheap ? '0.65 + 0.7 * 0.25 + 0.0 * q.x; // phones: no 3D value noise per pixel' : '0.65 + 0.7 * klFogVN(q) * klFogVN(q*2.3+3.1);'}
    float fogF = 1.0 - exp(-fogNear * dist * (0.35 + 0.65*hf) * banks);
    fogF = clamp(fogF, 0.0, 1.0);
    // haze tint: deep teal-violet low, near-black high
    float up = clamp((vFogWorld.y + 60.0) / 160.0, 0.0, 1.0);
    vec3 fc = mix(fogColor * vec3(1.1, 0.9, 1.25), fogColor * 0.5, up);
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fc, fogF );
    }
  }
#endif`;
}
