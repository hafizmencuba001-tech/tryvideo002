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
