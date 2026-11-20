// s1-kotak cast: Bos Rahman (boxy navy suit, canvas face) and Intern-3 (orange box robot with a pixel-screen face).
// Each builder returns a THREE.Group with named pivots in group.userData.rig:
//   body, head, armL, armR (+ elbowL, elbowR, handL, handR, fingerL, fingerR)  and group.setFace(emotion, mouthOpen, blink)
// emotions: neutral | happy | annoyed | shocked
import * as THREE from 'three';
import { box, slab, piv, std, basic, glowMat, canvasTex, roundRect, glow, TAU, clamp, lerp } from './s1-kotak.lib.js';

// ======================================================================================================================
// Bos Rahman
// ======================================================================================================================
export function makeBos() {
  const root = new THREE.Group();
  const navy = std('#1f2f6b', { roughness: 0.5, metalness: 0.05 }), navyD = std('#16214f', { roughness: 0.5 }), navyL = std('#2b3d86', { roughness: 0.5 });
  const shirt = std('#eef2fa', { roughness: 0.6 }), tie = std('#d4202f', { roughness: 0.32, metalness: 0.1 }), tieD = std('#a8141f', { roughness: 0.4 });
  const skin = std('#b87d55', { roughness: 0.65 }), skinD = std('#a06a45', { roughness: 0.7 });
  const hairM = std('#16141d', { roughness: 0.5 }), grey = std('#8b8fa6', { roughness: 0.5 });
  const shoe = std('#0d0f1a', { roughness: 0.28, metalness: 0.25 }), belt = std('#0b0c14', { roughness: 0.4 });
  const frameM = std('#0f1220', { roughness: 0.3, metalness: 0.5 });

  const legH = 0.64, torsoH = 0.8, torsoW = 0.82, torsoD = 0.46;
  const legs = {}; // hip pivots (rig.legL / rig.legR) so seated poses can swing the legs forward
  for (const [key, sx] of [['L', 1], ['R', -1]]) {
    const hip = piv(root, sx * 0.19, legH, 0); legs[key] = hip;
    box(hip, 0.3, legH - 0.1, 0.34, navyD, 0, 0.1 + (legH - 0.1) / 2 - legH, 0, 0.04);
    box(hip, 0.33, 0.12, 0.56, shoe, 0, 0.06 - legH, 0.1, 0.05);
  }
  const body = piv(root, 0, legH, 0);
  // torso: jacket, shirt wedge, tie, lapels, buttons
  box(body, torsoW, torsoH, torsoD, navy, 0, torsoH / 2, 0, 0.07);
  box(body, torsoW + 0.02, 0.1, torsoD + 0.02, belt, 0, 0.05, 0, 0.03);
  slab(body, 0.04, 0.5, 0.012, navyD, 0, 0.38, torsoD / 2 + 0.003); // centre seam hint
  box(body, 0.2, 0.52, 0.03, shirt, 0, 0.52, torsoD / 2 + 0.002, 0.012);
  for (const sx of [-1, 1]) { const l = box(body, 0.17, 0.5, 0.045, navyL, sx * 0.17, 0.5, torsoD / 2 + 0.012, 0.015); l.rotation.z = -sx * 0.12; }
  box(body, 0.085, 0.085, 0.05, tieD, 0, 0.74, torsoD / 2 + 0.03, 0.02); // knot
  box(body, 0.1, 0.46, 0.04, tie, 0, 0.47, torsoD / 2 + 0.038, 0.02);
  const tip = box(body, 0.13, 0.1, 0.04, tie, 0, 0.215, torsoD / 2 + 0.038, 0.02);
  for (const sy of [0.22, 0.12]) box(body, 0.045, 0.045, 0.03, std('#c9a24a', { metalness: 0.8, roughness: 0.3 }), 0.12, sy, torsoD / 2 + 0.014, 0.012);
  box(body, 0.13, 0.08, 0.04, shirt, -0.26, 0.58, torsoD / 2 + 0.018, 0.012); // pocket square
  box(body, 0.1, 0.014, 0.045, std('#d4202f'), -0.26, 0.62, torsoD / 2 + 0.02, 0.005);
  // neck + head
  const neck = piv(body, 0, torsoH, 0);
  box(neck, 0.24, 0.1, 0.22, skinD, 0, 0.02, 0, 0.03);
  box(neck, 0.34, 0.06, 0.3, shirt, 0, 0.0, 0, 0.02); // collar
  const hw = 0.72, hh = 0.76, hd = 0.56;
  const head = piv(neck, 0, 0.05 + hh / 2, 0);
  box(head, hw, hh, hd, skin, 0, 0, 0, 0.09);
  // hair: short flat-top with side grey
  box(head, hw + 0.02, 0.2, hd + 0.02, hairM, 0, hh / 2 - 0.07, -0.02, 0.06);
  box(head, hw + 0.04, 0.16, 0.1, hairM, 0, hh / 2 - 0.12, hd / 2 - 0.005, 0.03); // fringe edge
  for (const sx of [-1, 1]) {
    box(head, 0.05, 0.3, hd - 0.02, hairM, sx * (hw / 2 + 0.006), hh / 2 - 0.2, -0.02, 0.02);
    box(head, 0.045, 0.2, 0.12, grey, sx * (hw / 2 + 0.012), hh / 2 - 0.2, 0.1, 0.015); // grey temples
    box(head, 0.07, 0.17, 0.12, skinD, sx * (hw / 2 + 0.03), -0.02, 0.0, 0.025); // ears
  }
  // face canvas
  const FW = 512, FH = Math.round(512 * hh / hw), pxu = FW / hw;
  const X = (x) => FW / 2 + x * pxu, Y = (y) => FH / 2 - y * pxu;
  const faceTx = canvasTex(FW, FH, null);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTx.tex, roughness: 0.65, metalness: 0, emissive: new THREE.Color('#ffffff'), emissiveMap: faceTx.tex, emissiveIntensity: 0.22 });
  const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(hw - 0.004, hh - 0.004), faceMat);
  facePlane.position.z = hd / 2 + 0.002; facePlane.receiveShadow = true; head.add(facePlane);
  const fz = hd / 2;
  // 3D facial features: glasses, nose, moustache
  const lens = std('#cfe6ff', { roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.14 });
  const glasses = piv(head, 0, 0.055, 0); // pivot so the glasses can be lifted (rub_eyes)
  for (const sx of [-1, 1]) {
    const cx = sx * 0.17, cy = 0, lw = 0.255, lh = 0.2, t = 0.03;
    box(glasses, lw, t, 0.04, frameM, cx, cy + lh / 2 - t / 2, fz + 0.02, 0.01);
    box(glasses, lw, t, 0.04, frameM, cx, cy - lh / 2 + t / 2, fz + 0.02, 0.01);
    box(glasses, t, lh, 0.04, frameM, cx - lw / 2 + t / 2, cy, fz + 0.02, 0.01);
    box(glasses, t, lh, 0.04, frameM, cx + lw / 2 - t / 2, cy, fz + 0.02, 0.01);
    slab(glasses, lw - 0.03, lh - 0.03, 0.004, lens, cx, cy, fz + 0.035);
    box(glasses, 0.03, 0.03, hd * 0.9, frameM, sx * (hw / 2 + 0.005), cy + 0.03, 0.0, 0.01); // temple arms along the head sides
  }
  box(glasses, 0.1, 0.03, 0.04, frameM, 0, 0.045, fz + 0.02, 0.01); // bridge
  box(head, 0.09, 0.15, 0.09, skinD, 0, -0.05, fz + 0.04, 0.03); // nose
  box(head, 0.44, 0.1, 0.08, hairM, 0, -0.145, fz + 0.04, 0.035); // moustache
  for (const sx of [-1, 1]) box(head, 0.085, 0.15, 0.07, hairM, sx * 0.21, -0.19, fz + 0.035, 0.03);
  box(head, 0.12, 0.05, 0.06, hairM, 0, -0.36, fz + 0.01, 0.02); // chin goatee patch
  // arms
  const arms = {};
  for (const [key, sx] of [['L', 1], ['R', -1]]) {
    const sh = piv(body, sx * (torsoW / 2 + 0.1), torsoH - 0.12, 0);
    box(sh, 0.24, 0.26, 0.26, navy, 0, -0.04, 0, 0.06); // shoulder pad
    box(sh, 0.2, 0.44, 0.23, navy, 0, -0.22, 0, 0.05);
    const el = piv(sh, 0, -0.4, 0);
    box(el, 0.185, 0.4, 0.21, navy, 0, -0.18, 0, 0.05);
    box(el, 0.16, 0.05, 0.19, shirt, 0, -0.39, 0, 0.012); // cuff
    const hand = piv(el, 0, -0.46, 0);
    box(hand, 0.15, 0.15, 0.15, skin, 0, 0, 0, 0.04);
    const finger = box(hand, 0.045, 0.16, 0.045, skin, 0, -0.14, 0.01, 0.015); finger.visible = false;
    arms[key] = { sh, el, hand, finger };
  }
  // shadow-casting is on by default for boxes
  const rig = { body, head, neck, glasses, legL: legs.L, legR: legs.R, armL: arms.L.sh, armR: arms.R.sh, elbowL: arms.L.el, elbowR: arms.R.el, handL: arms.L.hand, handR: arms.R.hand, fingerL: arms.L.finger, fingerR: arms.R.finger,
    shoulderY: torsoH - 0.12, shoulderX: torsoW / 2 + 0.1, lenA: 0.4, lenB: 0.46 + 0.22, headY: legH + torsoH + 0.05 + hh / 2 };

  // ---- face drawing ----------------------------------------------------------------------------------------------------
  const SKIN = '#b87d55', SKIN_L = '#c68c62', SKIN_D = '#9d6843';
  let last = '';
  function drawFace(g, emotion, mouthOpen, blink) {
    // base
    g.fillStyle = SKIN; g.fillRect(0, 0, FW, FH);
    const gr = g.createLinearGradient(0, 0, 0, FH); gr.addColorStop(0, 'rgba(255,220,180,.16)'); gr.addColorStop(0.55, 'rgba(255,220,180,0)'); gr.addColorStop(1, 'rgba(60,20,0,.2)');
    g.fillStyle = gr; g.fillRect(0, 0, FW, FH);
    g.fillStyle = 'rgba(214,120,96,.35)'; // cheeks
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(X(sx * 0.25), Y(-0.1), 36, 22, 0, 0, TAU); g.fill(); }
    // eyes
    const ex = { neutral: { w: 0.15, h: 0.115, p: 0.065, lid: 0.0 }, happy: { w: 0.15, h: 0.115, p: 0.06, lid: 0.0 }, annoyed: { w: 0.15, h: 0.115, p: 0.065, lid: 0.45 }, shocked: { w: 0.17, h: 0.16, p: 0.04, lid: 0 } }[emotion] || {};
    const cy = 0.055;
    for (const sx of [-1, 1]) {
      const cx = sx * 0.17;
      if (emotion === 'happy' || blink > 0.85) { // happy ^ ^ or fully blinked: closed arc
        g.strokeStyle = '#2a140c'; g.lineWidth = 11; g.lineCap = 'round';
        g.beginPath();
        if (emotion === 'happy') { g.arc(X(cx), Y(cy) + 20, 30, Math.PI * 1.1, Math.PI * 1.9); } else { g.moveTo(X(cx) - 30, Y(cy) + 4); g.lineTo(X(cx) + 30, Y(cy) + 4); }
        g.stroke();
        continue;
      }
      const w = ex.w * pxu, h = ex.h * pxu * (1 - blink * 0.8);
      g.fillStyle = '#f7f4ee'; roundRect(g, X(cx) - w / 2, Y(cy) - h / 2, w, h, 10); g.fill();
      g.fillStyle = '#1a0f0c';
      const px = X(cx) + (-sx * 0.0) * pxu - 0.012 * pxu, ps = ex.p * pxu;
      roundRect(g, px - ps / 2, Y(cy) - ps / 2 + (ex.lid ? 5 : 0), ps, ps, 8); g.fill();
      g.fillStyle = '#fff'; g.fillRect(px - ps / 2 + 4, Y(cy) - ps / 2 + 4 + (ex.lid ? 5 : 0), 9, 9);
      if (ex.lid) { // heavy annoyed upper lids (skin colour) cut diagonally toward the inner corner
        g.fillStyle = SKIN_D; g.beginPath();
        const top = Y(cy) - h / 2 - 3, l = X(cx) - w / 2 - 4, r = X(cx) + w / 2 + 4, depthO = h * ex.lid * 0.55, depthI = h * ex.lid * 1.25;
        const dl = sx < 0 ? depthO : depthI, dr = sx < 0 ? depthI : depthO;
        g.moveTo(l, top); g.lineTo(r, top); g.lineTo(r, top + dr); g.lineTo(l, top + dl); g.closePath(); g.fill();
        g.strokeStyle = '#2a140c'; g.lineWidth = 5; g.beginPath(); g.moveTo(l, top + dl); g.lineTo(r, top + dr); g.stroke();
      }
    }
    // eyebrows (thick)
    const bw = 0.27 * pxu, bt = 0.07 * pxu;
    for (const sx of [-1, 1]) {
      const cx = sx * 0.17;
      let by = 0.215, ang = 0, bs = 1; // ang>0: inner end lower (angry)
      if (emotion === 'annoyed') { by = 0.178; ang = 0.46; bs = 1.1; }
      else if (emotion === 'shocked') { by = 0.285; ang = -0.12; }
      else if (emotion === 'happy') { by = 0.24; ang = -0.12; }
      else { by = 0.215; ang = 0.04; }
      g.save(); g.translate(X(cx), Y(by)); g.rotate(sx * ang); // for sx<0 (left of face) inner end is on the right: rotate positive = clockwise = right end down
      g.fillStyle = '#17120f'; roundRect(g, -bw * bs / 2, -bt / 2, bw * bs, bt * (emotion === 'annoyed' ? 1.15 : 1), 10); g.fill();
      g.restore();
    }
    if (emotion === 'annoyed') { // forehead wrinkles + frown line
      g.strokeStyle = SKIN_D; g.lineWidth = 6; g.lineCap = 'round';
      for (const yy of [0.325, 0.29]) { g.beginPath(); g.moveTo(X(-0.17), Y(yy)); g.quadraticCurveTo(X(0), Y(yy + 0.02), X(0.17), Y(yy)); g.stroke(); }
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(X(sx * 0.035), Y(0.19)); g.lineTo(X(sx * 0.03), Y(0.13)); g.stroke(); }
    }
    // mouth below the moustache
    const my = emotion === 'shocked' ? -0.28 : -0.265, mw = 0.2 * pxu;
    const open = clamp(mouthOpen);
    if (emotion === 'happy') {
      const h = (0.04 + open * 0.1) * pxu;
      g.fillStyle = '#3a0f12'; g.beginPath(); g.moveTo(X(-0.12), Y(my + 0.03)); g.quadraticCurveTo(X(0), Y(my - 0.01 - h / pxu), X(0.12), Y(my + 0.03));
      g.quadraticCurveTo(X(0), Y(my + 0.07 + 0.0), X(-0.12), Y(my + 0.03)); g.closePath();
      g.fill();
      g.fillStyle = '#fff'; g.fillRect(X(-0.085), Y(my + 0.03), 0.17 * pxu, 6);
    } else if (emotion === 'shocked') {
      const h = (0.08 + open * 0.07) * pxu, w = 0.1 * pxu;
      g.fillStyle = '#3a0f12'; roundRect(g, X(0) - w / 2, Y(my) - h / 2, w, h, 16); g.fill();
      g.fillStyle = '#c24b5b'; roundRect(g, X(0) - w / 2 + 8, Y(my) + h / 2 - 20, w - 16, 14, 6); g.fill();
    } else {
      const h = Math.max(7, (0.016 + open * 0.115) * pxu);
      if (open < 0.12) {
        g.strokeStyle = '#3a1612'; g.lineWidth = 11; g.lineCap = 'round'; g.beginPath();
        if (emotion === 'annoyed') { g.moveTo(X(-0.1), Y(my) + 4); g.quadraticCurveTo(X(0), Y(my) - 12, X(0.1), Y(my) + 4); } else { g.moveTo(X(-0.1), Y(my)); g.lineTo(X(0.1), Y(my)); }
        g.stroke();
      } else {
        g.fillStyle = '#3a0f12'; roundRect(g, X(0) - mw * 0.52, Y(my) - h / 2, mw * 1.04, h, 12); g.fill();
        g.fillStyle = '#f2eee6'; g.fillRect(X(0) - mw * 0.46, Y(my) - h / 2 + 3, mw * 0.92, Math.min(10, h * 0.28));
        g.fillStyle = '#c24b5b'; roundRect(g, X(0) - mw * 0.3, Y(my) + h / 2 - Math.min(18, h * 0.4), mw * 0.6, Math.min(16, h * 0.36), 6); g.fill();
      }
    }
  }
  /** emotion + mouth + blink; optional prev/mix cross-fades from the previous emotion (mix 0..1) */
  function setFace(emotion = 'neutral', mouthOpen = 0, blink = 0, prev = null, mix = 1) {
    const mq = prev && prev !== emotion ? Math.round(clamp(mix) * 4) / 4 : 1;
    const key = [emotion, mouthOpen.toFixed(2), blink.toFixed(2), mq < 1 ? prev : '', mq].join();
    if (key === last) return; last = key;
    const g = faceTx.g;
    if (mq < 1) { drawFace(g, prev, mouthOpen, blink); g.globalAlpha = mq; drawFace(g, emotion, mouthOpen, blink); g.globalAlpha = 1; }
    else drawFace(g, emotion, mouthOpen, blink);
    faceTx.tex.needsUpdate = true;
  }
  setFace('neutral', 0, 0);
  root.userData.rig = rig; root.setFace = setFace; root.userData.name = 'bos';
  return root;
}

