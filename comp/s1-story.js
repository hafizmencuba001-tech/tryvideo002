// s1-kotak story player. Plays window.STORY (script + screens) against window.TIMING (voice timing + mouth envelopes).
// Every frame is a pure function of t: shot choice (hard cut at each line start), camera drift, performance (faces, lip-sync, blinks,
// breathing, head bob, hops), actions, the monitor content (typing / counters) and props. No captions: text lives only on the monitor.
import * as THREE from 'three';
import { clamp, lerp, sm, V3, rng } from './s1-kotak.lib.js';
import { createWorld, armQ, applyArm } from './s1-kotak.world.js';
import { createScreen, typeText, parseCount, fmtCount } from './s1-kotak.screen.js';
import { typingPlan, hopLines, printSchedule, SLAM_DELAY } from './s1-kotak.plan.js';
import { makePrinter, makeInsertHands } from './s1-kotak.props.js';

export function startStory(LOCMOD) {
const STORY = window.STORY, TIMING = window.TIMING;
const TL = TIMING.lines, SL = STORY.lines;
const FPS = 30;
const nn = (i) => String(i).padStart(2, '0');

V.dur = TIMING.dur;
V.sounds = TL.filter((l) => l.who).map((l) => ({ src: `vo/${STORY.id}/${nn(l.i)}.wav`, at: l.start, vol: 1 }));
if (TIMING.sfx) V.sounds.push({ src: TIMING.sfx, at: 0, vol: 0.5 }); // typing clicks, slam, hops, ambience (tools/timing.mjs)

// ---- world (the location module builds set + lights; see s1-kotak.loc-*.js) ----------------------------------------------------
const screen = createScreen(LOCMOD.screenOpts || {});
const W = createWorld({ canvas: document.getElementById('gl'), loc: LOCMOD, screen, story: STORY, timing: TIMING });
const { bos, intern, world, loc } = W;
const rigB = bos.userData.rig, rigI = intern.userData.rig;
rigB.head.rotation.order = 'YXZ'; rigI.head.rotation.order = 'YXZ';

const TYPING = typingPlan(STORY, TL);
const HOPS = new Set(hopLines(STORY));
const handsIntern = makeInsertHands('intern'), handsBos = makeInsertHands('bos');
world.add(handsIntern.group, handsBos.group);

// ---- timeline helpers -------------------------------------------------------------------------------------------------------
const cutT = TL.map((l, i) => (i === 0 ? 0 : l.start));
const endT = TL.map((l, i) => (i + 1 < TL.length ? TL[i + 1].start : TIMING.dur));
function idxAt(t) { let k = 0; for (let i = 0; i < TL.length; i++) if (t >= cutT[i]) k = i; return k; }
function emos(i) { const L = SL[i]; return L.who === 'intern' ? { bos: L.listener, intern: L.face } : { bos: L.face, intern: L.listener }; }

// deterministic blink schedules (every ~2.5-4.5 s)
function blinks(seed) { const R = rng(seed), out = []; let t = 0.7 + R() * 1.5; while (t < TIMING.dur + 2) { out.push(t); t += 2.5 + R() * 2.0; } return out; }
const BLINK = { bos: blinks(11), intern: blinks(29) };
const blinkAt = (who, t) => { for (const b of BLINK[who]) if (t >= b && t < b + 0.17) return Math.sin(((t - b) / 0.17) * Math.PI); return 0; };

const SHOTS = loc.shots;

// ---- screen state --------------------------------------------------------------------------------------------------------------
let lastKey = '';
function updateScreen(t, i) {
  const L = SL[i], name = L.screen, sc = STORY.screens[name], T = TL[i];
  const pName = i > 0 ? SL[i - 1].screen : null, prev = pName ? STORY.screens[pName] : null;
  const o = { caret: false };
  const typing = !!TYPING[i];
  const full = typeText(sc);
  if (typing) {
    const P = TYPING[i], p = clamp((t - P.t0) / (P.t1 - P.t0));
    o.n = P.n0 + Math.floor((P.n1 - P.n0) * p);
    o.caret = true; o.typing = p < 1;
  } else if (sc.type !== 'post') o.caret = Math.floor(t * 2) % 2 === 0;
  if (sc.type === 'post') {
    o.views = sc.views; o.likes = sc.likes;
    if (prev && prev.type === 'post' && (prev.views !== sc.views || prev.likes !== sc.likes)) {
      const p = V.eio(clamp((t - T.start) / (T.dur * 0.88)));
      o.views = p >= 1 ? sc.views : fmtCount(lerp(parseCount(prev.views), parseCount(sc.views), p));
      o.likes = p >= 1 ? sc.likes : fmtCount(lerp(parseCount(prev.likes), parseCount(sc.likes), p));
    }
    if (o.typing === undefined && typing) o.caret = true;
  }
  const key = [name, o.n, o.caret && (o.typing || sc.type !== 'post' ? 1 : 0), o.views, o.likes].join('|');
  if (key !== lastKey) { lastKey = key; screen.draw(sc, o); }
}

// ---- action helpers --------------------------------------------------------------------------------------------------------------
function lookAngles(g, rig, pt) {
  g.updateMatrixWorld(true);
  const hw = rig.head.getWorldPosition(new THREE.Vector3());
  const a = g.worldToLocal(hw.clone()), b = g.worldToLocal(pt.clone()), d = b.sub(a);
  return { yaw: Math.atan2(d.x, d.z), pitch: -Math.atan2(d.y, Math.hypot(d.x, d.z)) };
}
const shortAngle = (from, to) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return from + d; };
const wP = (v) => (typeof v === 'function' ? v() : v);

