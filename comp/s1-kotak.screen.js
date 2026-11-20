// s1-kotak monitor content. A screen state (story `screens` entry) is drawn into one 2048x1280 canvas texture:
//   doc    { title, body, meta }                       generic document editor
//   email  { to, subject, body, status }               generic mail composer
//   post   { caption, image: 'product'|'bosmeme', views, likes }   generic social-video post card
//   prompt { lines[] }                                 generic AI prompt box
// createScreen() returns { tex, canvas, draw(state, opts) }; draw is cheap enough to call every frame while typing.
//   opts: { n: chars of typeText(state) shown (default all), caret: bool, views, likes: display strings (counter animation) }
// No side effects at import time; fonts are macOS system fonts (no async loading needed).
import * as THREE from 'three';
import { canvasTex, roundRect, TAU } from './s1-kotak.lib.js';
import { typeText, commonPrefix } from './s1-kotak.plan.js';

const SANS = '"Helvetica Neue", "Avenir Next", Arial, sans-serif';
const HEAVY = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
const W = 2048, H = 1280;

export { typeText, commonPrefix };

/** "1.2J" / "88K" / "38" -> number (J = juta) */
export function parseCount(s) {
  const m = String(s).trim().match(/^([\d.,]+)\s*([KkJj]?)$/);
  if (!m) return 0;
  const v = parseFloat(m[1].replace(',', '.'));
  return m[2] ? v * (/[Jj]/.test(m[2]) ? 1e6 : 1e3) : v;
}
/** number -> "38" / "88K" / "1.2J" (Malay short form) */
export function fmtCount(v) {
  v = Math.max(0, Math.round(v));
  if (v < 1000) return String(v);
  if (v < 1e6) { const k = v / 1e3; return (k < 100 ? k.toFixed(1).replace(/\.0$/, '') : String(Math.round(k))) + 'K'; }
  const m = v / 1e6; return m.toFixed(m < 10 ? 1 : 0).replace(/\.0$/, '') + 'J';
}

// ---- text helpers -----------------------------------------------------------------------------------------------------
function wrap(g, text, maxW) {
  const rows = [];
  const paras = text.split('\n');
  paras.forEach((p, pi) => {
    if (p === '') { rows.push({ t: '', end: pi }); return; }
    let cur = '';
    for (const w of p.split(' ')) {
      const test = cur ? cur + ' ' + w : w;
      if (cur && g.measureText(test).width > maxW) { rows.push({ t: cur }); cur = w; } else cur = test;
    }
    rows.push({ t: cur });
  });
  return rows;
}
/** biggest font size (<= max) at which `text` wrapped to maxW fits in maxH. Wraps the FULL text so the size never changes while typing */
function fitSize(g, font, text, maxW, maxH, max, min = 34, lh = 1.28) {
  for (let s = max; s >= min; s -= 2) {
    g.font = font(s);
    if (wrap(g, text, maxW).length * s * lh <= maxH) return s;
  }
  return min;
}