// ======================================================================================================================
// Intern-3
// ======================================================================================================================
const CW = 24, CH = 19;
function internCells(emotion, open, blink) {
  const on = new Set(); const add = (x, y) => on.add(x + ',' + y);
  const rectc = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) add(x, y); };
  const LX = 4, RX = 15, ey = 4;
  const closed = blink > 0.6;
  for (const [i, x0] of [LX, RX].entries()) {
    if (closed && emotion !== 'happy') { rectc(x0, ey + 3, 5, 1); continue; }
    if (emotion === 'happy') { // ^ ^
      rectc(x0 + 1, ey + 1, 3, 1); [[0, 2], [1, 2], [3, 2], [4, 2], [0, 3], [4, 3]].forEach(([dx, dy]) => add(x0 + dx, ey + dy));
      rectc(x0 + 1, ey + 0, 3, 1);
    } else if (emotion === 'annoyed') {
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 5; dx++) {
        const inner = i === 0 ? dx : 4 - dx; // 4 = nearest to the nose
        if (dy < Math.round(inner * 0.6)) continue; // slanted top lid, high at the outer corner
        add(x0 + dx, ey + 2 + dy);
      }
    } else if (emotion === 'shocked') {
      rectc(x0 - 0, ey - 1, 6, 8); [[2, 2], [3, 2], [2, 3], [3, 3]].forEach(([dx, dy]) => on.delete((x0 + dx) + ',' + (ey - 1 + dy + 2)));
      on.delete((x0 + 0) + ',' + (ey - 1)); on.delete((x0 + 5) + ',' + (ey - 1)); on.delete((x0 + 0) + ',' + (ey + 6)); on.delete((x0 + 5) + ',' + (ey + 6));
    } else { // neutral
      rectc(x0, ey, 5, 7); on.delete(x0 + ',' + ey); on.delete((x0 + 4) + ',' + ey); on.delete(x0 + ',' + (ey + 6)); on.delete((x0 + 4) + ',' + (ey + 6));
    }
  }
  const my = 14;
  const oh = Math.round(open * 4);
  if (emotion === 'happy') {
    if (oh >= 1) { rectc(7, my - 1, 10, 1 + oh); [7, 16].forEach((x) => on.delete(x + ',' + (my - 1 + oh))); rectc(8, my + 1 + oh, 8, 1); }
    else { [[5, 11], [6, 12], [17, 12], [18, 11]].forEach(([x, y]) => add(x, y)); rectc(7, 13, 10, 2); }
    if (oh >= 1) { add(5, 11); add(6, 12); add(17, 12); add(18, 11); }
  } else if (emotion === 'annoyed') {
    if (oh >= 1) { rectc(8, my, 8, 1 + oh); }
    else { rectc(8, my + 1, 8, 1); add(7, my + 2); add(16, my + 2); }
  } else if (emotion === 'shocked') {
    rectc(9, 12, 6, 6); [[11, 14], [12, 14], [11, 15], [12, 15]].forEach(([x, y]) => on.delete(x + ',' + y));
    [[9, 12], [14, 12], [9, 17], [14, 17]].forEach(([x, y]) => on.delete(x + ',' + y));
  } else {
    rectc(8, my, 8, 1 + oh);
  }
  return on;
}

