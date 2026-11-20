// Render comp/<id>.html to out/<id>.mp4 (1080x1920, 30 fps, H.264 + AAC voices/sfx).
//   node render.mjs s10-e1                 full render
//   node render.mjs s10-e1 --stills 1,4.5  PNG stills only (out/stills/<id>-<t>.png) for quick review
// Portable starter-pack version: browser = installed Chrome, else Edge, else bundled Chromium (see tools/lib/common.mjs).
// A watchdog stops the render with a clear message if the page throws an error or a frame never finishes (V.seek hangs).
import fs from 'fs';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import { ROOT, COMP, OUT, ffmpegPath, launchBrowser, describeGpu } from './tools/lib/common.mjs';

const FFMPEG = ffmpegPath();
const FPS = 30;
const CRF = process.env.VIDEO_CRF || '20';
const PRESET = process.env.VIDEO_PRESET || 'medium';
const MAXRATE = process.env.VIDEO_MAXRATE || '10M';                                // cap so grainy sets do not produce 100+ MB files (TikTok/Reels re-encode anyway)
const FRAME_TIMEOUT_MS = Number(process.env.FRAME_TIMEOUT_SECS || 120) * 1000;  // one frame must finish within this
const ERROR_GRACE_MS = 20 * 1000;                                                // ...or within this once the page has thrown an error
const MAX_TOTAL_MS = Number(process.env.RENDER_MAX_MINUTES || 120) * 60 * 1000;   // absolute ceiling for the whole run

const args = process.argv.slice(2);
const si = args.indexOf('--stills');
const stills = si >= 0 ? args[si + 1].split(',').map(Number) : null;
const spi = args.indexOf('--speed');
const SPEED = spi >= 0 ? Number(args[spi + 1]) : 1;
const reuseSilent = args.includes('--reuse-silent');
const ids = args.filter((a, i) => !a.startsWith('--') && !(si >= 0 && i === si + 1) && !(spi >= 0 && i === spi + 1));
if (!ids.length) { console.error('usage: node render.mjs <story-id> [--stills 1,4.5]'); process.exit(1); }

let browser = null, ffChild = null;
async function die(msg, code = 1) {
  console.error('\nRENDER STOPPED: ' + msg);
  try { ffChild?.kill('SIGKILL'); } catch { /* ignore */ }
  try { await Promise.race([browser?.close(), new Promise((r) => setTimeout(r, 4000))]); } catch { /* ignore */ }
  process.exit(code);
}
const overall = setTimeout(() => die(`the render ran longer than ${MAX_TOTAL_MS / 60000} minutes and was stopped.`, 124), MAX_TOTAL_MS);

function meta(html, name) {
  const m = html.match(new RegExp(`<meta name="${name}"([^>]*)>`));
  if (!m) return null;
  const attrs = {};
  for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
  return attrs;
}

