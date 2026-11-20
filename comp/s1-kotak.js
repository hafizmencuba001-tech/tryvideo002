// s1-kotak "Pejabat": box robots in a dark neon night office. Pure function of t (stills: 0.5 WIDE, 1.5 CLOSE).
// World/cast/set/screen/post builders live in s1-kotak.world.js and friends; story pages (s1-story.js) reuse them.
import * as THREE from 'three';
import { V3 } from './s1-kotak.lib.js';
import { createWorld, poseActor } from './s1-kotak.world.js';
import * as PEJABAT from './s1-kotak.loc-pejabat.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
V.dur = 2;

const W = createWorld({ canvas: document.getElementById('gl'), loc: PEJABAT });
const { bos, intern, world } = W;
const set = W.loc.set;

// ---- shots table (stills) ------------------------------------------------------------------------------------------------
const SCREEN = (x = 0, y = 0) => set.monitor.localToWorld(V3(x, y, 0.06));
export const shots = {
  wide: {
    cam: { pos: [1.1, 1.85, 7.5], target: [0.22, 1.0, -1.4], fov: 34 },
    dof: { focus: 8.8, range: 3.2, maxCoc: 0.9 },
    speaker: 'bos',
    bos: { pos: [1.3, 0, -1.8], yaw: -0.5, lean: 0.2, sway: 0, headYaw: 0.4, headPitch: 0.05, headRoll: 0.05, emotion: 'annoyed',
      armR: { aim: () => SCREEN(0.17, -0.2), pole: [-0.7, -0.6, -0.1], point: true }, armL: { rest: [0.1, 0, -0.28], bend: -0.6 } },
    intern: { pos: [0.55, 0.555, -1.0], yaw: -0.4, lean: -0.12, headYaw: 0.25, headPitch: -0.14, headRoll: -0.06, emotion: 'happy',
      armR: { hip: true }, armL: { rest: [-0.3, 0, 0.55], bend: -0.5 } },
  },
  close: {
    cam: { pos: [1.0, 2.2, 1.8], target: [-0.35, 1.4, -2.0], fov: 38, yawOff: -0.05 },
    dof: { focus: 3.6, range: 1.5, maxCoc: 0.5 },
    speaker: 'intern',
    bos: { pos: [1.3, 0, -1.8], yaw: -0.5, lean: 0.2, sway: 0, headYaw: 0.4, headPitch: 0.05, headRoll: 0.05, emotion: 'annoyed',
      armR: { aim: () => SCREEN(0.17, -0.2), pole: [-0.7, -0.6, -0.1], point: true }, armL: { rest: [0.1, 0, -0.28], bend: -0.6 } },
    intern: { pos: [0.64, 0.555, -0.95], yaw: -0.1, lean: -0.05, headYaw: 0.05, headPitch: -0.06, headRoll: 0.08, emotion: 'happy',
      armR: { hip: true }, armL: { rest: [-0.3, 0, 0.55], bend: -0.5 } },
  },
};
export const shotAt = (t) => (t < 1 ? 'wide' : 'close');

V.onFrame = (t) => {
  const S = shots[shotAt(t)];
  const talk = (a) => clamp(0.5 + 0.45 * Math.sin(t * 19 + a), 0, 1);
  const bosOpen = S.speaker === 'bos' ? talk(0) : 0, inOpen = S.speaker === 'intern' ? talk(1.1) : 0;
  world.scale.set(1, 1, 1); world.updateMatrixWorld(true);
  poseActor(bos, S.bos, t, bosOpen, 'bos');
  poseActor(intern, S.intern, t, inOpen, 'intern');
  bos.setFace(S.bos.emotion, bosOpen, 0);
  intern.setFace(S.intern.emotion, inOpen, 0);
  set.motes.position.y = Math.sin(t * 0.7) * 0.03;
  W.render(S.cam, S.dof);
};
window.__shots = shots;