export function makeIntern() {
  const root = new THREE.Group();
  const orange = std('#ff7d1c', { roughness: 0.3, metalness: 0.25 }), orangeD = std('#d95a08', { roughness: 0.35, metalness: 0.25 });
  const steel = std('#3b4258', { roughness: 0.35, metalness: 0.7 }), dark = std('#0a0e18', { roughness: 0.25, metalness: 0.4 });
  const cream = std('#f3e9d8', { roughness: 0.5 });

  const legH = 0.2;
  const legsI = {};
  for (const [key, sx] of [['L', 1], ['R', -1]]) {
    const hip = piv(root, sx * 0.12, legH, 0); legsI[key] = hip;
    box(hip, 0.13, legH, 0.13, steel, 0, 0.08 + legH / 2 - 0.04 - legH, 0, 0.03);
    box(hip, 0.19, 0.08, 0.26, orangeD, 0, 0.04 - legH, 0.04, 0.035);
  }
  const body = piv(root, 0, legH + 0.04, 0);
  const bw = 0.5, bh = 0.46, bd = 0.36;
  box(body, bw, bh, bd, orange, 0, bh / 2, 0, 0.07);
  box(body, bw + 0.02, 0.05, bd + 0.02, steel, 0, 0.03, 0, 0.02); // belt line
  // chest panel + number + lights
  const plate = canvasTex(256, 192, (g) => {
    g.fillStyle = '#0a0e18'; g.fillRect(0, 0, 256, 192);
    g.fillStyle = '#19e3ff'; g.font = '800 120px Menlo, monospace'; g.textAlign = 'center'; g.fillText('03', 128, 128);
    g.fillStyle = '#ff2fb4'; g.fillRect(36, 150, 40, 10); g.fillStyle = '#ffd03a'; g.fillRect(96, 150, 40, 10); g.fillStyle = '#35e08a'; g.fillRect(156, 150, 40, 10);
  });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.21), new THREE.MeshBasicMaterial({ map: plate.tex, toneMapped: false })); pm.material.color.setScalar(1.25);
  box(body, 0.32, 0.25, 0.02, dark, 0, 0.27, bd / 2 + 0.003, 0.01); pm.position.set(0, 0.27, bd / 2 + 0.016); body.add(pm);
  for (const sx of [-1, 1]) box(body, 0.05, 0.05, 0.02, glowMat(sx < 0 ? '#ff2fb4' : '#35e08a', 1.8), sx * 0.17, 0.4 - 0.0, bd / 2 + 0.005, 0.01);
  // neck + head
  const neck = piv(body, 0, bh, 0);
  box(neck, 0.18, 0.07, 0.18, steel, 0, 0.02, 0, 0.02);
  const hw = 0.66, hh = 0.58, hd = 0.54;
  const head = piv(neck, 0, 0.045 + hh / 2, 0);
  box(head, hw, hh, hd, orange, 0, 0, 0, 0.09);
  // screen inset
  const sw = 0.54, sh = 0.43;
  box(head, sw + 0.05, sh + 0.05, 0.03, steel, 0, 0.0, hd / 2 - 0.002, 0.025);
  box(head, sw, sh, 0.03, dark, 0, 0.0, hd / 2 + 0.008, 0.02);
  const CWpx = 576, CHpx = Math.round(576 * (sh - 0.04) / (sw - 0.04)), cell = CWpx / CW;
  const faceTx = canvasTex(CWpx, CHpx, null);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTx.tex, toneMapped: false }); faceMat.color.setScalar(1.35);
  const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(sw - 0.04, sh - 0.04), faceMat); facePlane.position.z = hd / 2 + 0.0245; head.add(facePlane);
  // ear bolts, antenna
  for (const sx of [-1, 1]) { box(head, 0.07, 0.2, 0.2, steel, sx * (hw / 2 + 0.03), -0.02, 0, 0.025); box(head, 0.03, 0.09, 0.09, orangeD, sx * (hw / 2 + 0.07), -0.02, 0, 0.012); }
  box(head, 0.035, 0.2, 0.035, steel, 0.12, hh / 2 + 0.1, -0.02, 0.01);
  const antM = glowMat('#35e08a', 2.0);
  const ant = box(head, 0.09, 0.09, 0.09, antM, 0.12, hh / 2 + 0.22, -0.02, 0.025);
  const antGlow = glow(head, 'rgba(60,255,150,.9)', 0.55, 0.12, hh / 2 + 0.22, -0.02, 0.8);
  // arms (stubby)
  const arms = {};
  for (const [key, sx] of [['L', 1], ['R', -1]]) {
    const sh2 = piv(body, sx * (bw / 2 + 0.06), bh - 0.08, 0);
    box(sh2, 0.13, 0.13, 0.15, steel, 0, 0, 0, 0.04);
    box(sh2, 0.11, 0.16, 0.12, orange, 0, -0.1, 0, 0.035);
    const el = piv(sh2, 0, -0.17, 0);
    box(el, 0.1, 0.15, 0.11, orange, 0, -0.06, 0, 0.03);
    const hand = piv(el, 0, -0.18, 0);
    box(hand, 0.15, 0.12, 0.14, steel, 0, 0, 0, 0.035);
    const finger = box(hand, 0.035, 0.12, 0.035, steel, 0, -0.1, 0.0, 0.012); finger.visible = false;
    arms[key] = { sh: sh2, el, hand, finger };
  }
  const rig = { body, head, neck, legL: legsI.L, legR: legsI.R, armL: arms.L.sh, armR: arms.R.sh, elbowL: arms.L.el, elbowR: arms.R.el, handL: arms.L.hand, handR: arms.R.hand, fingerL: arms.L.finger, fingerR: arms.R.finger,
    shoulderY: bh - 0.08, shoulderX: bw / 2 + 0.06, lenA: 0.17, lenB: 0.24, headY: legH + 0.04 + bh + 0.045 + hh / 2, antennaMat: antM, antennaGlow: antGlow };

  // ---- pixel face -----------------------------------------------------------------------------------------------------
  let last = '';
  function setFace(emotion = 'neutral', mouthOpen = 0, blink = 0, prev = null, mix = 1, tint = '#19e3ff') {
    const mq = prev && prev !== emotion ? Math.round(clamp(mix) * 4) / 4 : 1;
    const key = [emotion, Math.round(mouthOpen * 4), blink > 0.6 ? 1 : 0, mq < 1 ? prev : '', mq, tint].join();
    if (key === last) return; last = key;
    const g = faceTx.g;
    g.fillStyle = '#04080f'; g.fillRect(0, 0, CWpx, CHpx);
    const gr = g.createRadialGradient(CWpx / 2, CHpx / 2, 10, CWpx / 2, CHpx / 2, CWpx * 0.7); gr.addColorStop(0, 'rgba(25,227,255,.10)'); gr.addColorStop(1, 'rgba(25,227,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, CWpx, CHpx);
    const oy = (CHpx - CH * cell) / 2;
    // dim LED matrix
    g.fillStyle = 'rgba(25,227,255,.07)';
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { roundRect(g, x * cell + 3, oy + y * cell + 3, cell - 6, cell - 6, 4); g.fill(); }
    const layer = (emo, alpha) => {
      const cells = internCells(emo, clamp(mouthOpen), blink);
      const draw = () => { for (const k of cells) { const [x, y] = k.split(',').map(Number); roundRect(g, x * cell + 2, oy + y * cell + 2, cell - 4, cell - 4, 5); g.fill(); } };
      g.save(); g.globalAlpha = alpha; g.fillStyle = tint; g.shadowColor = tint; g.shadowBlur = 26; draw(); draw(); g.restore();
      g.save(); g.globalAlpha = alpha; g.fillStyle = '#d8fbff'; // hot core
      for (const k of cells) { const [x, y] = k.split(',').map(Number); roundRect(g, x * cell + 6, oy + y * cell + 6, cell - 12, cell - 12, 3); g.fill(); }
      g.restore();
    };
    if (mq < 1) { layer(prev, 1 - mq); layer(emotion, mq); } else layer(emotion, 1);
    faceTx.tex.needsUpdate = true;
  }
  setFace('neutral', 0, 0);
  root.userData.rig = rig; root.setFace = setFace; root.userData.name = 'intern';
  return root;
}
