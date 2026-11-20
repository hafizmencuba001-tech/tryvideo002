// Shared helpers for every tool: project root, .env, ffmpeg path, browser launcher.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const COMP = path.join(ROOT, 'comp');
export const OUT = path.join(ROOT, 'out');
const require = createRequire(import.meta.url);

/** Read ROOT/.env (KEY=VALUE lines) into process.env. Real environment variables win over the file. */
export function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1].startsWith('#')) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    if (process.env[m[1]] === undefined || process.env[m[1]] === '') process.env[m[1]] = v;
  }
}
loadEnv();

let _ffmpeg;
/** ffmpeg binary: the one bundled by `npm install` (ffmpeg-static), else `ffmpeg` on PATH. */
export function ffmpegPath() {
  if (_ffmpeg) return _ffmpeg;
  try {
    const p = require('ffmpeg-static');
    if (p && fs.existsSync(p)) return (_ffmpeg = p);
  } catch { /* fall through */ }
  const r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (r.status === 0) return (_ffmpeg = 'ffmpeg');
  throw new Error('ffmpeg not found. Run "npm install" in this folder (it downloads ffmpeg-static), or install ffmpeg.');
}

const BROWSER_ARGS = ['--allow-file-access-from-files', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];

/**
 * Launch a browser for rendering. Order: installed Google Chrome, installed Microsoft Edge, Playwright's bundled Chromium.
 * Real Chrome/Edge are preferred because they use the GPU for WebGL (bundled headless Chromium falls back to slow software GL).
 * Override with BROWSER_CHANNEL=chrome|msedge|chromium in .env.
 */
export async function launchBrowser() {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { throw new Error('The "playwright" package is missing. Run "npm install" in this folder first.'); }
  const order = [{ name: 'Google Chrome', opts: { channel: 'chrome' } }, { name: 'Microsoft Edge', opts: { channel: 'msedge' } }, { name: 'bundled Chromium', opts: {} }];
  const want = (process.env.BROWSER_CHANNEL || '').toLowerCase();
  if (want) {
    const i = order.findIndex((o) => (o.opts.channel || 'chromium') === want);
    if (i > 0) order.unshift(order.splice(i, 1)[0]);
  }
  const errors = [];
  for (const o of order) {
    try {
      const b = await chromium.launch({ ...o.opts, args: BROWSER_ARGS });
      b.__name = o.name;
      return b;
    } catch (e) { errors.push(`${o.name}: ${String(e.message).split('\n')[0]}`); }
  }
  throw new Error('No browser could be started.\n  ' + errors.join('\n  ') +
    '\nFix: install Google Chrome (https://www.google.com/chrome) or use Microsoft Edge, or run:  npx playwright install chromium');
}

/** One line about the GPU the browser will use (warns when WebGL is software-only, which is very slow). */
export async function describeGpu(browser) {
  const page = await browser.newPage();
  try {
    const info = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return null;
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown GPU';
    });
    if (!info) return { ok: false, text: 'WebGL is NOT available in this browser. Use Google Chrome.' };
    const soft = /swiftshader|llvmpipe|software|basic render/i.test(info);
    return { ok: true, soft, text: `GPU: ${info}${soft ? '  (software rendering: this will be slow; use Google Chrome with a normal graphics driver)' : ''}` };
  } finally { await page.close(); }
}

// ---------- installed styles, cast and voices ----------
// Every style lives in library/<style-id>/ (README.md, thumb.jpg, cast.json, voices.json) plus its comp/<style-id>* files.
// cast and voices = the fragments of every installed style, then the root cast.json / voices.json on top (root wins).

/** Installed style ids (folders under library/ that have a README.md, or a set.json for an own set still being drawn), sorted by set number; own sets last. */
export function installedStyles() {
  const lib = path.join(ROOT, 'library');
  if (!fs.existsSync(lib)) return [];
  const num = (s) => Number((s.match(/^s(\d+)-/) || [0, 1e9])[1]);
  return fs.readdirSync(lib).filter((d) => fs.existsSync(path.join(lib, d, 'README.md')) || fs.existsSync(path.join(lib, d, 'set.json')))
    .sort((a, b) => num(a) - num(b) || a.localeCompare(b));
}

