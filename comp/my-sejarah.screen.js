// my-sejarah screen (replaces s1-kotak.screen.js for this own set): everything from the base screen, plus a new screen type
//   { "type": "anim", "anim": "<scene>", "title": "...", "caption": "..." }
// drawn on the monitor as a looping 2D animation. Scenes: dashboard, tajuk, kereta1886, flywheel, garismasa, crank, kickback, butang, bersambung.
// The animation is a pure function of the local time (seconds since the screen appeared), which the location module passes in via api.tick().
import { createScreen as baseCreateScreen } from './s1-kotak.screen.js';
import { roundRect, TAU, canvasTex } from './s1-kotak.lib.js';
export { typeText, commonPrefix, parseCount, fmtCount, makeScreenTexture, buildMonitor } from './s1-kotak.screen.js';

const SANS = '"Helvetica Neue", "Avenir Next", Arial, sans-serif';
const HEAVY = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
const C = { bg: '#141a2e', panel: '#1d2440', ink: '#eef2ff', dim: '#8c97bb', cyan: '#19e3ff', pink: '#ff2fb4', gold: '#ffc23a', red: '#ff4b4b',
  wood: '#8a5a32', woodD: '#6a4222', woodL: '#a8733f', metal: '#9aa3b8', metalD: '#5c6478', black: '#141414', body: '#2f6fd8', bodyD: '#1f4ea0', tyre: '#1a1a1f', road: '#2a3150', skin: '#d29d74' };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };


