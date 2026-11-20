// Engine-level camera moves (works on top of any three.js style player, no style edits).
//
// A story line may carry  "camera": "push_in"  or  { "move": "orbit_left", "amount": 0.5 }  or a list of moves  ["push_in", "handheld"].
// A story may carry  "camera_style": "calm" | "lively" | "dramatic"  : every line WITHOUT its own "camera" then gets a move picked from the
// story structure (hook, silent beat, punchline, faces, shot). "camera": "none" keeps a line as the style made it.
//
// How it hooks in (make-story.mjs imports this module before the style player):
//   1. Scene render callbacks (Object3D.prototype.onBeforeRender / onAfterRender for scenes) are wrapped. When a style renders its MAIN camera
//      (a PerspectiveCamera with the frame's aspect) during a frame, the camera is moved relative to the shot the player just set (dolly / orbit /
//      crane / pan / roll / zoom), the frame is drawn, and the camera is put back exactly as the player left it. Offsets are eased over the
//      line: a pure function of V.t.
//   2. The pivot (what orbits / cranes circle around and what dolly distances are measured to) is the point on the view axis at the depth of
//      the world origin, where every style stands its characters. A style may set window.CAMERA_PIVOT = [x, y, z] to override.
//   3. Styles whose W.render(cam, dof) takes a depth-of-field object ({ focus }) get the focus corrected for dolly moves, and rack_focus.
//   4. whip adds a horizontal motion blur on the visible frame (#stage, CSS/SVG filter) and a whoosh; zoom_punch adds a soft hit.
//   5. Flat styles (no perspective main camera: 2D canvas styles, orthographic paper/comic styles) get a 2D fallback: V.onFrame is wrapped and,
//      after the style drew a frame, the layers inside #stage are scaled / slid / rotated (with overscan so no edge shows).
import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const sio = (x) => { x = clamp(x); return 0.5 - 0.5 * Math.cos(Math.PI * x); }; // sine in-out (gentler start than cubic)
const eo = (x) => 1 - Math.pow(1 - clamp(x), 3);
const ei = (x) => Math.pow(clamp(x), 3);
const backOut = (x) => { x = clamp(x); const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const DEG = Math.PI / 180;

/** All moves. Each returns offsets for progress u (0..1 over the line), lt (seconds into the line), seg (line length), ctx. */
export const MOVES = {
  // slow dolly toward the subject (ends ~18% closer)
  push_in: (u, a) => ({ dolly: 0.18 * a * sio(u) }),
  // starts close and drifts back to (a little past) the style's framing
  pull_out: (u, a) => ({ dolly: a * (0.15 - 0.23 * sio(u)) }),
  // arc around the subject; camera travels to its left / right (~16 degrees)
  orbit_left: (u, a) => ({ orbitYaw: a * 0.28 * (0.5 - sio(u)) }),
  orbit_right: (u, a) => ({ orbitYaw: a * 0.28 * (sio(u) - 0.5) }),
  // camera rises (or sinks) on an arc while staying aimed at the subject
  crane_up: (u, a) => ({ orbitPitch: a * (-0.09 + 0.32 * sio(u)), dolly: 0.05 * a * sio(u) }),
  crane_down: (u, a) => ({ orbitPitch: a * (0.23 - 0.32 * sio(u)), dolly: 0.05 * a * sio(u) }),
  // reveal pans: start looking off to one side, turn and settle on the shot
  pan_left: (u, a, c) => ({ panYaw: -a * 0.42 * c.hfov * c.short * (1 - eio(u / 0.75)) }),
  pan_right: (u, a, c) => ({ panYaw: a * 0.42 * c.hfov * c.short * (1 - eio(u / 0.75)) }),
  // gentle seeded hand-held wobble (smooth sums of sines, never random)
  handheld: (u, a, c) => {
    const t = c.t, A = 0.03 * c.vfov * a;
    const n = (f, p) => Math.sin(t * f * 6.283 + p);
    return {
      panYaw: A * (0.55 * n(0.31, 1.3) + 0.3 * n(0.83, 4.1) + 0.15 * n(1.9, 0.7)),
      tilt: A * (0.5 * n(0.27, 2.2) + 0.35 * n(0.71, 5.3) + 0.15 * n(2.3, 3.9)),
      roll: A * 0.7 * (0.6 * n(0.23, 0.4) + 0.4 * n(0.9, 2.8)),
      dolly: 0.012 * a * n(0.4, 1.7),
    };
  },
  // fast pan that carries the cut into the next line (motion blur + whoosh); handled in planFor()
  whip: () => ({}),
  // slow tilt of the horizon (about 6 degrees)
  dutch: (u, a) => ({ roll: a * 0.11 * sio(u), dolly: 0.05 * a * sio(u) }),
  // fast punch-in on the punchline: zoom snaps in with a tiny overshoot, small jolt, then creeps
  zoom_punch: (u, a, c) => {
    const at = c.at ?? clamp(0.3 * c.seg, 0.35, 0.9), x = (c.lt - at) / 0.2;
    if (x < 0) return {};
    const hit = Math.exp(-(c.lt - at) * 9);
    return { zoom: 1 + a * (0.3 * backOut(x) + 0.05 * sio((c.lt - at) / Math.max(1, c.seg - at))), tilt: a * 0.006 * hit * Math.sin((c.lt - at) * 40), roll: a * 0.004 * hit * Math.sin((c.lt - at) * 33) };
  },
  // vertigo: camera dollies in while the lens widens, so the subject stays the same size and the room stretches behind it
  dolly_zoom: (u, a) => { const k = a * 0.6 * eio(u); return { dolly: k, zoom: 1 - k }; },
  // calm floating drift: slow sideways float with a breath of rise
  slow_drift: (u, a, c) => ({ truck: a * c.side * 0.05 * (u - 0.5), rise: a * 0.015 * Math.sin(Math.PI * u), orbitYaw: a * c.side * 0.035 * (u - 0.5) }),
  // focus pulls from the background to the subject (styles with depth of field only; s30 yes, s4 no)
  rack_focus: (u, a) => { const k = eio((u - 0.15) / 0.45), w = a * (1 - k); return { focusMul: 1 + 1.1 * w, cocMul: 1 + 0.8 * w, rangeMul: 1 - 0.45 * w }; },
  // keep the style's own camera
  none: () => ({}),
};
const ALIAS = { orbit: 'orbit_right', crane: 'crane_up', pan: 'pan_left', dolly_in: 'push_in', dolly_out: 'pull_out', zoom: 'zoom_punch', shake: 'handheld', drift: 'slow_drift', vertigo: 'dolly_zoom', static: 'none' };

function norm(spec) {
  if (spec == null) return [];
  if (Array.isArray(spec)) return spec.flatMap(norm);
  if (typeof spec === 'string') return spec.split('+').map((s) => s.trim()).filter(Boolean).map((m) => ({ move: m }));
  if (typeof spec === 'object' && spec.move) return [spec];
  return [];
}
const known = (m) => { const k = ALIAS[m.move] || m.move; if (!MOVES[k]) { console.warn('camera: unknown move "' + m.move + '" (ignored)'); return null; } return { ...m, move: k }; };

// ---- camera_style: pick moves from the story structure (deterministic, from the story only) ----
const CLOSE = (shot) => shot && !/^(wide|two|screen|ots_screen)$/.test(shot);
export function autoMoves(story, style) {
  const L = story.lines, n = L.length;
  const lastSpoken = (() => { for (let i = n - 1; i >= 0; i--) if (L[i].who) return i; return n - 1; })();
  let orbitSide = 0, wideK = 0, closeK = 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const l = L[i], shot = l.shot || 'two', prev = out[i - 1]?.[0]?.move;
    const spFace = l.face, shocked = spFace === 'shocked' || (!l.who && l.listener === 'shocked');
    let m;
    const screenish = shot === 'screen' || shot === 'ots_screen';
    if (style === 'calm') {
      if (i === 0) m = { move: 'push_in', amount: 0.7 };
      else if (!l.who) m = { move: 'slow_drift', amount: 1 };
      else if (i === lastSpoken) m = { move: 'pull_out', amount: 0.7 };
      else if (screenish) m = { move: 'push_in', amount: 0.5 };
      else m = (closeK++ % 2) ? { move: 'push_in', amount: 0.5 } : { move: 'slow_drift', amount: 0.8 };
    } else if (style === 'dramatic') {
      if (i === 0) m = { move: 'push_in', amount: 1.3 };
      else if (i === lastSpoken) m = { move: 'zoom_punch', amount: CLOSE(shot) ? 1.15 : 0.7 };
      else if (screenish) m = { move: 'push_in', amount: 1 };
      else if (!l.who) m = shocked ? { move: 'dolly_zoom', amount: 1 } : { move: (orbitSide++ % 2) ? 'orbit_left' : 'orbit_right', amount: 1.2 };
      else if (shocked && prev !== 'zoom_punch') m = { move: 'zoom_punch', amount: 1 };
      else if (spFace === 'annoyed' && prev !== 'dutch') m = { move: 'dutch', amount: 1 };
      else if (CLOSE(shot)) m = (closeK++ % 2) ? { move: 'handheld', amount: 1 } : { move: 'push_in', amount: 1.1 };
      else m = (wideK++ % 2) ? { move: 'crane_down', amount: 1 } : { move: 'crane_up', amount: 1 };
    } else { // lively
      if (i === 0) m = { move: 'push_in', amount: 1 };
      else if (i === lastSpoken) m = { move: 'zoom_punch', amount: CLOSE(shot) ? 1 : 0.6 };
      else if (screenish) m = { move: 'push_in', amount: 0.8 };
      else if (!l.who) m = { move: (orbitSide++ % 2) ? 'orbit_left' : 'orbit_right', amount: 1 };
      else if (shocked && prev !== 'zoom_punch') m = { move: 'zoom_punch', amount: 0.8 };
      else if (CLOSE(shot)) m = [{ move: 'push_in', amount: 0.9 }, { move: 'slow_drift', amount: 1.2 }, { move: 'handheld', amount: 0.7 }][closeK++ % 3];
      else m = [{ move: 'orbit_right', amount: 1 }, { move: 'crane_up', amount: 1 }, { move: 'orbit_left', amount: 1 }, { move: 'pull_out', amount: 0.8 }][wideK++ % 4];
    }
    out.push([m]);
  }
  return out;
}

