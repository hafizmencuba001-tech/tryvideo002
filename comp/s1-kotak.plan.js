// Pure planning helpers shared by the story player (browser) and tools/timing.mjs (node, for the sfx track): no three.js, no DOM.
// All times are absolute seconds in the reel.

/** the text of a screen that gets typed (progressively revealed) */
export function typeText(s) {
  if (!s) return '';
  if (s.type === 'doc' || s.type === 'email') return s.body || '';
  if (s.type === 'post') return s.caption || '';
  if (s.type === 'prompt') return (s.lines || []).join('\n');
  return '';
}
/** number of leading characters two typed texts share (continue typing instead of retyping from empty) */
export function commonPrefix(a, b) { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; }

/** typing reveal per line: when a `type`/`boss_types` line shows a different screen than the previous line, the new text is typed
 *  over the first 60% of a spoken line (85% of a silent beat). Returns { [lineIndex]: { n0, n1, t0, t1 } }. */
export function typingPlan(story, lines) {
  const out = {};
  story.lines.forEach((L, i) => {
    if (!(L.action === 'type' || L.action === 'boss_types')) return;
    const pName = i > 0 ? story.lines[i - 1].screen : null;
    if (L.screen === pName) return;
    const sc = story.screens[L.screen], prev = pName ? story.screens[pName] : null, full = typeText(sc);
    let n0 = prev && prev.type === sc.type ? commonPrefix(typeText(prev), full) : 0;
    if (n0 >= full.length) n0 = 0; // new text is a prefix of the old one: select all and retype
    const T = lines[i];
    out[i] = { n0, n1: full.length, t0: T.start, t1: T.start + T.dur * (T.who ? 0.6 : 0.85) };
  });
  return out;
}

/** lines where the intern does its small happy hop (its face is `happy` at line start and it is speaking or just turned happy) */
export function hopLines(story) {
  const emo = (L) => (L.who === 'intern' ? L.face : L.who === 'bos' ? L.listener : L.listener);
  const hops = [];
  story.lines.forEach((L, i) => { if (emo(L) === 'happy' && (L.who === 'intern' || i === 0 || emo(story.lines[i - 1]) !== 'happy')) hops.push(i); });
  return hops;
}

/** printer_spew schedule (sheets per second during the beat, a slow dribble afterwards) */
export function printSchedule(story, lines) {
  const i = story.lines.findIndex((l) => l.action === 'printer_spew');
  return i < 0 ? null : { line: i, t0: lines[i].start + 0.1, t1: lines[i].end - 0.1, rateBurst: 15, rateTail: 1.6 };
}
export const SLAM_DELAY = 0.32; // seconds after the line's cut when the fists hit the desk

/** SFX for a story, synthesised by tools/timing.mjs (this is the per-setup plan module API: see SETUPS.md "Story player contract").
 *  ctx = { story, lines (TIMING.lines), total (reel seconds), SR, add(t, fn(x, k), len, amp), rnd() (seeded), click(t, amp) }
 *  add() mixes fn(x = seconds since t) * amp into the track at time t for len seconds. The result is peak-normalised by the caller. */
