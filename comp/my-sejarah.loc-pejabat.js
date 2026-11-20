// my-sejarah location "pejabat": the base s1-kotak night office, plus
//  - animated monitor screens (type "anim", drawn by my-sejarah.screen.js) driven by the local time of the current screen,
//  - a "full" shot: the camera looks at a vertical 1080x1920 panel (far behind the set) that shows the same animation full-frame,
//  - lights that dim from the first story line marked "lights": "dim" (the cliffhanger).
import * as THREE from 'three';
import { canvasTex } from './s1-kotak.lib.js';
import * as base from './s1-kotak.loc-pejabat.js';
import { createFullScreen } from './my-sejarah.screen.js';
export const screenOpts = base.screenOpts;

const FULL_Z = 40, FULL_D = 5, FULL_FOV = 40, OVERSIZE = 1.02; // full-frame lines use no camera move, so the panel exactly fills the frame

export function build(ctx) {
  const L = base.build(ctx);
  const { world, screen, story, timing } = ctx;
  const lines = (story && story.lines) || [], tl = (timing && timing.lines) || [];
  const runStart = tl.map((T, i) => { let k = i; while (k > 0 && lines[k - 1].screen === lines[i].screen) k--; return tl[k] ? tl[k].start : 0; });
  const lineAt = (t) => { let k = 0; for (let i = 0; i < tl.length; i++) if (t >= (i === 0 ? 0 : tl[i].start)) k = i; return k; };
  const dimIdx = lines.findIndex((l) => l.lights === 'dim');
  const dimT = dimIdx >= 0 && tl[dimIdx] ? tl[dimIdx].start : Infinity;
  const lights = [];
  world.traverse((o) => { if (o.isLight) lights.push([o, o.intensity]); });

  // ---- full-frame panel + shot ----
  const full = createFullScreen();
  const ph = 2 * FULL_D * Math.tan((FULL_FOV / 2) * Math.PI / 180) * OVERSIZE, pw = ph * full.W / full.H;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph),
    new THREE.MeshBasicMaterial({ map: full.tex, toneMapped: false, fog: false }));
  panel.position.set(0, 1.5, FULL_Z - FULL_D); panel.visible = false; panel.renderOrder = 10;
  world.add(panel);
  L.shots.full = { cam: { pos: [0, 1.5, FULL_Z], target: [0, 1.5, FULL_Z - 10], fov: FULL_FOV }, push: 0.02, coc: 0 };
  // ---- staging for a professor and his assistant (instead of a boss and an intern) ----
  L.shots.two = { ...L.shots.two, cam: { ...L.shots.two.cam, pos: [1.5, 1.85, 5.2], target: [1.0, 1.52, -1.5] } }; // a bit wider and right: the professor is no longer cut off
  const baseStage = L.stage;
  L.stage = (shot, speaker, ...rest) => {
    const r = baseStage(shot, speaker, ...rest);
    if (shot === 'full') { r.showB = false; r.showI = false; return r; }
    const B = r.B;
    if (shot === 'wide') B.pos = [1.38, 0, -1.85]; // faces no longer overlap
    // relaxed arms instead of the boss's hand on the hip; a lecturing hand while he talks
    if (B.armL && B.armL.hip) B.armL = speaker === 'bos' ? { rest: [-0.75, 0, 0.18], bend: -1.25 } : { rest: [0.05, 0, 0.16], bend: -0.25 };
    if (B.armR && B.armR.hip) B.armR = { rest: [0.05, 0, -0.16], bend: -0.25 };
    return r;
  };

  // ---- live wall clock: starts at 11:48:00 PM and runs with the story time ----
  const CLOCK_START = 23 * 3600 + 48 * 60; // seconds since midnight
  const clockMesh = L.set && L.set.clock && L.set.clock.children.find((o) => o.isMesh && o.geometry.parameters && o.geometry.parameters.width === 0.66);
  const clockTex = canvasTex(512, 320, null);
  if (clockMesh) { clockMesh.material.map = clockTex.tex; clockMesh.material.needsUpdate = true; }
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  let clockKey = '';
  function drawClock(t) {
    const secs = Math.floor(CLOCK_START + Math.max(0, t)), h24 = Math.floor(secs / 3600) % 24, m = Math.floor(secs / 60) % 60, sec = secs % 60;
    const h12 = h24 % 12 || 12, pm = h24 >= 12, colon = (t % 1) < 0.5;
    const key = [h12, m, sec, colon].join();
    if (key === clockKey) return; clockKey = key;
    const g = clockTex.g;
    g.save(); g.shadowBlur = 0; g.fillStyle = '#080a16'; g.fillRect(0, 0, 512, 320);
    const seg = (x, y, w, h, on) => { g.fillStyle = on ? '#ff5a3a' : 'rgba(255,90,58,.07)'; g.shadowColor = '#ff5a3a'; g.shadowBlur = on ? 22 : 0; g.fillRect(x, y, w, h); };
    const digit = (x, y, ch) => { const on = SEG[ch] || '', T = 20, Wd = 64, Hd = 80; const s2 = (k, ax, ay, w, h) => seg(ax, ay, w, h, on.includes(k));
      s2('a', x + T, y, Wd, T); s2('g', x + T, y + Hd, Wd, T); s2('d', x + T, y + 2 * Hd, Wd, T);
      s2('f', x, y + T, T, Hd - T / 2 + 2); s2('b', x + Wd + T, y + T, T, Hd - T / 2 + 2); s2('e', x, y + Hd + T, T, Hd - T / 2 + 2); s2('c', x + Wd + T, y + Hd + T, T, Hd - T / 2 + 2); };
    const y0 = 52;
    if (h12 >= 10) digit(26, y0, 1); digit(140, y0, h12 % 10); digit(292, y0, Math.floor(m / 10)); digit(396, y0, m % 10);
    g.fillStyle = colon ? '#ff5a3a' : 'rgba(255,90,58,.12)'; g.shadowColor = '#ff5a3a'; g.shadowBlur = colon ? 20 : 0; g.fillRect(262, y0 + 52, 16, 16); g.fillRect(262, y0 + 112, 16, 16);
    g.shadowBlur = 0; g.fillStyle = '#ff5a3a'; g.font = '700 38px Menlo, monospace'; g.textAlign = 'left'; g.fillText(pm ? 'PM' : 'AM', 24, 300);
    g.textAlign = 'right'; g.fillText(':' + String(sec).padStart(2, '0'), 488, 300);
    g.restore();
    clockTex.tex.needsUpdate = true;
  }
  drawClock(0);

  const baseUpdate = L.update.bind(L);
  L.update = (t, S) => {
    baseUpdate(t, S);
    drawClock(t);
    const i = tl.length ? lineAt(t) : 0, sc = tl.length ? story.screens[lines[i].screen] : null;
    if (sc && sc.type === 'anim') {
      const lt = t - runStart[i];
      if (screen.tick) screen.tick(sc, lt);
      if (S.shot === 'full') full.draw(sc, lt);
    }
    panel.visible = S.shot === 'full';
    const d = Math.min(1, Math.max(0, (t - dimT) / 0.6));
    const f = 1 - 0.55 * d * d * (3 - 2 * d);
    for (const [o, k] of lights) o.intensity = k * f;
  };
  return L;
}
