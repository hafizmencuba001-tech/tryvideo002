// s1-kotak shared helpers: bevelled boxes, materials, canvas textures, glow sprites, seeded rng.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sm = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const kk = (t, a, b) => clamp((t - a) / (b - a));
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- bevelled box geometry (rounded edges and corners, flat faces) ---------------------------------------------------
const GEO = new Map();
export function bevGeo(w, h, d, r, K = 2) {
  r = Math.min(r, Math.min(w, h, d) / 2 - 1e-4);
  const key = [w, h, d, r, K].map((v) => v.toFixed(4)).join();
  if (GEO.has(key)) return GEO.get(key);
  const N = 2 * K + 1;
  const g = new THREE.BoxGeometry(w, h, d, N, N, N);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const remap = (u, half) => { const i = Math.round((u + half) / (2 * half) * N); return i <= K ? -half + r * i / K : half - r * (N - i) / K; };
  for (let i = 0; i < pos.count; i++) {
    const x = remap(pos.getX(i), hw), y = remap(pos.getY(i), hh), z = remap(pos.getZ(i), hd);
    const ix = clamp(x, -hw + r, hw - r), iy = clamp(y, -hh + r, hh - r), iz = clamp(z, -hd + r, hd - r);
    let dx = x - ix, dy = y - iy, dz = z - iz;
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    pos.setXYZ(i, ix + dx * r, iy + dy * r, iz + dz * r);
    nor.setXYZ(i, dx, dy, dz);
  }
  GEO.set(key, g);
  return g;
}

export const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o));
export const basic = (color, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color }, o));
/** emissive-looking unlit colour; mul > 1 pushes it into the bloom */
export const glowMat = (color, mul = 1.6) => { const m = new THREE.MeshBasicMaterial({ color }); m.color.multiplyScalar(mul); return m; };

export function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, r) {
  const m = new THREE.Mesh(bevGeo(w, h, d, r ?? Math.min(0.03, Math.min(w, h, d) * 0.32)), mat);
  m.position.set(x, y, z);
  if (!mat.isMeshBasicMaterial) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m);
  return m;
}
/** flat unbevelled slab (for panels, strips) */
export function slab(parent, w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (!mat.isMeshBasicMaterial) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m);
  return m;
}
export function piv(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// ---- canvas textures -------------------------------------------------------------------------------------------------
export function canvasTex(w, h, draw) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  if (draw) draw(g, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, canvas, g };
}
export function radialTex(inner, outer = 'rgba(0,0,0,0)', size = 128) {
  return canvasTex(size, size, (g) => {
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  }).tex;
}
const GLOWS = [];
/** additive glow sprite; collected so the depth pass can hide them */
export function glow(parent, color, size, x, y, z, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: false }));
  s.scale.set(size, size, 1); s.position.set(x, y, z); parent.add(s); GLOWS.push(s); return s;
}
export const glowList = GLOWS;

export function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
