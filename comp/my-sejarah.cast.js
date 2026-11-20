// my-sejarah cast (base style s1-kotak): Professor Sejarah (white hair, tweed jacket, bow tie) and Assistant Professor
// (young lecturer in a teal cardigan with a lanyard). Same rig as the base characters: makeBos -> Professor, makeIntern -> Assistant Professor.
// Each builder returns a THREE.Group with named pivots in group.userData.rig and group.setFace(emotion, mouthOpen, blink, prev, mix).
import * as THREE from 'three';
import { box, slab, piv, std, glow, canvasTex, roundRect, TAU, clamp } from './s1-kotak.lib.js';

// ---------------------------------------------------------------------------------------------------------------------
// Shared cartoon face painter (canvas), parametrised by head size and feature positions (head units, origin = head centre)
// ---------------------------------------------------------------------------------------------------------------------
function makeFacePainter(o) {
  const { FW, FH, pxu, skin, skinD, brow, eyeX, eyeY, mouthY, cheekY } = o;
  const X = (x) => FW / 2 + x * pxu, Y = (y) => FH / 2 - y * pxu;
  const P = (v) => v * pxu / 711; // pixel constants were tuned for 711 px per unit
  return function drawFace(g, emotion, mouthOpen, blink) {
    g.fillStyle = skin; g.fillRect(0, 0, FW, FH);
    const gr = g.createLinearGradient(0, 0, 0, FH); gr.addColorStop(0, 'rgba(255,220,180,.16)'); gr.addColorStop(0.55, 'rgba(255,220,180,0)'); gr.addColorStop(1, 'rgba(60,20,0,.2)');
    g.fillStyle = gr; g.fillRect(0, 0, FW, FH);
    g.fillStyle = 'rgba(214,120,96,.35)';
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(X(sx * (eyeX + 0.08)), Y(cheekY), P(36), P(22), 0, 0, TAU); g.fill(); }
    const ex = { neutral: { w: 0.15, h: 0.115, p: 0.065, lid: 0 }, happy: { w: 0.15, h: 0.115, p: 0.06, lid: 0 }, annoyed: { w: 0.15, h: 0.115, p: 0.065, lid: 0.45 }, shocked: { w: 0.17, h: 0.16, p: 0.04, lid: 0 } }[emotion] || { w: 0.15, h: 0.115, p: 0.065, lid: 0 };
    const k = o.eyeScale || 1;
    for (const sx of [-1, 1]) {
      const cx = sx * eyeX, cy = eyeY;
      if (emotion === 'happy' || blink > 0.85) {
        g.strokeStyle = '#2a140c'; g.lineWidth = P(11); g.lineCap = 'round'; g.beginPath();
        if (emotion === 'happy') g.arc(X(cx), Y(cy) + P(20), P(30) * k, Math.PI * 1.1, Math.PI * 1.9);
        else { g.moveTo(X(cx) - P(30) * k, Y(cy) + P(4)); g.lineTo(X(cx) + P(30) * k, Y(cy) + P(4)); }
        g.stroke(); continue;
      }
      const w = ex.w * k * pxu, h = ex.h * k * pxu * (1 - blink * 0.8);
      g.fillStyle = '#f7f4ee'; roundRect(g, X(cx) - w / 2, Y(cy) - h / 2, w, h, P(10)); g.fill();
      g.fillStyle = '#1a0f0c';
      const px = X(cx) - 0.012 * pxu, ps = ex.p * k * pxu, ly = ex.lid ? P(5) : 0;
      roundRect(g, px - ps / 2, Y(cy) - ps / 2 + ly, ps, ps, P(8)); g.fill();
      g.fillStyle = '#fff'; g.fillRect(px - ps / 2 + P(4), Y(cy) - ps / 2 + P(4) + ly, P(9), P(9));
      if (ex.lid) {
        g.fillStyle = skinD; g.beginPath();
        const top = Y(cy) - h / 2 - P(3), l = X(cx) - w / 2 - P(4), r = X(cx) + w / 2 + P(4), dO = h * ex.lid * 0.55, dI = h * ex.lid * 1.25;
        const dl = sx < 0 ? dO : dI, dr = sx < 0 ? dI : dO;
        g.moveTo(l, top); g.lineTo(r, top); g.lineTo(r, top + dr); g.lineTo(l, top + dl); g.closePath(); g.fill();
        g.strokeStyle = '#2a140c'; g.lineWidth = P(5); g.beginPath(); g.moveTo(l, top + dl); g.lineTo(r, top + dr); g.stroke();
      }
    }
    // eyebrows
    const bw = 0.27 * k * pxu, bt = (o.browThick || 0.07) * pxu;
    for (const sx of [-1, 1]) {
      let by = eyeY + 0.16, ang = 0.04, bs = 1;
      if (emotion === 'annoyed') { by = eyeY + 0.123; ang = 0.46; bs = 1.1; }
      else if (emotion === 'shocked') { by = eyeY + 0.23; ang = -0.12; }
      else if (emotion === 'happy') { by = eyeY + 0.185; ang = -0.12; }
      g.save(); g.translate(X(sx * eyeX), Y(by * (o.browK || 1))); g.rotate(sx * ang);
      g.fillStyle = brow; roundRect(g, -bw * bs / 2, -bt / 2, bw * bs, bt * (emotion === 'annoyed' ? 1.15 : 1), P(10)); g.fill();
      if (o.browEdge) { g.strokeStyle = o.browEdge; g.lineWidth = P(3); g.stroke(); }
      g.restore();
    }
    if (emotion === 'annoyed') {
      g.strokeStyle = skinD; g.lineWidth = P(6); g.lineCap = 'round';
      for (const yy of [eyeY + 0.27, eyeY + 0.235]) { if (Y(yy) < P(8)) continue; g.beginPath(); g.moveTo(X(-eyeX), Y(yy)); g.quadraticCurveTo(X(0), Y(yy + 0.02), X(eyeX), Y(yy)); g.stroke(); }
    }
    // mouth
    const my = emotion === 'shocked' ? mouthY - 0.015 : mouthY, mw = 0.2 * pxu;
    const open = clamp(mouthOpen);
    if (emotion === 'happy') {
      const h = (0.04 + open * 0.1) * pxu;
      g.fillStyle = '#3a0f12'; g.beginPath(); g.moveTo(X(-0.12), Y(my + 0.03)); g.quadraticCurveTo(X(0), Y(my - 0.01 - h / pxu), X(0.12), Y(my + 0.03));
      g.quadraticCurveTo(X(0), Y(my + 0.07), X(-0.12), Y(my + 0.03)); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.fillRect(X(-0.085), Y(my + 0.03), 0.17 * pxu, P(6));
    } else if (emotion === 'shocked') {
      const h = (0.08 + open * 0.07) * pxu, w = 0.1 * pxu;
      g.fillStyle = '#3a0f12'; roundRect(g, X(0) - w / 2, Y(my) - h / 2, w, h, P(16)); g.fill();
      g.fillStyle = '#c24b5b'; roundRect(g, X(0) - w / 2 + P(8), Y(my) + h / 2 - P(20), w - P(16), P(14), P(6)); g.fill();
    } else {
      const h = Math.max(P(7), (0.016 + open * 0.115) * pxu);
      if (open < 0.12) {
        g.strokeStyle = '#3a1612'; g.lineWidth = P(11); g.lineCap = 'round'; g.beginPath();
        if (emotion === 'annoyed') { g.moveTo(X(-0.1), Y(my) + P(4)); g.quadraticCurveTo(X(0), Y(my) - P(12), X(0.1), Y(my) + P(4)); } else { g.moveTo(X(-0.1), Y(my)); g.lineTo(X(0.1), Y(my)); }
        g.stroke();
      } else {
        g.fillStyle = '#3a0f12'; roundRect(g, X(0) - mw * 0.52, Y(my) - h / 2, mw * 1.04, h, P(12)); g.fill();
        g.fillStyle = '#f2eee6'; g.fillRect(X(0) - mw * 0.46, Y(my) - h / 2 + P(3), mw * 0.92, Math.min(P(10), h * 0.28));
        g.fillStyle = '#c24b5b'; roundRect(g, X(0) - mw * 0.3, Y(my) + h / 2 - Math.min(P(18), h * 0.4), mw * 0.6, Math.min(P(16), h * 0.36), P(6)); g.fill();
      }
    }
  };
}