export function createScreen(opts = {}) {
  const C = !!opts.compact; // story layout: content kept in the left ~70% so the over-the-shoulder shots don't hide it behind the intern
  const { tex, canvas, g } = canvasTex(W, H, null);
  tex.anisotropy = 16;
  g.textBaseline = 'alphabetic';

  // ---- shared drawing bits ----
  const dot = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const trafficLights = () => ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => dot(44 + i * 40, 32, 12, c));
  const caretAt = (x, baseY, size, color) => { g.fillStyle = color; g.fillRect(x + 6, baseY - size * 0.82, Math.max(5, size * 0.045), size * 0.98); };
  const pill = (x, y, w, h, bg, fg, label, size = 34) => {
    g.fillStyle = bg; roundRect(g, x, y, w, h, h / 2); g.fill();
    g.fillStyle = fg; g.font = `700 ${size}px ${SANS}`; g.textAlign = 'center'; g.fillText(label, x + w / 2, y + h / 2 + size * 0.35); g.textAlign = 'left';
  };

  /** draw wrapped text; rows revealed = first n chars. Returns caret position of the last revealed char. */
  function drawWrapped(full, n, x, y, maxW, size, o = {}) {
    const lh = o.lh || 1.28;
    const shown = full.slice(0, n);
    g.font = `${o.weight || 600} ${size}px ${o.family || HEAVY}`;
    const rows = wrap(g, shown, maxW);
    let cx = x, cy = y;
    rows.forEach((r, ri) => {
      cy = y + ri * size * lh;
      let tx = x, text = r.t;
      if (o.stamp) { // coloured timestamp prefix ("10:02  Bos: ...")
        const m = text.match(/^(\d\d:\d\d(?: [\u2013-] \d\d:\d\d)?)(\s+)/);
        if (m) { g.fillStyle = o.stamp; g.fillText(m[1], x, cy); tx = x + g.measureText(m[1] + m[2]).width; text = text.slice(m[0].length); }
      }
      g.fillStyle = o.color || '#12183a';
      g.fillText(text, tx, cy);
      cx = tx + g.measureText(text).width;
    });
    return { x: cx, y: cy, rows: rows.length };
  }

  // ============================================ doc =============================================================
  function drawDoc(s, o) {
    const full = s.body || '', n = Math.min(o.n ?? 1e9, full.length);
    g.fillStyle = '#1b2030'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#232a3d'; g.fillRect(0, 0, W, 64);
    trafficLights();
    g.fillStyle = '#9aa6c4'; g.font = `600 26px ${SANS}`; g.textAlign = 'center'; g.fillText(`${s.title}  -  Penyunting Dokumen`, W / 2, 41); g.textAlign = 'left';
    g.fillStyle = '#1b2030'; g.fillRect(0, 64, W, 56);
    g.font = `500 27px ${SANS}`; g.fillStyle = '#c3cce4';
    ['Fail', 'Sunting', 'Lihat', 'Sisip', 'Format', 'Alat', 'Bantuan'].forEach((m, i) => g.fillText(m, 36 + i * 132, 100));
    g.fillStyle = '#242b40'; g.fillRect(0, 120, W, 84);
    g.fillStyle = '#323b57'; roundRect(g, 36, 138, 230, 48, 10); g.fill();
    g.fillStyle = '#d6def5'; g.font = `500 26px ${SANS}`; g.fillText('Tajuk 1  v', 56, 171);
    g.fillStyle = '#323b57'; roundRect(g, 284, 138, 120, 48, 10); g.fill();
    g.fillStyle = '#d6def5'; g.fillText('28  v', 306, 171);
    [['B', 700], ['I', 400], ['U', 400]].forEach(([l, w], i) => {
      g.fillStyle = i === 0 ? '#3d4c7a' : '#323b57'; roundRect(g, 428 + i * 66, 138, 54, 48, 10); g.fill();
      g.fillStyle = '#eaf0ff'; g.font = `${i === 1 ? 'italic ' : ''}${w} 28px ${SANS}`; g.textAlign = 'center'; g.fillText(l, 455 + i * 66, 172);
    });
    g.textAlign = 'left';
    for (let i = 0; i < 5; i++) { g.fillStyle = '#323b57'; roundRect(g, 660 + i * 66, 138, 54, 48, 10); g.fill(); g.fillStyle = '#9fb0e0'; for (let k = 0; k < 3; k++) g.fillRect(672 + i * 66, 152 + k * 9, 30 - (k === 1 ? 8 : 0), 3); }
    // sidebar
    g.fillStyle = '#171c2b'; g.fillRect(0, 204, 260, H - 204 - 54);
    g.fillStyle = '#7e8bb0'; g.font = `600 22px ${SANS}`; g.fillText('HALAMAN', 28, 250);
    g.fillStyle = '#f6f7fb'; roundRect(g, 40, 276, 180, 240, 8); g.fill();
    g.strokeStyle = '#4c8dff'; g.lineWidth = 5; roundRect(g, 40, 276, 180, 240, 8); g.stroke();
    g.fillStyle = '#1b2236'; g.fillRect(58, 300, 120, 12); g.fillStyle = '#8b94ad'; g.fillRect(58, 330, 40, 9);
    if (n > 0) { g.fillStyle = '#c5cbdd'; for (let k = 0; k < Math.min(6, 1 + n / 14); k++) g.fillRect(58, 356 + k * 18, 104 - (k % 3) * 22, 6); }
    // workspace + page
    g.fillStyle = '#2a3045'; g.fillRect(260, 204, W - 260, H - 204 - 54);
    const PX = C ? 330 : 520, PW = 1180, PY = 240;
    g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 50; g.shadowOffsetY = 14;
    g.fillStyle = '#fbfcff'; g.fillRect(PX, PY, PW, H - PY - 54 + 80); g.restore();
    g.fillStyle = '#e4e8f2'; g.fillRect(PX, PY, PW, 30);
    g.fillStyle = '#9aa3bd'; for (let i = 0; i <= 24; i++) g.fillRect(PX + 40 + i * 47, PY + 8, 2, i % 2 ? 8 : 14);
    g.fillStyle = '#12183a';
    let tsz = 92; g.font = `800 ${tsz}px ${HEAVY}`;
    while (g.measureText(s.title).width > PW - 160 && tsz > 40) { tsz -= 2; g.font = `800 ${tsz}px ${HEAVY}`; }
    g.fillText(s.title, PX + 80, PY + 190);
    g.fillStyle = '#7a84a6'; g.font = `500 32px ${SANS}`;
    g.fillText('Disediakan oleh Intern-3   |   11:47 PM   |   Draf akhir', PX + 82, PY + 252);
    g.fillStyle = '#d6dbea'; g.fillRect(PX + 80, PY + 292, PW - 160, 4);
    // body: big when it is one short word, otherwise fitted to the page
    const bx = PX + 80, bw = PW - 160, by = PY + 360, bh = H - 54 - by - 24;
    const oneWord = full.length <= 10 && !full.includes('\n');
    const bullets = full.includes('\u2022');
    const fontFn = (sz) => `${oneWord ? 800 : 600} ${sz}px ${HEAVY}`;
    const size = oneWord ? (C ? 215 : 250) : fitSize(g, fontFn, full, bw, bh, bullets ? 74 : 84, 40, 1.3);
    const startY = oneWord ? PY + 560 : by + size * 0.9;
    const pos = drawWrapped(full, n, bx, startY, bw, size, { weight: oneWord ? 800 : 600, lh: oneWord ? 1.2 : 1.3, stamp: '#3b6ef0' });
    if (o.caret) caretAt(n ? pos.x : bx, n ? pos.y : startY, size, '#4c8dff');
    // status bar
    g.fillStyle = '#10141f'; g.fillRect(0, H - 54, W, 54);
    g.fillStyle = '#7e8bb0'; g.font = `500 25px ${SANS}`;
    g.fillText(s.meta || `Muka 1 daripada 1     |     ${n ? full.trim().split(/\s+/).length : 0} perkataan     |     Disimpan automatik`, 32, H - 18);
    g.textAlign = 'right'; g.fillStyle = '#35d07f'; g.fillText('Bersambung', W - 32, H - 18); g.textAlign = 'left';
  }

  // ============================================ email ===========================================================
  function drawEmail(s, o) {
    const full = s.body || '', n = Math.min(o.n ?? 1e9, full.length);
    g.fillStyle = '#171b2a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#232a3d'; g.fillRect(0, 0, W, 64); trafficLights();
    g.fillStyle = '#9aa6c4'; g.font = `600 26px ${SANS}`; g.textAlign = 'center'; g.fillText('Surat  -  Mesej Baharu', W / 2, 41); g.textAlign = 'left';
    // folders
    g.fillStyle = '#12162a'; g.fillRect(0, 64, 300, H - 64);
    ['Peti Masuk', 'Draf', 'Dihantar', 'Sampah'].forEach((f, i) => {
      const act = i === 1; if (act) { g.fillStyle = '#26305a'; roundRect(g, 18, 100 + i * 70, 264, 54, 12); g.fill(); }
      g.fillStyle = act ? '#e6ecff' : '#8c97bb'; g.font = `${act ? 700 : 500} 29px ${SANS}`; g.fillText(f, 44, 137 + i * 70);
    });
    // compose pane
    const X = C ? 330 : 360, PWd = C ? 1120 : W - X - 60;
    g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 40; g.shadowOffsetY = 10; g.fillStyle = '#fbfcff'; roundRect(g, X, 110, PWd, H - 170, 22); g.fill(); g.restore();
    const f1 = 168, lh = 96;
    g.font = `600 36px ${SANS}`;
    [['Kepada', s.to], ['Subjek', s.subject]].forEach(([k, v], i) => {
      const y = f1 + i * lh;
      g.fillStyle = '#7a84a6'; g.font = `600 34px ${SANS}`; g.fillText(k, X + 50, y + 50);
      g.fillStyle = '#12183a'; g.font = `${i ? 700 : 600} ${i ? 40 : 44}px ${HEAVY}`;
      if (i === 0) { const tw = g.measureText(v).width; g.fillStyle = '#dfe7ff'; roundRect(g, X + 230, y + 4, tw + 44, 62, 31); g.fill(); g.fillStyle = '#1f2f6b'; g.fillText(v, X + 252, y + 50); } else g.fillText(v, X + 230, y + 50);
      g.fillStyle = '#e3e7f2'; g.fillRect(X + 50, y + lh - 10, PWd - 100, 3);
    });
    const bx = X + 50, bw = PWd - 100, by = f1 + 2 * lh + 40, bh = H - 60 - by - 150;
    const fontFn = (sz) => `600 ${sz}px ${HEAVY}`;
    const size = fitSize(g, fontFn, full || ' ', bw, bh, 78, 44);
    const pos = drawWrapped(full, n, bx, by + size * 0.9, bw, size, { weight: 600, lh: 1.28 });
    if (o.caret) caretAt(n ? pos.x : bx, n ? pos.y : by + size * 0.9, size, '#4c8dff');
    // footer: send button + status chip
    const sent = /dihantar/i.test(s.status || '');
    g.fillStyle = '#eef1fa'; g.fillRect(X, H - 60 - 118, PWd, 118);
    g.fillStyle = sent ? '#9aa4c4' : '#3b6ef0'; roundRect(g, X + 50, H - 60 - 118 + 24, 230, 70, 16); g.fill();
    g.fillStyle = '#fff'; g.font = `800 36px ${HEAVY}`; g.textAlign = 'center'; g.fillText('Hantar', X + 165, H - 60 - 118 + 71); g.textAlign = 'left';
    const st = s.status || 'Draf', cw = Math.max(220, st.length * 24 + 80);
    sent ? pill(X + PWd - cw - 50, H - 60 - 118 + 22, cw, 74, '#d7f6e4', '#0f7a43', st, 36) : pill(X + PWd - cw - 50, H - 60 - 118 + 22, cw, 74, '#ffe7c2', '#a2570a', st, 36);
  }

  // ============================================ prompt ==========================================================
  function drawPrompt(s, o) {
    const lines = s.lines || [], full = lines.join('\n'), n = Math.min(o.n ?? 1e9, full.length);
    const bgr = g.createLinearGradient(0, 0, W, H); bgr.addColorStop(0, '#12152b'); bgr.addColorStop(1, '#1d1535');
    g.fillStyle = bgr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b2030'; g.fillRect(0, 0, W, 64); trafficLights();
    g.fillStyle = '#9aa6c4'; g.font = `600 26px ${SANS}`; g.textAlign = 'center'; g.fillText('Pembantu AI  -  Arahan Baharu', W / 2, 41); g.textAlign = 'left';
    // sparkle title
    g.fillStyle = '#d9e2ff'; g.font = `800 64px ${HEAVY}`; g.fillText('Apa yang AI perlu tahu?', 150, 172);
    g.fillStyle = '#8c97bb'; g.font = `500 32px ${SANS}`; g.fillText('Tulis arahan penuh: siapa, apa, kenapa, bentuk apa', 152, 224);
    // input card
    const cx = 120, cy = 270, cw = C ? 1320 : W - 240, ch = 780;
    g.save(); g.shadowColor = 'rgba(80,110,255,.45)'; g.shadowBlur = 60; g.fillStyle = '#f6f8ff'; roundRect(g, cx, cy, cw, ch, 36); g.fill(); g.restore();
    g.strokeStyle = '#7c5cff'; g.lineWidth = 5; roundRect(g, cx, cy, cw, ch, 36); g.stroke();
    const tx = cx + 70, tw = cw - 140, fontFn = (sz) => `700 ${sz}px ${HEAVY}`;
    const size = fitSize(g, fontFn, full, tw, ch - 150, 66, 40, 1.4);
    g.font = fontFn(size);
    // label colouring per line; revealed char budget flows across lines
    let left = n, y = cy + 90 + size * 0.4, endX = tx, endY = y;
    lines.forEach((ln) => {
      const take = Math.min(left, ln.length); left -= take + 1; // +1 = the newline
      if (take < 0) return;
      const shown = ln.slice(0, take), k = ln.indexOf(':');
      const rows = wrap(g, ln, tw); // wrap the FULL line (stable layout), reveal by chars
      let used = 0, ry = y;
      rows.forEach((r, ri) => {
        const rowStart = used; used += r.t.length + 1;
        const part = r.t.slice(0, Math.max(0, take - rowStart));
        let px = tx;
        const lab = rowStart === 0 && k >= 0 ? Math.min(part.length, k + 1) : 0;
        if (lab) { g.fillStyle = '#6a3df0'; g.font = `800 ${size}px ${HEAVY}`; g.fillText(part.slice(0, lab), px, ry); px += g.measureText(part.slice(0, lab)).width; }
        g.font = fontFn(size); g.fillStyle = '#1b2236'; g.fillText(part.slice(lab), px, ry);
        if (part.length) { endX = px + g.measureText(part.slice(lab)).width; endY = ry; }
        ry += size * 1.4;
      });
      if (take >= 0 && take <= ln.length && n > 0) { /* keep last caret position */ }
      y = ry + size * 0.25;
    });
    if (!n) { endX = tx; endY = cy + 90 + size * 0.4; }
    if (o.caret) caretAt(endX, endY, size, '#6a3df0');
    // send bar
    const sbx = cx + cw - 260;
    g.fillStyle = '#6a3df0'; roundRect(g, sbx, cy + ch + 40, 260, 84, 24); g.fill();
    g.fillStyle = '#fff'; g.font = `800 40px ${HEAVY}`; g.textAlign = 'center'; g.fillText('Hantar  >', sbx + 130, cy + ch + 96); g.textAlign = 'left';
    ['Peranan', 'Tugasan', 'Konteks', 'Format'].forEach((c, i) => { pill(150 + i * 250, cy + ch + 50, 226, 64, 'rgba(255,255,255,.08)', '#9fb0e0', c, 30); });
  }

  // ============================================ post ============================================================
  function drawProduct(x, y, s) {
    const bgr = g.createLinearGradient(x, y, x, y + s); bgr.addColorStop(0, '#ffe9c9'); bgr.addColorStop(1, '#ffc38a');
    g.fillStyle = bgr; g.fillRect(x, y, s, s);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x + s * 0.5, y + s * 0.45, s * 0.42, 0, TAU); g.fill();
    // table shadow
    const sh = g.createRadialGradient(x + s * 0.5, y + s * 0.82, 10, x + s * 0.5, y + s * 0.82, s * 0.36); sh.addColorStop(0, 'rgba(90,50,10,.35)'); sh.addColorStop(1, 'rgba(90,50,10,0)');
    g.fillStyle = sh; g.fillRect(x, y + s * 0.6, s, s * 0.4);
    // isometric box
    const bx = x + s * 0.5, by = y + s * 0.78, a = s * 0.27, hgt = s * 0.38;
    const top = [[bx, by - hgt - a * 0.55], [bx + a, by - hgt], [bx, by - hgt + a * 0.55], [bx - a, by - hgt]];
    const left = [[bx - a, by - hgt], [bx, by - hgt + a * 0.55], [bx, by + a * 0.55], [bx - a, by]];
    const right = [[bx, by - hgt + a * 0.55], [bx + a, by - hgt], [bx + a, by], [bx, by + a * 0.55]];
    const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill(); };
    poly(left, '#2a6fdb'); poly(right, '#1a4fa8'); poly(top, '#5b95f2');
    g.fillStyle = 'rgba(255,255,255,.9)'; poly([[bx - a * 0.78, by - hgt * 0.72], [bx - a * 0.1, by - hgt * 0.72 + a * 0.38], [bx - a * 0.1, by - hgt * 0.32 + a * 0.38], [bx - a * 0.78, by - hgt * 0.32]], '#ffffff');
    g.fillStyle = '#1a4fa8'; g.font = `800 ${s * 0.05}px ${HEAVY}`; g.save(); g.translate(bx - a * 0.44, by - hgt * 0.52 + a * 0.1); g.transform(1, 0.55, 0, 1, 0, 0); g.textAlign = 'center'; g.fillText('PRODUK', 0, 0); g.restore(); g.textAlign = 'left';
    // tape
    poly([[bx - a * 0.12, by - hgt - a * 0.4], [bx + a * 0.12, by - hgt - a * 0.28], [bx + a * 0.12, by - hgt + a * 0.76], [bx - a * 0.12, by - hgt + a * 0.64]], 'rgba(255,230,160,.85)');
    // promo burst
    const px = x + s * 0.8, py = y + s * 0.2, r1 = s * 0.14, r2 = s * 0.1;
    g.fillStyle = '#ff4766'; g.beginPath(); for (let i = 0; i < 20; i++) { const rr = i % 2 ? r2 : r1, an = i / 20 * TAU; g.lineTo(px + Math.cos(an) * rr, py + Math.sin(an) * rr); } g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = `800 ${s * 0.058}px ${HEAVY}`; g.textAlign = 'center'; g.fillText('PROMO', px, py + s * 0.02); g.textAlign = 'left';
  }
  function drawBosMeme(x, y, s) {
    const bgr = g.createRadialGradient(x + s / 2, y + s / 2, s * 0.05, x + s / 2, y + s / 2, s * 0.75); bgr.addColorStop(0, '#ff7a45'); bgr.addColorStop(1, '#b5122e');
    g.fillStyle = bgr; g.fillRect(x, y, s, s);
    g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip(); g.fillStyle = 'rgba(255,220,120,.22)';
    for (let i = 0; i < 24; i++) { const a0 = i / 24 * TAU, a1 = a0 + 0.1; g.beginPath(); g.moveTo(x + s / 2, y + s / 2); g.lineTo(x + s / 2 + Math.cos(a0) * s, y + s / 2 + Math.sin(a0) * s); g.lineTo(x + s / 2 + Math.cos(a1) * s, y + s / 2 + Math.sin(a1) * s); g.closePath(); g.fill(); }
    g.restore();
    // head (box face, shocked)
    const hw = s * 0.62, hh = s * 0.64, hx = x + (s - hw) / 2, hy = y + s * 0.2;
    // suit + tie
    g.fillStyle = '#1f2f6b'; roundRect(g, x + s * 0.08, y + s * 0.84, s * 0.84, s * 0.4, 30); g.fill();
    g.fillStyle = '#eef2fa'; g.beginPath(); g.moveTo(x + s * 0.42, y + s * 0.84); g.lineTo(x + s * 0.58, y + s * 0.84); g.lineTo(x + s * 0.5, y + s * 0.98); g.closePath(); g.fill();
    g.fillStyle = '#d4202f'; g.fillRect(x + s * 0.47, y + s * 0.88, s * 0.06, s * 0.14);
    g.fillStyle = '#a06a45'; g.fillRect(x + s * 0.43, y + s * 0.78, s * 0.14, s * 0.08);
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 28; g.shadowOffsetY = 10;
    g.fillStyle = '#b87d55'; roundRect(g, hx, hy, hw, hh, s * 0.05); g.fill(); g.restore();
    g.fillStyle = '#16141d'; roundRect(g, hx - s * 0.005, hy - s * 0.02, hw + s * 0.01, hh * 0.2, s * 0.04); g.fill(); // flat-top hair
    g.fillStyle = '#8b8fa6'; g.fillRect(hx, hy + hh * 0.12, s * 0.025, hh * 0.18); g.fillRect(hx + hw - s * 0.025, hy + hh * 0.12, s * 0.025, hh * 0.18);
    const fx = (u) => hx + hw * (0.5 + u), fy = (v) => hy + hh * (0.5 - v);
    // brows (raised) + eyes (wide)
    for (const sx of [-1, 1]) {
      g.save(); g.translate(fx(sx * 0.24), fy(0.3)); g.rotate(-sx * 0.12); g.fillStyle = '#17120f'; roundRect(g, -hw * 0.17, -hh * 0.03, hw * 0.34, hh * 0.06, 12); g.fill(); g.restore();
      g.fillStyle = '#f7f4ee'; roundRect(g, fx(sx * 0.24) - hw * 0.12, fy(0.1) - hh * 0.12, hw * 0.24, hh * 0.24, 18); g.fill();
      g.fillStyle = '#1a0f0c'; roundRect(g, fx(sx * 0.24) - hw * 0.025, fy(0.1) - hh * 0.04, hw * 0.05, hh * 0.08, 8); g.fill();
      g.strokeStyle = '#0f1220'; g.lineWidth = s * 0.014; roundRect(g, fx(sx * 0.24) - hw * 0.15, fy(0.1) - hh * 0.15, hw * 0.3, hh * 0.3, 10); g.stroke(); // glasses
    }
    g.fillStyle = '#0f1220'; g.fillRect(fx(-0.09), fy(0.12), hw * 0.18, s * 0.012);
    g.fillStyle = '#a06a45'; roundRect(g, fx(-0.05), fy(0.04), hw * 0.1, hh * 0.15, 10); g.fill();
    g.fillStyle = '#16141d'; roundRect(g, fx(-0.2), fy(-0.1), hw * 0.4, hh * 0.08, 16); g.fill(); // moustache
    g.fillStyle = '#3a0f12'; roundRect(g, fx(-0.07), fy(-0.2), hw * 0.14, hh * 0.2, 24); g.fill(); // gaping mouth
    g.fillStyle = '#c24b5b'; roundRect(g, fx(-0.05), fy(-0.32) , hw * 0.1, hh * 0.05, 8); g.fill();
    // sweat drops
    g.fillStyle = '#9fe4ff'; for (const [u, v] of [[0.43, 0.38], [-0.45, 0.2]]) { g.beginPath(); g.ellipse(fx(u), fy(v), s * 0.018, s * 0.03, 0, 0, TAU); g.fill(); }
    // meme text
    g.textAlign = 'center'; g.font = `900 ${s * 0.085}px Impact, "Arial Black", ${HEAVY}`; g.lineJoin = 'round'; g.lineWidth = s * 0.016; g.strokeStyle = '#000'; g.fillStyle = '#fff';
    g.strokeText('BIL ELEKTRIK?!', x + s / 2, y + s * 0.11); g.fillText('BIL ELEKTRIK?!', x + s / 2, y + s * 0.11);
    g.textAlign = 'left';
  }
  function drawPost(s, o) {
    const full = s.caption || '', n = Math.min(o.n ?? 1e9, full.length);
    g.fillStyle = '#0f1220'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b2030'; g.fillRect(0, 0, W, 64); trafficLights();
    g.fillStyle = '#9aa6c4'; g.font = `600 26px ${SANS}`; g.textAlign = 'center'; g.fillText('Siaran  -  Prestasi Hantaran', W / 2, 41); g.textAlign = 'left';
    // nav rail
    g.fillStyle = '#0b0e1b'; g.fillRect(0, 64, 130, H - 64);
    for (let i = 0; i < 5; i++) { g.fillStyle = i === 1 ? '#7c5cff' : '#2a3150'; roundRect(g, 38, 120 + i * 100, 54, 54, 14); g.fill(); }
    // card
    const cx = C ? 180 : 200, cy = 130, cw = C ? 1290 : W - 280, ch = H - 200;
    g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 50; g.shadowOffsetY = 12; g.fillStyle = '#1a1f35'; roundRect(g, cx, cy, cw, ch, 36); g.fill(); g.restore();
    const S = C ? 580 : 760, ix = cx + 50, iy = cy + (C ? 150 : 50);
    g.save(); roundRect(g, ix, iy, S, S, 26); g.clip();
    if (s.image === 'bosmeme') drawBosMeme(ix, iy, S); else drawProduct(ix, iy, S);
    g.restore();
    // play badge on the image
    g.fillStyle = 'rgba(0,0,0,.45)'; roundRect(g, ix + 24, iy + S - 82, 150, 58, 29); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(ix + 56, iy + S - 70); g.lineTo(ix + 56, iy + S - 36); g.lineTo(ix + 84, iy + S - 53); g.closePath(); g.fill();
    g.font = `700 28px ${SANS}`; g.fillText('0:15', ix + 98, iy + S - 42);
    // right column
    const rx = ix + S + 60, rw = cx + cw - 40 - rx;
    dot(rx + 38, iy + 40, 38, '#ff7d1c'); g.fillStyle = '#fff'; g.font = `800 34px ${HEAVY}`; g.fillText('@pejabat.kotak', rx + 96, iy + 52);
    const csz = C ? 54 : 62;
    const cap = drawWrapped(full, n, rx, iy + 170, rw, csz, { weight: 700, color: '#eef2ff', lh: 1.22, family: HEAVY });
    if (o.caret) caretAt(n ? cap.x : rx, n ? cap.y : iy + 170, csz, '#7c5cff');
    // stats
    const vy = iy + S - (C ? 150 : 250);
    g.fillStyle = '#8c97bb'; g.font = `700 32px ${SANS}`; g.fillText('TONTONAN', rx, vy - 96);
    g.fillStyle = '#ffffff'; g.font = `900 ${C ? 150 : 196}px ${HEAVY}`; g.fillText(o.views ?? s.views ?? '0', rx - 4, vy + (C ? 62 : 78));
    g.fillStyle = '#ff6fa8'; g.font = `800 ${C ? 52 : 60}px ${HEAVY}`; g.fillText('\u2665 ' + (o.likes ?? s.likes ?? '0'), rx, vy + (C ? 150 : 190));
    g.fillStyle = '#8c97bb'; g.font = `600 ${C ? 34 : 38}px ${SANS}`; g.fillText('suka', rx + (C ? 210 : 230), vy + (C ? 148 : 188));
  }

  function draw(state, opts = {}) {
    g.save(); g.globalAlpha = 1; g.shadowColor = 'transparent'; g.shadowBlur = 0; g.textAlign = 'left';
    const t = state && state.type;
    if (t === 'email') drawEmail(state, opts);
    else if (t === 'post') drawPost(state, opts);
    else if (t === 'prompt') drawPrompt(state, opts);
    else drawDoc(state || { title: 'Dokumen', body: '' }, opts);
    g.restore();
    tex.needsUpdate = true;
  }
  draw({ type: 'doc', title: 'Laporan Suku Ketiga', body: 'Rugi.' }, { caret: true });
  return { tex, canvas, draw, W, H };
}

