// Location "pejabat": the night neon office (s1-e1 and the s1-kotak stills). Reference implementation of the location interface
// (see s1-kotak.world.js createWorld for how a location is used and s1-story.js for what the player expects from it).
import * as THREE from 'three';
import { V3 } from './s1-kotak.lib.js';
import { buildSet, makeFloor, buildEnvScene, NO_MIRROR, NO_DEPTH } from './s1-kotak.set.js';
import { makePrinter } from './s1-kotak.props.js';
import { printSchedule } from './s1-kotak.plan.js';

export const screenOpts = { compact: true }; // keep screen content in the left ~70% (over-the-shoulder shots hide the right side)
const FOG = '#0c1030', FOGDEN = 0.034;

export function build(ctx) {
  const { world, post, screen, story, timing } = ctx;
  const inStory = !!story;
  const floor = makeFloor(post.rtRefl.texture, FOG, FOGDEN, { carpetZ1: inStory ? 2.6 : undefined });
  const set = buildSet(world, floor, { screen, cab: inStory ? [-0.65, -0.5] : undefined, story: inStory });

  // ---- lights ----
  const L = (l) => { world.add(l); if (l.target) world.add(l.target); return l; };
  L(new THREE.HemisphereLight('#4a58b8', '#1a0d33', 0.55));
  const monKey = L(new THREE.SpotLight('#a9c8ff', 7, 0, 0.95, 0.9, 1));
  {
    const mp = set.monitor.position, n = V3(Math.sin(0.42), 0, Math.cos(0.42));
    monKey.position.set(mp.x + n.x * 0.9, mp.y + 0.1, mp.z + n.z * 0.9);
    monKey.target.position.set(0.8, 1.2, -1.0);
    monKey.castShadow = true; monKey.shadow.mapSize.set(2048, 2048); monKey.shadow.bias = -0.0004; monKey.shadow.normalBias = 0.02; monKey.shadow.radius = 5;
  }
  const magenta = L(new THREE.SpotLight('#ff2fb4', 150, 0, 0.8, 0.9, 2)); magenta.position.set(-3.2, 3.2, -2.8); magenta.target.position.set(0.9, 1.3, -1.1);
  const cyan = L(new THREE.SpotLight('#2f9bff', 90, 0, 0.8, 0.9, 2)); cyan.position.set(3.6, 3.0, -3.2); cyan.target.position.set(0.6, 1.3, -1.0);
  const fill = L(new THREE.DirectionalLight('#9fb0ff', 0.85)); fill.position.set(1.5, 3.5, 7); fill.target.position.set(0.5, 1.2, -1);
  const lampL = L(new THREE.PointLight('#ffb36b', 6, 6, 2)); lampL.position.copy(set.lampPos);

  // ---- story props ----
  const ps = inStory && timing ? printSchedule(story, timing.lines) : null;
  const printer = ps ? makePrinter(set.cab, ps) : null;
  const jumpBase = set.deskThings.map((o) => o.position.y), monY = set.monitor.position.y;

  // ---- shots: cam pos/target/fov; push = slow push-in fraction; coc = max depth-of-field blur ----
  const shots = {
    wide: { cam: { pos: [0.45, 1.9, 5.6], target: [0.45, 1.7, -1.8], fov: 41 }, push: 0.03, coc: 0.55 },
    two: { cam: { pos: [1.5, 1.8, 4.6], target: [0.95, 1.5, -1.5], fov: 32 }, push: 0.05, coc: 0.55 },
    bos: { cam: { pos: [0.55, 1.6, 1.4], target: [0.95, 1.55, -2.95], fov: 36 }, push: 0.06, coc: 0.55 },
    intern: { cam: { pos: [1.15, 1.65, 3.2], target: [0.5, 1.5, -1.0], fov: 30 }, push: 0.06, coc: 0.5 },
    ots_screen: { cam: { pos: [1.0, 2.2, 1.8], target: [-0.35, 1.4, -2.0], fov: 38, yawOff: -0.05 }, push: 0.05, coc: 0.5 },
    screen: { cam: { pos: [1.05, 1.5, 1.5], target: [-0.45, 1.45, -1.93], fov: 33 }, push: 0.03, coc: 0.4 },
  };

  // ---- stage: actor poses per shot (hard cuts make per-shot restaging invisible) ----
  const hip = { hip: true };
  const BOS0 = { pos: [1.3, 0, -1.8], yaw: -0.5, lean: 0.12, headYaw: 0.35, headPitch: 0.04, headRoll: 0.03, armL: hip, armR: { rest: [0.12, 0, -0.22], bend: -0.4 } };
  const INT0 = { pos: [0.55, 0.555, -1.0], yaw: -0.4, lean: -0.1, headYaw: 0.25, headPitch: -0.14, headRoll: -0.05, armL: { rest: [-0.3, 0, 0.55], bend: -0.5 }, armR: hip };
  function stage(shot, speaker, typing) {
    const B = { ...BOS0 }, I = { ...INT0 }; let showB = true, showI = true;
    if (shot === 'wide') { B.pos = [1.0, 0, -1.8]; I.pos = [0.4, 0.555, -1.0]; }
    else if (shot === 'two') { B.yaw = -0.35; B.headYaw = 0.45; I.yaw = -0.25; I.headYaw = 0.1; I.headPitch = -0.2; }
    else if (shot === 'bos') { B.pos = [0.95, 0, -2.95]; B.yaw = -0.08; B.lean = 0.07; B.headYaw = -0.25; B.headPitch = 0.04; showI = false; }
    else if (shot === 'intern') { I.yaw = -0.05; I.lean = -0.05; I.headYaw = 0.35; I.headPitch = -0.08; I.headRoll = 0.07; }
    else if (shot === 'ots_screen') {
      if (speaker === 'intern' || typing) { // intern typing at the keyboard, head turned toward the camera; boss shoulder at the right edge
        I.pos = [0.62, 0.555, -1.22]; I.yaw = -2.7; I.lean = 0.2; I.headYaw = 2.2; I.headPitch = 0.0; I.headRoll = 0.05; I.typeAt = true;
        B.pos = [1.25, 0, -0.1]; B.yaw = -1.0; B.headYaw = 0.35; B.lean = 0.1;
      } else { I.pos = [0.64, 0.555, -0.95]; I.yaw = -0.1; I.lean = -0.05; I.headYaw = 0.05; I.headPitch = -0.06; I.headRoll = 0.08; }
    } else if (shot === 'screen') { showB = false; showI = false; }
    return { B, I, showB, showI };
  }

  const kbP = new THREE.Vector3();
  return {
    id: 'pejabat', fog: { color: FOG, den: FOGDEN }, background: '#080b22', env: buildEnvScene(), envIntensity: 0.85,
    floor, noMirror: NO_MIRROR, noDepth: NO_DEPTH, shadowLights: [monKey],
    shots, stage,
    screenMesh: set.monitor.userData.screen,
    point: { aim: () => set.monitor.localToWorld(V3(0.17, -0.2, 0.06)), pole: [-0.7, -0.6, -0.1] },
    /** world points where the fists land when the boss (at pos B) slams the table */
    slam: { targets: (B) => [V3(B[0] + 0.35, 0.9, B[2] + 0.75), V3(B[0] - 0.35, 0.9, B[2] + 0.75)] },
    clock: V3(1.4, 3.5, -3.5),
    kb: () => ({ pos: set.kb.getWorldPosition(kbP), yaw: 0.42 }), // insert hands for keyboard close-ups
    typeTarget: (side, tap) => V3(0.15 + (side === 'L' ? -0.08 : 0.08), 0.9 + tap, -1.65),
    /** per frame, before posing/render. S = { t, shot, stage, sinceSlam (<=0 before the hit), slamHit } */
    update(t, S) {
      set.motes.position.y = Math.sin(t * 0.7) * 0.03;
      set.cab.visible = S.shot !== 'screen'; // the cabinet stands in the monitor's line of sight for the insert
      if (S.stage) { set.chair.visible = S.stage.showI; set.chair.position.set(S.stage.I.pos[0], 0, S.stage.I.pos[2]); set.chair.rotation.y = S.stage.I.yaw; }
      const hit = S.sinceSlam > 0;
      set.deskThings.forEach((o, k) => { o.position.y = jumpBase[k] + (hit ? Math.exp(-S.sinceSlam * 7) * Math.abs(Math.sin(S.sinceSlam * 22 + k)) * (0.05 + 0.01 * (k % 3)) : 0); });
      set.monitor.position.y = monY + (hit ? Math.exp(-S.sinceSlam * 8) * Math.abs(Math.sin(S.sinceSlam * 20)) * 0.012 : 0);
      if (printer) printer.update(t);
    },
    set,
  };
}