function faceSetter(faceTx, drawFace) {
  let last = '';
  return function setFace(emotion = 'neutral', mouthOpen = 0, blink = 0, prev = null, mix = 1) {
    const mq = prev && prev !== emotion ? Math.round(clamp(mix) * 4) / 4 : 1;
    const key = [emotion, mouthOpen.toFixed(2), blink.toFixed(2), mq < 1 ? prev : '', mq].join();
    if (key === last) return; last = key;
    const g = faceTx.g;
    if (mq < 1) { drawFace(g, prev, mouthOpen, blink); g.globalAlpha = mq; drawFace(g, emotion, mouthOpen, blink); g.globalAlpha = 1; }
    else drawFace(g, emotion, mouthOpen, blink);
    faceTx.tex.needsUpdate = true;
  };
}

// ======================================================================================================================
// Professor Sejarah (role of Bos)
// ======================================================================================================================
export function makeBos() {
  // ---- look knobs ----
  const JACKET = '#7d6a45', JACKET_D = '#5e4f33', JACKET_L = '#93805a';
  const BOWTIE = '#8e1b2c', SHIRT = '#f1ead8', HAIR = '#ecebe6', SKIN = '#c48d63';
  const SIZE = 1.0;

  const root = new THREE.Group();
  const fig = new THREE.Group(); fig.scale.setScalar(SIZE); root.add(fig);
  const jacket = std(JACKET, { roughness: 0.75 }), jacketD = std(JACKET_D, { roughness: 0.8 }), jacketL = std(JACKET_L, { roughness: 0.75 });
  const trouser = std('#3b3328', { roughness: 0.7 });
  const shirt = std(SHIRT, { roughness: 0.6 }), bow = std(BOWTIE, { roughness: 0.4, metalness: 0.05 }), bowD = std('#6a1220', { roughness: 0.45 });
  const skin = std(SKIN, { roughness: 0.65 }), skinD = std('#a8734d', { roughness: 0.7 });
  const hair = std(HAIR, { roughness: 0.6 }), hairS = std('#cfcdc6', { roughness: 0.6 });
  const shoe = std('#2a1a10', { roughness: 0.3, metalness: 0.2 }), belt = std('#1b120b', { roughness: 0.4 });
  const frameM = std('#6b4a1e', { roughness: 0.3, metalness: 0.6 });
  const patch = std('#4a3020', { roughness: 0.9 });

  const legH = 0.64, torsoH = 0.8, torsoW = 0.82, torsoD = 0.46;
  const legs = {};
  for (const [key, sx] of [['L', 1], ['R', -1]]) {
    const hip = piv(fig, sx * 0.19, legH, 0); legs[key] = hip;
    box(hip, 0.3, legH - 0.1, 0.34, trouser, 0, 0.1 + (legH - 0.1) / 2 - legH, 0, 0.04);
    box(hip, 0.33, 0.12, 0.56, shoe, 0, 0.06 - legH, 0.1, 0.05);
  }
  const body = piv(fig, 0, legH, 0);
  box(body, torsoW, torsoH, torsoD, jacket, 0, torsoH / 2, 0, 0.07);
  box(body, torsoW + 0.02, 0.1, torsoD + 0.02, belt, 0, 0.05, 0, 0.03);
  // tweed check lines on the jacket front
  for (const yy of [0.2, 0.36, 0.52]) slab(body, torsoW - 0.1, 0.012, 0.008, jacketD, 0, yy, torsoD / 2 + 0.002);
  box(body, 0.24, 0.56, 0.03, shirt, 0, 0.5, torsoD / 2 + 0.002, 0.012);
  // waistcoat
  box(body, 0.22, 0.4, 0.03, jacketD, 0, 0.37, torsoD / 2 + 0.012, 0.012);
  for (const sy of [0.44, 0.34, 0.24]) box(body, 0.035, 0.035, 0.02, std('#d8c48a', { metalness: 0.8, roughness: 0.3 }), 0, sy, torsoD / 2 + 0.03, 0.01);
  for (const sx of [-1, 1]) { const l = box(body, 0.17, 0.5, 0.045, jacketL, sx * 0.19, 0.5, torsoD / 2 + 0.018, 0.015); l.rotation.z = -sx * 0.14; }
  // bow tie
  box(body, 0.07, 0.07, 0.05, bowD, 0, 0.73, torsoD / 2 + 0.04, 0.02);
  for (const sx of [-1, 1]) { const w = box(body, 0.13, 0.11, 0.04, bow, sx * 0.09, 0.73, torsoD / 2 + 0.035, 0.025); w.rotation.z = sx * 0.12; }
  // pocket + pen
  box(body, 0.16, 0.03, 0.035, jacketD, -0.26, 0.56, torsoD / 2 + 0.02, 0.008);
  box(body, 0.025, 0.12, 0.025, std('#1d2a5c', { metalness: 0.4, roughness: 0.3 }), -0.29, 0.6, torsoD / 2 + 0.02, 0.008);
  // neck + head
  const neck = piv(body, 0, torsoH, 0);
  box(neck, 0.24, 0.1, 0.22, skinD, 0, 0.02, 0, 0.03);
  box(neck, 0.34, 0.06, 0.3, shirt, 0, 0.0, 0, 0.02);
  const hw = 0.72, hh = 0.76, hd = 0.56;
  const head = piv(neck, 0, 0.05 + hh / 2, 0);
  box(head, hw, hh, hd, skin, 0, 0, 0, 0.09);
  // white hair: receding top, fuller sides and back
  box(head, hw - 0.18, 0.08, hd - 0.16, hair, 0, hh / 2 + 0.01, -0.06, 0.04);
  box(head, hw + 0.03, 0.34, 0.14, hair, 0, hh / 2 - 0.2, -hd / 2 + 0.05, 0.05);
  for (const sx of [-1, 1]) {
    box(head, 0.09, 0.3, hd - 0.08, hair, sx * (hw / 2 + 0.02), hh / 2 - 0.22, -0.04, 0.035); // side tufts
    box(head, 0.06, 0.1, 0.18, hairS, sx * (hw / 2 + 0.05), hh / 2 - 0.1, 0.0, 0.02);
    box(head, 0.07, 0.17, 0.12, skinD, sx * (hw / 2 + 0.03), -0.02, 0.06, 0.025); // ears
  }
  // face canvas
  const FW = 512, FH = Math.round(512 * hh / hw), pxu = FW / hw;
  const faceTx = canvasTex(FW, FH, null);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTx.tex, roughness: 0.65, metalness: 0, emissive: new THREE.Color('#ffffff'), emissiveMap: faceTx.tex, emissiveIntensity: 0.22 });
  const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(hw - 0.004, hh - 0.004), faceMat);
  facePlane.position.z = hd / 2 + 0.002; facePlane.receiveShadow = true; head.add(facePlane);
  const fz = hd / 2;
  // round-ish gold glasses (pivot so they can be lifted)
  const lens = std('#cfe6ff', { roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.14 });
  const glasses = piv(head, 0, 0.055, 0);
  for (const sx of [-1, 1]) {
    const cx = sx * 0.17, cy = 0, lw = 0.235, lh = 0.2, t = 0.026;
    box(glasses, lw - 0.05, t, 0.035, frameM, cx, cy + lh / 2 - t / 2, fz + 0.02, 0.01);
    box(glasses, lw - 0.05, t, 0.035, frameM, cx, cy - lh / 2 + t / 2, fz + 0.02, 0.01);
    box(glasses, t, lh - 0.05, 0.035, frameM, cx - lw / 2 + t / 2, cy, fz + 0.02, 0.01);
    box(glasses, t, lh - 0.05, 0.035, frameM, cx + lw / 2 - t / 2, cy, fz + 0.02, 0.01);
    for (const [dx, dy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const c = box(glasses, 0.045, 0.045, 0.035, frameM, cx + dx * (lw / 2 - 0.03), cy + dy * (lh / 2 - 0.03), fz + 0.02, 0.01); c.rotation.z = 0.785; }
    slab(glasses, lw - 0.03, lh - 0.03, 0.004, lens, cx, cy, fz + 0.035);
    box(glasses, 0.025, 0.025, hd * 0.9, frameM, sx * (hw / 2 + 0.005), cy + 0.03, 0.0, 0.01);
  }
  box(glasses, 0.1, 0.025, 0.035, frameM, 0, 0.045, fz + 0.02, 0.01);
  box(head, 0.09, 0.15, 0.09, skinD, 0, -0.05, fz + 0.04, 0.03); // nose
  // neat white moustache
  box(head, 0.4, 0.09, 0.08, hair, 0, -0.145, fz + 0.04, 0.035);
  for (const sx of [-1, 1]) box(head, 0.08, 0.12, 0.07, hair, sx * 0.19, -0.18, fz + 0.035, 0.03);
  // arms
  const arms = {};
  for (const [key, sx] of [['L', 1], ['R', -1]]) {
    const sh = piv(body, sx * (torsoW / 2 + 0.1), torsoH - 0.12, 0);
    box(sh, 0.24, 0.26, 0.26, jacket, 0, -0.04, 0, 0.06);
    box(sh, 0.2, 0.44, 0.23, jacket, 0, -0.22, 0, 0.05);
    const el = piv(sh, 0, -0.4, 0);
    box(el, 0.185, 0.4, 0.21, jacket, 0, -0.18, 0, 0.05);
    box(el, 0.12, 0.16, 0.03, patch, 0, -0.06, -0.105, 0.02); // elbow patch
    box(el, 0.16, 0.05, 0.19, shirt, 0, -0.39, 0, 0.012);
    const hand = piv(el, 0, -0.46, 0);
    box(hand, 0.15, 0.15, 0.15, skin, 0, 0, 0, 0.04);
    const finger = box(hand, 0.045, 0.16, 0.045, skin, 0, -0.14, 0.01, 0.015); finger.visible = false;
    arms[key] = { sh, el, hand, finger };
  }
  const rig = { body, head, neck, glasses, legL: legs.L, legR: legs.R, armL: arms.L.sh, armR: arms.R.sh, elbowL: arms.L.el, elbowR: arms.R.el, handL: arms.L.hand, handR: arms.R.hand, fingerL: arms.L.finger, fingerR: arms.R.finger,
    shoulderY: torsoH - 0.12, shoulderX: torsoW / 2 + 0.1, lenA: 0.4, lenB: 0.46 + 0.22, headY: legH + torsoH + 0.05 + hh / 2 };

  const drawFace = makeFacePainter({ FW, FH, pxu, skin: SKIN, skinD: '#a8734d', brow: '#f4f2ee', browEdge: '#9a948a', browThick: 0.08, eyeX: 0.17, eyeY: 0.055, mouthY: -0.265, cheekY: -0.1 });
  const setFace = faceSetter(faceTx, drawFace);
  setFace('neutral', 0, 0);
  root.userData.rig = rig; root.setFace = setFace; root.userData.name = 'bos';
  return root;
}

