// my-sejarah overlay: HTML layer drawn over the 3D canvas (the renderer screenshots the page, so it ends up in the video).
//  - channel watermark (top left), TikTok-style subtitles with the current word highlighted, name labels on first appearance,
//  - branded end card on the last line.
// Everything is a pure function of the story time t (update(t) is called every frame by the location module).

export const BRAND = { name: 'GARAJ SEJARAH', global: 'HISTORY GARAGE', tagline: 'Sejarah automotif, satu blok demi satu blok', gold: '#FFC23A', cyan: '#19E3FF', navy: '#0C1430' };

/** the channel logo: a blocky gear with a clock hand inside (SVG string, any size) */
export function logoSVG(size = 120) {
  const teeth = Array.from({ length: 8 }, (_, k) => {
    const a = (k / 8) * 360;
    return `<rect x="52" y="6" width="16" height="22" rx="3" fill="${BRAND.navy}" transform="rotate(${a} 60 60)"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">
    <rect x="4" y="4" width="112" height="112" rx="26" fill="${BRAND.gold}"/>
    <rect x="4" y="96" width="112" height="20" rx="10" fill="#d99a16" opacity=".55"/>
    ${teeth}
    <circle cx="60" cy="60" r="34" fill="${BRAND.navy}"/>
    <circle cx="60" cy="60" r="24" fill="${BRAND.cyan}"/>
    <rect x="57" y="40" width="6" height="22" rx="3" fill="${BRAND.navy}"/>
    <rect x="58" y="57" width="16" height="6" rx="3" fill="${BRAND.navy}" transform="rotate(35 60 60)"/>
    <circle cx="60" cy="60" r="5" fill="${BRAND.navy}"/>
  </svg>`;
}

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

export function createOverlay(story, timing) {
  const stage = document.getElementById('stage') || document.body;
  const root = document.createElement('div');
  root.id = 'my-ovl';
  root.style.cssText = 'position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none;z-index:50;font-family:Jakarta,Lexend,sans-serif;';
  root.innerHTML = `
    <style>
      #my-ovl .wm{position:absolute;left:44px;top:196px;display:flex;align-items:center;gap:14px;opacity:.9}
      #my-ovl .wm span{font-weight:800;font-size:30px;letter-spacing:2px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7)}
      #my-ovl .sub{position:absolute;left:70px;right:70px;top:1450px;text-align:center;font-weight:800;font-size:62px;line-height:1.18;word-spacing:14px;color:#fff;
        -webkit-text-stroke:10px #0a0d1c;paint-order:stroke fill;text-shadow:0 6px 18px rgba(0,0,0,.55)}
      #my-ovl .sub b{color:${BRAND.gold};font-weight:800}
      #my-ovl .lab{position:absolute;left:56px;top:1236px;display:flex;flex-direction:column;gap:6px;padding:18px 30px 20px 26px;border-left:12px solid ${BRAND.gold};
        background:rgba(8,11,28,.86);border-radius:0 20px 20px 0}
      #my-ovl .lab .n{font-weight:800;font-size:50px;color:#fff;letter-spacing:1px}
      #my-ovl .lab .r{font-family:Lexend,sans-serif;font-weight:600;font-size:32px;color:${BRAND.cyan}}
      #my-ovl .end{position:absolute;left:0;right:0;top:1170px;display:flex;flex-direction:column;align-items:center;gap:22px}
      #my-ovl .end .row{display:flex;align-items:center;gap:22px}
      #my-ovl .end .nm{font-weight:800;font-size:76px;color:#fff;letter-spacing:3px}
      #my-ovl .end .tg{font-family:Lexend,sans-serif;font-weight:600;font-size:34px;color:#b9c3e6}
      #my-ovl .end .cta{margin-top:8px;padding:20px 44px;border-radius:60px;background:${BRAND.gold};color:#1a1206;font-weight:800;font-size:46px}
    </style>
    <div class="wm">${logoSVG(64)}<span>${BRAND.name}</span></div>
    <div class="lab"><div class="n"></div><div class="r"></div></div>
    <div class="sub"></div>
    <div class="end"><div class="row">${logoSVG(130)}<div class="nm">${BRAND.name}</div></div><div class="tg">${BRAND.tagline}</div><div class="cta">Ikuti untuk Part 2 &rarr;</div></div>`;
  stage.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const wm = $('.wm'), sub = $('.sub'), lab = $('.lab'), labN = $('.lab .n'), labR = $('.lab .r'), end = $('.end');

  const lines = story.lines, tl = timing.lines, last = lines.length - 1;
  // per spoken line: subtitle chunks (<= 5 words, broken after punctuation) with word timings proportional to their length
  const plan = lines.map((L, i) => {
    if (!L.who || !tl[i]) return null;
    const words = String(L.sub || L.text).split(/\s+/).filter(Boolean);
    const wts = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 2), tot = wts.reduce((a, b) => a + b, 0);
    const T0 = tl[i].start, D = tl[i].dur;
    let acc = 0; const times = wts.map((w) => { const a = T0 + (acc / tot) * D; acc += w; return [a, T0 + (acc / tot) * D]; });
    const chunks = []; let cur = [];
    words.forEach((w, k) => { cur.push(k); if (cur.length >= 5 || /[.!?,]$/.test(w) && cur.length >= 2) { chunks.push(cur); cur = []; } });
    if (cur.length) chunks.push(cur);
    return { words, times, chunks };
  });
  const lineAt = (t) => { let k = 0; for (let i = 0; i < tl.length; i++) if (t >= (i === 0 ? 0 : tl[i].start)) k = i; return k; };
  let lastKey = '';

  return {
    update(t, shot) {
      const i = lineAt(t), L = lines[i], P = plan[i];
      // subtitles
      let html = '';
      if (P) {
        let ci = P.chunks.findIndex((c) => t < P.times[c[c.length - 1]][1]);
        if (ci < 0) ci = P.chunks.length - 1;
        html = P.chunks[ci].map((k) => (t >= P.times[k][0] && t < P.times[k][1] ? `<b>${P.words[k]}</b>` : P.words[k])).join(' ');
      }
      // name label (first appearance), slides in and out
      const lt = t - (tl[i] ? tl[i].start : 0);
      const showLab = L.label && lt < 3.2, k = showLab ? ease(lt / 0.35) * (1 - ease((lt - 2.8) / 0.4)) : 0;
      const isEnd = i === last && L.screen === 'bersambung', ek = isEnd ? ease((lt - 0.4) / 0.5) : 0;
      const key = [i, html, k.toFixed(2), ek.toFixed(2), shot].join('|');
      if (key === lastKey) return; lastKey = key;
      sub.innerHTML = html; sub.style.display = html ? 'block' : 'none';
      lab.style.display = k > 0.001 ? 'flex' : 'none';
      if (k > 0.001) { labN.textContent = L.label.name; labR.textContent = L.label.role; lab.style.transform = `translateX(${(k - 1) * 120}%)`; lab.style.opacity = String(k); }
      end.style.display = ek > 0.001 ? 'flex' : 'none'; end.style.opacity = String(ek); end.style.transform = `translateY(${(1 - ek) * 40}px)`;
      wm.style.display = isEnd ? 'none' : 'flex';
    },
  };
}
