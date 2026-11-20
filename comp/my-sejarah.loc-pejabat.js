// my-sejarah location "pejabat": the base s1-kotak night office, plus
//  - animated monitor screens (type "anim", drawn by my-sejarah.screen.js) driven by the local time of the current screen,
//  - lights that dim from the first story line marked "lights": "dim" (the cliffhanger).
import * as base from './s1-kotak.loc-pejabat.js';
export const screenOpts = base.screenOpts;

export function build(ctx) {
  const L = base.build(ctx);
  const { world, screen, story, timing } = ctx;
  const lines = (story && story.lines) || [], tl = (timing && timing.lines) || [];
  // start time of the run of consecutive lines that show the same screen (the animation restarts when the screen changes)
  const runStart = tl.map((T, i) => { let k = i; while (k > 0 && lines[k - 1].screen === lines[i].screen) k--; return tl[k] ? tl[k].start : 0; });
  const lineAt = (t) => { let k = 0; for (let i = 0; i < tl.length; i++) if (t >= (i === 0 ? 0 : tl[i].start)) k = i; return k; };
  const dimIdx = lines.findIndex((l) => l.lights === 'dim');
  const dimT = dimIdx >= 0 && tl[dimIdx] ? tl[dimIdx].start : Infinity;
  const lights = [];
  world.traverse((o) => { if (o.isLight) lights.push([o, o.intensity]); });

  const baseUpdate = L.update.bind(L);
  L.update = (t, S) => {
    baseUpdate(t, S);
    if (tl.length && screen.tick) {
      const i = lineAt(t), sc = story.screens[lines[i].screen];
      if (sc && sc.type === 'anim') screen.tick(sc, t - runStart[i]);
    }
    const d = Math.min(1, Math.max(0, (t - dimT) / 0.6));
    const f = 1 - 0.55 * d * d * (3 - 2 * d);
    for (const [o, k] of lights) o.intensity = k * f;
  };
  return L;
}
