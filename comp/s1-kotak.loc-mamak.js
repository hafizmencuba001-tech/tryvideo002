// Location "mamak" (s1-e4): a kedai mamak at night. Bright cool fluorescent tubes, steel table, plastic stools, teh tarik + roti canai,
// ceiling fan, a football match on the wall TV, menu board, blurred customers in the back. Screen prop: the boss's phone (landscape,
// leaning on a teh tarik glass, screen toward the characters; ots/screen shots look at it from behind them).
import * as THREE from 'three';
import { V3 } from './s1-kotak.lib.js';
import { box, slab, piv, std, glowMat, canvasTex, roundRect, rng, TAU, glow } from './s1-kotak.lib.js';
import { makeFloorTex, blobShadow, signBoard, makeExtra, glassTumbler } from './s1-kotak.locs.js';

export const screenOpts = { compact: false };
const FOG = '#0a1a1d', FOGDEN = 0.03;
const TOP = 0.99; // table top height

function drawTV(g, w, h, t) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1f7a3a'); gr.addColorStop(1, '#2a9a48'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'; g.fillRect(i * w / 10, 0, w / 10, h); }
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 4; g.strokeRect(30, 40, w - 60, h - 80);
  g.beginPath(); g.moveTo(w / 2, 40); g.lineTo(w / 2, h - 40); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 60, 0, TAU); g.stroke();
  g.strokeRect(30, h / 2 - 90, 120, 180); g.strokeRect(w - 150, h / 2 - 90, 120, 180);
  const R = rng(5);
  for (let i = 0; i < 22; i++) {
    const bx = 80 + R() * (w - 160), by = 80 + R() * (h - 160), ph = R() * 6;
    const x = bx + Math.sin(t * 0.9 + ph) * 40, y = by + Math.cos(t * 0.7 + ph * 1.3) * 28;
    g.fillStyle = i < 11 ? '#ff3b3b' : '#3b8bff'; g.fillRect(x - 7, y - 9, 14, 18);
  }
  const bx = w / 2 + Math.sin(t * 1.3) * 200, by = h / 2 + Math.cos(t * 1.7) * 90;
  g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 9, 0, TAU); g.fill();
  g.fillStyle = 'rgba(0,0,0,.65)'; roundRect(g, 24, 14, 310, 42, 8); g.fill();
  g.fillStyle = '#fff'; g.font = '700 26px "Helvetica Neue", Arial'; g.fillText('HARIMAU 1 - 1 ELANG', 38, 44);
  g.fillStyle = '#ff3b3b'; roundRect(g, w - 150, 14, 126, 40, 8); g.fill(); g.fillStyle = '#fff'; g.font = '800 24px "Helvetica Neue", Arial'; g.fillText('LANGSUNG', w - 140, 42);
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, h - 44, w, 44); g.fillStyle = '#ffd03a'; g.font = '700 24px "Helvetica Neue", Arial'; g.fillText(`${String(Math.floor(60 + t / 60)).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}`, 20, h - 14);
}

