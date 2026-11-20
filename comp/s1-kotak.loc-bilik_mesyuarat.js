// Location "bilik_mesyuarat" (s1-e6): the boardroom just after the meeting, past midnight. Cool slate walls, a projector screen still glowing on the
// back wall, a whiteboard of scribbles, a long conference table with cold coffee and leftover kuih, empty office chairs, a sad plant, a city glass wall
// on the camera side (seen from the reverse shots). Screen prop: the laptop on the table (screen toward the seats; ots/screen shots look at it
// from behind the seats). Same box-robot material language and neon rim lights as the rest of s1-kotak.
import * as THREE from 'three';
import { V3 } from './s1-kotak.lib.js';
import { box, slab, piv, std, glowMat, canvasTex, roundRect, rng, TAU, glow } from './s1-kotak.lib.js';
import { makeFloorTex, blobShadow } from './s1-kotak.locs.js';

export const screenOpts = { compact: false };
const FOG = '#0f1730', FOGDEN = 0.028;
const TOP = 0.74;                       // conference table top height
const TB = { x: 0.4, z: -1.95 };        // table centre (depth 1.5: z -2.7 .. -1.2)
const SEAT_Z = -3.3;                    // the two seats on the far side of the table

function slide(g, w, h) {
  g.fillStyle = '#eef3fb'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#243a6b'; g.fillRect(0, 0, w, h * 0.2);
  g.fillStyle = '#fff'; g.font = '800 54px "Avenir Next", Arial'; g.textAlign = 'left'; g.fillText('LEMBAGA PENGARAH · SUKU KETIGA', 48, h * 0.135);
  const bars = [[0.52, '#5b8def'], [0.7, '#5b8def'], [0.46, '#5b8def'], [0.9, '#ff6b4a']];
  bars.forEach(([v, c], i) => { g.fillStyle = c; const bh = (h * 0.52) * v; g.fillRect(90 + i * 190, h * 0.9 - bh, 130, bh); });
  g.fillStyle = '#243a6b'; g.font = '700 36px "Avenir Next", Arial'; ['JUL', 'OGO', 'SEP', 'KOS'].forEach((s, i) => g.fillText(s, 100 + i * 190, h * 0.96));
  g.fillStyle = '#243a6b'; g.font = '800 44px "Avenir Next", Arial'; g.fillText('Agenda 4: Lain-lain', 900, h * 0.42);
  g.font = '600 38px "Avenir Next", Arial'; g.fillStyle = '#4a5878'; ['1. Jualan', '2. Kos operasi', '3. Pelan suku keempat', '4. Kek (siapa beli?)'].forEach((s, i) => g.fillText(s, 900, h * 0.52 + i * 62));
}
function whiteboard(g, w, h) {
  g.fillStyle = '#f4f6f4'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < 8; i++) g.fillRect(0, i * h / 8, w, 2);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#1f6fd6'; g.lineWidth = 9; g.beginPath(); g.moveTo(60, 380); g.lineTo(190, 300); g.lineTo(300, 340); g.lineTo(420, 190); g.lineTo(560, 230); g.stroke();
  g.fillStyle = '#1f6fd6'; g.font = '800 64px "Avenir Next", Arial'; g.fillText('JUALAN', 56, 100);
  g.strokeStyle = '#d6322d'; g.lineWidth = 9; g.beginPath(); g.arc(760, 270, 90, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(700, 210); g.lineTo(820, 330); g.stroke();
  g.fillStyle = '#d6322d'; g.font = '800 54px "Avenir Next", Arial'; g.fillText('KOS ?!', 680, 120);
  g.strokeStyle = '#1b9a52'; g.lineWidth = 8; g.beginPath(); g.moveTo(80, 440); g.lineTo(900, 440); g.stroke();
  g.fillStyle = '#1b9a52'; g.font = '700 48px "Avenir Next", Arial'; g.fillText('→ siapkan minit', 80, 500);
}

