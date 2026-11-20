// Tiny deterministic motion engine for 1080x1920 ad videos.
// Every visual is a pure function of time t, so the renderer can seek frame by frame (render.mjs)
// and the page can also play live in a browser for previewing (open the html with ?play).
//
// Clip frames are JPEG sequences extracted by render.mjs into frames/<clip>/f00001.jpg (30 fps).
// window.__CLIPS = { 'upkk/u-home': 214, ... } (frame counts) is injected by render.mjs or loaded from frames/manifest.js.
(function () {
  const FPS = 30;
  const scenes = [];
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const V = {
    FPS,
    dur: 20,
    /** frame size [w, h]; default 1080x1920. A landscape comp calls V.setSize(1920, 1080) before building its scenes; render.mjs reads V.size for the viewport */
    size: [1080, 1920],
    setSize(w, h) {
      V.size = [w, h];
      const st = document.createElement('style');
      st.textContent = `html, body, #stage { width: ${w}px; height: ${h}px; }`;
      document.head.appendChild(st);
    },
    clamp,
    lerp: (a, b, x) => a + (b - a) * x,
    /** 0..1 ramp of t between a and b */
    k: (t, a, b) => clamp((t - a) / (b - a)),
    eo: (x) => 1 - Math.pow(1 - clamp(x), 3), // ease out cubic
    eio: (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    back: (x) => { x = clamp(x); const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    $: (s, r = document) => r.querySelector(s),
    $$: (s, r = document) => [...r.querySelectorAll(s)],
    /** register a scene: element shown for t in [a,b), fn(lt, len, t) called every frame while visible */
    scene(el, a, b, fn) { if (typeof el === 'string') el = V.$(el); scenes.push({ el, a, b, fn }); return el; },
    /** opacity envelope: fade in over fin, out over fout at the end of [0,len] */
    env(lt, len, fin = 0.3, fout = 0.3) { return Math.min(fin ? clamp(lt / fin) : 1, fout ? clamp((len - lt) / fout) : 1); },
    /** rise-in: returns css transform+opacity for an element appearing at time a */
    rise(el, lt, a, { dy = 40, d = 0.45, out = 1e9, od = 0.3, scale = 0 } = {}) {
      if (el.classList.contains('ncap')) el = el.parentElement; // inline caption boxes can't transform: move their wrapper
      const p = V.eo(V.k(lt, a, a + d));
      const q = 1 - V.k(lt, out, out + od);
      el.style.opacity = Math.min(p, q);
      el.style.transform = `translateY(${(1 - p) * dy}px) scale(${1 - scale * (1 - p)})`;
    },
    /** set an <img> to frame of clip at clip time ct (seconds); holds first/last frame outside range */
    clip(img, name, ct) {
      const n = (window.__CLIPS || {})[name];
      if (!n) { img.removeAttribute('src'); img.style.background = '#888'; return; }
      const f = clamp(Math.round(ct * FPS), 0, n - 1) + 1;
      const src = `frames/${name}/f${String(f).padStart(5, '0')}.jpg`;
      if (img.getAttribute('src') !== src) { img.setAttribute('src', src); pending.push(img); }
    },
    /** play a list of clip shots [{c:'upkk/u-home', from:0.5, len:3}] back to back in one <img>; returns {i, lt} of the active shot */
    seq(img, list, lt) {
      let acc = 0;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (lt < acc + s.len || i === list.length - 1) { V.clip(img, s.c, (s.from || 0) + (lt - acc) * (s.speed || 1)); return { i, lt: lt - acc, at: acc }; }
        acc += s.len;
      }
    },
    /** sound cues for taps/answers inside the shots (from recorder marks): taps -> 'tap', correct -> chime, wrong -> 'wrong' */
    shotSfx(list, at0) {
      const out = []; let acc = 0;
      for (const s of list) {
        const from = s.from || 0, sp = s.speed || 1, end = from + s.len * sp;
        for (const [t, label] of (window.__MARKS || {})[s.c] || []) {
          if (t < from || t >= end || !/tap|answered/i.test(label)) continue;
          const at = at0 + acc + (t - from) / sp;
          out.push({ src: 'sfx/tap.wav', at, vol: 0.6 });
          if (/wrong/i.test(label)) out.push({ src: 'sfx/wrong.wav', at: at + 0.08, vol: 0.35 });
          else if (/correct|answered/i.test(label)) out.push({ src: 'sfx/correct.wav', at: at + 0.06, vol: 0.38 });
        }
        acc += s.len;
      }
      return out;
    },
    total: (list) => list.reduce((a, s) => a + s.len, 0),
    clipLen: (name) => ((window.__CLIPS || {})[name] || 0) / FPS,
    async seek(t) {
      V.t = t; // current frame time (read by comp/camera.js)
      pending = [];
      for (const s of scenes) {
        const on = t >= s.a && t < s.b;
        s.el.style.display = on ? '' : 'none';
        if (on && s.fn) s.fn(t - s.a, s.b - s.a, t);
      }
      if (V.onFrame) V.onFrame(t);
      await Promise.all(pending.map((im) => (im.complete && im.naturalWidth ? null : im.decode().catch(() => {}))));
      await document.fonts.ready;
    },
  };
  let pending = [];
  window.V = V;

  // live preview: ?play (loops), ?t=12.5 (still)
  window.addEventListener('load', () => {
    const q = new URLSearchParams(location.search);
    if (q.has('t')) V.seek(+q.get('t'));
    else if (q.has('play')) {
      const t0 = performance.now();
      const tick = () => { V.seek(((performance.now() - t0) / 1000) % V.dur); requestAnimationFrame(tick); };
      tick();
    } else V.seek(0);
  });
})();