export function sfx(ctx) {
  const { story, lines, total, add, rnd, click } = ctx;
  const typing = typingPlan(story, lines);
  for (const P of Object.values(typing)) {
    const n = P.n1 - P.n0; if (n <= 0) continue;
    let last = -1;
    for (let k = 0; k <= n; k++) { const t = P.t0 + (k / n) * (P.t1 - P.t0); if (t - last < 0.045) continue; last = t; click(t, 0.6 + rnd() * 0.4); }
  }
  story.lines.forEach((L, i) => { if (L.action === 'slam_desk') {
    const t = lines[i].start + SLAM_DELAY;
    add(t, (x) => Math.sin(2 * Math.PI * (62 - 22 * Math.min(1, x / 0.3)) * x) * Math.exp(-x / 0.13), 0.6, 0.95);
    let lp = 0; add(t, () => { lp += (rnd() * 2 - 1 - lp) * 0.12; return lp * 3; }, 0.25, 0.55 * 1);
    for (const [dt, a] of [[0.07, 0.18], [0.13, 0.1]]) click(t + dt, a * 3);
  } });
  const ps = printSchedule(story, lines);
  if (ps) {
    const nb = Math.round(ps.rateBurst * (ps.t1 - ps.t0));
    let lp = 0;
    add(ps.t0 - 0.05, (x) => { lp += (rnd() * 2 - 1 - lp) * 0.18; const env = Math.min(1, x / 0.15) * Math.min(1, ((ps.t1 - ps.t0) + 0.5 - x) / 0.35); return lp * (0.55 + 0.45 * Math.sin(2 * Math.PI * 18 * x)) * Math.max(0, env) * 1.4 + Math.sin(2 * Math.PI * 95 * x) * 0.05 * Math.max(0, env); }, ps.t1 - ps.t0 + 0.55, 0.45);
    for (let i = 0; i < 150; i++) {
      const t = i < nb ? ps.t0 + i / ps.rateBurst : ps.t1 + (i - nb + 1) / ps.rateTail; if (t > total) break;
      let hp = 0; add(t, (x) => { const n = rnd() * 2 - 1; hp += (n - hp) * 0.5; return (n - hp) * Math.sin(Math.min(1, x / 0.05) * Math.PI); }, 0.05, i < nb ? 0.22 : 0.32);
    }
  }
  for (const i of hopLines(story)) { const t = i === 0 ? lines[0].start : lines[i].start; add(t, (x) => Math.sin(2 * Math.PI * (260 * x + 900 * x * x)) * Math.exp(-x / 0.07), 0.2, 0.22); }

  // ---- ambience per location (kept quiet under the voices) ----
  const locId = story.location || 'pejabat';
  const noise = (fn, t0, len, amp) => { let lp = 0, lp2 = 0; add(t0, (x, k) => fn(x, rnd() * 2 - 1), len, amp); };
  if (locId === 'mamak') {
    let a = 0, b = 0, c = 0;
    add(0, (x) => { const n = rnd() * 2 - 1; a += (n - a) * 0.12; b += (a - b) * 0.2; return (a - b) * 5 * (0.7 + 0.3 * Math.sin(x * 0.7)) * (0.6 + 0.4 * Math.sin(x * 3.3 + 1)); }, total, 0.1); // crowd murmur
    add(0, (x) => { const n = rnd() * 2 - 1; c += (n - c) * 0.3; return c * Math.max(0, Math.sin(x * 2 * Math.PI * 5.2) * Math.sin(x * 2 * Math.PI * 0.8 + 2)) * 0.9; }, total, 0.05); // TV commentary
    for (const t of [6.2, 17.5]) { let lp = 0; add(t, (x) => { const n = rnd() * 2 - 1; lp += (n - lp) * 0.2; return lp * Math.sin(Math.min(1, x / 0.4) * Math.PI) * 3; }, 1.6, 0.12); } // crowd cheer swell
    add(0, (x) => Math.sin(x * 2 * Math.PI * 62) * 0.5 + Math.sin(x * 2 * Math.PI * 124) * 0.2, total, 0.035); // fan + tube hum
    let cs = 3.1; while (cs < total) { const f = 2400 + rnd() * 1600; add(cs, (x) => Math.sin(2 * Math.PI * f * x) * Math.exp(-x / 0.05), 0.2, 0.1); cs += 3.5 + rnd() * 5; } // glass clinks
    story.lines.forEach((L, i) => { if (L.action === 'slam_desk') add(lines[i].start + SLAM_DELAY, (x) => Math.sin(2 * Math.PI * 3100 * x) * Math.exp(-x / 0.09) + Math.sin(2 * Math.PI * 4700 * x) * Math.exp(-x / 0.06), 0.35, 0.3); });
  } else if (locId === 'rumah') {
    add(0, (x) => Math.sin(x * 2 * Math.PI * 4300) * Math.max(0, Math.sin(x * 2 * Math.PI * 27)) * (Math.sin(x * 2 * Math.PI * 0.6) > -0.2 ? 1 : 0.2), total, 0.022); // crickets
    add(0, (x) => Math.sin(x * 2 * Math.PI * 50) * 0.6 + Math.sin(x * 2 * Math.PI * 100) * 0.3, total, 0.03); // fridge hum
    for (let t = 0.7; t < total; t += 1.0) click(t, 0.25); // wall clock tick
    add(0, (x) => Math.sin(x * 2 * Math.PI * 26) * (0.5 + 0.5 * Math.sin(x * 2 * Math.PI * 0.35)) , total, 0.04); // cat purr
  } else if (locId === 'bilik_mesyuarat') {
    let a = 0, b = 0;
    add(0, () => { const n = rnd() * 2 - 1; a += (n - a) * 0.06; b += (a - b) * 0.1; return a - b; }, total, 0.2); // air-con rush
    add(0, (x) => Math.sin(x * 2 * Math.PI * 120) * 0.4 + Math.sin(x * 2 * Math.PI * 240) * 0.2, total, 0.03); // projector fan + ballast hum
    for (let t = 0.8; t < total; t += 1.0) click(t, 0.18); // wall clock tick
    let tr = 4.3; while (tr < total - 1) { let lp = 0; add(tr, (x) => { const n = rnd() * 2 - 1; lp += (n - lp) * 0.04; return lp * Math.sin(Math.min(1, x / 1.2) * Math.PI) * 4; }, 1.6, 0.05); tr += 6 + rnd() * 6; } // far traffic swell through the glass
  } else {
    let a = 0; add(0, () => { a += (rnd() * 2 - 1 - a) * 0.05; return a; }, total, 0.12);
    add(0, (x) => Math.sin(x * 2 * Math.PI * 58) * 0.5, total, 0.03);
  }
}
