// Location "rumah" (s1-e5): the boss's living room late at night. Warm floor lamp pool, plum walls, sofa, a box-cat asleep, family photos
// on a shelf, TV off, laptop on the coffee table (screen toward the sofa; ots/screen shots look at it from behind the sofa).
import * as THREE from 'three';
import { V3 } from './s1-kotak.lib.js';
import { box, slab, piv, std, glowMat, canvasTex, roundRect, rng, TAU, glow, radialTex } from './s1-kotak.lib.js';
import { makeFloorTex, blobShadow, signBoard } from './s1-kotak.locs.js';

export const screenOpts = { compact: false };
const FOG = '#150e1e', FOGDEN = 0.03;
const CT = { x: 0.3, y: 0.5, z: -2.1 }; // coffee table centre, top height

function portrait(g, w, h, kind) {
  const bg = { dad: '#5a7fb0', mum: '#b05a86', boy: '#6ab070', girl: '#e0a840' }[kind];
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const skin = { dad: '#b87d55', mum: '#c68c62', boy: '#c68c62', girl: '#b87d55' }[kind];
  const s = kind === 'boy' || kind === 'girl' ? 0.62 : 0.78;
  const hw = w * s, hh = h * s * 0.82, hx = (w - hw) / 2, hy = h * 0.2 + (kind === 'boy' || kind === 'girl' ? h * 0.12 : 0);
  g.fillStyle = kind === 'dad' ? '#1f2f6b' : kind === 'mum' ? '#2f8a7a' : kind === 'boy' ? '#d4202f' : '#7a5acd'; g.fillRect(w * 0.1, hy + hh * 0.95, w * 0.8, h);
  g.fillStyle = skin; roundRect(g, hx, hy, hw, hh, 14); g.fill();
  if (kind === 'mum') { g.fillStyle = '#e8d6f0'; g.beginPath(); g.moveTo(hx - 12, hy + hh * 0.9); g.lineTo(hx - 12, hy + 18); g.quadraticCurveTo(w / 2, hy - 36, hx + hw + 12, hy + 18); g.lineTo(hx + hw + 12, hy + hh * 0.9); g.lineTo(hx + hw - 8, hy + hh * 0.9); g.lineTo(hx + hw - 8, hy + hh * 0.3); g.lineTo(hx + 8, hy + hh * 0.3); g.lineTo(hx + 8, hy + hh * 0.9); g.fill(); g.fillStyle = skin; roundRect(g, hx + 8, hy + hh * 0.3, hw - 16, hh * 0.65, 10); g.fill(); }
  else { g.fillStyle = '#16141d'; g.fillRect(hx - 4, hy - 8, hw + 8, hh * 0.2); }
  g.fillStyle = '#2a140c'; g.fillRect(hx + hw * 0.22, hy + hh * 0.42, hw * 0.12, hh * 0.12); g.fillRect(hx + hw * 0.66, hy + hh * 0.42, hw * 0.12, hh * 0.12);
  g.strokeStyle = '#3a1612'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(w / 2, hy + hh * 0.62, hw * 0.18, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  if (kind === 'dad') { g.strokeStyle = '#0f1220'; g.lineWidth = 5; g.strokeRect(hx + hw * 0.16, hy + hh * 0.34, hw * 0.26, hh * 0.24); g.strokeRect(hx + hw * 0.58, hy + hh * 0.34, hw * 0.26, hh * 0.24); g.fillStyle = '#16141d'; g.fillRect(hx + hw * 0.25, hy + hh * 0.7, hw * 0.5, hh * 0.08); }
}

export function build(ctx) {
  const { world, post } = ctx;
  const noMirror = [], noDepth = [];
  const R = rng(17);
  const wood = std('#5a3a28', { roughness: 0.45 }), woodD = std('#3a261b', { roughness: 0.5 }), metal = std('#59647f', { roughness: 0.35, metalness: 0.75 });

  // ---- floor: warm parquet + rug ----
  const floor = makeFloorTex(post.rtRefl.texture, FOG, FOGDEN, (g, cx, cz, u) => {
    g.fillStyle = '#3a2418'; g.fillRect(0, 0, 2048, 2048);
    const Rr = rng(8);
    for (let ix = -12; ix < 12; ix += 0.6) for (let iz = -16; iz < 8; iz += 2.4) {
      const sh = Rr(); g.fillStyle = `hsl(${22 + sh * 8},${40 + sh * 10}%,${20 + sh * 8}%)`; g.fillRect(cx(ix) + 1, cz(iz + ((Math.round(ix / 0.6) % 2) * 1.2)) + 1, 0.6 * u - 2, 2.4 * u - 2);
    }
    const pool = (x, z, rx, rz, col) => { g.save(); g.translate(cx(x), cz(z)); g.scale(rx * u, rz * u); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); };
    pool(-2.0, -3.6, 3.2, 2.6, 'rgba(255,170,80,.42)'); pool(0.3, -2.1, 2.2, 1.5, 'rgba(160,190,255,.22)');
    // rug
    g.fillStyle = '#6b2d44'; g.fillRect(cx(-2.2), cz(-4.6), 5.4 * u, 6.0 * u);
    g.strokeStyle = '#e8b13c'; g.lineWidth = 10; g.strokeRect(cx(-2.1), cz(-4.5), 5.2 * u, 5.8 * u);
    g.strokeStyle = '#2f8a7a'; g.lineWidth = 6; g.strokeRect(cx(-1.9), cz(-4.3), 4.8 * u, 5.4 * u);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.05 + Rr() * 0.06})`; g.fillRect(cx(-1.7 + Rr() * 4.4), cz(-4.1 + Rr() * 5), 18, 18); }
  }, { reflK: 0.38, fres0: 0.25 });
  world.add(floor);

  // ---- room shell ----
  const wallM = std('#4a3358', { roughness: 0.85 }), wallD = std('#38264a', { roughness: 0.9 });
  slab(world, 12, 5, 0.3, wallM, 0, 2.5, -6.15);
  slab(world, 0.3, 5, 9, wallD, -4.3, 2.5, -1.6); slab(world, 0.3, 5, 9, wallD, 4.5, 2.5, -1.6);
  slab(world, 12, 0.3, 10, std('#2a1d34', { roughness: 0.9 }), 0, 5.0, -1.5);
  slab(world, 12, 0.2, 0.08, std('#2a1d34'), 0, 0.1, -5.98);
  // window with curtains (back wall)
  const wx = -1.5, wy = 2.9;
  box(world, 1.9, 2.3, 0.1, std('#10131f'), wx, wy, -6.0, 0.03);
  const city = canvasTex(256, 256, (g) => { g.fillStyle = '#0a0f2c'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 38; i++) { g.fillStyle = ['#ffd27a', '#8defff', '#ff9bd8'][i % 3]; g.fillRect(((i * 53) % 230) + 8, ((i * 37) % 200) + 20, 8, 6); } }).tex;
  const cityM = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.1), new THREE.MeshBasicMaterial({ map: city, toneMapped: false })); cityM.material.color.setScalar(0.7); cityM.position.set(wx, wy, -5.93); world.add(cityM);
  for (const sx of [-1, 1]) box(world, 0.55, 2.6, 0.2, std('#2a3a7a', { roughness: 0.9 }), wx + sx * 1.15, wy, -5.85, 0.05);
  slab(world, 2.9, 0.06, 0.08, metal, wx, wy + 1.38, -5.85);
  glow(world, 'rgba(120,150,255,.5)', 4, wx, wy, -5.4, 0.25);
  // shelf with family photos (back wall, right)
  const shelf = piv(world, 1.7, 2.9, -5.95);
  box(shelf, 2.6, 0.07, 0.4, woodD, 0, -0.55, 0, 0.02); box(shelf, 2.6, 0.07, 0.4, woodD, 0, 0.35, 0.0, 0.02);
  ['dad', 'mum', 'boy', 'girl'].forEach((k, i) => {
    const fr = piv(shelf, -0.9 + i * 0.6, 0.72, 0.1 + (i % 2) * 0.03); fr.rotation.z = (i - 1.5) * 0.04;
    box(fr, 0.5, 0.62, 0.05, std('#e8d6b0', { roughness: 0.5 }), 0, 0, 0, 0.02);
    const t = canvasTex(160, 192, (g) => portrait(g, 160, 192, k)); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.52), new THREE.MeshBasicMaterial({ map: t.tex, toneMapped: false })); m.material.color.setScalar(0.85); m.position.z = 0.03; fr.add(m);
  });
  for (let i = 0; i < 7; i++) box(shelf, 0.1, 0.34 + (i % 3) * 0.04, 0.26, std(['#c0392b', '#2d6ad2', '#e8b13c', '#2eae5c'][i % 4], { roughness: 0.6 }), -0.9 + i * 0.13, -0.35 + (i % 3) * 0.02, 0.0, 0.02);
  const pot = piv(shelf, 0.85, -0.51, 0.05); box(pot, 0.26, 0.24, 0.26, std('#b5532e'), 0, 0.12, 0, 0.03); for (let i = 0; i < 4; i++) { const l = box(pot, 0.1, 0.3, 0.04, std('#4a9a4a'), (i - 1.5) * 0.06, 0.38, 0, 0.01); l.rotation.z = (i - 1.5) * 0.25; }
  const shelf2 = piv(world, 1.7, 2.1, -5.95); box(shelf2, 2.6, 0.07, 0.4, woodD, 0, 0, 0, 0.02);
  const trophy = piv(shelf2, 0.5, 0.04, 0); box(trophy, 0.2, 0.08, 0.2, woodD, 0, 0.04, 0, 0.02); box(trophy, 0.05, 0.2, 0.05, std('#e8b13c', { metalness: 0.8, roughness: 0.3 }), 0, 0.18, 0, 0.01); box(trophy, 0.18, 0.18, 0.1, std('#e8b13c', { metalness: 0.8, roughness: 0.3 }), 0, 0.36, 0, 0.03);
  box(world, 1.0, 0.7, 0.06, std('#e8d6b0'), -3.2, 2.9, -6.0, 0.02); // wall art
  slab(world, 0.9, 0.6, 0.02, glowMat('#ff7d5a', 0.6), -3.2, 2.9, -5.96);

  // ---- sofa ----
  const sofaM = std('#2f6f78', { roughness: 0.75 }), sofaL = std('#3a8590', { roughness: 0.7 }), sofaD = std('#245860', { roughness: 0.8 });
  const sofa = piv(world, 0, 0, -3.7);
  box(sofa, 3.4, 0.35, 1.2, sofaD, 0, 0.2, 0, 0.05);
  for (const x of [-0.85, 0.85]) box(sofa, 1.6, 0.2, 1.0, sofaL, x, 0.46, 0.08, 0.08);
  box(sofa, 3.4, 1.15, 0.35, sofaM, 0, 0.95, -0.62, 0.08);
  for (const sx of [-1, 1]) box(sofa, 0.3, 0.75, 1.2, sofaM, sx * 1.75, 0.5, 0, 0.08);
  for (const [x, c] of [[-1.3, '#e8b13c'], [1.25, '#d4202f']]) { const p = box(sofa, 0.5, 0.5, 0.16, std(c, { roughness: 0.8 }), x, 0.85, -0.38, 0.06); p.rotation.set(-0.2, x > 0 ? -0.3 : 0.3, 0); }
  // ottoman / pouf in front of the sofa (the intern types from it in the reverse shots)
  const pouf = piv(world, -0.2, 0, -2.95); box(pouf, 0.6, 0.38, 0.6, std('#e8b13c', { roughness: 0.8 }), 0, 0.2, 0, 0.1);

  // ---- coffee table + laptop (screen prop) ----
  const ct = piv(world, CT.x, 0, CT.z);
  box(ct, 1.9, 0.07, 1.0, wood, 0, CT.y - 0.035, 0, 0.03); box(ct, 1.7, 0.05, 0.8, woodD, 0, 0.2, 0, 0.02);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(ct, 0.09, CT.y - 0.05, 0.09, woodD, sx * 0.85, (CT.y - 0.05) / 2, sz * 0.4, 0.02);
  const jumpers = [];
  const laptop = new THREE.Group();
  const LW = 0.95, LH = LW / 1.6;
  const lapM = std('#9aa5b8', { roughness: 0.3, metalness: 0.8 }), lapD = std('#10131c', { roughness: 0.4, metalness: 0.5 });
  const base = piv(world, CT.x + 0.0, CT.y + 0.03, CT.z + 0.1);
  box(base, LW + 0.06, 0.04, 0.62, lapM, 0, 0, 0, 0.02);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 11; c++) box(base, 0.062, 0.012, 0.06, lapD, -0.4 + c * 0.08, 0.025, -0.2 + r * 0.075, 0.004);
  box(base, 0.3, 0.012, 0.18, std('#242a3d', { roughness: 0.4 }), 0, 0.022, 0.2, 0.004);
  // lid (hinge at the far edge, leaning back; screen faces -z toward the sofa)
  const hinge = piv(base, 0, 0.03, 0.3); hinge.rotation.x = 0.32; // screen normal elevation ~ 18 deg
  const lid = new THREE.Group(); lid.rotation.y = Math.PI; hinge.add(lid); // faces -z
  lid.position.set(0, LH / 2 + 0.04, 0);
  box(lid, LW + 0.06, LH + 0.08, 0.04, lapM, 0, 0, -0.02, 0.025);
  box(lid, LW + 0.0, LH + 0.0, 0.03, lapD, 0, 0, 0.0, 0.02);
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(LW - 0.04, LH - 0.04), new THREE.MeshBasicMaterial({ map: ctx.screen.tex, toneMapped: false }));
  screenMesh.material.color.setScalar(0.95); screenMesh.position.z = 0.0175; lid.add(screenMesh);
  slab(lid, 0.3, 0.02, 0.01, glowMat('#cfe0ff', 1.2), 0, 0.0, -0.045); // back glow strip
  jumpers.push(base);
  const mug = piv(ct, -0.75, CT.y, 0.1); box(mug, 0.16, 0.2, 0.16, std('#e9e4da', { roughness: 0.3 }), 0, 0.1, 0, 0.03); box(mug, 0.05, 0.1, 0.03, std('#e9e4da', { roughness: 0.3 }), 0.1, 0.1, 0, 0.01);
  const bowl = piv(ct, 0.8, CT.y, -0.1); box(bowl, 0.4, 0.14, 0.4, std('#e8d6b0', { roughness: 0.5 }), 0, 0.07, 0, 0.05); for (let i = 0; i < 5; i++) { const k = box(bowl, 0.1, 0.05, 0.1, std('#e0a642'), -0.1 + (i % 3) * 0.1, 0.16 + (i % 2) * 0.03, -0.05 + (i % 2) * 0.1, 0.02); k.rotation.y = i; }
  const remote = box(ct, 0.14, 0.03, 0.4, std('#10131c'), 0.62, CT.y + 0.03, -0.3, 0.01);

  // ---- cat asleep on the sofa ----
  const cat = piv(world, -1.45, 0.58, -3.6);
  const orange = std('#e8903a', { roughness: 0.85 }), cream = std('#f3e6cf', { roughness: 0.85 });
  const body = box(cat, 0.8, 0.36, 0.5, orange, 0, 0.18, 0, 0.12);
  box(cat, 0.5, 0.02, 0.3, cream, 0.05, 0.05, 0.12, 0.01);
  const chead = piv(cat, 0.46, 0.2, 0.18); chead.rotation.y = -0.5; box(chead, 0.36, 0.3, 0.32, orange, 0, 0.0, 0, 0.1);
  for (const sx of [-1, 1]) { const e = box(chead, 0.1, 0.16, 0.06, orange, sx * 0.11, 0.2, -0.02, 0.02); e.rotation.z = -sx * 0.25; box(chead, 0.05, 0.1, 0.02, std('#e89a9a'), sx * 0.11, 0.2, 0.01, 0.01).rotation.z = -sx * 0.25; }
  const catFace = canvasTex(128, 128, (g) => { g.strokeStyle = '#2a140c'; g.lineWidth = 6; g.lineCap = 'round'; for (const x of [34, 94]) { g.beginPath(); g.arc(x, 56, 12, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); } g.fillStyle = '#e89a9a'; g.fillRect(58, 74, 12, 8); g.beginPath(); g.moveTo(64, 84); g.lineTo(64, 94); g.stroke(); });
  const cfp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: catFace.tex, transparent: true })); cfp.position.set(0, 0, 0.165); chead.add(cfp);
  for (let i = 0; i < 4; i++) { const s = box(cat, 0.22, 0.2, 0.22, i % 2 ? orange : cream, -0.48 - i * 0.12 + (i > 1 ? 0.0 : 0), 0.12 + (i > 2 ? 0.08 : 0), -0.18 + i * 0.12, 0.07); } // curled tail
  const zs = [];
  for (let k = 0; k < 3; k++) { const t = canvasTex(64, 64, (g) => { g.fillStyle = '#cfe0ff'; g.font = '800 54px "Avenir Next", Arial'; g.textAlign = 'center'; g.fillText('z', 32, 48); }); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, fog: false, depthWrite: false })); sp.scale.set(0.22, 0.22, 1); world.add(sp); noDepth.push(sp); zs.push(sp); }

  // ---- TV wall (hidden when the camera is on that side) ----
  const tvWall = new THREE.Group(); world.add(tvWall);
  slab(tvWall, 12, 5, 0.3, wallM, 0, 2.5, 2.7);
  box(tvWall, 3.2, 0.75, 0.7, wood, 0.3, 0.38, 2.3, 0.04);
  box(tvWall, 2.8, 1.6, 0.1, std('#05060c', { roughness: 0.08, metalness: 0.7 }), 0.3, 1.9, 2.5, 0.03);
  const tvTex = canvasTex(512, 288, (g) => { const gr = g.createLinearGradient(0, 0, 512, 288); gr.addColorStop(0, '#0d1022'); gr.addColorStop(0.5, '#05060c'); gr.addColorStop(1, '#10132a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 288); g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(40, 0); g.lineTo(190, 0); g.lineTo(60, 288); g.lineTo(0, 288); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,176,96,.18)'; g.beginPath(); g.arc(430, 60, 90, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, 0, 512, 288); }).tex;
  const tvScr = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.5), new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false })); tvScr.position.set(0.3, 1.9, 2.44); tvScr.rotation.y = Math.PI; tvWall.add(tvScr);
  slab(tvWall, 0.06, 0.04, 0.02, glowMat('#ff2a2a', 2.5), 1.6, 1.15, 2.43);
  box(tvWall, 0.6, 1.4, 0.6, std('#3a8a4a'), -2.6, 0.7, 2.3, 0.1);
  // ---- floor lamp (warm) ----
  const lamp = piv(world, -2.3, 0, -4.4);
  box(lamp, 0.5, 0.06, 0.5, metal, 0, 0.03, 0, 0.02); box(lamp, 0.07, 3.0, 0.07, metal, 0, 1.55, 0, 0.02);
  box(lamp, 0.9, 0.8, 0.9, std('#ffd9a0', { emissive: '#ffb060', emissiveIntensity: 1.1, roughness: 0.9 }), 0, 3.2, 0, 0.06);
  glow(world, 'rgba(255,170,80,.9)', 3.4, -2.3, 3.2, -4.4, 0.55);
  const sideT = piv(world, -2.6, 0, -3.2); box(sideT, 0.8, 0.7, 0.8, wood, 0, 0.35, 0, 0.04);

  // ---- lights ----
  const Lt = (l) => { world.add(l); if (l.target) world.add(l.target); return l; };
  Lt(new THREE.HemisphereLight('#6a5aa8', '#1a0d1f', 0.42));
  const lampL = Lt(new THREE.PointLight('#ffa850', 26, 12, 1.6)); lampL.position.set(-2.0, 3.0, -3.9);
  lampL.castShadow = true; lampL.shadow.mapSize.set(1024, 1024); lampL.shadow.bias = -0.0006; lampL.shadow.radius = 6;
  const lapK = Lt(new THREE.SpotLight('#b8d0ff', 10, 0, 0.8, 0.9, 1)); lapK.position.set(0.3, 1.2, -1.2); lapK.target.position.set(0.3, 1.8, -3.9);
  const moon = Lt(new THREE.SpotLight('#6f8cff', 38, 0, 0.9, 0.9, 1.6)); moon.position.set(-1.5, 3.8, -5.2); moon.target.position.set(0.2, 1.0, -2.6);
  const magenta = Lt(new THREE.SpotLight('#ff2fb4', 55, 0, 0.8, 0.9, 2)); magenta.position.set(-3.5, 3.2, 1.0); magenta.target.position.set(0.5, 1.4, -3.4);
  const cyan = Lt(new THREE.SpotLight('#2f9bff', 45, 0, 0.8, 0.9, 2)); cyan.position.set(3.6, 3.0, 1.0); cyan.target.position.set(0.3, 1.4, -3.4);
  const front = Lt(new THREE.DirectionalLight('#c8b8ff', 0.35)); front.position.set(1, 3, 6); front.target.position.set(0.3, 1.3, -3.5);

  blobShadow(world, noMirror, noDepth, 0, -3.7, 1.8, 0.8, 0.6); blobShadow(world, noMirror, noDepth, CT.x, CT.z, 1.1, 0.7, 0.55); blobShadow(world, noMirror, noDepth, -2.3, -4.4, 0.5, 0.5, 0.5);

  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: '#1a1226', side: THREE.BackSide })));
  const wp = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), glowMat('#ffb060', 3)); wp.position.set(-8, 2.5, -2); wp.rotation.y = Math.PI / 2; env.add(wp);
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.6), glowMat('#6f8cff', 3)); cp.position.set(0, 4.5, -9); env.add(cp);

  // ---- shots ----
  const shots = {
    wide: { cam: { pos: [0.2, 1.85, 2.4], target: [0.2, 1.75, -3.7], fov: 50 }, push: 0.03, coc: 0.4 },
    two: { cam: { pos: [0.3, 1.95, 0.9], target: [0.3, 1.5, -3.7], fov: 48 }, push: 0.05, coc: 0.5 },
    bos: { cam: { pos: [-0.3, 1.95, -0.3], target: [0.7, 1.8, -3.7], fov: 38 }, push: 0.06, coc: 0.55 },
    intern: { cam: { pos: [0.45, 1.85, -0.3], target: [-0.4, 1.45, -3.7], fov: 34 }, push: 0.06, coc: 0.5 },
    ots_screen: (speaker) => (speaker === 'intern'
      ? { cam: { pos: [3.7, 2.7, -5.6], target: [0.0, 0.95, -2.1], fov: 34 }, push: 0.05, coc: 0.45 }
      : { cam: { pos: [-3.7, 2.7, -5.6], target: [0.6, 0.95, -2.1], fov: 34 }, push: 0.05, coc: 0.45 }),
    screen: { cam: { pos: [0.3, 1.6, -5.3], target: [0.3, 0.8, -2.0], fov: 34 }, push: 0.03, coc: 0.4 },
  };
  function stage(shot, speaker, typing) {
    const B = { pos: [0.7, -0.04, -3.7], yaw: 0, lean: 0.14, headYaw: -0.3, headPitch: 0.1, headRoll: 0.03, sit: true, armL: { rest: [0.8, 0, 0.12], bend: -0.95 }, armR: { rest: [0.9, 0, -0.1], bend: -1.0 } };
    const I = { pos: [-0.4, 0.37, -3.7], yaw: 0, lean: -0.05, headYaw: 0.3, headPitch: -0.1, headRoll: -0.04, sit: true, armL: { rest: [0.7, 0, 0.3], bend: -0.9 }, armR: { rest: [0.7, 0, -0.3], bend: -0.9 } };
    let showB = true, showI = true;
    if (shot === 'bos') { B.headYaw = -0.15; B.headPitch = 0.05; showI = false; }
    else if (shot === 'intern') { I.headYaw = 0.15; I.headPitch = -0.08; }
    else if (shot === 'two') { B.headYaw = -0.4; I.headYaw = 0.25; }
    else if (shot === 'ots_screen') { B.headYaw = -0.2; B.headPitch = 0.4; B.lean = 0.25; I.headPitch = 0.3; if (typing) { I.pos = [-0.05, 0.43, -3.0]; I.lean = 0.35; I.headYaw = 0.0; I.typeAt = true; } }
    else if (shot === 'screen') { showB = false; showI = false; }
    return { B, I, showB, showI };
  }

  const sofaGroupHide = [sofa, cat, pouf, ...zs, lamp, sideT];
  return {
    id: 'rumah', fog: { color: FOG, den: FOGDEN }, background: '#0e0816', env, envIntensity: 0.8, bloomK: 0.8, vig: 0.6,
    floor, noMirror, noDepth, shadowLights: [lampL], shots, stage, screenMesh,
    point: null, slam: null, clock: null,
    kb: () => ({ pos: V3(CT.x, CT.y + 0.08, CT.z + 0.0), yaw: Math.PI }), // boss hands over the laptop keyboard (camera is behind the sofa)
    typeTarget: (side, tap) => V3(CT.x + (side === 'L' ? 0.2 : -0.1), CT.y + 0.1 + tap * 0.8, CT.z - 0.05),
    update(t, S) {
      tvWall.visible = S.shot === 'ots_screen' || S.shot === 'screen';
      sofa.visible = S.shot !== 'screen'; cat.visible = S.shot !== 'screen'; pouf.visible = S.shot !== 'screen';
      cat.scale.y = 1 + 0.045 * Math.sin(t * 1.9); body.position.y = 0.18;
      zs.forEach((sp, k) => { const u = ((t * 0.3 + k / 3) % 1); sp.position.set(-1.45 + 0.15 + u * 0.2, 0.58 + 0.5 + u * 0.7, -3.6 + 0.3); sp.material.opacity = Math.sin(u * Math.PI) * 0.85; sp.visible = S.shot !== 'screen'; });
      lampL.intensity = 26 + 0.8 * Math.sin(t * 0.8);
    },
  };
}