// ---------- own sets (the student's own characters drawn in an installed style) ----------
// An own set "my-<slug>" has library/my-<slug>/set.json: { "base": "s10-kertas", "keys": { "<own key>": "<base key>" }, "shots": { "<own shot>": "<base shot>" } }.
// It plays with the base style's player (comp/<base prefix>-story.js). Each comp/my-<slug>.<part>.js REPLACES comp/<base>.<part>.js when the base
// has that part (normally only .cast.js), via the page's import map; comp/my-<slug>.loc-<place>.js ADDS a location. Story ids start with "my-<slug>-".
// The page sees the base keys/shots (keys and shots are mapped when the page is built), so the base player and plan work unchanged.

/** { id, base, own, prefix, player, keys, shots, replace: [{ part, ownFile, baseFile }] } for a story's "setup". */
export function setInfo(setup) {
  const file = path.join(ROOT, 'library', setup, 'set.json');
  if (!fs.existsSync(file)) {
    const prefix = setup.split('-')[0];
    return { id: setup, base: setup, own: false, prefix, player: `${prefix}-story.js`, keys: {}, shots: {}, replace: [] };
  }
  const s = readJsonFile(file, {});
  if (!s.base) throw new Error(`library/${setup}/set.json: "base" (the style it is drawn in, e.g. "s10-kertas") is missing`);
  if (fs.existsSync(path.join(ROOT, 'library', s.base, 'set.json'))) throw new Error(`library/${setup}/set.json: base "${s.base}" is an own set; use an installed style as base`);
  const replace = [];
  if (fs.existsSync(COMP)) {
    for (const f of fs.readdirSync(COMP)) {
      if (!f.startsWith(setup + '.') || !f.endsWith('.js') || f.startsWith(setup + '.loc-')) continue;
      const part = f.slice(setup.length); // ".cast.js"
      if (fs.existsSync(path.join(COMP, s.base + part))) replace.push({ part, ownFile: f, baseFile: s.base + part });
    }
  }
  return { id: setup, base: s.base, own: true, prefix: setup, player: `${s.base.split('-')[0]}-story.js`, keys: s.keys || {}, shots: s.shots || {}, replace };
}

/** The story as the base player must see it: own cast keys and shot names mapped to the base style's. */
export function storyForPlayer(story, info = setInfo(story.setup)) {
  if (!info.own) return story;
  return { ...story, lines: story.lines.map((l) => ({ ...l, ...(l.who && info.keys[l.who] ? { who: info.keys[l.who] } : {}), ...(l.shot && info.shots[l.shot] ? { shot: info.shots[l.shot] } : {}) })) };
}

