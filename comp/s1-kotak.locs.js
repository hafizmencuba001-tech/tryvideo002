// Shared builders for the story locations (mamak, rumah, ...): a textured glossy floor (same reflection shader as the office floor),
// background box-people, glass tumblers, sign boards. All pure builders; no side effects on import.
import * as THREE from 'three';
import { box, slab, piv, std, glowMat, canvasTex, roundRect, rng, TAU, glow } from './s1-kotak.lib.js';

/** glossy floor with the fake planar reflection. draw(g, cx, cz, u): paint with world x in [-12,12], z in [-16,8] (canvas S x S, u = px per unit) */
export function makeFloorTex(reflTex, fogColor, fogDen, draw, o = {}) {
  const S = o.size || 2048;
  const { tex } = canvasTex(S, S, (g) => draw(g, (x) => (x + 12) / 24 * S, (z) => (z + 16) / 24 * S, S / 24));
  tex.anisotropy = 8;
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, refl: { value: reflTex }, res: { value: new THREE.Vector2(1080, 1920) }, fogColor: { value: new THREE.Color(fogColor) }, fogDen: { value: fogDen }, reflK: { value: o.reflK ?? 0.6 }, fres0: { value: o.fres0 ?? 0.38 } },
    vertexShader: 'varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D map, refl; uniform vec2 res; uniform vec3 fogColor; uniform float fogDen, reflK, fres0; varying vec3 vW; varying vec2 vUv;
      void main(){
        vec3 base = texture2D(map, vUv).rgb;
        vec2 suv = gl_FragCoord.xy / res;
        vec3 r = vec3(0.); float ws = 0.;
        for (int j = -3; j <= 3; j++) for (int i = -3; i <= 3; i++) {
          float fi = float(i), fj = float(j); float w = exp(-(fi*fi*0.12 + fj*fj*0.07));
          r += texture2D(refl, suv + vec2(fi * 0.0016, fj * 0.0030)).rgb * w; ws += w;
        }
        r /= ws;
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1. - clamp(V.y, 0., 1.), 2.2);
        float k = reflK * (fres0 + (1. - fres0) * fres);
        vec3 col = base + r * k;
        float d = length(cameraPosition - vW);
        float f = 1. - exp(-pow(d * fogDen, 2.));
        col = mix(col, fogColor, f);
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0, -4);
  return m;
}

/** soft blob shadow on the floor (not in the mirror/depth passes) */
export function blobShadow(parent, noMirror, noDepth, x, z, rx, rz, a = 0.6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radial(a), transparent: true, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.scale.set(rx * 2, rz * 2, 1); m.position.set(x, 0.004, z); m.renderOrder = 2; parent.add(m);
  noMirror.push(m); noDepth.push(m); return m;
}
const RAD = new Map();
function radial(a) {
  const k = a.toFixed(2); if (RAD.has(k)) return RAD.get(k);
  const t = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(0,0,10,${a})`); gr.addColorStop(1, 'rgba(0,0,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }).tex;
  RAD.set(k, t); return t;
}

/** a flat-lit text/sign board: returns the group; draw(g, w, h) paints the canvas */
export function signBoard(parent, w, h, px, draw, x, y, z, frameMat, mul = 1.0) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  box(g, w + 0.14, h + 0.14, 0.08, frameMat, 0, 0, 0, 0.03);
  const t = canvasTex(px, Math.round(px * h / w), (c) => draw(c, px, Math.round(px * h / w)));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t.tex, toneMapped: false }));
  m.material.color.setScalar(mul); m.position.z = 0.045; g.add(m);
  g.userData.canvas = t; g.userData.mesh = m;
  return g;
}

/** a small box-person for backgrounds (blurred by depth of field): torso, head cube with a dot face, optional seated legs. */
export function makeExtra(parent, o, x, y, z, yaw = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g);
  const skin = std(o.skin || '#a9714a', { roughness: 0.65 }), shirt = std(o.shirt || '#c0392b', { roughness: 0.6 }), hair = std(o.hair || '#15121a', { roughness: 0.5 });
  const seated = o.seated !== false;
  const torso = box(g, 0.7, 0.8, 0.42, shirt, 0, 1.0, 0, 0.06);
  box(g, 0.18, 0.1, 0.2, skin, 0, 1.45, 0, 0.03);
  const head = box(g, 0.64, 0.62, 0.52, skin, 0, 1.8, 0, 0.08);
  box(g, 0.66, 0.16, 0.54, hair, 0, 2.06, -0.01, 0.05);
  const face = canvasTex(128, 128, (c) => { c.fillStyle = '#2a140c'; c.fillRect(30, 50, 14, 20); c.fillRect(84, 50, 14, 20); c.fillRect(44, 92, 40, 8); });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.58), new THREE.MeshBasicMaterial({ map: face.tex, transparent: true, fog: true })); fp.position.set(0, 1.8, 0.265); fp.material.opacity = 0.9; g.add(fp);
  for (const sx of [-1, 1]) {
    box(g, 0.2, 0.7, 0.24, shirt, sx * 0.46, 1.0, 0.0, 0.05);
    if (seated) { box(g, 0.28, 0.2, 0.7, std('#2d3550'), sx * 0.2, 0.58, 0.3, 0.04); box(g, 0.26, 0.6, 0.26, std('#2d3550'), sx * 0.2, 0.25, 0.62, 0.04); }
    else box(g, 0.28, 0.9, 0.3, std('#2d3550'), sx * 0.2, 0.3, 0, 0.04);
  }
  return g;
}

/** drinking glass (translucent tumbler) with liquid + optional foam; returns {g, liquid} */
export function glassTumbler(parent, x, y, z, o = {}) {
  const g = piv(parent, x, y, z);
  const w = o.w || 0.2, h = o.h || 0.5;
  const glassM = new THREE.MeshStandardMaterial({ color: '#dfeaff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2 });
  const liquidM = std(o.liquid || '#b8793a', { roughness: 0.25, emissive: o.liquid || '#b8793a', emissiveIntensity: 0.12 });
  const liquid = box(g, w * 0.86, h * 0.72, w * 0.86, liquidM, 0, h * 0.4, 0, 0.02);
  const foam = box(g, w * 0.86, h * 0.08, w * 0.86, std(o.foam || '#f1dcb5', { roughness: 0.9 }), 0, h * 0.78, 0, 0.02);
  const shell = box(g, w, h, w, glassM, 0, h / 2, 0, 0.025); shell.castShadow = false;
  shell.renderOrder = 3;
  return { g, liquid, foam, shell };
}
export { box, slab, piv, std, glowMat, canvasTex, roundRect, rng, TAU, glow };