// ---- per-frame ----------------------------------------------------------------------------------------------------------------------
const camP = new THREE.Vector3(), camT = new THREE.Vector3();

V.onFrame = (t) => {
  const i = idxAt(t), L = SL[i], T = TL[i];
  const lt = t - cutT[i], seg = endT[i] - cutT[i], tl = t - T.start; // lt: since the cut, tl: since the line starts speaking
  const shot = window.__force?.shot || (L.shot in SHOTS ? L.shot : 'two'); // __force: debug hook for framing tests
  const speaker = window.__force?.speaker ?? L.who;
  const act = L.action;
  const typing = act === 'type' || act === 'boss_types';
  const E = emos(i), Eprev = i > 0 ? emos(i - 1) : E;
  const mixK = clamp(lt / 0.15);
  // mouth envelope
  let open = 0;
  if (speaker) { const f = tl * FPS; if (f >= 0) { const env = TIMING.env[i], a = Math.floor(f), b = env[a] ?? 0, c = env[a + 1] ?? 0; open = lerp(b, c, f - a); } }
  const bosOpen = speaker === 'bos' ? open : 0, intOpen = speaker === 'intern' ? open : 0;

  world.scale.set(1, 1, 1);
  const stage = loc.stage(shot, speaker, typing && speaker === 'intern');

  // ---------------- characters ----------------
  const acts = { slam: 0, slamT: -1, rub: 0, clock: 0, clockI: 0, point: 0, hop: 0, tapI: 0 };
  if (act === 'point_screen') acts.point = sm(lt / 0.3) * (1 - sm((lt - (seg - 0.25)) / 0.25));
  if (act === 'slam_desk') { acts.slam = 1; acts.slamT = lt - SLAM_DELAY; }
  if (act === 'rub_eyes') acts.rub = sm(lt / 0.35) * (1 - sm((lt - (seg - 0.3)) / 0.3));
  if (act === 'look_clock') { acts.clock = sm((lt - 0.15) / 0.55); acts.clockI = sm((lt - 0.4) / 0.55); }
  if (typing) acts.tapI = 1;
  if (HOPS.has(i)) { // happy hop at the line start
    const u = (i === 0 ? tl : lt) / 0.34;
    if (u >= 0 && u < 1) acts.hop = 4 * u * (1 - u);
  }
  const sinceSlam = acts.slamT;
  const slamHit = acts.slam && sinceSlam > 0 ? Math.exp(-sinceSlam * 9) : 0; // 1 at impact, decays
  const slamUp = acts.slam ? sm(lt / 0.3) * (1 - sm((sinceSlam) / 0.07)) : 0; // fists raised before the hit

  const bp = stage.B;
  bos.visible = stage.showB; intern.visible = stage.showI;
  const seat = (rig, P) => { const a = P.sit ? -Math.PI / 2 + (P.sitSpread ? 0 : 0) : 0; rig.legL.rotation.set(a, 0, P.sit ? 0.12 : 0); rig.legR.rotation.set(a, 0, P.sit ? -0.12 : 0); };
  seat(rigB, stage.B); seat(rigI, stage.I);

  // ---- boss ----
  {
    const P = bp, g = bos;
    let yaw = P.yaw, lean = P.lean + 0.006 * Math.sin(t * 2.3) + 0.035 * Math.min(1, open) * 0 + 0.3 * slamUp * (acts.slam ? 1 : 0) + 0.05 * slamHit;
    const pos = [...P.pos];
    if (acts.clock && loc.clock) { yaw = lerp(yaw, shortAngle(yaw, Math.atan2(loc.clock.x - pos[0], loc.clock.z - pos[2])), acts.clock); }
    g.position.set(...pos); g.rotation.set(0, yaw, 0);
    const sway = 0.012 * Math.sin(t * 0.9) + (acts.slam ? 0.02 * slamHit * Math.sin(sinceSlam * 40) : 0);
    rigB.body.rotation.set(lean + 0.01 * Math.sin(t * 2.0), 0, sway);
    let hy = P.headYaw + 0.04 * Math.sin(t * 1.1) + 0.04 * Math.sin(t * 3.3) * bosOpen, hp = P.headPitch + 0.07 * bosOpen - 0.05 * slamHit + 0.02 * Math.sin(t * 2.0), hr = P.headRoll;
    if (speaker === 'bos') hp += 0.03 * Math.sin(t * 9);
    g.updateMatrixWorld(true);
    if (acts.clock && loc.clock) { const la = lookAngles(g, rigB, loc.clock); hy = lerp(hy, clamp(la.yaw, -1.2, 1.2), acts.clock); hp = lerp(hp, la.pitch, acts.clock); }
    if (acts.rub) { hp = lerp(hp, 0.22, acts.rub); hy = lerp(hy, 0, acts.rub); hr = lerp(hr, 0.06, acts.rub); }
    rigB.head.rotation.set(hp, hy, hr);
    g.updateMatrixWorld(true);
    // glasses lift
    rigB.glasses.position.set(0, 0.055 + 0.15 * acts.rub, 0.0 + 0.03 * acts.rub); rigB.glasses.rotation.x = -0.5 * acts.rub;
    // arms
    const armSpec = { L: P.armL, R: P.armR };
    const q = {};
    for (const side of ['L', 'R']) q[side] = armQ(rigB, side, armSpec[side]);
    const blend = (side, spec, w) => { if (w <= 0) return; const a = armQ(rigB, side, spec); q[side].sh.slerp(a.sh, clamp(w)); q[side].el.slerp(a.el, clamp(w)); };
    // point at the monitor
    if (loc.point) blend('R', { aim: loc.point.aim, pole: loc.point.pole }, acts.point);
    // slam: both fists up, then down on the desk top
    if (acts.slam && loc.slam) {
      const [hL, hR] = loc.slam.targets(bp.pos); // where the fists land
      const tgt = (h) => V3(h.x, sinceSlam > 0 ? h.y : lerp(h.y + 0.25, h.y + 1.0, sm(lt / 0.3)), h.z);
      blend('L', { aim: () => tgt(hL), pole: [0.9, -0.4, -0.5] }, 1);
      blend('R', { aim: () => tgt(hR), pole: [-0.9, -0.4, -0.5] }, 1);
    }
    // rub eyes: right hand to the eye area with a small circular rub
    if (acts.rub) {
      const rubT = () => rigB.head.localToWorld(V3(0.17 + 0.03 * Math.sin(t * 14), 0.0 + 0.03 * Math.cos(t * 14), 0.36));
      blend('R', { aim: rubT, pole: [-0.5, 0.3, 0.8] }, acts.rub);
    }
    for (const side of ['L', 'R']) applyArm(rigB, side, q[side]);
    rigB.fingerR.visible = acts.point > 0.3; rigB.fingerL.visible = false;
    bos.setFace(E.bos, bosOpen, Math.max(blinkAt('bos', t), acts.rub > 0.4 ? 1 : 0), Eprev.bos, mixK);
    if (!speaker) bos.setFace(E.bos, 0, Math.max(blinkAt('bos', t), acts.rub > 0.4 ? 1 : 0), Eprev.bos, mixK);
  }

  // ---- intern ----
  {
    const P = stage.I, g = intern;
    let yaw = P.yaw;
    if (acts.clockI && loc.clock) yaw = lerp(yaw, shortAngle(yaw, Math.atan2(loc.clock.x - P.pos[0], loc.clock.z - P.pos[2])), acts.clockI);
    const hopY = 0.09 * acts.hop;
    g.position.set(P.pos[0], P.pos[1] + hopY, P.pos[2]); g.rotation.set(0, yaw, 0);
    const bob = 0.012 * Math.sin(t * 2.6 + 1.3) + (acts.tapI ? 0.025 * Math.sin(t * 9) : 0);
    rigI.body.rotation.set(P.lean + bob, 0, 0.012 * Math.sin(t * 1.3));
    let hy = P.headYaw + 0.05 * Math.sin(t * 1.4) + 0.05 * Math.sin(t * 3.7) * intOpen, hp = P.headPitch + 0.07 * intOpen + 0.02 * Math.sin(t * 2.2 + 1), hr = P.headRoll + (speaker === 'intern' ? 0.04 * Math.sin(t * 4.1) : 0);
    g.updateMatrixWorld(true);
    if (acts.clockI && loc.clock) { const la = lookAngles(g, rigI, loc.clock); hy = lerp(hy, clamp(la.yaw, -1.2, 1.2), acts.clockI); hp = lerp(hp, la.pitch, acts.clockI); }
    rigI.head.rotation.set(hp, hy, hr);
    g.updateMatrixWorld(true);
    const q = {};
    for (const side of ['L', 'R']) q[side] = armQ(rigI, side, side === 'L' ? P.armL : P.armR);
    if (acts.tapI) {
      for (const side of ['L', 'R']) {
        const sx = side === 'L' ? 1 : -1, ph = side === 'L' ? 0 : 1.7;
        const typingAtKb = !!P.typeAt && !!loc.typeTarget;
        const tapY = Math.pow(Math.max(0, Math.sin(t * 13 + ph)), 2) * 0.035;
        const aimT = () => typingAtKb
          ? loc.typeTarget(side, tapY)
          : rigI.body.localToWorld(V3(sx * 0.12, 0.05 + tapY * 0.8, 0.42));
        const a = armQ(rigI, side, { aim: aimT, pole: [sx * 0.9, -0.3, -0.3] });
        q[side].sh.copy(a.sh); q[side].el.copy(a.el);
      }
    }
    for (const side of ['L', 'R']) applyArm(rigI, side, q[side]);
    rigI.fingerL.visible = false; rigI.fingerR.visible = false;
    rigI.antennaGlow.material.opacity = 0.35 + 0.5 * (0.55 + 0.45 * (Math.sin(t * 6) > 0 ? 1 : 0.2));
    intern.setFace(E.intern, intOpen, blinkAt('intern', t), Eprev.intern, mixK);
  }

  // ---------------- screen + props ----------------
  updateScreen(t, i);
  loc.update(t, { t, shot, stage, sinceSlam, slamHit, act, speaker, lt });
  // insert hands for keyboard / screen-tap close-ups
  const kb = loc.kb ? loc.kb() : null;
  const showHands = !!kb && shot === 'screen' && typing;
  handsIntern.group.visible = showHands && act === 'type'; handsBos.group.visible = showHands && act === 'boss_types';
  if (handsIntern.group.visible) handsIntern.update(t, kb.pos, kb.yaw, 1);
  if (handsBos.group.visible) handsBos.update(t, kb.pos, kb.yaw, 1);

  // ---------------- camera ----------------
  const S = typeof SHOTS[shot] === 'function' ? SHOTS[shot](speaker, typing) : SHOTS[shot], c = S.cam;
  camP.set(...c.pos); camT.set(...c.target);
  const u = clamp(lt / Math.max(seg, 1.5));
  const push = S.push * V.eio(u * 0.9 + 0.1 * u);
  const par = i % 2 ? 1 : -1;
  const dirv = camT.clone().sub(camP);
  const dist = dirv.length();
  camP.add(dirv.clone().multiplyScalar(push));
  const right = new THREE.Vector3().crossVectors(dirv.clone().normalize(), V3(0, 1, 0)).normalize();
  const drift = par * 0.045 * dist * (u - 0.5) * 0.5;
  camP.addScaledVector(right, drift); camT.addScaledVector(right, drift * 0.4);
  // desk-slam camera shake
  let roll = 0;
  if (acts.slam && sinceSlam > 0) { const a = Math.exp(-sinceSlam * 11) * 0.0075 * dist; camP.y += a * Math.sin(sinceSlam * 70); camP.x += a * 0.6 * Math.sin(sinceSlam * 53 + 1); roll = a * 0.15 * Math.sin(sinceSlam * 61); }
  const camD = camP.distanceTo(camT);
  W.render({ pos: camP.toArray(), target: camT.toArray(), fov: c.fov, yawOff: c.yawOff, roll }, { focus: camD, range: Math.max(1.1, camD * 0.4), maxCoc: S.coc });
};
window.__W = W;
}