/** Problems with an own set (empty list = fine): base installed, every key mapped and in its cast.json, replacement modules export what the base imports. */
export function checkOwnSet(info) {
  const out = [];
  if (!info.own) return out;
  if (!fs.existsSync(path.join(COMP, info.player))) { out.push(`the base style ${info.base} is not installed (comp/${info.player} is missing). Add it from its link: https://pandaitech.my/v/gaya`); return out; }
  const castFile = path.join(ROOT, 'library', info.id, 'cast.json');
  const own = readJsonFile(castFile, null);
  if (!own) out.push(`library/${info.id}/cast.json is missing`);
  const baseCast = readJsonFile(path.join(ROOT, 'library', info.base, 'cast.json'), {});
  for (const [k, b] of Object.entries(info.keys)) {
    if (own && !own[k]) out.push(`set.json maps "${k}" but library/${info.id}/cast.json has no "${k}"`);
    if (!baseCast[b]) out.push(`set.json maps "${k}" to "${b}", which is not a character of ${info.base} (${Object.keys(baseCast).join(', ')})`);
  }
  if (own) for (const k of Object.keys(own)) if (!info.keys[k]) out.push(`character "${k}" is in cast.json but not in set.json "keys"`);
  if (!info.replace.length) out.push(`no comp/${info.id}.<part>.js replaces a module of ${info.base} (expected e.g. comp/${info.id}.cast.js)`);
  // names the base modules import from each replaced module must be exported by the own module
  const baseFiles = fs.readdirSync(COMP).filter((f) => (f.startsWith(info.base + '.') || f === info.player) && f.endsWith('.js'));
  for (const r of info.replace) {
    const src = fs.readFileSync(path.join(COMP, r.ownFile), 'utf8');
    const need = new Set();
    for (const bf of baseFiles) {
      const txt = fs.readFileSync(path.join(COMP, bf), 'utf8');
      for (const m of txt.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/([^'"]+)['"]/g)) if (m[2] === r.baseFile) m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach((n) => need.add(n));
    }
    const missing = [...need].filter((n) => !new RegExp(`export\\s+(async\\s+)?(function|const|let|class)\\s+${n}\\b|export\\s*\\{[^}]*\\b${n}\\b`).test(src));
    if (missing.length) out.push(`comp/${r.ownFile} must export ${missing.join(', ')} (like comp/${r.baseFile})`);
  }
  return out;
}

function readJsonFile(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${path.relative(ROOT, file)} is not valid JSON: ${e.message}`); }
}
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
/** Merge character entries one level deep: only the fields given are replaced (a nested object such as "free" is merged too). */
function mergeChars(into, from) {
  for (const [k, v] of Object.entries(from || {})) {
    if (!isObj(v)) { into[k] = v; continue; }
    const cur = isObj(into[k]) ? { ...into[k] } : {};
    for (const [f, fv] of Object.entries(v)) cur[f] = isObj(fv) && isObj(cur[f]) ? { ...cur[f], ...fv } : fv;
    into[k] = cur;
  }
  return into;
}
const fragments = (name) => installedStyles().map((s) => path.join(ROOT, 'library', s, name)).filter((f) => fs.existsSync(f));

/** Character key -> { voice, style } (Gemini). Merged from library/<style>/cast.json files + root cast.json. */
export function loadCast() {
  const cast = {};
  for (const f of fragments('cast.json')) mergeChars(cast, readJsonFile(f, {}));
  return mergeChars(cast, readJsonFile(path.join(ROOT, 'cast.json'), {}));
}

/** voices.json settings with "characters" and "gemini.models" merged from library/<style>/voices.json files (root voices.json wins). */
export function loadVoices() {
  const root = readJsonFile(path.join(ROOT, 'voices.json'), {});
  const v = { ...root, gemini: { ...(root.gemini || {}), models: {} }, characters: {} };
  for (const f of fragments('voices.json')) {
    const frag = readJsonFile(f, {});
    mergeChars(v.characters, frag.characters);
    Object.assign(v.gemini.models, frag.gemini?.models || {});
  }
  mergeChars(v.characters, root.characters);
  Object.assign(v.gemini.models, root.gemini?.models || {});
  return v;
}

export function readStory(id) {
  const file = path.join(ROOT, 'stories', id + '.json');
  if (!fs.existsSync(file)) {
    const have = fs.existsSync(path.join(ROOT, 'stories')) ? fs.readdirSync(path.join(ROOT, 'stories')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort() : [];
    const styles = installedStyles();
    throw new Error(`stories/${id}.json not found.` + (have.length ? ` Existing stories: ${have.join(', ')}` : '') +
      (styles.length ? `\nInstalled styles: ${styles.join(', ')}.` : '\nNo style is installed yet. Paste a style link from https://pandaitech.my/v/gaya to Claude to add one.'));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Run another tool script as a child process (same Node), inheriting the terminal. Returns the exit code. */
export function runNode(script, args = [], opts = {}) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...args], { stdio: 'inherit', cwd: ROOT, env: process.env, ...opts });
  return r.status ?? 1;
}