// ---- per-line plan ----
let PLAN = null;
function buildPlan() {
  const S = window.STORY, T = window.TIMING;
  if (!S || !T || !T.lines) return null;
  const TL = T.lines, n = TL.length;
  const cut = TL.map((l, i) => (i === 0 ? 0 : l.start));
  const end = TL.map((l, i) => (i + 1 < n ? TL[i + 1].start : T.dur));
  const style = S.camera_style && S.camera_style !== 'none' ? String(S.camera_style) : null;
  const auto = style ? autoMoves(S, style) : null;
  const moves = S.lines.map((l, i) => {
    const own = 'camera' in l ? norm(l.camera) : auto ? auto[i] : [];
    return own.map(known).filter(Boolean);
  });
  // whip on line i: whip-out over the end of line i + whip-in over the start of line i+1 (on the last line: whip-in at its start)
  const whipOut = new Map(), whipIn = new Map();
  moves.forEach((ms, i) => {
    const w = ms.find((m) => m.move === 'whip');
    if (!w) return;
    const dir = w.dir === 'left' ? 1 : -1, amt = w.amount ?? 1;
    if (i + 1 < n) { whipOut.set(i, { dir, amt }); whipIn.set(i + 1, { dir, amt }); } else whipIn.set(i, { dir, amt });
  });
  const sounds = [];
  for (const [i] of whipOut) sounds.push({ src: 'assets/cam-whoosh.wav', at: Math.max(0, end[i] - 0.24), vol: 0.55 });
  for (const [i] of whipIn) if (!whipOut.has(i - 1)) sounds.push({ src: 'assets/cam-whoosh.wav', at: Math.max(0, cut[i] - 0.05), vol: 0.5 });
  moves.forEach((ms, i) => { const z = ms.find((m) => m.move === 'zoom_punch'); if (z) sounds.push({ src: 'assets/cam-hit.wav', at: cut[i] + (z.at ?? clamp(0.3 * (end[i] - cut[i]), 0.35, 0.9)), vol: 0.45 * (z.amount ?? 1) }); });
  return { cut, end, moves, whipOut, whipIn, sounds, n };
}

