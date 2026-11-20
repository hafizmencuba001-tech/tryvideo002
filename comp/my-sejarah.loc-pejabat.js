// my-sejarah location "pejabat": the base s1-kotak night office, plus
//  - animated monitor screens (type "anim", drawn by my-sejarah.screen.js) driven by the local time of the current screen,
//  - a "full" shot: the camera looks at a vertical 1080x1920 panel (far behind the set) that shows the same animation full-frame,
//  - lights that dim from the first story line marked "lights": "dim" (the cliffhanger).
import * as THREE from 'three';
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
  const baseStage = L.stage;
  L.stage = (shot, ...rest) => { const r = baseStage(shot, ...rest); if (shot === 'full') { r.showB = false; r.showI = false; } return r; };

  const baseUpdate = L.update.bind(L);
  L.update = (t, S) => {
    baseUpdate(t, S);
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