export function build(ctx) {
  const { world, post } = ctx;
  const noMirror = [], noDepth = [];
  const R = rng(41);
  const steel = std('#aeb8c4', { roughness: 0.22, metalness: 0.9 }), steelD = std('#5d6874', { roughness: 0.35, metalness: 0.8 });
  const dark = std('#171c22', { roughness: 0.5 });

  // ---- floor (cool tiles, wet sheen) ----
  const floor = makeFloorTex(post.rtRefl.texture, FOG, FOGDEN, (g, cx, cz, u) => {
    g.fillStyle = '#7f918b'; g.fillRect(0, 0, 2048, 2048);
    const T = 1.3;
    for (let ix = -10; ix < 10; ix++) for (let iz = -14; iz < 8; iz++) {
      g.fillStyle = (ix + iz) % 2 ? '#7f9089' : '#68786f'; g.fillRect(cx(ix * T) + 3, cz(iz * T) + 3, T * u - 6, T * u - 6);
    }
    const pool = (x, z, rx, rz, col) => { g.save(); g.translate(cx(x), cz(z)); g.scale(rx * u, rz * u); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); };
    pool(0.3, -2.4, 5, 3, 'rgba(240,255,245,.35)'); pool(3.0, -4.4, 2.2, 1.6, 'rgba(255,170,80,.35)'); pool(-3.2, -4.6, 2, 1.4, 'rgba(120,255,220,.3)');
    g.fillStyle = 'rgba(10,16,20,.8)'; g.fillRect(0, cz(1.0), 2048, 2048); // outside: dark pavement
    g.fillStyle = 'rgba(255,208,58,.8)'; g.fillRect(0, cz(1.0) - 4, 2048, 8); // kerb stripe
    const Rr = rng(3); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Rr() * 0.05})`; g.fillRect(Rr() * 2048, Rr() * 2048, 3, 3); }
  }, { reflK: 0.5 });
  world.add(floor);

  // ---- room shell ----
  const wallTex = canvasTex(1024, 1024, (g) => {
    g.fillStyle = '#2f7f78'; g.fillRect(0, 0, 1024, 1024);
    g.fillStyle = '#e9efe9'; g.fillRect(0, 540, 1024, 484); // tiled lower wall
    g.strokeStyle = 'rgba(40,70,70,.35)'; g.lineWidth = 3;
    for (let x = 0; x <= 1024; x += 64) { g.beginPath(); g.moveTo(x, 540); g.lineTo(x, 1024); g.stroke(); }
    for (let y = 540; y <= 1024; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
    g.fillStyle = '#e8b13c'; g.fillRect(0, 520, 1024, 24);
    const gr = g.createLinearGradient(0, 0, 0, 540); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 540);
  }).tex;
  const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.75 });
  slab(world, 14, 5.4, 0.3, wallM, 0, 2.7, -5.55);
  slab(world, 0.3, 5.4, 9, std('#245e59', { roughness: 0.85 }), -4.2, 2.7, -1.2);
  slab(world, 0.3, 5.4, 9, std('#245e59', { roughness: 0.85 }), 4.6, 2.7, -1.2);
  slab(world, 14, 0.3, 11, std('#1c2226', { roughness: 0.9 }), 0, 5.2, -1.0);   // ceiling
  slab(world, 0.2, 5.4, 0.2, std('#d8dfe6', { roughness: 0.4 }), 4.2, 2.7, 0.8);  // front pillars
  slab(world, 0.2, 5.4, 0.2, std('#d8dfe6', { roughness: 0.4 }), -3.8, 2.7, 0.8);

  // ---- fluorescent tubes ----
  const tubeMats = [];
  [[-0.9, -2.2], [1.4, -2.4], [0.2, -4.2], [-2.6, -4.0], [2.9, -4.1]].forEach(([x, z], i) => {
    box(world, 1.9, 0.08, 0.26, std('#c9d1d8', { roughness: 0.5 }), x, 5.02, z, 0.02);
    const m = glowMat('#eafff2', 2.6); tubeMats.push(m);
    slab(world, 1.7, 0.05, 0.1, m, x, 4.97, z);
    glow(world, 'rgba(230,255,240,.9)', 3.4, x, 4.7, z, 0.3);
  });
  // ---- ceiling fan ----
  const fan = piv(world, 0.55, 4.5, -2.9);
  box(world, 0.06, 0.6, 0.06, steelD, 0.55, 4.9, -2.9, 0.02);
  box(fan, 0.3, 0.16, 0.3, steelD, 0, 0, 0, 0.05);
  const blades = piv(fan, 0, 0.0, 0);
  for (let i = 0; i < 4; i++) { const b = piv(blades, 0, 0, 0); b.rotation.y = i * Math.PI / 2; box(b, 1.3, 0.035, 0.34, std('#e6ddc6', { roughness: 0.6 }), 0.85, 0, 0, 0.01); }

  // ---- wall TV + menu board + neon ----
  const tv = signBoard(world, 2.6, 1.46, 1024, (g, w, h) => drawTV(g, w, h, 0), 1.7, 3.4, -5.35, std('#0d1116', { roughness: 0.3, metalness: 0.5 }), 1.15);
  const tvCanvas = tv.userData.canvas;
  glow(world, 'rgba(120,255,160,.7)', 5, 1.7, 3.4, -4.9, 0.18);
  signBoard(world, 2.5, 1.7, 1024, (g, w, h) => {
    g.fillStyle = '#10161a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd03a'; g.font = '800 70px "Avenir Next", Arial'; g.textAlign = 'center'; g.fillText('MENU', w / 2, 90);
    g.font = '700 54px "Avenir Next", Arial'; g.textAlign = 'left';
    [['Roti Canai', '2.00'], ['Teh Tarik', '2.50'], ['Maggi Goreng', '6.50'], ['Nasi Lemak', '4.00'], ['Coklat Ais', '3.50'], ['Roti Telur', '3.50']].forEach(([a, b], i) => {
      g.fillStyle = i % 2 ? '#bff6e6' : '#ffe7a8'; g.fillText(a, 70, 190 + i * 100); g.textAlign = 'right'; g.fillText('RM ' + b, w - 70, 190 + i * 100); g.textAlign = 'left';
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(70, 205 + i * 100, w - 140, 3);
    });
  }, -1.8, 3.1, -5.35, std('#3a2a1a', { roughness: 0.6 }), 1.0);
  signBoard(world, 2.6, 0.52, 1024, (g, w, h) => { g.fillStyle = '#05100c'; g.fillRect(0, 0, w, h); g.fillStyle = '#35ff9a'; g.shadowColor = '#35ff9a'; g.shadowBlur = 24; g.font = '800 120px "Avenir Next", Arial'; g.textAlign = 'center'; g.fillText('MAMAK 24 JAM', w / 2, h * 0.72); }, -1.8, 4.35, -5.35, std('#10161a'), 1.4);
  glow(world, 'rgba(53,255,154,.8)', 4.4, -1.8, 4.35, -5.0, 0.3);
  slab(world, 0.05, 2.6, 0.05, glowMat('#ff2fb4', 1.8), -3.6, 3.0, -5.3);
  glow(world, 'rgba(255,47,180,.7)', 3.2, -3.6, 3.0, -5.0, 0.3);

  // ---- counter (right back) and drinks fridge (left back) ----
  box(world, 2.0, 1.1, 1.0, steel, 3.0, 0.55, -4.7, 0.04);
  box(world, 2.0, 0.08, 1.06, steelD, 3.0, 1.12, -4.7, 0.03);
  slab(world, 1.9, 0.03, 0.03, glowMat('#ffb24a', 2.0), 3.0, 1.05, -4.17);
  for (let i = 0; i < 3; i++) box(world, 0.22, 0.26, 0.22, steelD, 2.5 + i * 0.5, 1.3, -4.7, 0.03); // tarik pots
  const fridge = box(world, 1.2, 2.5, 0.8, std('#1b2328', { roughness: 0.4 }), -3.1, 1.25, -5.0, 0.04);
  const fg = slab(world, 1.0, 2.1, 0.03, glowMat('#aef7e3', 1.3), -3.1, 1.3, -4.58); fg.material.color.multiplyScalar(0.9);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) box(world, 0.14, 0.34, 0.14, std(['#ff7d1c', '#ff2fb4', '#35e08a', '#ffd03a'][(i + k) % 4], { emissive: ['#ff7d1c', '#ff2fb4', '#35e08a', '#ffd03a'][(i + k) % 4], emissiveIntensity: 0.4 }), -3.4 + k * 0.23, 0.55 + i * 0.5, -4.55, 0.03);
  glow(world, 'rgba(160,255,230,.7)', 3.2, -3.1, 1.3, -4.4, 0.25);

  // ---- main table, stools ----
  const TBL = { x: 0.25, z: -1.7 };
  const table = piv(world, TBL.x, 0, TBL.z);
  box(table, 2.8, 0.08, 1.2, steel, 0, TOP - 0.04, 0, 0.03);
  box(table, 2.7, 0.06, 1.1, steelD, 0, TOP - 0.11, 0, 0.02);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(table, 0.09, TOP - 0.1, 0.09, steelD, sx * 1.28, (TOP - 0.1) / 2, sz * 0.52, 0.02);
  box(table, 2.5, 0.05, 0.05, steelD, 0, 0.3, -0.5, 0.01); box(table, 2.5, 0.05, 0.05, steelD, 0, 0.3, 0.5, 0.01);
  const stool = (x, z, col) => { const s = piv(world, x, 0, z); box(s, 0.6, 0.12, 0.6, std(col, { roughness: 0.35 }), 0, 0.56, 0, 0.05); box(s, 0.5, 0.36, 0.5, std(col, { roughness: 0.45 }), 0, 0.32, 0, 0.06); box(s, 0.64, 0.05, 0.64, std(col, { roughness: 0.4 }), 0, 0.12, 0, 0.02); return s; };
  stool(1.0, -2.65, '#d2322d'); stool(-0.35, -2.65, '#2d6ad2');
  stool(-1.4, -1.0, '#2eae5c'); stool(2.0, -0.95, '#e8b13c');

  // items on the table
  const items = [];
  const jump = (o) => { items.push({ o, y: o.position.y }); return o; };
  const tehA = glassTumbler(table, -1.1, TOP, 0.05, { h: 0.42 }), tehB = glassTumbler(table, 1.05, TOP, 0.3, { h: 0.42 });
  const tehC = glassTumbler(table, 0.3 - TBL.x, TOP, -1.25 - TBL.z, { h: 0.5 }); // the glass the phone leans on
  [tehA, tehB, tehC].forEach((tg) => jump(tg.g));
  const plate = piv(table, -0.15, TOP, 0.28);
  box(plate, 0.62, 0.035, 0.62, std('#f1f3f6', { roughness: 0.3 }), 0, 0.02, 0, 0.015);
  box(plate, 0.48, 0.05, 0.48, std('#e0a642', { roughness: 0.7 }), 0, 0.06, 0, 0.03);
  box(plate, 0.4, 0.04, 0.4, std('#c98b2e', { roughness: 0.7 }), 0.02, 0.1, 0.02, 0.025);
  const curry = box(plate, 0.2, 0.1, 0.2, std('#f4f6f9', { roughness: 0.3 }), 0.38, 0.06, 0.2, 0.03); box(plate, 0.16, 0.012, 0.16, std('#d96a1f', { roughness: 0.3 }), 0.38, 0.11, 0.2);
  jump(plate);
  const jar = piv(table, 1.2, TOP, -0.3); box(jar, 0.22, 0.3, 0.22, std('#e8eef5', { roughness: 0.2, transparent: true, opacity: 0.6 }), 0, 0.15, 0, 0.03); box(jar, 0.24, 0.05, 0.24, steel, 0, 0.32, 0, 0.02); jump(jar);
  const tissue = piv(table, -0.75, TOP, 0.3); box(tissue, 0.34, 0.16, 0.22, std('#e24b4b'), 0, 0.08, 0, 0.03); jump(tissue);
  const spice = piv(table, 0.55, TOP, 0.1); box(spice, 0.12, 0.24, 0.12, std('#d03a2a', { roughness: 0.4 }), 0, 0.12, 0, 0.03); box(spice, 0.12, 0.2, 0.12, std('#3a8a3a', { roughness: 0.4 }), 0.16, 0.1, 0, 0.03); jump(spice);

  // ---- the boss's phone (screen prop): landscape, leaning back on tehC, screen toward -z (the characters) ----
  const phone = new THREE.Group();
  const PW = 0.9, PH = PW / 1.6;
  box(phone, PW + 0.1, PH + 0.1, 0.06, std('#11151c', { roughness: 0.3, metalness: 0.6 }), 0, 0, 0, 0.04);
  box(phone, PW + 0.08, PH + 0.08, 0.03, std('#b8801f', { roughness: 0.85 }), 0, 0, -0.04, 0.03); // case on the back (the side the front camera sees)
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: ctx.screen.tex, toneMapped: false }));
  screenMesh.material.color.setScalar(0.95); screenMesh.position.z = 0.032; phone.add(screenMesh);
  const TILT = 1.0; // screen normal elevation: the phone lies back at ~33 deg from the table so it never hides the faces
  phone.rotation.set(-TILT, Math.PI, 0, 'YXZ');
  const phoneBase = V3(TBL.x + 0.05, TOP + 0.03 + (PH + 0.1) / 2 * Math.cos(TILT), -1.85 + (PH + 0.1) / 2 * Math.sin(TILT));
  phone.position.copy(phoneBase); world.add(phone);
  const phoneGlow = new THREE.SpotLight('#cfe0ff', 3.5, 0, 0.9, 0.9, 1);
  phoneGlow.position.set(phoneBase.x, phoneBase.y + 0.1, phoneBase.z - 0.2); phoneGlow.target.position.set(0.35, 1.7, -2.8); world.add(phoneGlow, phoneGlow.target);
  jump(phone);

  // ---- customers in the back (blurred by DoF) ----
  const tableBack = (x, z) => { const t = piv(world, x, 0, z); box(t, 1.6, 0.07, 0.9, steel, 0, TOP - 0.04, 0, 0.03); for (const sx of [-1, 1]) box(t, 0.08, TOP - 0.1, 0.08, steelD, sx * 0.72, (TOP - 0.1) / 2, 0, 0.02); box(t, 0.3, 0.45, 0.3, std('#b8793a', { transparent: true, opacity: 0.5 }), 0.2, TOP + 0.22, 0.1, 0.02); };
  tableBack(-2.3, -3.7); tableBack(2.7, -3.5);
  makeExtra(world, { shirt: '#c0392b', skin: '#b87d55' }, -2.9, 0, -4.35, 0); makeExtra(world, { shirt: '#2d8a6a', skin: '#9d6843', hair: '#222' }, -1.7, 0, -4.35, 0);
  makeExtra(world, { shirt: '#e8b13c', skin: '#c68c62' }, 2.2, 0, -4.1, 0); makeExtra(world, { shirt: '#6a5acd', skin: '#a9714a' }, 3.2, 0, -4.1, 0);
  [-2.9, -1.7, 2.2, 3.2].forEach((x, i) => box(world, 0.6, 0.6, 0.6, std(['#d2322d', '#2d6ad2', '#2eae5c', '#e8b13c'][i], { roughness: 0.45 }), x, 0.3, i < 2 ? -4.2 : -3.95, 0.05));
  // foreground table (left) so the lower frame has content in the wide
  const fgT = piv(world, -2.1, 0, 0.1);
  box(fgT, 1.5, 0.07, 0.9, steel, 0, TOP - 0.04, 0, 0.03); for (const sx of [-1, 1]) box(fgT, 0.08, TOP - 0.1, 0.08, steelD, sx * 0.66, (TOP - 0.1) / 2, 0, 0.02);
  glassTumbler(fgT, -0.2, TOP, 0.1, { h: 0.5, liquid: '#e9c9a0' });
  box(fgT, 0.4, 0.04, 0.4, std('#f1f3f6'), 0.35, TOP + 0.02, -0.05, 0.015);
  // ---- street behind the frontage (seen from the reverse shots) ----
  for (let i = 0; i < 9; i++) {
    const x = -9 + i * 2.6, h = 4 + R() * 4;
    const b = box(world, 2.3, h, 1.5, std(['#1a2230', '#222a3a', '#2a2234'][i % 3], { roughness: 0.8 }), x, h / 2, 11, 0.04);
    for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) if (R() < 0.55) slab(world, 0.34, 0.26, 0.04, glowMat(['#ffd27a', '#ff9bd8', '#8defff'][(k + j) % 3], 1.3), x - 0.7 + j * 0.7, 1.4 + k * 0.9, 10.2);
    glow(world, ['rgba(255,47,180,.9)', 'rgba(25,227,255,.9)', 'rgba(255,208,58,.9)'][i % 3], 2.4, x, 2.5 + R() * 2, 10.0, 0.5);
  }
  for (const x of [-5, -1.5, 2.5, 6]) { box(world, 0.1, 4.2, 0.1, steelD, x, 2.1, 6.5, 0.02); glow(world, 'rgba(255,170,70,.95)', 2.2, x, 4.2, 6.5, 0.8); }

  // ---- lights ----
  const L = (l) => { world.add(l); if (l.target) world.add(l.target); return l; };
  L(new THREE.HemisphereLight('#9fd8cc', '#14202a', 0.38));
  const key1 = L(new THREE.SpotLight('#f0fff6', 55, 0, 1.15, 0.9, 1.4)); key1.position.set(0.4, 4.8, -1.4); key1.target.position.set(0.4, 1.0, -2.4);
  key1.castShadow = true; key1.shadow.mapSize.set(2048, 2048); key1.shadow.bias = -0.0004; key1.shadow.normalBias = 0.02; key1.shadow.radius = 5;
  const key2 = L(new THREE.SpotLight('#e6fff0', 22, 0, 1.0, 0.9, 1.4)); key2.position.set(-1.8, 4.8, -3.5); key2.target.position.set(0.0, 1.2, -3.0);
  const warm = L(new THREE.PointLight('#ffb060', 5, 7, 2)); warm.position.set(3.0, 2.2, -3.8);
  const tvL = L(new THREE.PointLight('#8dffb0', 4, 8, 2)); tvL.position.set(1.7, 3.2, -4.4);
  const magenta = L(new THREE.SpotLight('#ff2fb4', 70, 0, 0.8, 0.9, 2)); magenta.position.set(-3.6, 3.4, 0.2); magenta.target.position.set(0.5, 1.4, -2.6);
  const cyan = L(new THREE.SpotLight('#2f9bff', 50, 0, 0.8, 0.9, 2)); cyan.position.set(3.8, 3.2, 0.2); cyan.target.position.set(0.3, 1.4, -2.6);

  blobShadow(world, noMirror, noDepth, 0.25, -1.7, 1.5, 0.8, 0.5); blobShadow(world, noMirror, noDepth, 1.0, -2.65, 0.5, 0.5, 0.5); blobShadow(world, noMirror, noDepth, -0.35, -2.65, 0.5, 0.5, 0.5);

  // env: dark teal room with overhead white tube strips (steel surfaces pick them up)
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: '#0e1d1f', side: THREE.BackSide })));
  for (const z of [-3, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.8), glowMat('#eafff2', 6)); p.position.set(0, 5.5, z); p.rotation.x = Math.PI / 2; env.add(p); }
  const pn = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 8), glowMat('#ff2fb4', 4)); pn.position.set(-9.5, 1, 0); pn.rotation.y = Math.PI / 2; env.add(pn);

  // ---- shots ----
  const shots = {
    wide: { cam: { pos: [0.28, 1.65, 3.1], target: [0.28, 1.75, -2.4], fov: 55 }, push: 0.03, coc: 0.35 },
    two: { cam: { pos: [0.45, 1.85, 2.7], target: [0.3, 1.5, -2.65], fov: 42 }, push: 0.05, coc: 0.55 },
    bos: { cam: { pos: [0.05, 1.95, 0.9], target: [1.0, 1.8, -2.65], fov: 38 }, push: 0.06, coc: 0.55 },
    intern: { cam: { pos: [0.7, 2.0, 0.9], target: [-0.35, 1.45, -2.65], fov: 36 }, push: 0.06, coc: 0.5 },
    ots_screen: (speaker) => (speaker === 'intern'
      ? { cam: { pos: [2.6, 3.9, -5.2], target: [0.25, 1.15, -1.5], fov: 32 }, push: 0.05, coc: 0.45 }
      : { cam: { pos: [-0.5, 3.9, -5.2], target: [0.35, 1.15, -1.5], fov: 32 }, push: 0.05, coc: 0.45 }),
    screen: { cam: { pos: [0.3, 2.0, -4.4], target: [0.3, 1.22, -1.5], fov: 34 }, push: 0.03, coc: 0.4 },
  };

  // ---- stage (everyone seated facing +z, i.e. the front camera) ----
  const tableArm = (x, z) => ({ aim: V3(x, TOP + 0.04, z), pole: [0, 1, 0] });
  function stage(shot, speaker, typing) {
    const B = { pos: [1.0, 0.02, -2.65], yaw: 0, lean: 0.12, headYaw: -0.3, headPitch: 0.08, headRoll: 0.03, sit: true, armL: { hip: true }, armR: tableArm(0.5, -2.0) };
    const I = { pos: [-0.35, 0.42, -2.65], yaw: 0, lean: -0.04, headYaw: 0.3, headPitch: -0.12, headRoll: -0.04, sit: true, armL: tableArm(-0.55, -2.05), armR: tableArm(-0.15, -2.05) };
    let showB = true, showI = true;
    if (shot === 'bos') { B.headYaw = -0.2; B.headPitch = 0.04; showI = false; }
    else if (shot === 'intern') { I.headYaw = 0.12; I.headPitch = -0.08; I.lean = 0.0; }
    else if (shot === 'two') { B.headYaw = -0.4; I.headYaw = 0.25; }
    else if (shot === 'ots_screen') { B.headYaw = -0.4; B.headPitch = 0.35; B.lean = 0.2; I.headYaw = 0.35; I.headPitch = 0.3; if (typing) I.typeAt = true; }
    else if (shot === 'screen') { showB = false; showI = false; }
    return { B, I, showB, showI };
  }

  let tvStep = -1;
  const sloshT = [tehA, tehB, tehC, ...[]];
  return {
    id: 'mamak', fog: { color: FOG, den: FOGDEN }, background: '#06101a', env, envIntensity: 0.9, bloomK: 0.7, vig: 0.5,
    floor, noMirror, noDepth, shadowLights: [key1], shots, stage, screenMesh,
    point: { aim: () => V3(0.2, 1.35, -1.55), pole: [-0.3, 0.9, 0.3] },
    slam: { targets: (B) => [V3(B[0] + 0.3, TOP + 0.02, -2.0), V3(B[0] - 0.3, TOP + 0.02, -2.05)] },
    clock: null,
    kb: null,
    typeTarget: (side, tap) => V3(-0.35 + (side === 'L' ? 0.2 : -0.2), TOP + 0.04 + tap * 0.8, -2.0),
    update(t, S) {
      fan.rotation.y = 0; blades.rotation.y = t * 5.5;
      tubeMats.forEach((m, i) => { const f = i === 3 ? (0.86 + 0.14 * Math.sin(t * 40) * (Math.sin(t * 3.1) > 0.8 ? 1 : 0)) : 1; m.color.setRGB(0.92 * 2.6 * f, 1 * 2.6 * f, 0.95 * 2.6 * f); });
      const step = Math.floor(t * 8);
      if (step !== tvStep) { tvStep = step; drawTV(tvCanvas.g, 1024, tvCanvas.canvas.height, step / 8); tvCanvas.tex.needsUpdate = true; }
      tvL.intensity = 4 + 1.2 * Math.sin(t * 5.3) * Math.sin(t * 1.7);
      const hit = S.sinceSlam > 0;
      items.forEach((it, k) => { it.o.position.y = it.y + (hit ? Math.exp(-S.sinceSlam * 7) * Math.abs(Math.sin(S.sinceSlam * 22 + k * 1.3)) * (0.06 + 0.012 * (k % 3)) : 0); });
      [tehA, tehB, tehC].forEach((tg, k) => { const a = hit ? Math.exp(-S.sinceSlam * 4.5) * Math.sin(S.sinceSlam * 26 + k) * 0.22 : 0; tg.liquid.rotation.z = a; tg.liquid.position.y = 0.5 * 0.4 * 1.04 + (hit ? 0.015 * Math.sin(S.sinceSlam * 30) : 0); tg.foam.rotation.z = a * 1.4; });
      phone.position.copy(phoneBase); phone.position.y += (hit ? Math.exp(-S.sinceSlam * 7) * Math.abs(Math.sin(S.sinceSlam * 22 + 4)) * 0.07 : 0);
    },
  };
}