const WHIP = 0.2; // seconds each side of the cut
/** summed offsets at time t (camera frustum info in cam) */
function offsetsAt(t, cam) {
  if (!PLAN) PLAN = buildPlan();
  if (!PLAN) return null;
  let i = 0;
  for (let k = 0; k < PLAN.n; k++) if (t >= PLAN.cut[k]) i = k;
  const lt = t - PLAN.cut[i], seg = PLAN.end[i] - PLAN.cut[i];
  const vfov = cam.fov * DEG, hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
  const o = { dolly: 0, orbitYaw: 0, orbitPitch: 0, panYaw: 0, tilt: 0, roll: 0, truck: 0, rise: 0, zoom: 1, focusMul: 1, cocMul: 1, rangeMul: 1, blur: 0 };
  const add = (d) => { for (const k in d) { if (k === 'zoom' || k === 'focusMul' || k === 'cocMul' || k === 'rangeMul') o[k] *= d[k]; else o[k] += d[k]; } };
  for (const m of PLAN.moves[i] || []) {
    const a = m.amount ?? 1;
    const c = { t, lt, seg, vfov, hfov, at: m.at, side: i % 2 ? 1 : -1, short: Math.min(1, seg / 2.5) };
    add(MOVES[m.move](clamp(lt / Math.max(seg, 0.001)), a, c));
  }
  const wo = PLAN.whipOut.get(i), wi = PLAN.whipIn.get(i);
  if (wo && PLAN.end[i] - t < WHIP) { const p = 1 - (PLAN.end[i] - t) / WHIP; o.panYaw += wo.dir * wo.amt * 0.9 * hfov * ei(p); o.blur += wo.amt * 70 * ei(p); }
  if (wi && lt < WHIP) { const q = lt / WHIP; o.panYaw -= wi.dir * wi.amt * 0.9 * hfov * (1 - eo(q)); o.blur += wi.amt * 70 * (1 - eo(q)) ** 2; }
  return o;
}

