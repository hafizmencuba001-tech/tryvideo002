// s1-kotak story props: a printer that spews paper (printer_spew) and "insert" hands for keyboard close-ups (type / boss_types).
// Both are pure functions of time: update(t) sets every transform, nothing is simulated.
import * as THREE from 'three';
import { box, slab, piv, std, glowMat, rng, clamp, V3 } from './s1-kotak.lib.js';

/** printer on top of the filing cabinet `cab` (cabinet top at y=1.34). `sched` = { t0, t1, rateBurst, rateTail }: sheets leave at
 *  rateBurst/s during [t0,t1], then rateTail/s forever. Sheets arc out of the front slot and land on a growing pile on the floor. */
export function makePrinter(cab, sched, N = 150) {
  const g = new THREE.Group(); g.position.set(0.02, 1.34, 0.02); cab.add(g);
  const body = std('#d9dde8', { roughness: 0.45 }), dark = std('#1a1f33', { roughness: 0.4, metalness: 0.3 }), accent = std('#7b86a8', { roughness: 0.4, metalness: 0.4 });
  box(g, 0.56, 0.2, 0.4, body, 0, 0.1, 0, 0.04);
  box(g, 0.5, 0.06, 0.34, accent, 0, 0.23, -0.02, 0.025);                 // lid
  box(g, 0.5, 0.04, 0.2, dark, 0, 0.275, -0.08, 0.015);                    // paper feed tray on top
  slab(g, 0.4, 0.035, 0.012, dark, 0, 0.1, 0.205);                         // output slot
  box(g, 0.1, 0.05, 0.02, dark, -0.18, 0.17, 0.205, 0.01);                 // control panel
  slab(g, 0.03, 0.015, 0.01, glowMat('#35e08a', 2.2), -0.2, 0.17, 0.218);
  slab(g, 0.03, 0.015, 0.01, glowMat('#ffd03a', 2.0), -0.15, 0.17, 0.218);
  for (let i = 0; i < 3; i++) { const p = slab(g, 0.2, 0.004, 0.28, std('#f4f6fb', { roughness: 0.8 }), 0, 0.3 + i * 0.004, -0.08); p.rotation.y = 0.05 * i; } // paper waiting in the tray

  // pile: landing spots (cabinet-local x,z) near the cabinet front; stack height from earlier sheets close by
  const R = rng(311);
  const sheetM = [std('#f4f6fb', { roughness: 0.85, emissive: '#99a6d8', emissiveIntensity: 0.08 }), std('#e6eaf5', { roughness: 0.85, emissive: '#99a6d8', emissiveIntensity: 0.08 })];
  const geo = new THREE.BoxGeometry(0.27, 0.004, 0.36);
  const sheets = [];
  const emit = [];
  { const nb = Math.round(sched.rateBurst * (sched.t1 - sched.t0));
    for (let i = 0; i < N; i++) emit.push(i < nb ? sched.t0 + i / sched.rateBurst : sched.t1 + (i - nb + 1) / sched.rateTail); }
  const land = [];
  for (let i = 0; i < N; i++) {
    const a = R() * Math.PI * 2, r = 0.12 + Math.pow(R(), 0.8) * 0.55;
    const x = 0.2 + Math.cos(a) * r * 0.9, z = 0.95 + Math.sin(a) * r * 0.9, rot = R() * Math.PI;
    let h = 0; for (const l of land) if (Math.hypot(l.x - x, l.z - z) < 0.2) h += 0.0042;
    land.push({ x, z, rot, y: 0.004 + h, tilt: (R() - 0.5) * 0.12, tiltZ: (R() - 0.5) * 0.12, sx: (R() - 0.5) * 0.5, spin: 2 + R() * 4 });
  }
  const floorY = -cab.position.y; // cab group sits on the floor (y=0), so cabinet-local y == world y
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(geo, sheetM[i % 2]); m.castShadow = true; m.receiveShadow = true; m.visible = false; cab.add(m); sheets.push(m);
  }
  const SLOT = V3(0.02, 1.43, 0.3);
  const FLIGHT = 0.5;
  return {
    group: g, sheets, emitTimes: emit,
    /** number of sheets out by time t */
    count(t) { let n = 0; for (const e of emit) if (t >= e) n++; return n; },
    update(t) {
      const active = t >= sched.t0 && t < sched.t1 + 0.4;
      g.position.x = 0.02 + (active ? Math.sin(t * 90) * 0.004 : 0); g.position.y = 1.34 + (active ? Math.abs(Math.sin(t * 61)) * 0.003 : 0);
      for (let i = 0; i < N; i++) {
        const m = sheets[i], e = emit[i], L = land[i], u = (t - e) / FLIGHT;
        if (u < 0) { m.visible = false; continue; }
        m.visible = true;
        if (u >= 1) { m.position.set(L.x, L.y + floorY, L.z); m.rotation.set(L.tilt, L.rot, L.tiltZ); continue; }
        const k = u, ease = 1 - (1 - k) * (1 - k);
        m.position.set(SLOT.x + (L.x - SLOT.x) * ease + L.sx * Math.sin(k * Math.PI) * 0.3, SLOT.y + (L.y + floorY - SLOT.y) * k * k + 0.22 * Math.sin(k * Math.PI), SLOT.z + (L.z - SLOT.z) * ease);
        m.rotation.set(L.tilt + Math.sin(k * L.spin * 2) * 0.7 * (1 - k), L.rot * k + Math.sin(k * L.spin) * 0.3, L.tiltZ + Math.cos(k * L.spin) * 0.5 * (1 - k));
      }
    },
  };
}