export function build(ctx) {
  const { world, post } = ctx;
  const noMirror = [], noDepth = [];
  const R = rng(23);
  const wood = std('#4c3a3a', { roughness: 0.35 }), woodD = std('#2e2428', { roughness: 0.5 }), metal = std('#7b88a6', { roughness: 0.3, metalness: 0.8 });
  const wallM = std('#2c3b5a', { roughness: 0.85 }), wallD = std('#222e49', { roughness: 0.9 });

  // ---- floor: dark grey-blue carpet tiles with soft light pools ----
  const floor = makeFloorTex(post.rtRefl.texture, FOG, FOGDEN, (g, cx, cz, u) => {
    g.fillStyle = '#3a4260'; g.fillRect(0, 0, 2048, 2048);
    const T = 1.0;
    for (let ix = -12; ix < 12; ix++) for (let iz = -16; iz < 8; iz++) { g.fillStyle = (ix + iz) & 1 ? '#3c4564' : '#343c58'; g.fillRect(cx(ix * T) + 2, cz(iz * T) + 2, T * u - 4, T * u - 4); }
    const pool = (x, z, rx, rz, col) => { g.save(); g.translate(cx(x), cz(z)); g.scale(rx * u, rz * u); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); };
    pool(0.4, -2.0, 4.6, 3.2, 'rgba(190,215,255,.45)'); pool(-0.4, -4.4, 3.0, 1.6, 'rgba(235,245,255,.35)');
    const Rr = rng(5); for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(255,255,255,${Rr() * 0.04})`; g.fillRect(Rr() * 2048, Rr() * 2048, 3, 3); }
  }, { reflK: 0.34, fres0: 0.22 });
  world.add(floor);

  // ---- room shell ----
  slab(world, 13, 5.4, 0.3, wallM, 0, 2.7, -6.15);
  slab(world, 0.3, 5.4, 10, wallD, -4.7, 2.7, -1.4); slab(world, 0.3, 5.4, 10, wallD, 4.9, 2.7, -1.4);
  slab(world, 13, 0.3, 10, std('#1a2236', { roughness: 0.9 }), 0.1, 5.3, -1.4);
  slab(world, 13, 0.18, 0.08, std('#18203a'), 0.1, 0.09, -5.98);
  // ceiling light panels (soft cool white) + projector
  [[-1.6, -3.6], [1.8, -3.6], [-1.6, -0.6], [1.8, -0.6]].forEach(([x, z]) => { box(world, 1.8, 0.06, 1.0, std('#cfd9ee', { roughness: 0.6 }), x, 5.12, z, 0.02); slab(world, 1.6, 0.03, 0.8, glowMat('#eaf2ff', 1.5), x, 5.08, z); glow(world, 'rgba(210,225,255,.55)', 3.2, x, 4.8, z, 0.18); });
  const proj = piv(world, 0.3, 4.9, -1.4); box(proj, 0.5, 0.18, 0.4, std('#c9d1de', { roughness: 0.4 }), 0, 0, 0, 0.04); slab(proj, 0.12, 0.12, 0.08, glowMat('#cfe0ff', 2.0), 0, -0.01, -0.22); box(world, 0.05, 0.4, 0.05, metal, 0.3, 5.12, -1.4, 0.01);

  // ---- projector screen (back wall, left) ----
  const scr = canvasTex(1536, 864, (g, w, h) => slide(g, w, h)).tex;
  box(world, 3.1, 1.85, 0.08, std('#141a2a', { roughness: 0.4 }), -0.95, 3.25, -6.0, 0.02);
  const scrM = new THREE.Mesh(new THREE.PlaneGeometry(2.95, 1.66), new THREE.MeshBasicMaterial({ map: scr, toneMapped: false })); scrM.material.color.setScalar(0.62); scrM.position.set(-0.95, 3.25, -5.95); world.add(scrM);
  glow(world, 'rgba(170,200,255,.5)', 6.5, -0.95, 3.25, -5.3, 0.22);
  box(world, 3.2, 0.08, 0.1, metal, -0.95, 4.25, -5.95, 0.02);
  // ---- whiteboard (back wall, right) + marker tray ----
  const wb = canvasTex(1024, 640, (g, w, h) => whiteboard(g, w, h)).tex;
  box(world, 1.95, 1.4, 0.08, std('#aeb7c8', { roughness: 0.4, metalness: 0.6 }), 1.85, 3.0, -6.0, 0.02);
  const wbM = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.25), new THREE.MeshBasicMaterial({ map: wb, toneMapped: false })); wbM.material.color.setScalar(0.72); wbM.position.set(1.85, 3.0, -5.95); world.add(wbM);
  box(world, 1.6, 0.06, 0.16, metal, 1.85, 2.25, -5.9, 0.02); for (const [x, c] of [[-0.4, '#1f6fd6'], [-0.2, '#d6322d'], [0.0, '#1b9a52']]) box(world, 0.2, 0.05, 0.05, std(c), 1.85 + x, 2.3, -5.88, 0.012);
  // wall clock (right wall of the back, round-ish box)
  const clk = piv(world, 1.85, 4.3, -6.0); box(clk, 0.7, 0.7, 0.08, std('#e8edf6', { roughness: 0.4 }), 0, 0, 0, 0.12); box(clk, 0.05, 0.22, 0.03, std('#11151c'), 0.0, 0.1, 0.06, 0.01); const mh = box(clk, 0.04, 0.28, 0.03, std('#11151c'), 0.1, -0.08, 0.06, 0.01); mh.rotation.z = 1.1;

  // ---- sad plant in the corner ----
  const plant = piv(world, -3.7, 0, -5.2); box(plant, 0.5, 0.5, 0.5, std('#b5532e', { roughness: 0.7 }), 0, 0.25, 0, 0.06);
  const leaves = []; for (let i = 0; i < 5; i++) { const l = piv(plant, (i - 2) * 0.05, 0.5, 0); l.rotation.z = (i - 2) * 0.38; const lf = box(l, 0.1, 0.5, 0.04, std('#6b8a3a', { roughness: 0.8 }), 0, 0.25, 0, 0.01); lf.rotation.x = 0.1 * i; leaves.push(l); }

  // ---- conference table + things on it ----
  const tb = piv(world, TB.x, 0, TB.z);
  box(tb, 5.6, 0.08, 1.5, wood, 0, TOP - 0.04, 0, 0.03); box(tb, 5.5, 0.05, 1.4, woodD, 0, TOP - 0.1, 0, 0.02);
  for (const sx of [-1, 1]) { box(tb, 0.14, TOP - 0.12, 1.1, metal, sx * 2.5, (TOP - 0.12) / 2, 0, 0.03); box(tb, 0.14, 0.05, 1.3, metal, sx * 2.5, 0.03, 0, 0.02); }
  const items = [];
  const jump = (o) => { items.push({ o, y: o.position.y }); return o; };
  const cup = (x, z, col) => { const c = piv(tb, x, TOP, z); box(c, 0.16, 0.18, 0.16, std(col, { roughness: 0.3 }), 0, 0.09, 0, 0.03); box(c, 0.05, 0.08, 0.03, std(col, { roughness: 0.3 }), 0.1, 0.09, 0, 0.01); jump(c); return c; };
  cup(-2.2, 0.3, '#e9e4da'); cup(-1.5, -0.1, '#e9e4da'); cup(1.5, 0.35, '#3a8a9a'); cup(2.35, -0.2, '#e9e4da'); cup(-0.9, 0.38, '#d0b078');
  const kuih = piv(tb, 1.0, TOP, 0.05); box(kuih, 0.5, 0.03, 0.5, std('#f1f3f6', { roughness: 0.3 }), 0, 0.02, 0, 0.012); for (let i = 0; i < 3; i++) box(kuih, 0.14, 0.07, 0.14, std(['#e0a642', '#6aa84f', '#e87aa0'][i]), -0.12 + i * 0.12, 0.07, (i % 2) * 0.08 - 0.03, 0.02); jump(kuih);
  const jug = piv(tb, -1.2, TOP, 0.45); box(jug, 0.22, 0.4, 0.22, std('#dfeaff', { roughness: 0.1, transparent: true, opacity: 0.45 }), 0, 0.2, 0, 0.04); jump(jug);
  const spk = piv(tb, 0.2, TOP, -0.55); box(spk, 0.34, 0.05, 0.34, std('#1d2230', { roughness: 0.4 }), 0, 0.025, 0, 0.02); slab(spk, 0.12, 0.012, 0.12, glowMat('#6fe3a8', 1.6), 0, 0.054, 0); jump(spk);
  const notepad = piv(tb, -1.8, TOP, -0.35); box(notepad, 0.3, 0.02, 0.4, std('#f4efe0', { roughness: 0.8 }), 0, 0.012, 0, 0.005); jump(notepad);

  // ---- the laptop (screen prop), toward the seats; lid hinge on the near side ----
  const LW = 0.95, LH = LW / 1.6;
  const lapM = std('#9aa5b8', { roughness: 0.3, metalness: 0.8 }), lapD = std('#10131c', { roughness: 0.4, metalness: 0.5 });
  const base = piv(world, TB.x, TOP + 0.03, TB.z - 0.3);
  box(base, LW + 0.06, 0.04, 0.62, lapM, 0, 0, 0, 0.02);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 11; c++) box(base, 0.062, 0.012, 0.06, lapD, -0.4 + c * 0.08, 0.025, -0.2 + r * 0.075, 0.004);
  box(base, 0.3, 0.012, 0.18, std('#242a3d', { roughness: 0.4 }), 0, 0.022, 0.2, 0.004);
  const hinge = piv(base, 0, 0.03, 0.3); hinge.rotation.x = 0.32;
  const lid = new THREE.Group(); lid.rotation.y = Math.PI; hinge.add(lid); lid.position.set(0, LH / 2 + 0.04, 0);
  box(lid, LW + 0.06, LH + 0.08, 0.04, lapM, 0, 0, -0.02, 0.025); box(lid, LW, LH, 0.03, lapD, 0, 0, 0.0, 0.02);
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(LW - 0.04, LH - 0.04), new THREE.MeshBasicMaterial({ map: ctx.screen.tex, toneMapped: false }));
  screenMesh.material.color.setScalar(0.95); screenMesh.position.z = 0.0175; lid.add(screenMesh);
  slab(lid, 0.3, 0.02, 0.01, glowMat('#cfe0ff', 1.2), 0, 0.0, -0.045);
  jump(base);

  // ---- office chairs: the two seats (the cast sits on them) + empty ones along the far side ----
  const chairM = std('#2a3350', { roughness: 0.75 }), chairL = std('#3a4670', { roughness: 0.7 });
  function chair(x, z, yaw = 0) {
    const c = piv(world, x, 0, z); c.rotation.y = yaw;
    box(c, 0.64, 0.12, 0.64, chairL, 0, 0.5, 0, 0.05); box(c, 0.6, 0.78, 0.1, chairM, 0, 0.98, -0.32, 0.05);
    box(c, 0.07, 0.4, 0.07, metal, 0, 0.26, 0, 0.015);
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; const leg = box(c, 0.46, 0.04, 0.06, metal, Math.cos(a) * 0.23, 0.06, Math.sin(a) * 0.23, 0.01); leg.rotation.y = -a; box(c, 0.07, 0.07, 0.07, woodD, Math.cos(a) * 0.46, 0.03, Math.sin(a) * 0.46, 0.02); }
    for (const sx of [-1, 1]) box(c, 0.06, 0.05, 0.4, metal, sx * 0.34, 0.74, -0.02, 0.015);
    return c;
  }
  const seatB = chair(0.7, SEAT_Z - 0.0), seatI = chair(-0.4, SEAT_Z - 0.0);
  const extras = [chair(2.0, SEAT_Z - 0.1, -0.1), chair(3.0, SEAT_Z - 0.05, 0.2), chair(-1.7, SEAT_Z - 0.05, 0.12), chair(-2.8, SEAT_Z - 0.15, -0.15)];
  const nearChairs = [chair(-1.55, -0.1, Math.PI * 0.93), chair(3.0, -0.3, Math.PI * 1.08)];

  // ---- camera-side glass wall (only the reverse shots look at it): city at night behind blinds ----
  const glassWall = new THREE.Group(); world.add(glassWall);
  slab(glassWall, 13, 5.4, 0.3, wallD, 0.1, 2.7, 2.9);
  const city = canvasTex(1024, 512, (g) => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#0a1034'); gr.addColorStop(1, '#2a1a4a'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512); const Rc = rng(9); for (let i = 0; i < 22; i++) { const bw = 44 + Rc() * 70, bh = 120 + Rc() * 300, bx = i * 48 + Rc() * 20; g.fillStyle = '#0b1028'; g.fillRect(bx, 512 - bh, bw, bh); for (let k = 0; k < 20; k++) { g.fillStyle = ['#ffd27a', '#8defff', '#ff9bd8'][k % 3]; g.fillRect(bx + 6 + (k % 4) * 14, 512 - bh + 10 + Math.floor(k / 4) * 28, 6, 8); } } }).tex;
  const cityM = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 3.4), new THREE.MeshBasicMaterial({ map: city, toneMapped: false })); cityM.material.color.setScalar(0.8); cityM.position.set(0.1, 2.8, 2.7); cityM.rotation.y = Math.PI; glassWall.add(cityM);
  for (let i = 0; i < 6; i++) box(glassWall, 0.12, 4.0, 0.12, metal, -4.0 + i * 1.64, 2.6, 2.62, 0.02);
  slab(glassWall, 9.6, 0.1, 0.12, metal, 0.1, 4.55, 2.62); slab(glassWall, 9.6, 0.1, 0.12, metal, 0.1, 1.0, 2.62);
  box(glassWall, 0.7, 1.5, 0.5, std('#2a8a4a', { roughness: 0.8 }), -4.2, 0.75, 2.2, 0.06);

  // ---- lights: cool key from the ceiling, projector spill on the seats, magenta/cyan rim ----
  const Lt = (l) => { world.add(l); if (l.target) world.add(l.target); return l; };
  Lt(new THREE.HemisphereLight('#7a8fd8', '#1a1630', 0.5));
  const key = Lt(new THREE.SpotLight('#dfe8ff', 34, 0, 1.05, 0.9, 1.3)); key.position.set(0.4, 5.0, -2.6); key.target.position.set(0.3, 1.0, -3.2);
  key.castShadow = true; key.shadow.mapSize.set(1536, 1536); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
  const lapK = Lt(new THREE.SpotLight('#b8d0ff', 8, 0, 0.8, 0.9, 1)); lapK.position.set(0.3, 1.3, -1.0); lapK.target.position.set(0.3, 1.8, -3.5);
  const projL = Lt(new THREE.SpotLight('#a8c4ff', 22, 0, 0.7, 0.9, 1.5)); projL.position.set(-1.5, 3.2, -5.2); projL.target.position.set(0.3, 1.5, -2.4);
  const magenta = Lt(new THREE.SpotLight('#ff2fb4', 52, 0, 0.8, 0.9, 2)); magenta.position.set(-3.6, 3.2, 1.0); magenta.target.position.set(0.5, 1.4, -3.2);
  const cyan = Lt(new THREE.SpotLight('#2f9bff', 46, 0, 0.8, 0.9, 2)); cyan.position.set(3.8, 3.0, 1.0); cyan.target.position.set(0.3, 1.4, -3.2);
  const front = Lt(new THREE.DirectionalLight('#c8d4ff', 0.4)); front.position.set(1, 3, 6); front.target.position.set(0.3, 1.3, -3.2);

  blobShadow(world, noMirror, noDepth, TB.x, TB.z, 2.9, 1.0, 0.55);
  for (const c of [seatB, seatI, ...extras]) blobShadow(world, noMirror, noDepth, c.position.x, c.position.z, 0.5, 0.5, 0.5);
  blobShadow(world, noMirror, noDepth, -3.7, -5.2, 0.5, 0.5, 0.5);

  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: '#141b30', side: THREE.BackSide })));
  for (const z of [-4, 0]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.9), glowMat('#e6eeff', 4)); p.position.set(0, 5.5, z); p.rotation.x = Math.PI / 2; env.add(p); }
  const pn = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), glowMat('#6f8cff', 2.5)); pn.position.set(-8, 2.5, -2); pn.rotation.y = Math.PI / 2; env.add(pn);

  // ---- shots ----
  const shots = {
    wide: { cam: { pos: [0.3, 2.05, 2.6], target: [0.3, 1.45, -3.3], fov: 50 }, push: 0.03, coc: 0.4 },
    two: { cam: { pos: [0.35, 2.0, 1.0], target: [0.3, 1.45, -3.3], fov: 48 }, push: 0.05, coc: 0.5 },
    bos: { cam: { pos: [-0.3, 1.95, -0.1], target: [0.7, 1.8, -3.3], fov: 38 }, push: 0.06, coc: 0.55 },
    intern: { cam: { pos: [0.45, 1.85, -0.1], target: [-0.4, 1.45, -3.3], fov: 34 }, push: 0.06, coc: 0.5 },
    ots_screen: (speaker) => (speaker === 'intern'
      ? { cam: { pos: [3.7, 2.8, -5.5], target: [0.2, 1.05, -1.8], fov: 34 }, push: 0.05, coc: 0.45 }
      : { cam: { pos: [-3.7, 2.8, -5.5], target: [0.8, 1.05, -1.8], fov: 34 }, push: 0.05, coc: 0.45 }),
    screen: { cam: { pos: [0.4, 1.75, -5.2], target: [0.4, 0.9, -1.8], fov: 34 }, push: 0.03, coc: 0.4 },
  };
  function stage(shot, speaker, typing) {
    const B = { pos: [0.7, -0.04, SEAT_Z], yaw: 0, lean: 0.14, headYaw: -0.3, headPitch: 0.1, headRoll: 0.03, sit: true, armL: { rest: [0.8, 0, 0.12], bend: -0.95 }, armR: { rest: [0.9, 0, -0.1], bend: -1.0 } };
    const I = { pos: [-0.4, 0.37, SEAT_Z], yaw: 0, lean: -0.05, headYaw: 0.3, headPitch: -0.1, headRoll: -0.04, sit: true, armL: { rest: [0.7, 0, 0.3], bend: -0.9 }, armR: { rest: [0.7, 0, -0.3], bend: -0.9 } };
    let showB = true, showI = true;
    if (shot === 'bos') { B.headYaw = -0.15; B.headPitch = 0.05; showI = false; }
    else if (shot === 'intern') { I.headYaw = 0.15; I.headPitch = -0.08; }
    else if (shot === 'two') { B.headYaw = -0.4; I.headYaw = 0.25; }
    else if (shot === 'ots_screen') { B.headYaw = -0.2; B.headPitch = 0.4; B.lean = 0.25; I.headPitch = 0.3; if (typing) { I.pos = [-0.05, 0.43, SEAT_Z + 0.3]; I.lean = 0.35; I.headYaw = 0.0; I.typeAt = true; } }
    else if (shot === 'screen') { showB = false; showI = false; }
    return { B, I, showB, showI };
  }

  const LAPZ = TB.z - 0.3;
  return {
    id: 'bilik_mesyuarat', fog: { color: FOG, den: FOGDEN }, background: '#0a1024', env, envIntensity: 0.85, bloomK: 0.78, vig: 0.58,
    floor, noMirror, noDepth, shadowLights: [key], shots, stage, screenMesh,
    point: { aim: () => V3(TB.x + 0.25, TOP + 0.62, LAPZ + 0.1), pole: [-0.3, 0.9, 0.3] },
    slam: { targets: (B) => [V3(B[0] + 0.3, TOP + 0.03, TB.z - 0.67), V3(B[0] - 0.3, TOP + 0.03, TB.z - 0.69)] },
    clock: V3(1.85, 4.3, -6.0),
    kb: () => ({ pos: V3(TB.x, TOP + 0.1, LAPZ), yaw: Math.PI }),
    typeTarget: (side, tap) => V3(TB.x + (side === 'L' ? 0.2 : -0.1), TOP + 0.12 + tap * 0.8, LAPZ - 0.15),
    update(t, S) {
      glassWall.visible = S.shot === 'ots_screen' || S.shot === 'screen';
      const hideSeats = S.shot === 'screen';
      [seatB, seatI, ...extras].forEach((c) => { c.visible = !hideSeats; });
      nearChairs.forEach((c) => { c.visible = S.shot === 'wide' || S.shot === 'two'; });
      leaves.forEach((l, i) => { l.rotation.z = (i - 2) * 0.38 + 0.01 * Math.sin(t * 0.8 + i); });
      key.intensity = 34 + 0.5 * Math.sin(t * 1.3);
      projL.intensity = 22 + 1.5 * Math.sin(t * 7) * Math.sin(t * 0.9);
      const hit = S.sinceSlam > 0;
      items.forEach((it, k) => { it.o.position.y = it.y + (hit ? Math.exp(-S.sinceSlam * 7) * Math.abs(Math.sin(S.sinceSlam * 22 + k * 1.3)) * (0.05 + 0.01 * (k % 3)) : 0); });
    },
  };
}