// ---- motion blur on the visible frame (whip) ----
let blurEl = null, stageEl = null, lastBlur = -1;
function setBlur(px) {
  px = Math.round(px);
  if (px === lastBlur) return;
  lastBlur = px;
  stageEl = stageEl || document.getElementById('stage');
  if (!stageEl) return;
  if (!blurEl && px > 0) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    svg.innerHTML = '<filter id="camwhip" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feGaussianBlur id="camwhipb" stdDeviation="0 0" edgeMode="duplicate"/></filter>';
    document.body.appendChild(svg);
    blurEl = svg.querySelector('#camwhipb');
  }
  if (px > 0) { blurEl.setAttribute('stdDeviation', `${px} ${Math.round(px * 0.06)}`); stageEl.style.filter = 'url(#camwhip)'; }
  else stageEl.style.filter = '';
}

// ---- the hook ----
const isMain = (cam) => cam && cam.isPerspectiveCamera && Math.abs(cam.aspect - (V.size ? V.size[0] / V.size[1] : 0.5625)) < 0.01;
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), piv = new THREE.Vector3(), rel = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
let frameT = null, frameO = null, frameD = 0, frame3D = false;

/** pivot distance along the view axis: depth of window.CAMERA_PIVOT (default: the world origin) */
function pivotDist(cam) {
  const P = window.CAMERA_PIVOT || [0, 0, 0];
  fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
  rel.set(P[0], P[1], P[2]).sub(cam.position);
  return Math.max(rel.dot(fwd), cam.near * 4, 1e-3);
}
function current(cam) {
  const t = window.V && V.t;
  if (t == null) return null;
  if (t !== frameT) { frameT = t; frameO = offsetsAt(t, cam); setBlur(frameO ? frameO.blur : 0); }
  return frameO;
}