/** floating hands over the keyboard for monitor inserts. kind: 'intern' (orange sleeves, steel hands) | 'bos' (navy sleeves, white cuffs, skin hands, bigger) */
export function makeInsertHands(kind) {
  const g = new THREE.Group(); g.visible = false;
  const bossy = kind === 'bos', S = bossy ? 1.5 : 1;
  const sleeve = std(bossy ? '#1f2f6b' : '#ff7d1c', { roughness: 0.4, metalness: bossy ? 0.05 : 0.25 });
  const cuff = std(bossy ? '#eef2fa' : '#3b4258', { roughness: 0.5, metalness: bossy ? 0 : 0.7 });
  const hand = std(bossy ? '#b87d55' : '#3b4258', { roughness: 0.6, metalness: bossy ? 0 : 0.7 });
  const hands = [];
  for (const sx of [-1, 1]) {
    const arm = piv(g, sx * 0.11 * S, 0, 0); // pivot at the fingertips' rest point on the keyboard
    const fore = piv(arm, 0, 0, 0); fore.rotation.x = 0.55; // forearm rises toward the viewer (+z local)
    box(fore, 0.11 * S, 0.1 * S, 0.62, sleeve, 0, 0.0, 0.38, 0.03);
    box(fore, 0.12 * S, 0.11 * S, 0.06, cuff, 0, 0, 0.07, 0.015);
    const h = box(fore, 0.1 * S, 0.06 * S, 0.14, hand, 0, -0.01, 0.0, 0.025);
    for (let k = 0; k < 3; k++) box(h, 0.026 * S, 0.026 * S, 0.1 * S, hand, (k - 1) * 0.035 * S, -0.01, -0.1 * S, 0.01);
    hands.push({ arm, fore, sx });
  }
  return {
    group: g,
    /** place at keyboard world position with yaw; tapping from time t (seconds), strength 0..1 */
    update(t, kbPos, yaw, strength = 1) {
      g.position.copy(kbPos); g.position.y += 0.03; g.rotation.set(0, yaw, 0);
      hands.forEach((h, i) => {
        const ph = i * 1.9, tap = Math.pow(Math.max(0, Math.sin(t * (13 + i * 1.7) + ph)), 2) * 0.03 * S * strength;
        const tap2 = Math.pow(Math.max(0, Math.sin(t * 7.3 + ph * 2.1)), 3) * 0.025 * S * strength;
        h.fore.position.y = tap + tap2; h.arm.position.x = h.sx * 0.11 * S + Math.sin(t * 2.1 + i) * 0.03 * strength;
        h.arm.position.z = Math.sin(t * 1.7 + i * 2) * 0.02 * strength;
      });
    },
  };
}