async function render(id) {
  const file = path.join(COMP, id + '.html');
  if (!fs.existsSync(file)) await die(`comp/${id}.html does not exist. Run: npm run video -- ${id}  (it builds the page first)`);
  const html = fs.readFileSync(file, 'utf8');
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('  pageerror', e.message); });
  page.on('console', (m) => m.type() === 'error' && console.log('  console', m.text()));

  // run fn(), but give up (and say why) if it takes too long: a page error makes V.seek hang forever otherwise
  async function guarded(fn, what, limit = FRAME_TIMEOUT_MS) {
    let poll;
    const t0 = Date.now();
    const killer = new Promise((_, rej) => {
      poll = setInterval(() => {
        const lim = pageErrors.length ? Math.min(limit, ERROR_GRACE_MS) : limit;
        if (Date.now() - t0 > lim) rej(new Error(`${what} did not finish within ${Math.round(lim / 1000)} s.` + (pageErrors.length ? `\nThe page reported an error: ${pageErrors[0]}` : '\nNo page error was reported (very slow GPU? try Google Chrome, or set FRAME_TIMEOUT_SECS=300).')));
      }, 500);
    });
    try { return await Promise.race([fn(), killer]); } finally { clearInterval(poll); }
  }
  const seek = (t, label, limit) => guarded(() => page.evaluate((tt) => V.seek(tt), t), label, limit);

  try {
    await page.goto(pathToFileURL(file).href);
    await guarded(() => page.waitForFunction(() => typeof window.V !== 'undefined' && typeof V.onFrame === 'function', null, { timeout: 0 }), 'Loading the scene', 60000);
    await page.evaluate(() => document.fonts.ready);
    const [VW, VH] = await page.evaluate(() => V.size || [1080, 1920]);
    if (VW !== 1080 || VH !== 1920) await page.setViewportSize({ width: VW, height: VH });
    const dur = (await page.evaluate(() => V.dur)) / SPEED;
    const sounds = (await page.evaluate(() => V.sounds || [])).map((s) => ({ ...s, at: s.at / SPEED, ...(s.len != null && { len: s.len / SPEED }) }));
    const oid = SPEED === 1 ? id : id + '-fast';
    const V_GAIN = await page.evaluate(() => V.mixGain ?? 1.8), V_LIMIT = await page.evaluate(() => V.mixLimit ?? 0.9);
    const V_LEVEL = await page.evaluate(() => (V.mixLimit != null ? ':level=0' : ''));

    if (stills) {
      fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
      for (const t of stills) {
        await seek(t, `Still at ${t}s`, 180000);
        await page.screenshot({ path: path.join(OUT, 'stills', `${id}-${t}.png`) });
      }
      console.log(`stills ${id}: ${stills.join(', ')}`);
      return;
    }

    fs.mkdirSync(OUT, { recursive: true });
    const silent = path.join(OUT, `.${oid}.video.mp4`);
    const n = Math.round(dur * FPS);
    const t0 = Date.now();
    if (!(reuseSilent && fs.existsSync(silent))) {
      const ff = spawn(FFMPEG, ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-maxrate', MAXRATE, '-bufsize', String(parseInt(MAXRATE) * 2) + 'M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
      ffChild = ff;
      let ffDead = null;
      ff.on('error', (e) => { ffDead = e; });
      ff.stdin.on('error', () => { /* ffmpeg died: reported below */ });
      for (let f = 0; f < n; f++) {
        if (ffDead) await die('ffmpeg could not start: ' + ffDead.message);
        await seek((f / FPS) * SPEED, `Frame ${f}/${n} (t=${(f / FPS).toFixed(2)}s)`, f === 0 ? 180000 : FRAME_TIMEOUT_MS);
        const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
        if (f % 150 === 0) console.log(`  ${id} frame ${f}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
      ff.stdin.end();
      const code = await new Promise((r) => ff.on('close', r));
      ffChild = null;
      if (code !== 0) await die(`ffmpeg video encoding failed (exit ${code}).`);
    }

    // audio: voices + sfx placed at absolute times (optional music bed via <meta name="music">)
    const mu = meta(html, 'music');
    const outFile = path.join(OUT, oid + '.mp4');
    if (sounds.length) {
      const ins = ['-i', silent];
      const parts = [];
      sounds.forEach((s, i) => {
        if (s.loop) ins.push('-stream_loop', '-1');
        if (s.from) ins.push('-ss', String(s.from));
        ins.push('-i', path.join(COMP, s.src));
        const ms = Math.round(s.at * 1000);
        let ex = '';
        if (s.len != null) ex += `,atrim=0:${s.len},asetpts=N/SR/TB`;
        if (s.fi) ex += `,afade=t=in:d=${s.fi}`;
        if (s.fo) ex += `,afade=t=out:st=${((s.len ?? dur) - s.fo).toFixed(3)}:d=${s.fo}`;
        parts.push(`[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo${ex},volume=${s.vol ?? 1},adelay=${ms}|${ms}[s${i}]`);
      });
      const cnt0 = sounds.length;
      if (mu?.content) {
        ins.push('-ss', mu['data-start'] ?? '0', '-i', path.join(COMP, mu.content));
        parts.push(`[${cnt0 + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${dur},asetpts=N/SR/TB,volume=${mu['data-vol'] ?? '0.15'},afade=t=in:d=0.4,afade=t=out:st=${(dur - 1.6).toFixed(2)}:d=1.6[m]`);
      }
      const labels = sounds.map((_, i) => `[s${i}]`).join('') + (mu?.content ? '[m]' : '');
      const cnt = cnt0 + (mu?.content ? 1 : 0);
      parts.push(`${labels}amix=inputs=${cnt}:normalize=0:duration=longest,apad,atrim=0:${dur},volume=${V_GAIN},alimiter=limit=${V_LIMIT}${V_LEVEL},aresample=48000[a]`);
      execFileSync(FFMPEG, ['-nostdin', '-loglevel', 'error', '-y', ...ins, '-filter_complex', parts.join(';'),
        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outFile]);
    } else {
      execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', silent, '-c', 'copy', '-movflags', '+faststart', outFile]);
    }
    fs.rmSync(silent, { force: true });
    const th = String(Number(meta(html, 'thumb')?.content ?? '1.5') / SPEED);
    execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-ss', th, '-i', outFile, '-frames:v', '1', '-q:v', '2', path.join(OUT, oid + '-thumb.jpg')]);
    console.log(`done ${oid}  ${dur.toFixed(1)}s  ${((Date.now() - t0) / 1000).toFixed(0)}s render`);
    console.log('MP4: ' + outFile);
  } catch (e) {
    await die(e.message);
  } finally {
    await page.close().catch(() => {});
  }
}

try {
  browser = await launchBrowser();
  console.log(`browser: ${browser.__name}`);
  const gpu = await describeGpu(browser);
  console.log(gpu.text);
  if (!gpu.ok) await die('WebGL is not available. Install/use Google Chrome (or Edge) and try again.');
  for (const id of ids) await render(id);
} catch (e) {
  await die(e.message);
}
await browser.close();
clearTimeout(overall);
