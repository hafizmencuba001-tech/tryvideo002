// s1-kotak world builder + posing helpers, shared by the stills page (s1-kotak.js) and the story player (s1-story.js).
// createWorld() builds renderer, post pipeline, camera and the cast, and asks a *location module* (s1-kotak.loc-<id>.js, see
// loc-pejabat.js for the reference) to build the set + lights. It touches only the canvas it is given.
import * as THREE from 'three';
import { clamp, V3, glowList } from './s1-kotak.lib.js';
import { makeBos, makeIntern } from './s1-kotak.cast.js';
import { buildEnvScene } from './s1-kotak.set.js';
import { makePost } from './s1-kotak.post.js';

export const W = 1080, H = 1920;

/** o: { canvas, loc (location module: { build(ctx) }), screen (createScreen() object), story, timing } */
export function createWorld(o) {
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const world = new THREE.Group(); scene.add(world);
  const cam = new THREE.PerspectiveCamera(34, W / H, 0.1, 160);
  const post = makePost(renderer, W, H);
  const pm = new THREE.PMREMGenerator(renderer);

  const loc = o.loc.build({ THREE, world, scene, renderer, post, screen: o.screen, story: o.story, timing: o.timing });
  scene.background = new THREE.Color(loc.background);
  scene.fog = new THREE.FogExp2(loc.fog.color, loc.fog.den);
  scene.environment = pm.fromScene(loc.env || buildEnvScene(), 0.02).texture;
  scene.environmentIntensity = loc.envIntensity ?? 0.85;

  const bos = makeBos(), intern = makeIntern();
  world.add(bos, intern);

  const mirror = loc.mirror !== false;
  function renderMirror() {
    world.scale.y = -1; if (loc.floor) loc.floor.visible = false; loc.noMirror.forEach((m) => { m.visible = false; });
    (loc.shadowLights || []).forEach((l) => { l.castShadow = false; });
    const bg = scene.background;
    renderer.setRenderTarget(post.rtRefl); renderer.setClearColor(0x05071a, 1); renderer.clear(); scene.background = null;
    renderer.render(scene, cam);
    scene.background = bg; (loc.shadowLights || []).forEach((l) => { l.castShadow = true; });
    world.scale.y = 1; if (loc.floor) loc.floor.visible = true; loc.noMirror.forEach((m) => { m.visible = true; });
  }
  /** one frame: camera is set from c = {pos, target, fov, yawOff, roll}; dof = {focus, range, maxCoc} */
  function render(c, dof) {
    cam.fov = c.fov; cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.target); cam.rotateY(c.yawOff || 0); if (c.roll) cam.rotateZ(c.roll);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    world.scale.set(1, 1, 1); world.updateMatrixWorld(true);
    if (mirror) renderMirror();
    post.finish(scene, cam, { hideForDepth: [...loc.noDepth, ...glowList], focus: dof.focus, range: dof.range, maxCoc: dof.maxCoc, bloomK: loc.bloomK ?? 0.75, bloomThr: loc.bloomThr ?? 0.9, expo: loc.expo ?? 1.0, vig: loc.vig ?? 0.55 });
  }
  return { THREE, renderer, scene, world, cam, post, loc, bos, intern, render };
}

// ---- arm posing (two-bone IK + rest poses), as quaternion pairs so poses can be blended -----------------------------------
const DOWN = V3(0, -1, 0);
/** IK: quaternions {sh, el} that put the hand of arm `side` ('L'|'R') at world point `target` (elbow bends toward `pole`) */
export function aimQ(rig, side, target, pole) {
  const sh = rig['arm' + side];
  const tl = rig.body.worldToLocal(target.clone());
  const s = sh.position, a = rig.lenA, b = rig.lenB;
  const dir = tl.clone().sub(s); const dist = dir.length(); dir.normalize();
  const d = clamp(dist, Math.abs(a - b) + 0.03, a + b - 0.004);
  const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const p = V3(...pole).normalize(); p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize();
  const u = dir.clone().multiplyScalar(Math.cos(alpha)).add(p.multiplyScalar(Math.sin(alpha)));
  const qs = new THREE.Quaternion().setFromUnitVectors(DOWN, u);
  const elbow = s.clone().add(u.clone().multiplyScalar(a));
  const f = s.clone().add(dir.clone().multiplyScalar(d)).sub(elbow).normalize().applyQuaternion(qs.clone().invert());
  const qe = new THREE.Quaternion().setFromUnitVectors(DOWN, f);
  return { sh: qs, el: qe };
}
export function restQ(euler, bend) {
  return { sh: new THREE.Quaternion().setFromEuler(new THREE.Euler(euler[0], euler[1], euler[2])), el: new THREE.Quaternion().setFromEuler(new THREE.Euler(bend, 0, 0)) };
}
/** arm spec -> quaternion pair. spec: { aim: Vector3|()=>Vector3, pole } | { hip: true } | { rest: [x,y,z], bend } */
export function armQ(rig, side, A) {
  if (A.aim) return aimQ(rig, side, typeof A.aim === 'function' ? A.aim() : A.aim, A.pole);
  if (A.hip) { const sx = side === 'L' ? 1 : -1; return aimQ(rig, side, rig.body.localToWorld(V3(sx * 0.3, 0.2, 0.1)), [sx * 1, -0.2, -0.5]); }
  return restQ(A.rest, A.bend);
}
export function applyArm(rig, side, q) { rig['arm' + side].quaternion.copy(q.sh); rig['elbow' + side].quaternion.copy(q.el); }

/** the stills' pose function (static shots table entries) */
export function poseActor(g, P, t, open, who) {
  const rig = g.userData.rig;
  g.position.set(...P.pos); g.rotation.set(0, P.yaw, 0);
  const br = Math.sin(t * 2.3 + (who === 'bos' ? 0 : 1.3));
  rig.body.rotation.set(P.lean + 0.006 * br, 0, P.sway || 0);
  rig.head.rotation.set(P.headPitch + (who === 'bos' ? 0.02 : 0.03) * open, P.headYaw, P.headRoll);
  g.updateMatrixWorld(true);
  for (const side of ['L', 'R']) {
    const A = P['arm' + side];
    rig['finger' + side].visible = !!(A && A.point);
    if (!A) continue;
    applyArm(rig, side, armQ(rig, side, A));
  }
  if (rig.antennaMat) { const blink = 0.55 + 0.45 * (Math.sin(t * 6) > 0 ? 1 : 0.2); rig.antennaGlow.material.opacity = 0.35 + 0.5 * blink; }
}