/** All drawing in one design space: 2048 x 1280, scene content in x 40..1420. g = a 2D context already transformed by the caller. */
function makePainter(g) {
  const W = 2048, H = 1280, RIGHT = 1420;
  // ---------------------------------------------------------------- helpers
  const rect = (x, y, w, h, c, r = 14) => { g.fillStyle = c; roundRect(g, x, y, w, h, r); g.fill(); };
  const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const ring = (x, y, r, c, lw) => { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); };
  const line = (x1, y1, x2, y2, c, lw) => { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const text = (s, x, y, size, c, o = {}) => { g.font = `${o.w || 800} ${size}px ${o.f || HEAVY}`; g.fillStyle = c; g.textAlign = o.a || 'left'; g.fillText(s, x, y); g.textAlign = 'left'; };
  const fitText = (s, x, y, size, c, maxW, o = {}) => { g.font = `${o.w || 800} ${size}px ${o.f || HEAVY}`; while (g.measureText(s).width > maxW && size > 30) { size -= 2; g.font = `${o.w || 800} ${size}px ${o.f || HEAVY}`; } text(s, x, y, size, c, o); };
  const mid = (40 + RIGHT) / 2;

  function chrome(title) {
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#232a3d'; g.fillRect(0, 0, W, 64);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => circ(44 + i * 40, 32, 12, c));
    g.fillStyle = '#9aa6c4'; g.font = `600 26px ${SANS}`; g.textAlign = 'center'; g.fillText(`${title}  -  Animasi Sejarah`, W / 2, 41); g.textAlign = 'left';
    const gr = g.createLinearGradient(0, 64, 0, H); gr.addColorStop(0, '#1b2346'); gr.addColorStop(1, '#0f1428'); g.fillStyle = gr; g.fillRect(0, 64, W, H - 64);
  }
  function caption(s) {
    if (!s) return;
    rect(60, H - 190, RIGHT - 100, 130, 'rgba(8,10,24,.78)', 26);
    fitText(s, mid, H - 105, 64, C.ink, RIGHT - 160, { a: 'center' });
  }
  function badge(s, x, y, c = C.gold) {
    g.font = `900 70px ${HEAVY}`; const w = g.measureText(s).width + 70;
    rect(x, y, w, 104, c, 52); text(s, x + w / 2, y + 76, 70, '#1a1206', { a: 'center', w: 900 });
  }
  function wheel(x, y, r, a, spokes = 10) {
    circ(x, y, r, C.tyre); circ(x, y, r * 0.84, '#c9b48a');
    for (let k = 0; k < spokes; k++) { const q = a + (k / spokes) * TAU; line(x, y, x + Math.cos(q) * r * 0.82, y + Math.sin(q) * r * 0.82, '#5a4630', Math.max(4, r * 0.06)); }
    circ(x, y, r * 0.16, C.metalD); circ(x, y, r * 0.07, C.metal);
  }
  function smoke(x, y, t, n = 4) {
    for (let k = 0; k < n; k++) { const p = (t * 0.8 + k / n) % 1; g.globalAlpha = (1 - p) * 0.55; circ(x - p * 140, y - p * 90, 18 + p * 46, '#c7cce0'); }
    g.globalAlpha = 1;
  }
  /** early three-wheeled motor carriage, facing right; x,y = ground under the rear wheel */
  function carriage(x, y, s, wa, t) {
    g.save(); g.translate(x, y); g.scale(s, s);
    const bob = Math.sin(t * 9) * 3;
    line(0, -150, 300, -150, C.black, 14); // chassis tube
    rect(-40, -330 + bob, 210, 120, C.wood, 16); rect(-30, -320 + bob, 190, 30, C.woodL, 10); // bench seat box
    rect(-46, -420 + bob, 30, 110, C.woodD, 8); // seat back
    rect(-10, -230 + bob, 160, 90, C.metalD, 12); // engine under the seat
    // horizontal flywheel at the back (seen edge-on, spinning stripes)
    rect(-110, -205 + bob, 120, 34, C.metal, 17);
    for (let k = 0; k < 4; k++) { const p = ((t * 3 + k / 4) % 1); g.globalAlpha = 0.8; rect(-105 + p * 100, -200 + bob, 12, 24, C.metalD, 4); } g.globalAlpha = 1;
    line(240, -160, 300, -330 + bob, C.black, 10); // steering column
    line(260, -340 + bob, 340, -320 + bob, C.black, 12); // tiller
    rect(170, -250 + bob, 90, 40, C.body, 10);
    wheel(0, -110, 110, wa); wheel(320, -80, 80, wa * 1.4, 8);
    g.restore();
  }
  /** car front with radiator, lamps and a crank handle at angle a; x,y = ground centre */
  function carFront(x, y, s, a, shake = 0) {
    g.save(); g.translate(x + shake, y); g.scale(s, s);
    rect(-260, -560, 520, 360, C.body, 30); // bonnet / body
    rect(-180, -540, 360, 300, '#2a2f3e', 18); // radiator
    for (let k = 0; k < 8; k++) line(-160 + k * 46, -520, -160 + k * 46, -260, '#4a5166', 10);
    rect(-200, -560, 400, 30, C.metal, 12);
    for (const sx of [-1, 1]) { circ(sx * 300, -470, 64, C.metal); circ(sx * 300, -470, 46, '#fff6c8'); }
    rect(-300, -205, 600, 40, C.black, 12); // bumper
    for (const sx of [-1, 1]) { rect(sx * 250 - 60, -200, 120, 200, C.tyre, 24); }
    // crank handle: shaft from the centre below the radiator, arm rotating in the view plane
    const cx = 0, cy = -150;
    circ(cx, cy, 26, C.metalD);
    const ax = cx + Math.cos(a) * 130, ay = cy + Math.sin(a) * 130;
    line(cx, cy, ax, ay, C.metal, 26);
    rect(ax - 22, ay - 60, 44, 120, C.woodD, 16); // wooden grip
    g.restore();
    return { gx: x + shake + Math.cos(a) * 130 * s, gy: y + (-150 + Math.sin(a) * 130) * s };
  }
  /** blocky person bending over, with the hand reaching (hx, hy) */
  function bender(x, y, s, hx, hy, tired = 0) {
    g.save();
    const lean = 0.7 + tired * 0.15, hipY = y - 200 * s;
    const sh = { x: x + Math.sin(lean) * 200 * s, y: hipY - Math.cos(lean) * 200 * s };
    rect(x - 40 * s, y - 200 * s, 80 * s, 200 * s, '#2a2f45', 12); // legs
    g.translate(x, hipY); g.rotate(lean);
    rect(-50 * s, -230 * s, 120 * s, 230 * s, '#7d6a45', 20); // torso (tweed)
    rect(-55 * s, -360 * s, 130 * s, 130 * s, C.skin, 24); rect(-60 * s, -375 * s, 140 * s, 40 * s, '#ecebe6', 14); // head + white hair
    g.restore();
    line(sh.x, sh.y, hx, hy, '#7d6a45', 46 * s); circ(hx, hy, 26 * s, C.skin);
    if (tired > 0) { for (let k = 0; k < 3; k++) circ(x + (60 + k * 30) * s, y - (520 - k * 20) * s, 10 * s, '#7fd6ff'); }
  }

  // ---------------------------------------------------------------- scenes
  const SCENES = {
    dashboard(s, t) {
      rect(80, 140, RIGHT - 160, 760, C.wood, 40); rect(100, 160, RIGHT - 200, 60, C.woodL, 20);
      for (let k = 0; k < 6; k++) line(120, 300 + k * 100, RIGHT - 120, 300 + k * 100, C.woodD, 4);
      for (const [gx, gy] of [[380, 520], [760, 520]]) {
        circ(gx, gy, 150, '#2a2a2a'); circ(gx, gy, 130, '#f3ead6');
        for (let k = 0; k < 9; k++) { const q = Math.PI * (0.8 + k * 0.175); line(gx + Math.cos(q) * 100, gy + Math.sin(q) * 100, gx + Math.cos(q) * 120, gy + Math.sin(q) * 120, '#333', 8); }
        const q = Math.PI * (0.9 + 0.1 * Math.sin(t * 3 + gx)); line(gx, gy, gx + Math.cos(q) * 105, gy + Math.sin(q) * 105, C.red, 10); circ(gx, gy, 14, '#333');
      }
      // empty spot where a Start button would be
      g.setLineDash([22, 16]); g.strokeStyle = C.gold; g.lineWidth = 8; roundRect(g, 1040, 440, 220, 160, 30); g.stroke(); g.setLineDash([]);
      // magnifying glass searching
      const mx = 760 + Math.cos(t * 1.6) * 380, my = 560 + Math.sin(t * 2.3) * 140;
      ring(mx, my, 95, '#dfe7ff', 20); g.globalAlpha = 0.18; circ(mx, my, 85, '#cfe6ff'); g.globalAlpha = 1;
      line(mx + 68, my + 68, mx + 160, my + 160, C.woodD, 34);
      const qa = 0.6 + 0.4 * Math.abs(Math.sin(t * 3));
      g.globalAlpha = qa; text('?', 1150, 570, 150, C.gold, { a: 'center', w: 900 }); g.globalAlpha = 1;
    },
    tajuk(s, t) {
      const a = ease(t / 0.8);
      g.globalAlpha = a;
      fitText('EVOLUSI', mid, 330, 150, C.cyan, RIGHT - 160, { a: 'center', w: 900 });
      fitText('STARTER MOTOR', mid, 490, 150, C.ink, RIGHT - 160, { a: 'center', w: 900 });
      g.globalAlpha = 1;
      rect(60, 900, RIGHT - 100, 12, C.road, 6);
      const x = -300 + ((t * 260) % (RIGHT + 600));
      carriage(x, 900, 0.75, t * 4, t);
    },
    kereta1886(s, t) {
      rect(40, 930, RIGHT - 40, 190, C.road, 0);
      for (let k = 0; k < 8; k++) { const x = ((k * 220 - t * 300) % (RIGHT + 200) + RIGHT + 200) % (RIGHT + 200) - 100; rect(x, 1010, 120, 20, '#46507a', 8); }
      const x = 200 + ease(t / 2.2) * 330;
      smoke(x - 110, 760, t);
      carriage(x, 940, 1.15, t * (t < 2.2 ? 5 : 2.5), t);
      badge('1886', 90, 110);
    },
    flywheel(s, t) {
      const cx = 700, cy = 600, rx = 470, ry = 170, a = t * 2.2;
      rect(cx - 110, cy + 40, 220, 300, C.metalD, 20); // engine block below
      g.fillStyle = '#3a4258'; g.beginPath(); g.ellipse(cx, cy + 40, rx, ry, 0, 0, TAU); g.fill(); // rim thickness
      g.fillStyle = C.metal; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
      g.fillStyle = '#7b849a'; g.beginPath(); g.ellipse(cx, cy, rx * 0.84, ry * 0.84, 0, 0, TAU); g.fill();
      for (let k = 0; k < 6; k++) { const q = a + k * TAU / 6; line(cx, cy, cx + Math.cos(q) * rx * 0.84, cy + Math.sin(q) * ry * 0.84, C.metalD, 26); }
      circ(cx, cy, 44, '#2e3446');
      // hand on the rim, moving with it
      const q = a + 0.9, hx = cx + Math.cos(q) * rx, hy = cy + Math.sin(q) * ry;
      line(hx, hy, hx + 260, hy - 330, C.skin, 70); rect(hx - 45, hy - 40, 90, 80, C.skin, 22);
      // motion arcs
      g.strokeStyle = C.cyan; g.lineWidth = 12; g.globalAlpha = 0.7;
      g.beginPath(); g.ellipse(cx, cy, rx + 60, ry + 40, 0, a % TAU, (a % TAU) + 1.1); g.stroke(); g.globalAlpha = 1;
      badge('1886', 90, 110);
    },
    garismasa(s, t) {
      const y = 520, x0 = 160, x1 = RIGHT - 160;
      line(x0, y, x1, y, C.dim, 16);
      const p = ease(t / 3);
      line(x0, y, x0 + (x1 - x0) * p, y, C.gold, 16);
      for (const [f, lab] of [[0, '1886'], [0.5, '1890-an'], [1, '1900-an']]) {
        const x = x0 + (x1 - x0) * f; circ(x, y, 30, p >= f - 0.01 ? C.gold : C.dim);
        text(lab, x, y - 70, 64, p >= f - 0.01 ? C.ink : C.dim, { a: 'center' });
      }
      circ(x0 + (x1 - x0) * p, y, 44, C.cyan);
      // cars with crank handles pop in along the line
      [0.55, 1].forEach((f, k) => { const sc = ease((p - f + 0.25) / 0.25); if (sc <= 0) return; carFront(x0 + (x1 - x0) * f, 1060, 0.55 * sc, t * 2 + k); });
    },
    crank(s, t) {
      rect(40, 1040, RIGHT - 40, 80, C.road, 0);
      const a = t * 4;
      const grip = carFront(860, 1060, 1.15, a);
      bender(230, 1060, 1.05, grip.gx, grip.gy, 0);
      g.strokeStyle = C.cyan; g.lineWidth = 12; g.globalAlpha = 0.7; g.beginPath(); g.arc(860, 1060 - 150 * 1.15, 210, a, a + 1.2); g.stroke(); g.globalAlpha = 1;
    },
    kickback(s, t) {
      rect(40, 1040, RIGHT - 40, 80, C.road, 0);
      const P = 2.4, u = t % P, cyc = Math.floor(t / P);
      let a, shake = 0, burst = 0;
      if (u < 1.5) a = u * 3.2;                                 // turning slowly
      else { const v = (u - 1.5) / 0.9; a = 1.5 * 3.2 - ease(v / 0.25) * 4.2; burst = v < 0.6 ? 1 - v / 0.6 : 0; shake = Math.sin(u * 70) * 26 * burst; }
      a += cyc * 0.3;
      const grip = carFront(860, 1060, 1.15, a, shake);
      bender(230 + shake * 0.5, 1060, 1.05, grip.gx, grip.gy, burst > 0 ? 1 : 0);
      if (burst > 0) {
        g.save(); g.translate(grip.gx, grip.gy); g.globalAlpha = burst;
        for (let k = 0; k < 10; k++) { const q = k * TAU / 10; line(Math.cos(q) * 80, Math.sin(q) * 80, Math.cos(q) * 170, Math.sin(q) * 170, C.gold, 14); }
        g.restore(); g.globalAlpha = 1;
        g.save(); g.translate(mid, 300); g.rotate(-0.06); g.scale(1 + burst * 0.15, 1 + burst * 0.15);
        text('KICKBACK!', 0, 0, 150, C.red, { a: 'center', w: 900 }); g.restore();
      }
    },
    butang(s, t) {
      // faded crank on the left -> arrow -> glowing START button on the right
      g.globalAlpha = 0.45; carFront(330, 980, 0.62, t * 1.5); g.globalAlpha = 1;
      const ax = 640 + ((t * 300) % 140);
      for (let k = 0; k < 3; k++) { const x = 620 + k * 110; g.globalAlpha = ((Math.floor(t * 4) + k) % 3 === 0) ? 1 : 0.35; text('>', x, 640, 150, C.gold, { w: 900 }); } g.globalAlpha = 1;
      const bx = 1120, by = 580, pulse = 1 + 0.06 * Math.sin(t * 5);
      g.save(); g.translate(bx, by); g.scale(pulse, pulse);
      g.shadowColor = C.cyan; g.shadowBlur = 60; circ(0, 0, 170, '#0e3a4a'); g.shadowBlur = 0;
      ring(0, 0, 170, C.cyan, 18); circ(0, 0, 130, '#13253a');
      text('START', 0, 22, 66, C.cyan, { a: 'center', w: 900 });
      g.restore();
      text('?', bx + 200, by - 160, 160, C.gold, { a: 'center', w: 900 });
      void ax;
    },
    bersambung(s, t) {
      if (!s._full) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 64, W, H - 64); }
      const P = 1.8, u = t % P, hit = u < 0.35 ? 1 - u / 0.35 : 0;
      const a = -0.9 + (u < 0.35 ? -ease(1 - u / 0.35) * 1.6 : 0);
      const shake = Math.sin(t * 80) * 18 * hit;
      g.save(); g.translate(shake, 0);
      const cx = 420, cy = 700;
      circ(cx, cy, 50, C.metalD);
      const ax = cx + Math.cos(a) * 280, ay = cy + Math.sin(a) * 280;
      line(cx, cy, ax, ay, C.metal, 52); rect(ax - 44, ay - 120, 88, 240, C.woodD, 30);
      if (hit > 0) { g.globalAlpha = hit; for (let k = 0; k < 8; k++) { const q = k * TAU / 8; line(ax + Math.cos(q) * 150, ay + Math.sin(q) * 150, ax + Math.cos(q) * 260, ay + Math.sin(q) * 260, C.gold, 14); } g.globalAlpha = 1; }
      g.restore();
      if (s.text === false) return;
      const ap = ease(t / 0.6);
      g.globalAlpha = ap;
      text('BERSAMBUNG', 1060, 470, 110, C.gold, { a: 'center', w: 900 });
      fitText('PART 2:', 1060, 640, 96, C.ink, 680, { a: 'center', w: 900 });
      fitText('BAHAYA', 1060, 770, 110, C.red, 680, { a: 'center', w: 900 });
      fitText('CRANK HANDLE!', 1060, 900, 96, C.red, 700, { a: 'center', w: 900 });
      g.globalAlpha = 1;
    },
  };

  // =====================================================================================================================
  // Detailed scenes (v2): blocky pseudo-3D look (front + top + side faces) to match the Blocky 3D world
  // =====================================================================================================================
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (h, k) => { const [r, gg, b] = hex2rgb(h); const f = (v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return `rgb(${f(r)},${f(gg)},${f(b)})`; };
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const backOut = (x) => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  /** box seen slightly from above-right: front face x,y,w,h + top + right side of depth d */
  function block(x, y, w, h, c, d = 22) {
    const dx = d * 0.7, dy = d * 0.55;
    poly([[x, y], [x + dx, y - dy], [x + w + dx, y - dy], [x + w, y]], shade(c, 0.22));
    poly([[x + w, y], [x + w + dx, y - dy], [x + w + dx, y + h - dy], [x + w, y + h]], shade(c, -0.3));
    g.fillStyle = c; g.fillRect(x, y, w, h);
  }
  const groundShadow = (x, y, w, a = 0.35) => { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(x, y, w, w * 0.12, 0, 0, TAU); g.fill(); };
  function spokeWheel(x, y, r, a, n = 12, rim = '#2a1c12', wood = '#c9a46a') {
    circ(x + 6, y + 4, r, 'rgba(0,0,0,.25)');
    circ(x, y, r, rim); circ(x, y, r * 0.88, shade(wood, -0.15)); circ(x, y, r * 0.8, '#00000000');
    g.save(); g.beginPath(); g.arc(x, y, r * 0.86, 0, TAU); g.clip(); g.fillStyle = 'rgba(20,14,8,.55)'; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore();
    for (let k = 0; k < n; k++) { const q = a + (k / n) * TAU; line(x, y, x + Math.cos(q) * r * 0.86, y + Math.sin(q) * r * 0.86, wood, Math.max(4, r * 0.07)); }
    ring(x, y, r * 0.88, shade(wood, 0.1), r * 0.08);
    circ(x, y, r * 0.2, '#6b4a2a'); circ(x, y, r * 0.09, '#d8b46a');
  }
  function puff(x, y, t, n, spread, col = '220,215,205') {
    for (let k = 0; k < n; k++) { const p = (t * 0.7 + k / n) % 1, r0 = rnd(k + 3); g.fillStyle = `rgba(${col},${(1 - p) * 0.5})`; circ(x - p * spread - r0 * 30, y - p * spread * 0.7 - r0 * 20, 16 + p * 50, `rgba(${col},${(1 - p) * 0.5})`); }
  }
  const sweat = (x, y, t, n = 3) => { for (let k = 0; k < n; k++) { const p = (t * 1.2 + k / n) % 1; g.globalAlpha = 1 - p; poly([[x + k * 26, y + p * 60 - 14], [x + k * 26 - 9, y + p * 60 + 6], [x + k * 26 + 9, y + p * 60 + 6]], '#7fd6ff'); circ(x + k * 26, y + p * 60 + 8, 10, '#7fd6ff'); } g.globalAlpha = 1; };

  /** 1886 three-wheeled motor carriage, facing right. (x,y) = ground under the rear wheel. wa = wheel angle */
  function motorwagen(x, y, s, wa, t, driver = true) {
    g.save(); g.translate(x, y); g.scale(s, s);
    const bob = Math.sin(t * 11) * 3;
    groundShadow(170, 4, 300, 0.3);
    spokeWheel(-10, -125, 125, wa, 14);                                            // far rear wheel (darker, behind)
    g.globalAlpha = 0.55; spokeWheel(18, -132, 125, wa, 14); g.globalAlpha = 1;
    line(-10, -125, 380, -78, '#1c1c22', 18);                                       // tubular chassis
    // engine + horizontal flywheel at the back
    block(-70, -265 + bob, 150, 110, '#5c6478', 26);
    g.fillStyle = '#3a4152'; g.beginPath(); g.ellipse(-125, -232 + bob, 80, 20, 0, 0, TAU); g.fill();
    g.fillStyle = '#aab3c8'; g.beginPath(); g.ellipse(-125, -244 + bob, 80, 20, 0, 0, TAU); g.fill();
    for (let k = 0; k < 6; k++) { const q = t * 8 + k; const ex = Math.cos(q) * 70; if (Math.sin(q) > 0) rect(-125 + ex - 5, -254 + bob, 10, 20, '#5c6478', 3); }
    line(-140, -200 + bob, -190, -205 + bob, '#3a3a40', 16);                        // exhaust pipe
    // wooden body + red leather bench
    block(-30, -380 + bob, 250, 120, '#8a5a32', 28);
    for (let k = 0; k < 4; k++) line(-24, -350 + k * 28 + bob, 214, -350 + k * 28 + bob, '#6a4222', 3);
    block(-20, -420 + bob, 210, 42, '#8e2424', 22);
    block(-44, -540 + bob, 34, 160, '#8e2424', 22);
    // tiller steering + brass lamp
    line(250, -110, 285, -430 + bob, '#1c1c22', 14);
    line(250, -440 + bob, 330, -425 + bob, '#1c1c22', 14); circ(330, -425 + bob, 12, '#d8b46a');
    block(300, -330 + bob, 46, 54, '#d8b46a', 14); circ(323, -303 + bob, 14, '#fff3c0');
    spokeWheel(380, -78, 78, wa * 1.6, 10);                                         // single front wheel
    spokeWheel(-10, -125, 125, wa, 14);                                             // near rear wheel
    if (driver) {
      // driver in a long coat and top hat, hands on the tiller
      block(30, -600 + bob, 110, 190, '#2f3140', 24);                               // coat
      block(48, -690 + bob, 80, 86, '#d6a47a', 18);                                 // head
      rect(36, -705 + bob, 116, 16, '#121216', 6); block(52, -790 + bob, 84, 88, '#121216', 16); rect(52, -720 + bob, 84, 12, '#7a1f1f', 3);
      rect(110, -662 + bob, 16, 16, '#1a0f0c', 4);                                  // eye
      rect(98, -630 + bob, 34, 26, '#e9e2d6', 8);                                   // moustache
      line(120, -560 + bob, 255, -440 + bob, '#2f3140', 34); circ(258, -440 + bob, 18, '#d6a47a');
      block(60, -420 + bob, 60, 30, '#2f3140', 10);
    }
    g.restore();
  }
  /** 1890s horseless carriage (four wheels, buggy body) facing right */
  function buggy(x, y, s, wa) {
    g.save(); g.translate(x, y); g.scale(s, s);
    groundShadow(160, 4, 300, 0.3);
    spokeWheel(0, -110, 110, wa, 12); spokeWheel(330, -90, 90, wa * 1.2, 12);
    block(-60, -330, 400, 130, '#1f3f6e', 26); block(-40, -420, 160, 90, '#5a1d1d', 20); block(-60, -560, 30, 230, '#1c1c22', 12);
    rect(-70, -580, 230, 26, '#1c1c22', 8); // canopy
    line(300, -200, 330, -400, '#1c1c22', 12); circ(330, -405, 22, '#1c1c22');
    block(350, -300, 40, 44, '#d8b46a', 12);
    g.restore();
  }
  /** early-1900s car seen from the front, crank handle at angle a (rotates in the view plane). Returns the grip point. */
  function crankCar(x, y, s, a, shake = 0, lit = 1) {
    g.save(); g.translate(x + shake, y); g.scale(s, s);
    groundShadow(0, 0, 360, 0.35);
    for (const sx of [-1, 1]) { block(sx * 270 - 55, -230, 110, 230, '#16161c', 20); g.fillStyle = '#2a2a33'; g.fillRect(sx * 270 - 45, -220, 90, 210); } // tyres
    for (const sx of [-1, 1]) { g.fillStyle = '#1b2a4a'; g.beginPath(); g.ellipse(sx * 270, -240, 120, 50, 0, Math.PI, TAU); g.fill(); }      // fenders
    block(-250, -600, 500, 330, '#2b5fb4', 30);                                                            // body / bonnet
    block(-170, -580, 340, 300, '#c99a3a', 18);                                                            // brass radiator frame
    g.fillStyle = '#20232c'; g.fillRect(-145, -556, 290, 252);
    for (let k = 0; k < 9; k++) line(-130 + k * 32.5, -546, -130 + k * 32.5, -314, '#3a3f4e', 9);
    rect(-40, -640, 80, 40, '#c99a3a', 10);                                                                // radiator cap
    for (const sx of [-1, 1]) {                                                                            // brass lamps
      block(sx * 330 - 50, -560, 100, 90, '#c99a3a', 16); circ(sx * 330, -515, 36, lit ? '#fff3c0' : '#555');
    }
    block(-300, -270, 600, 40, '#1c1c22', 14);                                                             // bumper
    const cx = 0, cy = -170;
    circ(cx, cy, 30, '#3a3f4e'); circ(cx, cy, 14, '#9aa3b8');
    const ax = cx + Math.cos(a) * 150, ay = cy + Math.sin(a) * 150;
    line(cx, cy, ax, ay, '#aab3c8', 28); line(cx, cy, ax, ay, '#d7deec', 8);
    g.save(); g.translate(ax, ay); g.rotate(a); rect(-26, -26, 110, 52, '#6a4222', 20); g.restore();    // wooden grip
    g.restore();
    const gx = Math.cos(a) * 150 + Math.cos(a) * 40, gy = -170 + Math.sin(a) * 150 + Math.sin(a) * 40;
    return { gx: x + shake + gx * s, gy: y + gy * s };
  }
  /** a man in a flat cap and long coat, side view facing right. lean: torso tilt (rad); hand: grip point; fall: 0..1 thrown back */
  function crankMan(x, y, s, hand, o = {}) {
    const lean = o.lean ?? 0.75, fall = o.fall || 0, pain = o.pain || 0;
    const bx = x - fall * 170 * s, rot = lean - fall * 1.25;
    groundShadow(bx + 40 * s, y + 4, 120 * s, 0.3);
    // legs
    block(bx - 30 * s, y - 230 * s, 46 * s, 230 * s, '#2a2f45', 10 * s); block(bx + 30 * s - fall * 40 * s, y - 230 * s, 46 * s, 230 * s, '#232838', 10 * s);
    block(bx - 40 * s, y - 34 * s, 80 * s, 34 * s, '#1a1208', 8 * s); block(bx + 26 * s - fall * 40 * s, y - 34 * s, 80 * s, 34 * s, '#1a1208', 8 * s);
    const hip = { x: bx + 10 * s, y: y - 220 * s };
    const sh = { x: hip.x + Math.sin(rot) * 250 * s, y: hip.y - Math.cos(rot) * 250 * s };
    g.save(); g.translate(hip.x, hip.y); g.rotate(rot);
    block(-60 * s, -270 * s, 120 * s, 290 * s, '#5c4a32', 22 * s);                       // long coat
    rect(-60 * s, -40 * s, 120 * s, 16 * s, '#3a2c1c', 4);                                // belt
    block(-44 * s, -380 * s, 96 * s, 100 * s, '#d6a47a', 18 * s);                          // head
    block(-52 * s, -404 * s, 112 * s, 40 * s, '#4a4036', 14 * s); rect(20 * s, -380 * s, 64 * s, 16 * s, '#4a4036', 6); // flat cap
    rect(26 * s, -350 * s, 14 * s, pain ? 6 * s : 14 * s, '#1a0f0c', 3);                  // eye (squints in pain)
    rect(20 * s, -306 * s, 30 * s, pain ? 14 * s : 6 * s, '#3a0f12', 4);                   // mouth
    g.restore();
    // arm to the grip point (or flailing / holding the wrist)
    let hx = hand.x, hy = hand.y;
    if (fall > 0) { hx = lerp2(hand.x, sh.x + 40 * s, fall); hy = lerp2(hand.y, sh.y + 120 * s, fall); }
    line(sh.x, sh.y, hx, hy, '#5c4a32', 44 * s); circ(hx, hy, 24 * s, '#d6a47a');
    if (pain > 0) for (let k = 0; k < 4; k++) { const q = k * TAU / 4 + pain * 3; text('*', hx + Math.cos(q) * 70 * s, hy + Math.sin(q) * 70 * s, 60 * s, '#ffd03a', { a: 'center', w: 900 }); }
    return sh;
  }
  const lerp2 = (a, b, k) => a + (b - a) * k;
  function warnSign(x, y, sz, a) {
    g.globalAlpha = a; poly([[x, y - sz], [x + sz * 1.1, y + sz * 0.8], [x - sz * 1.1, y + sz * 0.8]], '#ffc23a');
    poly([[x, y - sz * 0.62], [x + sz * 0.78, y + sz * 0.6], [x - sz * 0.78, y + sz * 0.6]], '#1a1206');
    text('!', x, y + sz * 0.5, sz * 1.1, '#ffc23a', { a: 'center', w: 900 }); g.globalAlpha = 1;
  }

  Object.assign(SCENES, {
    // ---- 1. the 1886 motor carriage driving along an old European street (sepia) ----
    kereta1886(s, t) {
      g.save(); g.beginPath(); g.rect(40, 90, 1380, 1150); g.clip();
      sceneKereta(s, t);
      g.restore();
    },
    _unused(s, t) {
      const sky = g.createLinearGradient(0, 90, 0, 1000); sky.addColorStop(0, '#f2d7a6'); sky.addColorStop(1, '#c79a63');
      g.fillStyle = sky; g.fillRect(40, 90, 1380, 1150);
      circ(1180, 260, 70, 'rgba(255,240,200,.7)');
      // far buildings (slow parallax) then near buildings
      for (const [spd, base, sc, col] of [[40, 860, 0.8, '#a9845a'], [90, 940, 1.0, '#8c6440']]) {
        for (let k = 0; k < 9; k++) {
          const w = 190 * sc, span = 9 * 210 * sc, x = 40 + ((k * 210 * sc - t * spd) % span + span) % span - 120;
          const h = (220 + rnd(k * 7 + sc * 10) * 240) * sc, top = base - h;
          block(x, top, w, h, col, 26 * sc);
          poly([[x - 10, top], [x + w / 2 + 6, top - 80 * sc], [x + w + 12, top]], shade(col, -0.35));
          for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) rect(x + 30 * sc + c * 80 * sc, top + 40 * sc + r * 70 * sc, 40 * sc, 44 * sc, rnd(k + r * 3 + c) > 0.5 ? '#ffe2a0' : shade(col, -0.45), 4);
        }
      }
      // dirt road with ruts and stones scrolling fast
      g.fillStyle = '#9a7246'; g.fillRect(40, 940, 1380, 300);
      g.fillStyle = '#7f5d38'; g.fillRect(40, 1010, 1380, 10); g.fillRect(40, 1120, 1380, 10);
      for (let k = 0; k < 14; k++) { const x = 40 + ((k * 110 - t * 330) % 1540 + 1540) % 1540 - 80; rect(x, 980 + rnd(k) * 220, 26 + rnd(k + 1) * 20, 14, '#6b4d2e', 6); }
      const enter = ease(t / 2.4), x = -260 + enter * 760;
      puff(x - 140 * 0.95, 1080 - 205 * 0.95, t, 6, 260);
      motorwagen(x, 1085, 0.95, t * 6, t);
      // speed lines once it is cruising
      if (enter >= 1) for (let k = 0; k < 4; k++) { const p = (t * 1.5 + k / 4) % 1; g.globalAlpha = 0.5 * (1 - p); line(x - 260 - p * 300, 700 + k * 70, x - 160 - p * 300, 700 + k * 70, '#fff6dc', 8); g.globalAlpha = 1; }
      badge('1886', 90, 110, '#ffc23a');
      // film grain / vignette for an old-photo feel
      const vg = g.createRadialGradient(730, 660, 300, 730, 660, 900); vg.addColorStop(0, 'rgba(60,30,0,0)'); vg.addColorStop(1, 'rgba(60,30,0,.45)'); g.fillStyle = vg; g.fillRect(40, 90, 1380, 1150);
      for (let k = 0; k < 40; k++) { const r = rnd(k + Math.floor(t * 12) * 50); g.fillStyle = 'rgba(40,20,0,.25)'; g.fillRect(40 + r * 1380, 90 + rnd(k * 3 + Math.floor(t * 12)) * 1150, 3, 3); }
    },

    // ---- 2a. a hand pulls the horizontal flywheel round, again and again ----
    flywheel(s, t) {
      blueprint();
      const cx = 700, cy = 560, rx = 470, ry = 150;
      const P = 1.6, cyc = Math.floor(t / P), u = t - cyc * P;
      const pull = u < 0.9 ? ease(u / 0.9) : 1, a = (cyc + pull) * 0.9;
      engineBlock(cx, cy, 0);
      flywheelDisc(cx, cy, rx, ry, a, 0);
      // hand: grips the rim and moves with it while pulling, slides back while released
      const hq = u < 0.9 ? 0.5 + a : 0.5 + (cyc + 1) * 0.9 - ease((u - 0.9) / 0.7) * 0.9;
      const hx = cx + Math.cos(hq) * rx, hy = cy + Math.sin(hq) * ry - 10;
      line(hx, hy, hx + 330, hy + 360, '#5c4a32', 92); rect(hx + 210, hy + 230, 120, 40, '#3a2c1c', 10);
      block(hx - 52, hy - 46, 104, 86, '#d6a47a', 18);
      // curved arrow showing the direction
      const aa = 0.55 + 0.45 * Math.sin(t * 6);
      g.strokeStyle = `rgba(25,227,255,${aa})`; g.lineWidth = 16; g.beginPath(); g.ellipse(cx, cy, rx + 70, ry + 46, 0, hq + 0.3, hq + 1.2); g.stroke();
      const tq = hq + 1.2, tx = cx + Math.cos(tq) * (rx + 70), ty = cy + Math.sin(tq) * (ry + 46);
      g.save(); g.translate(tx, ty); g.rotate(tq + Math.PI / 2 + 0.25); g.globalAlpha = aa; poly([[0, 0], [-36, -30], [-36, 30]], C.cyan); g.restore(); g.globalAlpha = 1;
      if (u > 0.15 && u < 0.75) { const k = backOut((u - 0.15) / 0.25); g.save(); g.translate(1150, 300); g.scale(k, k); text('Hup!', 0, 0, 110, '#ffc23a', { a: 'center', w: 900 }); g.restore(); }
      sweat(1180, 380, t);
      badge('1886', 90, 110);
    },
    // ---- 2b. the engine catches: flywheel spinning fast, shaking, smoke, POP POP ----
    flywheel_hidup(s, t) {
      blueprint();
      const cx = 700, cy = 560, rx = 470, ry = 150, sh = Math.sin(t * 55) * 6;
      engineBlock(cx + sh, cy, 1);
      flywheelDisc(cx + sh, cy, rx, ry, t * 16, 1);
      puff(cx + 420 + sh, cy + 260, t * 1.6, 7, 300, '200,200,210');
      const words = [['POP!', 1080, 300], ['POP!', 360, 330], ['PUT-PUT!', 1060, 860]];
      words.forEach(([w, x, y], k) => { const p = ((t + k * 0.33) % 1); if (p < 0.6) { const sc = backOut(p / 0.25) * (1 - Math.max(0, (p - 0.4) / 0.2)); g.save(); g.translate(x, y); g.rotate((k - 1) * 0.12); g.scale(sc, sc); text(w, 0, 0, 100, k === 2 ? '#ff7d1c' : '#ffc23a', { a: 'center', w: 900 }); g.restore(); } });
      const pill = 'Enjin hidup!'; g.font = `900 64px ${HEAVY}`; const pw = g.measureText(pill).width + 80;
      rect(730 - pw / 2, 120, pw, 96, '#1f9d55', 48); text(pill, 730, 190, 64, '#fff', { a: 'center', w: 900 });
      badge('1886', 90, 110);
    },

    // ---- 3. timeline 1886 -> 1890s -> 1900s with a car for each era ----
    garismasa(s, t) {
      blueprint();
      const y = 820, xs = [250, 730, 1210], reach = [0.2, 2.6, 5.0];
      const p = t < reach[1] ? lerp2(0, 0.5, ease((t - reach[0]) / (reach[1] - reach[0]))) : lerp2(0.5, 1, ease((t - reach[1]) / (reach[2] - reach[1])));
      line(xs[0], y, xs[2], y, '#3a4466', 22);
      line(xs[0], y, lerp2(xs[0], xs[2], p), y, '#ffc23a', 22);
      const labels = ['1886', '1890-an', '1900-an'];
      const draws = [(sc) => motorwagen(xs[0] - 110 * sc, y - 40, 0.42 * sc, t * 3, t, true), (sc) => buggy(xs[1] - 110 * sc, y - 40, 0.5 * sc, t * 3), (sc) => crankCar(xs[2], y - 40, 0.42 * sc, t * 2.2)];
      xs.forEach((x, k) => {
        const on = t >= reach[k], pop = on ? backOut((t - reach[k]) / 0.45) : 0;
        circ(x, y, 38, on ? '#ffc23a' : '#3a4466'); circ(x, y, 18, on ? '#fff3c0' : '#232a44');
        g.save(); g.translate(x, y + 120); const ls = on ? 1 + 0.25 * Math.max(0, 1 - (t - reach[k]) / 0.6) : 0.85; g.scale(ls, ls);
        text(labels[k], 0, 0, 72, on ? '#ffffff' : '#5a6488', { a: 'center', w: 900 }); g.restore();
        if (pop > 0.01) draws[k](pop);
      });
      // time needle
      const nx = lerp2(xs[0], xs[2], p);
      poly([[nx, y - 40], [nx - 26, y - 90], [nx + 26, y - 90]], C.cyan); circ(nx, y, 48, 'rgba(25,227,255,.25)');
      // highlight the crank handle once the 1900s car is in
      if (t > reach[2] + 0.6) {
        const k = 0.5 + 0.5 * Math.sin(t * 6), gx = xs[2] + Math.cos(t * 2.2) * 80, gy = y - 40 - 170 * 0.42;
        ring(xs[2], gy, 120, `rgba(255,75,75,${0.6 + 0.4 * k})`, 12);
        line(xs[2] - 300, gy + 220, xs[2] - 130, gy + 80, '#ff4b4b', 14);
        text('Crank handle', xs[2] - 330, gy + 290, 64, '#ff8a8a', { a: 'center', w: 900 }); void gx;
      }
    },

    // ---- crank (monitor behind the assistant): a man turning the crank, slowly ----
    crank(s, t) {
      blueprint(); floorBand();
      const a = t * 3.2, grip = crankCar(940, 1080, 1.0, a);
      crankMan(420, 1080, 1.0, { x: grip.gx, y: grip.gy }, { lean: 0.8 });
      sweat(560, 420, t);
    },

    // ---- 4. kickback: turning... SNAP! the handle flies back, the man is thrown, holds his arm ----
    kickback(s, t) {
      blueprint(); floorBand();
      const P = 3.4, u = t % P, cyc = Math.floor(t / P);
      let a, shake = 0, fall = 0, pain = 0, flash = 0;
      if (u < 1.5) a = cyc * 0.4 + u * 2.6;                               // turning slowly, straining
      else {
        const v = u - 1.5;
        a = cyc * 0.4 + 1.5 * 2.6 - ease(v / 0.18) * 5.2;                 // snaps back in a fraction of a second
        flash = Math.max(0, 1 - v / 0.35); shake = Math.sin(u * 90) * 30 * flash;
        fall = ease(v / 0.35) * (1 - ease((v - 1.2) / 0.6)); pain = v > 0.3 ? 1 : 0;
      }
      const grip = crankCar(960 + shake, 1080, 1.0, a, 0);
      crankMan(440 + shake * 0.4, 1080, 1.0, { x: grip.gx, y: grip.gy }, { lean: 0.85, fall, pain: pain && fall > 0.2 ? 1 : 0 });
      if (u < 1.5) sweat(580, 420, t);
      if (flash > 0) {
        g.fillStyle = `rgba(255,60,60,${flash * 0.35})`; g.fillRect(40, 90, 1380, 1150);
        g.save(); g.translate(grip.gx, grip.gy); g.globalAlpha = flash;
        for (let k = 0; k < 12; k++) { const q = k * TAU / 12; line(Math.cos(q) * 90, Math.sin(q) * 90, Math.cos(q) * 210, Math.sin(q) * 210, k % 2 ? '#ffd03a' : '#ffffff', 16); }
        g.restore(); g.globalAlpha = 1;
      }
      if (u >= 1.5) {
        const v = u - 1.5, sc = backOut(v / 0.25) * (1 + 0.05 * Math.sin(u * 40));
        g.save(); g.translate(730 + Math.sin(u * 60) * 10 * flash, 300); g.rotate(-0.07); g.scale(sc, sc);
        text('KICKBACK!', 6, 8, 170, '#3a0000', { a: 'center', w: 900 }); text('KICKBACK!', 0, 0, 170, '#ff3b3b', { a: 'center', w: 900 }); g.restore();
      }
      warnSign(1320, 430, 60, 0.6 + 0.4 * Math.abs(Math.sin(t * 4)));
    },

    // ---- 5. then vs the future: crank on the left, a glowing START button on the right ----
    butang(s, t) {
      // left: DULU (grey)
      g.fillStyle = '#2a2d36'; g.fillRect(40, 90, 680, 1150);
      text('DULU', 380, 220, 80, '#b9bccb', { a: 'center', w: 900 });
      g.save(); g.filter = 'grayscale(1)';
      const grip = crankCar(470, 1000, 0.62, t * 2.6); crankMan(170, 1000, 0.62, { x: grip.gx, y: grip.gy }, { lean: 0.85 });
      g.restore(); sweat(240, 600, t, 2);
      // right: MASA DEPAN? (glowing)
      const bg = g.createLinearGradient(740, 90, 1420, 1240); bg.addColorStop(0, '#10224a'); bg.addColorStop(1, '#071026'); g.fillStyle = bg; g.fillRect(740, 90, 680, 1150);
      text('MASA DEPAN?', 1080, 220, 80, C.cyan, { a: 'center', w: 900 });
      block(820, 760, 520, 260, '#1c2440', 30); // dashboard
      for (const gx of [930, 1230]) { circ(gx, 860, 70, '#0b0f1e'); ring(gx, 860, 70, '#3a4466', 10); line(gx, 860, gx + Math.cos(-2.4 + Math.sin(t * 2 + gx) * 0.3) * 55, 860 + Math.sin(-2.4 + Math.sin(t * 2 + gx) * 0.3) * 55, '#ff4b4b', 8); }
      const P = 4.5, u = t % P, press = u > 2.6 && u < 2.9 ? 0.86 : 1, lit = u > 2.6 ? Math.max(0, 1 - (u - 2.6) / 1.6) : 0;
      const bx = 1080, by = 560, pulse = (1 + 0.05 * Math.sin(t * 5)) * press;
      g.save(); g.translate(bx, by); g.scale(pulse, pulse);
      g.shadowColor = C.cyan; g.shadowBlur = 50 + 80 * lit; circ(0, 0, 150, '#0e3a4a'); g.shadowBlur = 0;
      ring(0, 0, 150, C.cyan, 16); circ(0, 0, 118, lit ? `rgba(25,227,255,${0.3 + 0.5 * lit})` : '#13253a');
      text('START', 0, 22, 66, lit ? '#ffffff' : C.cyan, { a: 'center', w: 900 });
      g.restore();
      if (lit > 0) for (let k = 0; k < 14; k++) { const q = k * TAU / 14 + 0.2, r = 180 + (1 - lit) * 220; g.globalAlpha = lit; circ(bx + Math.cos(q) * r, by + Math.sin(q) * r, 10, k % 2 ? '#ffd03a' : C.cyan); } g.globalAlpha = 1;
      // middle arrow
      for (let k = 0; k < 3; k++) { g.globalAlpha = ((Math.floor(t * 4) + k) % 3 === 0) ? 1 : 0.3; text('>', 690 + k * 34, 640, 110, '#ffc23a', { w: 900 }); } g.globalAlpha = 1;
      if (u < 2.6) { const hy = by + 260 - ease(u / 2.6) * 120; block(bx + 30, hy, 70, 110, '#d6a47a', 14); } // a finger moving toward the button
    },

    // ---- 6. dark workshop: a single spotlight, dust, the crank handle jolts; end card glitches in ----
    bersambung(s, t) {
      g.fillStyle = '#05060c'; g.fillRect(40, 90, 1380, 1150);
      const cx = s.text === false ? 730 : 470;
      // spotlight cone + lit wall patch + floor pool
      block(cx - 300, 520, 600, 420, '#0c0e16', 30);
      g.fillStyle = '#141824'; g.fillRect(cx - 200, 560, 400, 300);
      const cone = g.createLinearGradient(cx, 90, cx, 1150); cone.addColorStop(0, 'rgba(255,236,190,.34)'); cone.addColorStop(1, 'rgba(255,236,190,.04)');
      g.save(); g.globalCompositeOperation = 'lighter'; poly([[cx - 40, 90], [cx + 40, 90], [cx + 420, 1150], [cx - 420, 1150]], cone); g.restore();
      block(cx - 70, 90, 140, 40, '#2a2d36', 14); // the lamp
      g.fillStyle = 'rgba(255,236,190,.16)'; g.beginPath(); g.ellipse(cx, 1110, 400, 70, 0, 0, TAU); g.fill();
      const P = 2.2, u = t % P, hit = u < 0.4 ? 1 - u / 0.4 : 0, flick = 0.85 + 0.15 * Math.sin(t * 37) * Math.sin(t * 13);
      const a = -1.0 - (u < 0.4 ? ease(1 - u / 0.4) * 1.7 : 0), shake = Math.sin(t * 90) * 16 * hit;
      // big shadow of the crank on the wall
      g.save(); g.translate(cx - 160 + shake * 2, 430); g.rotate(a); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, -40, 520, 80); g.fillRect(470, -140, 110, 280); g.restore();
      // the crank handle in the light
      g.save(); g.translate(cx + shake, 880);
      circ(0, 0, 34, '#3a3f4e');
      const ax = Math.cos(a) * 260, ay = Math.sin(a) * 260;
      line(0, 0, ax, ay, `rgba(200,208,224,${flick})`, 44); line(0, 0, ax, ay, '#eef2ff', 12);
      g.translate(ax, ay); g.rotate(a); rect(-30, -34, 170, 68, '#7a4a22', 26);
      g.restore();
      if (hit > 0) { g.globalAlpha = hit; const hx = cx + shake + Math.cos(a) * 300, hy = 880 + Math.sin(a) * 300; for (let k = 0; k < 10; k++) { const q = k * TAU / 10; line(hx + Math.cos(q) * 70, hy + Math.sin(q) * 70, hx + Math.cos(q) * 170, hy + Math.sin(q) * 170, '#ffd03a', 14); } g.fillStyle = `rgba(255,255,255,${hit * 0.18})`; g.fillRect(40, 90, 1380, 1150); g.globalAlpha = 1; }
      // dust in the beam
      for (let k = 0; k < 46; k++) {
        const r1 = rnd(k), r2 = rnd(k + 99), yy = 120 + ((r2 * 1000 + t * (20 + r1 * 30)) % 1000), spread = 60 + (yy - 90) * 0.31;
        const xx = cx + (r1 - 0.5) * 2 * spread + Math.sin(t * 0.8 + k) * 14;
        g.fillStyle = `rgba(255,240,210,${0.25 + 0.5 * rnd(k + 7) * (0.6 + 0.4 * Math.sin(t * 3 + k))})`; g.fillRect(xx, yy, 5, 5);
      }
      if (s.text === false) return;
      // end card text with a glitch
      const ap = ease(t / 0.6), gl = (t % 1.3) < 0.18 ? 1 : 0, j = (k) => gl ? (rnd(k + Math.floor(t * 30)) - 0.5) * 30 : 0;
      g.globalAlpha = ap;
      const lines = [['BERSAMBUNG', 430, 110, '#ffc23a'], ['PART 2:', 600, 96, '#eef2ff'], ['BAHAYA', 730, 120, '#ff3b3b'], ['CRANK HANDLE!', 860, 96, '#ff3b3b']];
      lines.forEach(([w, y, sz, c], k) => {
        if (gl) { g.globalAlpha = ap * 0.7; fitText(w, 1060 + j(k) - 8, y, sz, '#00e5ff', 680, { a: 'center', w: 900 }); fitText(w, 1060 + j(k + 5) + 8, y, sz, '#ff00aa', 680, { a: 'center', w: 900 }); g.globalAlpha = ap; }
        fitText(w, 1060 + j(k + 9), y, sz, c, 680, { a: 'center', w: 900 });
      });
      if (gl) for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(${k % 2 ? '0,229,255' : '255,0,170'},.25)`; g.fillRect(700, 300 + rnd(k + Math.floor(t * 30)) * 650, 720, 8 + rnd(k) * 16); }
      g.globalAlpha = 1;
    },
  });

  const sceneKereta = (s, t) => SCENES._unused(s, t);
  // shared backgrounds and machine parts for the v2 scenes
  function blueprint() {
    const bg = g.createLinearGradient(0, 90, 0, 1240); bg.addColorStop(0, '#16224a'); bg.addColorStop(1, '#0c1430'); g.fillStyle = bg; g.fillRect(40, 90, 1380, 1150);
    g.strokeStyle = 'rgba(120,170,255,.08)'; g.lineWidth = 2;
    for (let x = 40; x <= 1420; x += 60) { g.beginPath(); g.moveTo(x, 90); g.lineTo(x, 1240); g.stroke(); }
    for (let y = 90; y <= 1240; y += 60) { g.beginPath(); g.moveTo(40, y); g.lineTo(1420, y); g.stroke(); }
  }
  function floorBand() { g.fillStyle = '#1b2547'; g.fillRect(40, 1080, 1380, 160); line(40, 1080, 1420, 1080, '#2c3a6e', 6); }
  function engineBlock(cx, cy, running) {
    block(cx - 150, cy + 60, 300, 330, '#4a5266', 34);
    for (let k = 0; k < 4; k++) rect(cx - 130, cy + 110 + k * 64, 260, 18, '#3a4152', 6);                        // cooling fins
    block(cx + 170, cy + 200, 140, 70, '#3a4152', 18); line(cx + 310, cy + 235, cx + 420, cy + 260, '#2a2f3c', 26); // exhaust
    if (running) circ(cx + 230, cy + 235, 12, '#ff7d1c');
  }
  function flywheelDisc(cx, cy, rx, ry, a, blur) {
    g.fillStyle = '#2e3446'; g.beginPath(); g.ellipse(cx, cy + 50, rx, ry, 0, 0, TAU); g.fill();               // rim thickness
    g.fillStyle = '#2e3446'; g.fillRect(cx - rx, cy, 2 * rx, 50);
    g.fillStyle = '#b8c0d4'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.fillStyle = '#7b849a'; g.beginPath(); g.ellipse(cx, cy, rx * 0.84, ry * 0.84, 0, 0, TAU); g.fill();
    const n = blur ? 6 : 1;
    for (let b = 0; b < n; b++) {
      g.globalAlpha = blur ? 0.22 : 1;
      for (let k = 0; k < 6; k++) { const q = a - b * 0.09 + k * TAU / 6; line(cx, cy, cx + Math.cos(q) * rx * 0.84, cy + Math.sin(q) * ry * 0.84, '#4a5266', 30); }
    }
    g.globalAlpha = 1;
    if (blur) { g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 8; for (const k of [0.5, 0.7]) { g.beginPath(); g.ellipse(cx, cy, rx * k, ry * k, 0, a % TAU, (a % TAU) + 2.2); g.stroke(); } }
    circ(cx, cy, 46, '#232838'); circ(cx, cy, 20, '#c99a3a');
    // a white mark on the rim so the rotation reads clearly
    const mq = a + 1.0; block(cx + Math.cos(mq) * rx * 0.92 - 16, cy + Math.sin(mq) * ry * 0.92 - 12, 32, 20, '#ffffff', 6);
  }

  return { scene: (s, t) => (SCENES[s.anim] || SCENES.tajuk)(s, Math.max(0, t)), caption, chrome, fitText, text, rect };
}

export function createScreen(opts = {}) {
  const api = baseCreateScreen(opts);
  const { H, tex, canvas } = api;
  const g = canvas.getContext('2d');
  const P = makePainter(g);
  let lt = 0;
  function drawAnim(s, t) {
    g.save(); g.globalAlpha = 1; g.shadowBlur = 0; g.setLineDash([]);
    P.chrome(s.title || 'Evolusi Starter Motor');
    if (opts.compact) { // the over-the-shoulder shots crop the left edge and hide the right: fit the scene into x 230..1250
      const k = (1250 - 230) / (1420 - 40), oy = 64 + ((H - 64) - (H - 90) * k) / 2;
      g.translate(230 - 40 * k, oy - 90 * k); g.scale(k, k);
    }
    P.scene(s, t);
    P.caption(s.caption);
    g.restore();
    tex.needsUpdate = true;
  }
  const baseDraw = api.draw;
  api.draw = (state, o = {}) => { if (state && state.type === 'anim') drawAnim(state, lt); else baseDraw(state, o); };
  /** per frame from the location: local time since the current screen appeared */
  api.tick = (state, localT) => { lt = localT; if (state && state.type === 'anim') drawAnim(state, localT); };
  return api;
}

/** Full-frame vertical (1080 x 1920) version of the same animations, for the "full" shot. draw(state, localT). */
export function createFullScreen() {
  const FW = 1080, FH = 1920;
  const { tex, canvas, g } = canvasTex(FW, FH, null);
  const P = makePainter(g);
  let last = '';
  function draw(s, t) {
    const key = (s && s.anim) + '|' + t.toFixed(3);
    if (key === last) return; last = key;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.shadowBlur = 0; g.setLineDash([]);
    const gr = g.createLinearGradient(0, 0, 0, FH); gr.addColorStop(0, '#1d2650'); gr.addColorStop(0.5, '#141a36'); gr.addColorStop(1, '#0b0f22');
    g.fillStyle = gr; g.fillRect(0, 0, FW, FH);
    // faint blueprint grid
    g.strokeStyle = 'rgba(25,227,255,.07)'; g.lineWidth = 2;
    for (let x = 0; x <= FW; x += 90) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, FH); g.stroke(); }
    for (let y = 0; y <= FH; y += 90) { g.beginPath(); g.moveTo(0, y); g.lineTo(FW, y); g.stroke(); }
    if (s.anim === 'bersambung') { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, FW, FH); }
    // title (top of the safe zone)
    if (s.title) {
      g.fillStyle = '#ffc23a'; roundRect(g, 90, 300, FW - 180, 8, 4); g.fill();
      g.font = `900 92px ${HEAVY}`; let size = 92; while (g.measureText(s.title).width > FW - 160 && size > 40) { size -= 2; g.font = `900 ${size}px ${HEAVY}`; }
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.fillText(s.title, FW / 2, 420); g.textAlign = 'left';
    }
    // scene: design box x 40..1420, y 90..1240 scaled to the frame width, centred between title and caption
    const k = (FW - 120) / 1380, top = 560;
    g.save(); g.beginPath(); g.rect(0, top, FW, 1150 * k); g.clip();
    g.translate(60 - 40 * k, top - 90 * k); g.scale(k, k);
    P.scene({ ...s, _full: true }, t);
    g.restore();
    // caption (bottom of the safe zone)
    if (s.caption) {
      g.fillStyle = 'rgba(8,10,24,.85)'; roundRect(g, 60, 1480, FW - 120, 170, 40); g.fill();
      g.font = `800 72px ${HEAVY}`; let size = 72; while (g.measureText(s.caption).width > FW - 200 && size > 36) { size -= 2; g.font = `800 ${size}px ${HEAVY}`; }
      g.fillStyle = '#eef2ff'; g.textAlign = 'center'; g.fillText(s.caption, FW / 2, 1590); g.textAlign = 'left';
    }
    g.restore();
    tex.needsUpdate = true;
  }
  return { tex, draw, W: FW, H: FH };
}