// ======================================================================================================================
// Assistant Professor (role of Intern)
// ======================================================================================================================
export function makeIntern() {
  // ---- look knobs ----
  const CARDIGAN = '#1f8f86', CARDIGAN_D = '#166d66', SHIRT = '#f4f6fb', HAIR = '#1c1410', SKIN = '#d29d74', LANYARD = '#d4202f';
  const SIZE = 1.0;

  const root = new THREE.Group();
  const fig = new THREE.Group(); fig.scale.setScalar(SIZE); root.add(fig);
  const card = std(CARDIGAN, { roughness: 0.8 }), cardD = std(CARDIGAN_D, { roughness: 0.85 });
  const shirt = std(SHIRT, { roughness: 0.6 }), pants = std('#2a2f45', { roughness: 0.7 }), shoe = std('#3a2414', { roughness: 0.3, metalness: 0.2 });
  const skin = std(SKIN, { roughness: 0.65 }), skinD = std('#b98260', { roughness: 0.7 });
  const hairM = std(HAIR, { roughness: 0.55 });
  const lanyard = std(LANYARD, { roughness: 0.5 }), badge = std('#ffffff', { roughness: 0.4 }), badgeB = std('#2b6fd8', { roughness: 0.4 });

  const legH = 0.2;
  const legsI = {};
  for (const [key, sx] of [['L', 1], ['R', -1]]) {
    const hip = piv(fig, sx * 0.12, legH, 0); legsI[key] = hip;
    box(hip, 0.15, legH, 0.15, pants, 0, 0.08 + legH / 2 - 0.04 - legH, 0, 0.03);
    box(hip, 0.18, 0.08, 0.26, shoe, 0, 0.04 - legH, 0.04, 0.035);
  }
  const body = piv(fig, 0, legH + 0.04, 0);
  const bw = 0.5, bh = 0.46, bd = 0.36;
  box(body, bw, bh, bd, card, 0, bh / 2, 0, 0.07);
  box(body, bw + 0.02, 0.06, bd + 0.02, cardD, 0, 0.03, 0, 0.02); // ribbed hem
  box(body, 0.16, 0.38, 0.03, shirt, 0, 0.27, bd / 2 + 0.002, 0.01); // shirt opening
  slab(body, 0.012, 0.36, 0.01, cardD, -0.085, 0.24, bd / 2 + 0.01);
  for (const sy of [0.33, 0.23, 0.13]) box(body, 0.03, 0.03, 0.02, std('#e8dcc0', { roughness: 0.4 }), -0.1, sy, bd / 2 + 0.012, 0.008);
  // lanyard + blank ID badge
  for (const sx of [-1, 1]) { const s = box(body, 0.025, 0.24, 0.015, lanyard, sx * 0.07, 0.34, bd / 2 + 0.022, 0.006); s.rotation.z = sx * 0.28; }
  box(body, 0.13, 0.15, 0.015, badge, 0, 0.17, bd / 2 + 0.026, 0.01);
  box(body, 0.13, 0.04, 0.017, badgeB, 0, 0.225, bd / 2 + 0.027, 0.006);
  box(body, 0.05, 0.05, 0.017, std('#c9a27e'), -0.03, 0.16, bd / 2 + 0.028, 0.006);
  // neck + head
  const neck = piv(body, 0, bh, 0);
  box(neck, 0.16, 0.08, 0.16, skinD, 0, 0.02, 0, 0.02);
  box(neck, 0.24, 0.05, 0.22, shirt, 0, 0.0, 0, 0.015); // collar
  const hw = 0.66, hh = 0.58, hd = 0.54;
  const head = piv(neck, 0, 0.045 + hh / 2, 0);
  box(head, hw, hh, hd, skin, 0, 0, 0, 0.09);
  // neat side-parted hair
  box(head, hw + 0.03, 0.1, hd + 0.03, hairM, 0, hh / 2 + 0.01, -0.015, 0.05);
  const sweep = box(head, 0.34, 0.06, 0.06, hairM, 0.13, hh / 2 - 0.035, hd / 2 + 0.005, 0.03); sweep.rotation.z = -0.1;
  box(head, hw + 0.03, 0.34, 0.1, hairM, 0, hh / 2 - 0.2, -hd / 2 + 0.03, 0.04);
  for (const sx of [-1, 1]) {
    box(head, 0.045, 0.24, hd - 0.06, hairM, sx * (hw / 2 + 0.008), hh / 2 - 0.15, -0.03, 0.02);
    box(head, 0.06, 0.14, 0.1, skinD, sx * (hw / 2 + 0.025), -0.04, 0.03, 0.02); // ears
  }
  box(head, 0.07, 0.11, 0.07, skinD, 0, -0.06, hd / 2 + 0.03, 0.025); // nose
  // face canvas
  const FW = 512, FH = Math.round(512 * hh / hw), pxu = FW / hw;
  const faceTx = canvasTex(FW, FH, null);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTx.tex, roughness: 0.65, metalness: 0, emissive: new THREE.Color('#ffffff'), emissiveMap: faceTx.tex, emissiveIntensity: 0.22 });
  const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(hw - 0.004, hh - 0.004), faceMat);
  facePlane.position.z = hd / 2 + 0.002; facePlane.receiveShadow = true; head.add(facePlane);
  // arms (short, cardigan sleeves)
  const arms = {};
  for (const [key, sx] of [['L', 1], ['R', -1]]) {
    const sh2 = piv(body, sx * (bw / 2 + 0.06), bh - 0.08, 0);
    box(sh2, 0.14, 0.14, 0.16, card, 0, 0, 0, 0.045);
    box(sh2, 0.12, 0.17, 0.13, card, 0, -0.1, 0, 0.04);
    const el = piv(sh2, 0, -0.17, 0);
    box(el, 0.11, 0.15, 0.12, card, 0, -0.06, 0, 0.035);
    box(el, 0.115, 0.04, 0.125, cardD, 0, -0.13, 0, 0.012); // cuff
    const hand = piv(el, 0, -0.18, 0);
    box(hand, 0.13, 0.12, 0.13, skin, 0, 0, 0, 0.035);
    const finger = box(hand, 0.035, 0.12, 0.035, skin, 0, -0.1, 0.0, 0.012); finger.visible = false;
    arms[key] = { sh: sh2, el, hand, finger };
  }
  // the base player blinks an antenna light: keep a hidden one so it has something to drive
  const antM = std('#000000');
  const antGlow = glow(head, 'rgba(60,255,150,.9)', 0.01, 0, 0, 0, 0); antGlow.visible = false;
  const rig = { body, head, neck, legL: legsI.L, legR: legsI.R, armL: arms.L.sh, armR: arms.R.sh, elbowL: arms.L.el, elbowR: arms.R.el, handL: arms.L.hand, handR: arms.R.hand, fingerL: arms.L.finger, fingerR: arms.R.finger,
    shoulderY: bh - 0.08, shoulderX: bw / 2 + 0.06, lenA: 0.17, lenB: 0.24, headY: legH + 0.04 + bh + 0.045 + hh / 2, antennaMat: antM, antennaGlow: antGlow };

  const drawFace = makeFacePainter({ FW, FH, pxu, skin: SKIN, skinD: '#b98260', brow: '#1c1410', browThick: 0.06, eyeX: 0.15, eyeY: 0.02, mouthY: -0.17, cheekY: -0.08, eyeScale: 1.05, browK: 0.8 });
  const setFace = faceSetter(faceTx, drawFace);
  setFace('neutral', 0, 0);
  root.userData.rig = rig; root.setFace = setFace; root.userData.name = 'intern';
  return root;
}