// WebGLRenderer defines render() per instance, so the hook sits on the scene callbacks the renderer calls around every render:
// scene.onBeforeRender runs after the renderer updated the camera matrices and before it builds the frustum and draws.
const _obr = THREE.Object3D.prototype.onBeforeRender, _oar = THREE.Object3D.prototype.onAfterRender;
const saved = new Map();
THREE.Object3D.prototype.onBeforeRender = function (renderer, scene, cam, ...rest) {
  if (this.isScene && isMain(cam)) frame3D = true;
  if (this.isScene && isMain(cam) && !saved.has(cam)) applyMove(cam);
  return _obr.call(this, renderer, scene, cam, ...rest);
};
THREE.Object3D.prototype.onAfterRender = function (renderer, scene, cam, ...rest) {
  if (this.isScene && saved.has(cam)) {
    const s = saved.get(cam); saved.delete(cam);
    cam.position.copy(s.p); cam.quaternion.copy(s.q); cam.fov = s.fov;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  return _oar.call(this, renderer, scene, cam, ...rest);
};

function applyMove(cam) {
  const o = current(cam);
  if (!o || (o.dolly === 0 && o.orbitYaw === 0 && o.orbitPitch === 0 && o.panYaw === 0 && o.tilt === 0 && o.roll === 0 && o.truck === 0 && o.rise === 0 && o.zoom === 1)) return;
  saved.set(cam, { p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov });
  const f0 = cam.fov;
  const d = pivotDist(cam);
  frameD = d;
  fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
  right.set(1, 0, 0).applyQuaternion(cam.quaternion);
  piv.copy(cam.position).addScaledVector(fwd, d);
  // orbit (yaw about world up, pitch about the camera's right axis) around the pivot: position and aim rotate together
  if (o.orbitYaw || o.orbitPitch) {
    q1.setFromAxisAngle(Y, o.orbitYaw);
    q2.setFromAxisAngle(right.clone().setY(0).normalize(), -o.orbitPitch);
    q1.multiply(q2);
    rel.copy(cam.position).sub(piv).applyQuaternion(q1);
    cam.position.copy(piv).add(rel);
    cam.quaternion.premultiply(q1);
    fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    right.set(1, 0, 0).applyQuaternion(cam.quaternion);
  }
  // dolly along the (new) view axis, truck sideways, rise straight up
  cam.position.addScaledVector(fwd, o.dolly * d).addScaledVector(right, o.truck * d);
  cam.position.y += o.rise * d;
  // pan (about world up, from the camera), tilt (camera right), roll (view axis)
  if (o.panYaw) cam.quaternion.premultiply(q1.setFromAxisAngle(Y, o.panYaw));
  if (o.tilt) cam.quaternion.multiply(q1.setFromAxisAngle(X, o.tilt));
  if (o.roll) cam.quaternion.multiply(q1.setFromAxisAngle(Z, o.roll));
  if (o.zoom !== 1) cam.fov = 2 * Math.atan(Math.tan((f0 * DEG) / 2) / o.zoom) / DEG;
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
}

// ---- depth-of-field styles: W.render(cam, { focus, range, maxCoc }) ----
let _W;
Object.defineProperty(window, '__W', {
  configurable: true,
  get() { return _W; },
  set(w) {
    _W = w;
    if (!w || typeof w.render !== 'function' || w.__camWrapped) return;
    const orig = w.render;
    w.render = function (c, dof, ...rest) {
      if (dof && typeof dof.focus === 'number' && window.V && V.t != null) {
        if (!PLAN) PLAN = buildPlan();
        const fake = { fov: c.fov || 40, aspect: V.size ? V.size[0] / V.size[1] : 0.5625 };
        const o = PLAN && offsetsAt(V.t, fake);
        if (o && (o.dolly || o.focusMul !== 1 || o.cocMul !== 1 || o.rangeMul !== 1)) {
          dof = { ...dof, focus: dof.focus * (1 - o.dolly) * o.focusMul };
          if (typeof dof.maxCoc === 'number') dof.maxCoc *= o.cocMul;
          if (typeof dof.range === 'number') dof.range *= o.rangeMul;
        }
      }
      return orig.call(this, c, dof, ...rest);
    };
    w.__camWrapped = true;
  },
});


// ---- 2D fallback: styles without a perspective 3D camera (2D canvas styles, orthographic paper/ink styles) ----
// After the style drew the frame, if no main perspective camera was rendered, the visible layers inside #stage are moved like a lens on a
// flat picture: dolly/zoom -> scale, pan/tilt/orbit/truck -> slide, roll -> rotate, always with enough overscan that no edge shows.
// Orbit and crane cannot show depth in 2D (they become a gentle slide); dolly_zoom and rack_focus have no effect there.
let moved2D = false;
function clear2D() {
  if (!moved2D) return;
  for (const el of document.getElementById('stage')?.children || []) el.style.transform = '';
  moved2D = false;
}
function apply2D(t) {
  const fov = { fov: 30, aspect: V.size ? V.size[0] / V.size[1] : 0.5625 };
  const o = offsetsAt(t, fov);
  setBlur(o ? o.blur : 0);
  if (!o) return clear2D();
  const vf = 30 * DEG, hf = 2 * Math.atan(Math.tan(vf / 2) * fov.aspect);
  const W = V.size ? V.size[0] : 1080, H = V.size ? V.size[1] : 1920;
  let sc = o.zoom / Math.max(0.5, 1 - o.dolly); // dolly in / zoom in -> bigger
  const tx = W * ((o.panYaw + 0.4 * o.orbitYaw) / hf - o.truck / (2 * Math.tan(hf / 2)));
  const ty = H * ((-o.tilt + 0.4 * o.orbitPitch) / vf + o.rise / (2 * Math.tan(vf / 2)));
  const rot = -o.roll;
  const need = 1 + 2 * Math.max(Math.abs(tx) / W, Math.abs(ty) / H) + Math.abs(Math.sin(rot)) * (H / W) + 0.002;
  sc = Math.max(sc, need);
  if (Math.abs(sc - 1) < 1e-4 && !tx && !ty && !rot) return clear2D();
  for (const el of document.getElementById('stage')?.children || []) {
    el.style.transformOrigin = '50% 50%';
    el.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${rot.toFixed(5)}rad) scale(${sc.toFixed(5)})`;
  }
  moved2D = true;
}
// wrap the style's V.onFrame (set by the player) so the 2D fallback runs after each frame is drawn
{
  let fn = null;
  Object.defineProperty(V, 'onFrame', {
    configurable: true,
    get() { return fn && wrapped; },
    set(f) { fn = f; },
  });
  const post = (t) => { if (frame3D) clear2D(); else apply2D(t); };
  const wrapped = (t) => {
    frame3D = false;
    const r = fn(t);
    if (r && typeof r.then === 'function') return r.then((x) => { post(t); return x; });
    post(t);
    return r;
  };
}

/** called by the story page right after the style's startStory(): adds the whoosh / hit sounds of the planned moves */
export function cameraInit() {
  PLAN = buildPlan();
  if (PLAN && PLAN.sounds.length && Array.isArray(V.sounds)) V.sounds.push(...PLAN.sounds);
  window.__CAMERA = { plan: PLAN, MOVES: Object.keys(MOVES) };
}
