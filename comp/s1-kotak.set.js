// s1-kotak set: night office. Floor (glossy, fake reflection), walls + window with a box city, desk, chair, cabinet, sad plant, clock, props.
import * as THREE from 'three';
import { box, slab, piv, std, basic, glowMat, canvasTex, radialTex, glow, rng, TAU, roundRect } from './s1-kotak.lib.js';
import { buildMonitor } from './s1-kotak.screen.js';

export const NO_MIRROR = []; // things that must not show in the mirror pass (blob shadows, glass)
export const NO_DEPTH = [];  // things that must not write the depth pass (glass, haze)

// ---- glossy floor with screen-space reflection of the mirrored world -------------------------------------------------
export function makeFloor(reflTex, fogColor, fogDen, o = {}) {
  const cz1 = o.carpetZ1 ?? 0.6; // front edge of the rug (world z); stories pull it toward the camera so the lower frame has content
  const S = 2048, R = rng(5);
  const { tex } = canvasTex(S, S, (g) => {
    g.fillStyle = '#0a0d1f'; g.fillRect(0, 0, S, S);
    // world->canvas: x in [-12,12], z in [-16,8]
    const cx = (x) => (x + 12) / 24 * S, cz = (z) => (z + 16) / 24 * S, u = S / 24;
    // soft tile seams
    g.strokeStyle = 'rgba(70,90,170,.16)'; g.lineWidth = 2;
    for (let i = -12; i <= 12; i += 1.2) { g.beginPath(); g.moveTo(cx(i), 0); g.lineTo(cx(i), S); g.stroke(); }
    for (let k = -16; k <= 8; k += 1.2) { g.beginPath(); g.moveTo(0, cz(k)); g.lineTo(S, cz(k)); g.stroke(); }
    const pool = (x, z, rx, rz, col, a) => { g.save(); g.translate(cx(x), cz(z)); g.scale(rx * u, rz * u); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); };
    pool(0, -3.2, 5.0, 2.0, 'rgba(25,200,255,A)', 0.28);     // window cyan spill
    pool(-3.6, -2.0, 3.0, 3.4, 'rgba(255,47,180,A)', 0.30);  // magenta strip spill
    pool(3.6, -2.4, 2.8, 3.0, 'rgba(25,227,255,A)', 0.20);
    pool(0.3, -0.6, 3.2, 3.6, 'rgba(120,150,255,A)', 0.28);  // monitor glow on the floor
    pool(-0.2, -1.9, 2.0, 1.0, 'rgba(255,47,180,A)', 0.30);  // under-desk led
    // carpet under the desk area
    const rd = cz1 + 3.0; // rug depth
    g.fillStyle = 'rgba(30,38,92,.9)'; g.fillRect(cx(-1.9), cz(-3.0), 4.6 * u, rd * u);
    g.strokeStyle = 'rgba(25,227,255,.55)'; g.lineWidth = 5; g.strokeRect(cx(-1.9), cz(-3.0), 4.6 * u, rd * u);
    g.strokeStyle = 'rgba(255,47,180,.35)'; g.lineWidth = 3; g.strokeRect(cx(-1.75), cz(-2.85), 4.3 * u, (rd - 0.3) * u);
    // speckle
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(120,140,220,${R() * 0.05})`; g.fillRect(R() * S, R() * S, 2, 2); }
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, refl: { value: reflTex }, res: { value: new THREE.Vector2(1080, 1920) }, fogColor: { value: new THREE.Color(fogColor) }, fogDen: { value: fogDen }, reflK: { value: 0.85 } },
    vertexShader: 'varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D map, refl; uniform vec2 res; uniform vec3 fogColor; uniform float fogDen, reflK; varying vec3 vW; varying vec2 vUv;
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
        float k = reflK * (0.38 + 0.62 * fres);
        vec3 col = base * 1.0 + r * k;
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

function blob(parent, x, z, rx, rz, a = 0.6, rot = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex(`rgba(0,0,10,${a})`, 'rgba(0,0,10,0)'), transparent: true, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.scale.set(rx * 2, rz * 2, 1); m.position.set(x, 0.004, z); m.renderOrder = 2; parent.add(m);
  NO_MIRROR.push(m); NO_DEPTH.push(m); return m;
}

// ---- city behind the window -------------------------------------------------------------------------------------------
function cityTile(seed, lit) {
  const R = rng(seed);
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#0b0f2c'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) {
      const on = R() < lit;
      if (!on) { g.fillStyle = '#121840'; } else { const c = R(); g.fillStyle = c < 0.55 ? '#ffd27a' : c < 0.8 ? '#ff9bd8' : c < 0.93 ? '#8defff' : '#ffffff'; }
      g.fillRect(x * 21 + 5, y * 16 + 4, 11, 8);
    }
  }).tex;
}
function buildCity(world) {
  const R = rng(21), tiles = [cityTile(1, 0.55), cityTile(2, 0.4), cityTile(3, 0.7), cityTile(4, 0.3)];
  tiles.forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; });
  const g = new THREE.Group(); world.add(g);
  // sky
  const sky = canvasTex(8, 256, (c) => { const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#07072a'); gr.addColorStop(0.55, '#1b1052'); gr.addColorStop(0.82, '#6a1f78'); gr.addColorStop(1, '#d6489a'); c.fillStyle = gr; c.fillRect(0, 0, 8, 256); }).tex;
  const skyM = new THREE.Mesh(new THREE.PlaneGeometry(160, 70), new THREE.MeshBasicMaterial({ map: sky, fog: false })); skyM.position.set(0, 16, -60); g.add(skyM);
  for (let layer = 0; layer < 4; layer++) {
    const z0 = -9 - layer * 6;
    let x = -34;
    while (x < 34) {
      const w = 2.2 + R() * 3.2, h = 4 + R() * (6 + layer * 2.2), d = 3 + R() * 3;
      const tx = tiles[(R() * 4) | 0].clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(Math.max(1, Math.round(w / 1.5)), Math.max(1, Math.round((h + 3) / 2.2)));
      const m = new THREE.MeshBasicMaterial({ map: tx });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h + 3, d), m); b.position.set(x + w / 2, (h + 3) / 2 - 3, z0 - R() * 3); g.add(b);
      if (R() < 0.35) { // rooftop light
        glow(g, R() < 0.5 ? 'rgba(255,60,90,.9)' : 'rgba(25,227,255,.9)', 0.9, b.position.x, h + 0.2, b.position.z + d / 2, 0.9);
      }
      if (R() < 0.18) { // lit sign
        const sg = box(g, Math.min(w * 0.6, 1.0), 0.4, 0.1, glowMat(R() < 0.5 ? '#ff2fb4' : '#19e3ff', 1.2), b.position.x, 1 + R() * (h - 2), b.position.z + d / 2 + 0.06, 0.03);
      }
      x += w + 0.15 + R() * 0.6;
    }
  }
  return g;
}

// ---- environment (for glossy reflections on the robot/office materials) --------------------------------------------
export function buildEnvScene() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: '#0d1030', side: THREE.BackSide }));
  s.add(room);
  const strip = (w, h, x, y, z, ry, c, m = 6) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glowMat(c, m)); p.position.set(x, y, z); p.rotation.y = ry; s.add(p); return p; };
  strip(10, 0.7, 0, 5, -9.5, 0, '#19e3ff', 7);          // cyan back strip
  strip(0.7, 8, -9.5, 1, 0, Math.PI / 2, '#ff2fb4', 7);  // magenta left
  strip(0.7, 8, 9.5, 1, 0, -Math.PI / 2, '#19e3ff', 5);  // cyan right
  strip(6, 4, 0, 1.5, 9.5, Math.PI, '#7fa6ff', 2.5);     // cool monitor-ish front fill
  strip(8, 8, 0, 6, 0, 0, '#6c78d8', 0.5).rotation.x = Math.PI / 2;
  return s;
}

// ---- main set --------------------------------------------------------------------------------------------------------
export function buildSet(world, floorMesh, opts = {}) {
  const refs = {};
  // palette
  const wallM = std('#1a1f45', { roughness: 0.85 }), wallD = std('#12163a', { roughness: 0.9 });
  const trim = std('#0d1028', { roughness: 0.5, metalness: 0.4 });
  const woodD = std('#33243a', { roughness: 0.28, metalness: 0.1 }), woodTop = std('#3b2a46', { roughness: 0.18, metalness: 0.2 });
  const metalM = std('#59647f', { roughness: 0.35, metalness: 0.75 }), metalD = std('#2d3550', { roughness: 0.4, metalness: 0.7 });

  world.add(floorMesh);
  // back wall around the window opening
  const WZ = -3.6, WT = 0.3, WH = 6.4;
  const wx0 = -1.9, wx1 = 0.8, wy0 = 1.85, wy1 = 4.6;
  slab(world, 14 - 0, wy0, WT, wallM, 0, wy0 / 2, WZ - WT / 2);
  slab(world, wx0 + 7, wy1 - wy0, WT, wallM, (wx0 - 7) / 2, (wy0 + wy1) / 2, WZ - WT / 2);
  slab(world, 7 - wx1, wy1 - wy0, WT, wallM, (wx1 + 7) / 2, (wy0 + wy1) / 2, WZ - WT / 2);
  slab(world, 14, WH - wy1, WT, wallM, 0, (wy1 + WH) / 2, WZ - WT / 2);
  // wall panel seams
  for (let i = -6; i <= 6; i += 1.4) if (i < wx0 - 0.1 || i > wx1 + 0.1) slab(world, 0.04, wy1 - 0.2, 0.02, wallD, i, 2.4, WZ + 0.01);
  slab(world, 14, 0.16, 0.06, trim, 0, 0.08, WZ + 0.03); // skirting
  // window frame + glass + mullions + neon outline
  const fcx = (wx0 + wx1) / 2, fcy = (wy0 + wy1) / 2, fw = wx1 - wx0, fh = wy1 - wy0;
  box(world, fw + 0.2, 0.12, 0.2, trim, fcx, wy0 - 0.02, WZ + 0.04, 0.02);
  box(world, fw + 0.2, 0.12, 0.2, trim, fcx, wy1 + 0.02, WZ + 0.04, 0.02);
  box(world, 0.12, fh + 0.2, 0.2, trim, wx0 - 0.02, fcy, WZ + 0.04, 0.02);
  box(world, 0.12, fh + 0.2, 0.2, trim, wx1 + 0.02, fcy, WZ + 0.04, 0.02);
  box(world, 0.07, fh, 0.12, trim, fcx + 0.15, fcy, WZ - 0.02, 0.015);
  box(world, fw, 0.07, 0.12, trim, fcx, fcy + 0.35, WZ - 0.02, 0.015);
  slab(world, fw + 0.38, 0.03, 0.03, glowMat('#ff2fb4', 1.7), fcx, wy1 + 0.12, WZ + 0.16);
  slab(world, 0.03, fh + 0.3, 0.03, glowMat('#19e3ff', 1.7), wx0 - 0.12, fcy, WZ + 0.16);
  slab(world, 0.03, fh + 0.3, 0.03, glowMat('#19e3ff', 1.7), wx1 + 0.12, fcy, WZ + 0.16);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ color: '#8fb6ff', transparent: true, opacity: 0.06, roughness: 0.02, metalness: 0.9 }));
  glass.position.set(fcx, fcy, WZ + 0.0); world.add(glass); NO_MIRROR.push(glass); NO_DEPTH.push(glass);
  buildCity(world);
  // side walls
  slab(world, 0.3, WH, 9, wallD, -3.55, WH / 2, WZ + 4.5);
  slab(world, 0.3, WH, 9, wallD, 3.75, WH / 2, WZ + 4.5);
  // neon wall strips
  slab(world, 0.06, 4.0, 0.06, glowMat('#ff2fb4', 1.8), -2.5, 3.2, WZ + 0.05);
  slab(world, 0.06, 3.0, 0.06, glowMat('#19e3ff', 1.8), 1.15, 3.0, WZ + 0.05);
  glow(world, 'rgba(255,47,180,.7)', 2.8, -2.5, 3.2, WZ + 0.5, 0.35);
  glow(world, 'rgba(25,227,255,.7)', 2.8, 1.15, 3.0, WZ + 0.5, 0.3);
  glow(world, 'rgba(25,227,255,.6)', 5.0, fcx, fcy, WZ + 1.2, 0.35);

  // clock 11:48 PM
  const clock = new THREE.Group(); clock.position.set(1.4, 3.5, WZ + 0.1); world.add(clock);
  box(clock, 0.74, 0.46, 0.1, trim, 0, 0, 0, 0.04);
  const ct = canvasTex(512, 320, (g) => {
    g.fillStyle = '#080a16'; g.fillRect(0, 0, 512, 320);
    const SEG = { 0: 'abcdef', 1: 'bc', 4: 'bcfg', 8: 'abcdefg' };
    const seg = (x, y, w, h, on) => { g.fillStyle = on ? '#ff5a3a' : 'rgba(255,90,58,.07)'; g.shadowColor = '#ff5a3a'; g.shadowBlur = on ? 22 : 0; g.fillRect(x, y, w, h); };
    const digit = (x, y, ch) => { const on = SEG[ch], T = 20, Wd = 64, Hd = 80; const s2 = (k, ax, ay, w, h) => seg(ax, ay, w, h, on.includes(k));
      s2('a', x + T, y, Wd, T); s2('g', x + T, y + Hd + T / 2 - T / 2, Wd, T); s2('d', x + T, y + 2 * Hd + 0, Wd, T);
      s2('f', x, y + T, T, Hd - T / 2 + 2); s2('b', x + Wd + T, y + T, T, Hd - T / 2 + 2); s2('e', x, y + Hd + T, T, Hd - T / 2 + 2); s2('c', x + Wd + T, y + Hd + T, T, Hd - T / 2 + 2); };
    const y0 = 52;
    digit(26, y0, 1); digit(140, y0, 1); digit(292, y0, 4); digit(396, y0 - 0, 8);
    g.fillStyle = '#ff5a3a'; g.shadowBlur = 20; g.fillRect(262, y0 + 52, 16, 16); g.fillRect(262, y0 + 112, 16, 16);
    g.shadowBlur = 0; g.font = '700 38px Menlo, monospace'; g.textAlign = 'left'; g.fillText('PM', 24, 300);
  });
  const cm = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.38), new THREE.MeshBasicMaterial({ map: ct.tex, toneMapped: false })); cm.material.color.setScalar(1.3); cm.position.z = 0.054; clock.add(cm);
  glow(clock, 'rgba(255,90,58,.7)', 1.5, 0, 0, 0.3, 0.35);
  refs.clock = clock;

  // wall poster: falling chart
  const poster = new THREE.Group(); poster.position.set(-2.55, 2.75, WZ + 0.05); world.add(poster);
  box(poster, 0.95, 1.2, 0.06, trim, 0, 0, 0, 0.02);
  const pt = canvasTex(380, 480, (g) => {
    g.fillStyle = '#10142f'; g.fillRect(0, 0, 380, 480);
    g.fillStyle = '#9fb0e6'; g.font = '700 38px Menlo, monospace'; g.textAlign = 'left'; g.fillText('JUALAN Q3', 28, 62);
    g.strokeStyle = 'rgba(160,180,255,.25)'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(28, 120 + i * 60); g.lineTo(352, 120 + i * 60); g.stroke(); }
    g.strokeStyle = '#ff4766'; g.lineWidth = 10; g.lineJoin = 'round'; g.beginPath(); [[28, 150], [100, 190], [170, 170], [240, 280], [310, 370], [352, 400]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.fillStyle = '#ff4766'; g.beginPath(); g.moveTo(352, 424); g.lineTo(322, 392); g.lineTo(366, 380); g.closePath(); g.fill();
  });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 1.06), new THREE.MeshBasicMaterial({ map: pt.tex, toneMapped: false })); pm.material.color.setScalar(0.8); pm.position.z = 0.034; poster.add(pm);

  // ---- desk ----------------------------------------------------------------------------------------------------------
  const D = new THREE.Group(); D.position.set(-0.1, 0, -2.0); world.add(D);
  box(D, 2.7, 0.07, 1.1, woodTop, 0, 0.8, 0, 0.025);
  box(D, 0.7, 0.74, 0.96, woodD, -0.95, 0.4, 0, 0.03);
  for (let i = 0; i < 3; i++) { box(D, 0.6, 0.2, 0.03, std('#2a1d33', { roughness: 0.3, metalness: 0.2 }), -0.95, 0.12 + i * 0.23 + 0.12, 0.49, 0.015); box(D, 0.2, 0.025, 0.03, metalM, -0.95, 0.12 + i * 0.23 + 0.17, 0.52, 0.01); }
  box(D, 0.07, 0.74, 0.96, woodD, 1.25, 0.4, 0, 0.025);
  box(D, 1.9, 0.5, 0.04, woodD, 0.28, 0.5, -0.46, 0.015);
  slab(D, 2.62, 0.02, 0.02, glowMat('#ff2fb4', 1.9), 0, 0.745, 0.5);   // under-edge neon (front)
  glow(D, 'rgba(255,47,180,.8)', 3.0, 0, 0.55, 0.7, 0.28);
  slab(D, 2.62, 0.012, 0.012, glowMat('#19e3ff', 1.6), 0, 0.838, 0.548);
  refs.desk = D;
  // monitor
  const mon = buildMonitor(box, slab, std, glowMat, opts.screen); mon.position.set(-0.55, 0.835 + mon.userData.baseY, -2.0 + 0.05); mon.rotation.y = 0.42; D.parent.add(mon);
  mon.position.set(-0.3, 0.835 + mon.userData.baseY, -2.0);
  refs.monitor = mon; refs.screen = mon.userData.screenApi;
  // keyboard, mouse, mug, papers, lamp
  const st = !!opts.story; // story layout: keyboard centred under the monitor so the intern can type at it, mug/mouse moved aside
  const kb = box(D, 0.78, 0.03, 0.26, std('#10131f', { roughness: 0.4, metalness: 0.4 }), st ? -0.05 : -0.35, 0.85, st ? 0.36 : 0.28, 0.012); kb.rotation.y = st ? 0.1 : 0.2;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) { const k = box(kb, 0.052, 0.012, 0.042, std('#2a3150', { roughness: 0.4 }), -0.33 + c * 0.06, 0.02, -0.08 + r * 0.055, 0.004); if (r === 3 && c > 2 && c < 8) k.scale.x = 1; }
  box(D, 0.09, 0.025, 0.14, std('#10131f', { roughness: 0.4 }), st ? 0.56 : 0.17, 0.845, 0.3, 0.01);
  const mug = box(D, 0.14, 0.17, 0.14, std('#e9e4da', { roughness: 0.35 }), (st ? 0.86 : 0.45), 0.915, 0.25, 0.03); const mugH = box(D, 0.05, 0.1, 0.03, std('#e9e4da', { roughness: 0.35 }), (st ? 0.95 : 0.54), 0.915, 0.25, 0.01);
  const coffee = slab(D, 0.12, 0.012, 0.12, std('#3a1f14', { roughness: 0.2 }), (st ? 0.86 : 0.45), 0.995, 0.25);
  refs.kb = kb; refs.deskThings = [mug, mugH, coffee, kb]; // things that jump when the boss slams the desk
  // paper stack + sticky notes
  for (let i = 0; i < 6; i++) { const p = box(D, 0.36, 0.012, 0.28, std(i % 2 ? '#e9ecf5' : '#f4f6fb', { roughness: 0.8 }), (st ? 0.55 : 0.85), 0.842 + i * 0.012, -0.2, 0.004); p.rotation.y = i * 0.12 - 0.2; refs.deskThings.push(p); }
  const notes = ['#ffd03a', '#ff7fb8', '#7fe0ff'];
  notes.forEach((c, i) => { const n = box(refs.monitor, 0.1, 0.1, 0.006, std(c, { roughness: 0.7, emissive: c, emissiveIntensity: 0.15 }), 0.62 + (i % 2) * 0.03, 0.34 - i * 0.12, 0.056, 0.002); n.rotation.z = (i - 1) * 0.12; });
  // desk lamp (box style) at the far left
  const lamp = piv(D, -0.98, 0.835, -0.3);
  box(lamp, 0.2, 0.04, 0.2, metalD, 0, 0.02, 0, 0.012);
  box(lamp, 0.04, 0.34, 0.04, metalM, 0, 0.2, 0, 0.012);
  const arm = box(lamp, 0.04, 0.3, 0.04, metalM, 0.08, 0.46, 0, 0.012); arm.rotation.z = -0.5;
  box(lamp, 0.22, 0.09, 0.13, metalD, 0.22, 0.6, 0, 0.02);
  slab(lamp, 0.19, 0.01, 0.1, glowMat('#ffd9a0', 2.0), 0.22, 0.553, 0);
  glow(lamp, 'rgba(255,200,130,.8)', 0.5, 0.22, 0.52, 0, 0.3);
  refs.lamp = lamp; refs.lampPos = lamp.localToWorld(new THREE.Vector3(0.22, 0.45, 0));

  // ---- chair (the intern stands on the seat) -----------------------------------------------------------------------------
  const chair = new THREE.Group(); chair.position.set(0.55, 0, -1.0); chair.rotation.y = -0.4; world.add(chair);
  const fab = std('#242a4a', { roughness: 0.75 }), fabL = std('#2f3764', { roughness: 0.7 });
  box(chair, 0.62, 0.11, 0.6, fabL, 0, 0.5, 0, 0.05);
  box(chair, 0.58, 0.64, 0.1, fab, 0, 0.9, -0.3, 0.05);
  box(chair, 0.08, 0.22, 0.1, metalD, 0, 0.72, -0.3, 0.02);
  for (const sx of [-1, 1]) { box(chair, 0.06, 0.05, 0.38, metalD, sx * 0.34, 0.68, -0.02, 0.02); box(chair, 0.05, 0.16, 0.05, metalD, sx * 0.34, 0.6, 0.12, 0.015); }
  box(chair, 0.08, 0.3, 0.08, metalM, 0, 0.3, 0, 0.025);
  for (let i = 0; i < 5; i++) { const a = new THREE.Group(); a.rotation.y = i * TAU / 5 + 0.3; chair.add(a); box(a, 0.07, 0.05, 0.36, metalD, 0, 0.14, 0.19, 0.02); box(a, 0.07, 0.07, 0.08, std('#0b0d16', { roughness: 0.4 }), 0, 0.05, 0.37, 0.025); }
  refs.chair = chair; refs.seatTop = 0.555;

  // ---- filing cabinet + sad plant ------------------------------------------------------------------------------------
  const cab = new THREE.Group(); cab.position.set(opts.cab ? opts.cab[0] : -1.45, 0, opts.cab ? opts.cab[1] : -3.1); world.add(cab); refs.cab = cab;
  box(cab, 0.66, 1.34, 0.7, metalM, 0, 0.67, 0, 0.04);
  for (let i = 0; i < 3; i++) {
    box(cab, 0.58, 0.38, 0.03, metalD, 0, 0.23 + i * 0.43, 0.355, 0.015);
    box(cab, 0.22, 0.04, 0.04, std('#c9d3ee', { metalness: 0.9, roughness: 0.25 }), 0, 0.3 + i * 0.43, 0.39, 0.015);
    box(cab, 0.15, 0.07, 0.015, std('#e8ecf7', { roughness: 0.5 }), 0, 0.1 + i * 0.43 + 0.07, 0.375, 0.004);
  }
  // plant on top: droopy leaves
  const pot = piv(D, -1.28, 0.835, 0.05);
  box(pot, 0.3, 0.26, 0.3, std('#b5532e', { roughness: 0.8 }), 0, 0.13, 0, 0.03);
  box(pot, 0.34, 0.05, 0.34, std('#c9663b', { roughness: 0.8 }), 0, 0.27, 0, 0.02);
  box(pot, 0.26, 0.02, 0.26, std('#2a1a12'), 0, 0.29, 0, 0.005);
  const leaf1 = std('#8a9a3a', { roughness: 0.7 }), leaf2 = std('#a89a36', { roughness: 0.7 }), leafBrown = std('#7a5a2a', { roughness: 0.8 });
  const R = rng(9);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU, st = new THREE.Group(); st.rotation.y = a; st.position.y = 0.3; pot.add(st);
    const stem = box(st, 0.025, 0.3 + (i % 2) * 0.08, 0.025, std('#6a7a30'), 0.03, 0.15, 0, 0.008); stem.rotation.z = -0.25 - R() * 0.15;
    const lf = box(st, 0.27, 0.03, 0.15, i % 3 === 0 ? leaf2 : leaf1, 0.22, 0.4 - (i % 2) * 0.05, 0, 0.01); lf.rotation.z = -0.9 - R() * 0.35;  // droop
    box(lf, 0.06, 0.02, 0.09, leafBrown, 0.12, 0, 0, 0.008);
  }
  refs.plantPos = new THREE.Vector3(-1.38, 1.3, -1.95);
  // papers on cabinet
  for (let i = 0; i < 4; i++) { const p = box(cab, 0.26, 0.012, 0.2, std('#e8ecf5', { roughness: 0.8 }), -0.2, 1.355 + i * 0.012, 0.1, 0.004); p.rotation.y = 0.3 + i * 0.12; }

  // ---- misc: bin with crumpled paper, cables, shelf of binders, server box ---------------------------------------------
  const bin = new THREE.Group(); bin.position.set(1.8, 0, -2.3); world.add(bin);
  box(bin, 0.34, 0.4, 0.34, metalD, 0, 0.2, 0, 0.03);
  for (let i = 0; i < 5; i++) { const c = box(bin, 0.13, 0.12, 0.13, std('#e6e9f2', { roughness: 0.9 }), -0.07 + (i % 3) * 0.07, 0.43 + (i % 2) * 0.05, -0.04 + (i % 2) * 0.08, 0.035); c.rotation.set(i, i * 1.3, i * 0.7); }
  for (let i = 0; i < 3; i++) { const c = box(world, 0.13, 0.12, 0.13, std('#e6e9f2', { roughness: 0.9 }), 1.2 + i * 0.12, 0.06, -1.9 + i * 0.1, 0.035); c.rotation.set(i, i * 1.3, i * 0.7); }
  // binders on the right wall shelf
  const shelf = new THREE.Group(); shelf.position.set(2.6, 2.3, WZ + 0.2); world.add(shelf);
  box(shelf, 1.3, 0.05, 0.36, trim, 0, 0, 0, 0.015);
  const bc = ['#ff7d1c', '#19e3ff', '#ff2fb4', '#7a63ff', '#35e08a', '#ffd03a'];
  for (let i = 0; i < 7; i++) box(shelf, 0.12, 0.34 + (i % 3) * 0.05, 0.26, std(bc[i % 6], { roughness: 0.5, emissive: bc[i % 6], emissiveIntensity: 0.06 }), -0.5 + i * 0.16, 0.2 + (i % 3) * 0.025, 0, 0.02);

  // contact shadows (the floor is a shader, so these are painted blobs)
  blob(world, 0.55, -1.0, 0.65, 0.65, 0.65);
  blob(world, -0.1, -2.0, 1.7, 0.9, 0.55);
  blob(world, refs.cab.position.x, refs.cab.position.z, 0.55, 0.5, 0.6);
  blob(world, 1.4, -1.8, 0.55, 0.45, 0.55);
  blob(world, 1.8, -2.3, 0.3, 0.3, 0.5);

  // dust motes
  const R2 = rng(77), n = 160, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos.set([-3 + R2() * 6.5, 0.4 + R2() * 4.6, -3.4 + R2() * 7.5], i * 3); }
  const gm = new THREE.BufferGeometry(); gm.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(gm, new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, map: radialTex('rgba(190,230,255,.9)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45, fog: false }));
  world.add(motes); NO_DEPTH.push(motes);
  refs.motes = motes;
  return refs;
}