/** the stills' texture: the document with the single word "Rugi." */
export function makeScreenTexture() { return createScreen().tex; }

/** the monitor prop: bezel, screen, stand. Returns a group whose +z faces the viewer; group.userData.screen is the screen mesh,
 *  group.userData.screenApi the createScreen() object (call .draw(state, opts) to change the content). */
export function buildMonitor(box, slab, std, glowMat, screenApi = createScreen()) {
  const g = new THREE.Group();
  const Wm = 1.62, Hh = 1.04;
  const bez = std('#10131c', { roughness: 0.35, metalness: 0.5 });
  box(g, Wm, Hh, 0.08, bez, 0, 0, 0, 0.04);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(Wm - 0.1, Hh - 0.1), new THREE.MeshBasicMaterial({ map: screenApi.tex, toneMapped: false }));
  scr.material.color.setScalar(0.92);
  scr.position.z = 0.0415; g.add(scr);
  box(g, 0.06, 0.012, 0.01, glowMat('#19e3ff', 2.0), 0, -Hh / 2 + 0.028, 0.045, 0.004);
  box(g, 0.14, 0.34, 0.07, bez, 0, -Hh / 2 - 0.16, -0.06, 0.02);
  box(g, 0.62, 0.04, 0.38, bez, 0, -Hh / 2 - 0.34, -0.02, 0.018);
  g.userData.screen = scr; g.userData.screenApi = screenApi; g.userData.W = Wm; g.userData.H = Hh; g.userData.baseY = Hh / 2 + 0.34;
  return g;
}
