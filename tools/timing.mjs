// Story + voice WAVs -> comp/vo/<id>/timing.js  (window.TIMING = { id, dur, lines: [...], env: { lineIndex: [mouth 0..1 per 30 fps frame] } })
//   node tools/timing.mjs s1-e1
// Layout: 0.5 s lead-in; line starts back-to-back plus each line's `pause`; silent beats (who: null) last `dur`; >= 1.0 s tail.
// (portable starter-pack copy: ffmpeg comes from ffmpeg-static)
// Voice WAVs get their leading/trailing silence trimmed first (originals kept as NN.orig.wav) so line timing is tight.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import { ffmpegPath, setInfo, storyForPlayer } from './lib/common.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = ffmpegPath();
const FPS = 30, LEAD = 0.5, TAIL = 1.0, KEEP = 0.05;
const id = process.argv[2];
if (!id) { console.error('usage: timing.mjs <story-id>'); process.exit(1); }
const story = JSON.parse(fs.readFileSync(path.join(HERE, 'stories', id + '.json'), 'utf8'));
const dir = path.join(HERE, 'comp', 'vo', id);

/** plain RIFF/WAV decoder -> { rate, samples: Float32Array (mono, -1..1) } */
function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not a WAV: ' + file);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const tag = b.toString('ascii', p, p + 4); let size = b.readUInt32LE(p + 4);
    if (tag === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    else if (tag === 'data') { if (p + 8 + size > b.length) size = b.length - p - 8; data = b.subarray(p + 8, p + 8 + size); break; }
    p += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.format !== 1 || fmt.bits !== 16) throw new Error('expected 16-bit PCM WAV: ' + file);
  const n = Math.floor(data.length / 2 / fmt.ch), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < fmt.ch; c++) s += data.readInt16LE((i * fmt.ch + c) * 2); out[i] = s / fmt.ch / 32768; }
  return { rate: fmt.rate, samples: out };
}

/** trim leading/trailing silence of NN.wav in place (keeping KEEP s); original saved once as NN.orig.wav; re-trims when TTS rewrote NN.wav */
function trim(nn) {
  const wav = path.join(dir, nn + '.wav'), orig = path.join(dir, nn + '.orig.wav'), mark = path.join(dir, nn + '.trimmed');
  const mt = String(fs.statSync(wav).mtimeMs);
  if (fs.existsSync(mark) && fs.readFileSync(mark, 'utf8') === mt) return;
  fs.copyFileSync(wav, orig);
  const sr = `silenceremove=start_periods=1:start_threshold=-42dB:start_silence=${KEEP}:detection=peak`;
  const tmp = path.join(dir, nn + '.tmp.wav');
  execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', orig, '-af', `${sr},areverse,${sr},areverse`, '-ac', '1', '-c:a', 'pcm_s16le', tmp]);
  fs.renameSync(tmp, wav);
  fs.writeFileSync(mark, String(fs.statSync(wav).mtimeMs));
}

/** mouth openness per 30 fps frame: windowed RMS, normalised to the line's loud part, gated (silence closes the mouth), smoothed */
function envelope(w) {
  const n = Math.ceil((w.samples.length / w.rate) * FPS) + 1, rms = new Float64Array(n);
  const half = w.rate / FPS; // window = 2 frames (50% overlap)
  for (let f = 0; f < n; f++) {
    const a = Math.max(0, Math.round((f - 0.5) * half)), z = Math.min(w.samples.length, Math.round((f + 1.5) * half));
    let s = 0; for (let i = a; i < z; i++) s += w.samples[i] * w.samples[i];
    rms[f] = z > a ? Math.sqrt(s / (z - a)) : 0;
  }
  const sorted = [...rms].sort((x, y) => x - y), ref = Math.max(1e-4, sorted[Math.floor(sorted.length * 0.92)]);
  const out = []; let sm = 0;
  for (let f = 0; f < n; f++) {
    let v = Math.max(0, Math.min(1, rms[f] / ref));
    v = v < 0.12 ? 0 : Math.pow((v - 0.12) / 0.88, 0.75);       // gate + soft curve
    sm += (v - sm) * (v > sm ? 0.75 : 0.45);                      // fast attack, slower release
    out.push(sm < 0.06 ? 0 : Math.round(sm * 100) / 100);
  }
  return out;
}

const lines = [], env = {};
let cursor = LEAD;
story.lines.forEach((ln, i) => {
  const nn = String(i).padStart(2, '0');
  let dur;
  if (ln.who) {
    if (!fs.existsSync(path.join(dir, nn + '.wav'))) { console.error(`timing: missing voice file comp/vo/${id}/${nn}.wav. Run: npm run voice -- ${id}`); process.exit(1); }
    trim(nn);
    const w = readWav(path.join(dir, nn + '.wav'));
    dur = w.samples.length / w.rate;
    env[i] = envelope(w);
  } else dur = ln.dur ?? 1;
  const pause = ln.who ? (ln.pause ?? 0) : 0;
  const start = cursor, end = start + dur;
  lines.push({ i, who: ln.who || null, start: +start.toFixed(3), dur: +dur.toFixed(3), end: +end.toFixed(3), pause, shot: ln.shot, screen: ln.screen, action: ln.action || null });
  cursor = end + pause;
});
const last = lines[lines.length - 1];
const total = +Math.max(last.end + TAIL, cursor).toFixed(3);

// ---- sfx track: the setup's plan module (comp/<setup>.plan.js, export function sfx(ctx)) decides what to synthesise.
// No plan module (or no sfx export) = voices only, no sfx.wav. See SETUPS.md "Story player contract".
// Own set (library/my-<slug>/set.json): its own comp/my-<slug>.plan.js if it has one, else the base style's, fed the story with base keys/shots.
async function sfxTrack(total) {
  const info = setInfo(story.setup);
  let planFile = path.join(HERE, 'comp', `${story.setup}.plan.js`);
  if (info.own && !fs.existsSync(planFile)) planFile = path.join(HERE, 'comp', `${info.base}.plan.js`);
  const sfxFile = path.join(dir, 'sfx.wav');
  fs.rmSync(sfxFile, { force: true });
  if (!fs.existsSync(planFile)) return false;
  const plan = await import(pathToFileURL(planFile).href);
  if (typeof plan.sfx !== 'function') return false;
  const SR = 24000, buf = new Float32Array(Math.ceil(total * SR) + SR);
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const add = (t, fn, len, amp = 1) => { const a = Math.round(t * SR), n = Math.round(len * SR); for (let k = 0; k < n && a + k < buf.length; k++) buf[a + k] += fn(k / SR, k) * amp; };
  const click = (t, amp) => { let lp = 0; add(t, (x) => { const n = rnd() * 2 - 1; lp += (n - lp) * 0.45; return ((n - lp) * 0.9 + Math.sin(x * 2 * Math.PI * (1700 + 500 * amp)) * 0.35) * Math.exp(-x / 0.0022); }, 0.02, 0.32 * amp); };
  const ps = storyForPlayer(story, info), pl = info.own ? lines.map((l) => ({ ...l, who: ps.lines[l.i].who, shot: ps.lines[l.i].shot })) : lines;
  plan.sfx({ story: ps, lines: pl, total, SR, add, rnd, click });
  let peak = 0; for (let k = 0; k < buf.length; k++) peak = Math.max(peak, Math.abs(buf[k]));
  const g = peak > 0 ? 0.85 / peak : 1, pcm = Buffer.alloc(buf.length * 2);
  for (let k = 0; k < buf.length; k++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[k] * g)) * 32767), k * 2);
  const hdr = Buffer.alloc(44); hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(sfxFile, Buffer.concat([hdr, pcm]));
  return true;
}
const hasSfx = await sfxTrack(total);
const js = 'window.TIMING = ' + JSON.stringify({ id, dur: total, ...(hasSfx ? { sfx: `vo/${id}/sfx.wav` } : {}), lines, env }) + ';\n';
fs.writeFileSync(path.join(dir, 'timing.js'), js);
console.log(`timing ${id}: ${total.toFixed(2)} s, ${lines.length} lines${hasSfx ? ', sfx' : ', no sfx (no plan module)'}`);
