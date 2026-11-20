// One WAV per spoken line: comp/vo/<id>/NN.wav (24 kHz mono 16-bit). who:null lines (silent beats) are skipped.
//   node tools/voice.mjs <story-id> [--provider elevenlabs|gemini|free] [--force] [--keep-existing]
// Provider default: VOICE_PROVIDER in .env, else "free".
//   elevenlabs  REST text-to-speech, model eleven_multilingual_v2 (Malay), voice per character = voices.json "elevenlabs_voice_id"
//   gemini      Google Gemini TTS; voice name + style per character from cast.json; story "delivery" goes into the prompt
//   free        computer voice: macOS `say` (Amira = Malay), Windows System.Speech (PowerShell). A placeholder: robotic.
// Cache: NN.stamp records provider + voice + text; a line is only regenerated when one of those changed (or with --force).
// --keep-existing: keep any existing WAV whose text is unchanged, whatever voice made it (used by stills/check so they never spend API credits).
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { ROOT, COMP, ffmpegPath, readStory, loadCast, loadVoices, setInfo } from './lib/common.mjs';

class UserError extends Error {}
const PROVIDERS = ['elevenlabs', 'gemini', 'free'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const id = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--provider');
if (!id) { console.error('usage: node tools/voice.mjs <story-id> [--provider elevenlabs|gemini|free] [--force] [--keep-existing]'); process.exit(1); }
const provider = (opt('--provider') || process.env.VOICE_PROVIDER || 'free').toLowerCase().trim();
if (!PROVIDERS.includes(provider)) { console.error(`Unknown voice provider "${provider}". Use one of: ${PROVIDERS.join(', ')} (VOICE_PROVIDER in .env or --provider).`); process.exit(1); }
const FORCE = flag('--force'), KEEP = flag('--keep-existing');

const story = readStory(id);
const cast = loadCast();      // library/<style>/cast.json of every installed style + root cast.json
const VOICES = loadVoices();  // root voices.json + library/<style>/voices.json
const dir = path.join(COMP, 'vo', id);
fs.mkdirSync(dir, { recursive: true });
const FFMPEG = ffmpegPath();

// ---------- helpers ----------
function pcmToWav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + (r.stderr || '').trim());
}
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vcs-voice-'));
process.on('exit', () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ } });
const cleanText = (t) => String(t).replace(/\s+/g, ' ').trim();

// ---------- ElevenLabs ----------
async function elevenlabs(charKey, text, out) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new UserError('ELEVENLABS_API_KEY is empty. Put your key in the ".env" file (see .env.example), or run with --provider free.');
  const c = VOICES.characters[charKey];
  const voiceId = c?.elevenlabs_voice_id;
  if (!voiceId) throw new UserError(`No "elevenlabs_voice_id" for character "${charKey}" in voices.json or library/<style>/voices.json.`);
  const base = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';
  const E = VOICES.elevenlabs;
  const body = JSON.stringify({ text, model_id: E.model_id, voice_settings: E.voice_settings });
  for (const fmt of ['pcm_24000', 'mp3_44100_128']) {
    let res;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        res = await fetch(`${base}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${fmt}`, {
          method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: '*/*' }, body, signal: AbortSignal.timeout(120000),
        });
      } catch (e) { if (attempt === 4) throw new UserError('Cannot reach ElevenLabs (network?): ' + e.message); await sleep(2000 * (attempt + 1)); continue; }
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (attempt + 1)); continue; }
      break;
    }
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (fmt === 'pcm_24000') { fs.writeFileSync(out, pcmToWav(buf, 24000)); return; }
      const mp3 = path.join(tmpDir, 'el.mp3'); fs.writeFileSync(mp3, buf);
      ffmpeg(['-i', mp3, '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', out]); return;
    }
    const txt = (await res.text()).slice(0, 400);
    if (res.status === 401) throw new UserError('ElevenLabs rejected the API key (401). Check ELEVENLABS_API_KEY in .env (no spaces, no quotes needed).');
    if (res.status === 404 || /voice_not_found/i.test(txt)) throw new UserError(`ElevenLabs: voice id ${voiceId} (${charKey}) was not found. Pick another voice and update voices.json. Detail: ${txt}`);
    if (/quota/i.test(txt) || res.status === 402) throw new UserError('ElevenLabs: out of characters/credits for this month (or plan limit). Top up, or run with --provider free. Detail: ' + txt);
    if (fmt === 'pcm_24000' && (res.status === 400 || res.status === 403 || res.status === 422)) continue; // output format not allowed on this plan: retry as mp3
    throw new UserError(`ElevenLabs error HTTP ${res.status}: ${txt}`);
  }
  throw new UserError('ElevenLabs request failed.');
}

// ---------- Gemini ----------
function geminiModel() { return VOICES.gemini.models?.[story.setup] || VOICES.gemini.models?.[setInfo(story.setup).base] || VOICES.gemini.default_model; } // own set: its base style's model
async function gemini(charKey, text, delivery, out) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new UserError('GEMINI_API_KEY is empty. Put your key in the ".env" file (see .env.example), or run with --provider free.');
  const p = cast[charKey];
  const model = geminiModel();
  const base = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  // "{style}: {text}" gets blocked (false-positive PROHIBITED_CONTENT) on short lines; this phrasing passes reliably
  const prompt = delivery ? `Say in this voice (${p.style}), ${delivery}: ${text}` : `Say in this voice (${p.style}): ${text}`;
  const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: p.voice } } } } };
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await fetch(`${base}/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload), signal: AbortSignal.timeout(120000) });
    } catch (e) { if (attempt === 4) throw new UserError('Cannot reach Gemini (network?): ' + e.message); await sleep(3000 * (attempt + 1)); continue; }
    const raw = await res.text();
    if (res.ok) {
      let part;
      try { part = JSON.parse(raw).candidates[0].content.parts[0].inlineData; } catch { part = null; }
      if (!part?.data) { await sleep(3000 * (attempt + 1)); continue; } // 200 without audio (flaky TTS): retry
      const m = /rate=(\d+)/.exec(part.mimeType || '');
      fs.writeFileSync(out, pcmToWav(Buffer.from(part.data, 'base64'), m ? Number(m[1]) : 24000));
      return;
    }
    if (res.status === 429 && /per_?day|PerDay/i.test(raw)) throw new UserError(`Gemini: the free daily quota for model ${model} is used up. Try tomorrow, use --provider elevenlabs, or --provider free.`);
    if (res.status === 429 || res.status === 500 || res.status === 503) { await sleep(8000 * (attempt + 1)); continue; }
    if (res.status === 400 && /API key/i.test(raw)) throw new UserError('Gemini rejected the API key. Check GEMINI_API_KEY in .env.');
    if (res.status === 403) throw new UserError('Gemini: access denied (403). Check GEMINI_API_KEY and that the key is allowed to use the Generative Language API. ' + raw.slice(0, 200));
    throw new UserError(`Gemini error HTTP ${res.status}: ${raw.slice(0, 300)}`);
  }
  throw new UserError('Gemini TTS failed after 5 attempts (quota or network). Run the same command again later: lines already done are kept.');
}

// ---------- free (macOS say / Windows System.Speech) ----------
const FREE_DEFAULT = { voice: 'Amira', rate: 175, pitch: 0 };
let sayVoices = null, warnedVoice = false;
function resolveSayVoice(want) {
  if (!sayVoices) {
    const r = spawnSync('say', ['-v', '?'], { encoding: 'utf8' });
    sayVoices = (r.stdout || '').split('\n').map((l) => l.match(/^(.+?)\s{2,}([a-z]{2,3}_[A-Za-z]{2})\s+#/)).filter(Boolean).map((m) => ({ name: m[1].trim(), lang: m[2] }));
  }
  const names = sayVoices.map((v) => v.name);
  if (names.includes(want)) return want;
  const base = want.replace(/\s*\(.*\)$/, '');
  const cand = names.find((n) => n === base) || names.find((n) => n.startsWith(base + ' ('));
  if (cand) return cand;
  const ms = sayVoices.find((v) => v.lang.startsWith('ms_'));
  if (ms) return ms.name;
  if (!warnedVoice) { warnedVoice = true; console.log('  note: the Malay voice "Amira" is not installed, so the Mac default voice is used (English accent). For a Malay accent: System Settings > Accessibility > Spoken Content > System Voice > Manage Voices > Malay > Amira. Or use ElevenLabs.'); }
  return null;
}
function pitchFilter(pitch, tempo) {
  const f = 2 ** (pitch / 12);
  if (Math.abs(pitch) > 1e-6) return `aresample=48000,asetrate=${Math.round(48000 * f)},aresample=24000,atempo=${(tempo / f).toFixed(4)}`;
  return Math.abs(tempo - 1) > 1e-3 ? `aresample=24000,atempo=${tempo.toFixed(4)}` : 'aresample=24000';
}
const PS_SCRIPT = `param([string]$TextFile,[string]$Out)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = @($s.GetInstalledVoices() | Where-Object { $_.Enabled })
$pick = $voices | Where-Object { $_.VoiceInfo.Culture.Name -like 'ms*' } | Select-Object -First 1
if (-not $pick) { $pick = $voices | Where-Object { $_.VoiceInfo.Culture.Name -like 'id*' } | Select-Object -First 1 }
if ($pick) { $s.SelectVoice($pick.VoiceInfo.Name) }
$text = [System.IO.File]::ReadAllText($TextFile, [System.Text.Encoding]::UTF8)
$s.SetOutputToWaveFile($Out)
$s.Speak($text)
$s.Dispose()
`;
function freeVoice(charKey, text, out) {
  const c = { ...FREE_DEFAULT, ...(VOICES.characters[charKey]?.free || {}) };
  const raw = path.join(tmpDir, process.platform === 'darwin' ? 'x.aiff' : 'x.wav');
  if (process.platform === 'darwin') {
    const v = resolveSayVoice(c.voice);
    const a = [...(v ? ['-v', v] : []), '-r', String(c.rate), '-o', raw, '--', text];
    const r = spawnSync('say', a, { encoding: 'utf8' });
    if (r.status !== 0) throw new UserError('macOS "say" failed: ' + (r.stderr || r.error?.message || ''));
    ffmpeg(['-i', raw, '-af', pitchFilter(c.pitch, 1), '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', out]);
  } else if (process.platform === 'win32') {
    const txt = path.join(tmpDir, 'x.txt'), ps = path.join(tmpDir, 'x.ps1');
    fs.writeFileSync(txt, text, 'utf8'); fs.writeFileSync(ps, '﻿' + PS_SCRIPT, 'utf8');
    const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps, '-TextFile', txt, '-Out', raw], { encoding: 'utf8' });
    if (r.status !== 0 || !fs.existsSync(raw)) throw new UserError('Windows speech (System.Speech) failed: ' + ((r.stderr || r.error?.message || '').trim().slice(0, 300)));
    ffmpeg(['-i', raw, '-af', pitchFilter(c.pitch, c.rate / 175), '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', out]);
  } else {
    throw new UserError('The free voice only works on macOS and Windows. Use --provider elevenlabs or --provider gemini on this computer.');
  }
}

// ---------- per-line plan ----------
function descriptor(ln) {
  const text = cleanText(ln.text);
  if (provider === 'elevenlabs') return { provider, model: VOICES.elevenlabs.model_id, voice: VOICES.characters[ln.who]?.elevenlabs_voice_id, settings: VOICES.elevenlabs.voice_settings, text };
  if (provider === 'gemini') return { provider, model: geminiModel(), voice: cast[ln.who]?.voice, style: cast[ln.who]?.style, delivery: ln.delivery || '', text };
  return { provider, platform: process.platform, voice: VOICES.characters[ln.who]?.free || FREE_DEFAULT, text };
}
const hash = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex');

let made = 0, cached = 0, spoken = 0;
try {
  for (let i = 0; i < story.lines.length; i++) {
    const ln = story.lines[i];
    if (!ln.who) continue;
    spoken++;
    const nn = String(i).padStart(2, '0');
    if (!ln.text || !cleanText(ln.text)) throw new UserError(`stories/${id}.json line ${i}: "text" is empty.`);
    if (!cast[ln.who]) throw new UserError(`stories/${id}.json line ${i}: unknown character "${ln.who}" (not in cast.json or library/<style>/cast.json; is the style installed?).`);
    const wav = path.join(dir, nn + '.wav'), stampFile = path.join(dir, nn + '.stamp');
    const want = descriptor(ln);
    let old = null;
    try { old = JSON.parse(fs.readFileSync(stampFile, 'utf8')); } catch { /* none */ }
    if (!FORCE && fs.existsSync(wav)) {
      if (KEEP ? (!old || old.text === want.text) : old && old.hash === hash(want)) { cached++; continue; }
    }
    const text = want.text;
    if (provider === 'elevenlabs') await elevenlabs(ln.who, text, wav);
    else if (provider === 'gemini') await gemini(ln.who, text, ln.delivery ? cleanText(ln.delivery) : '', wav);
    else freeVoice(ln.who, text, wav);
    fs.writeFileSync(stampFile, JSON.stringify({ hash: hash(want), provider, text: want.text }));
    fs.rmSync(path.join(dir, nn + '.trimmed'), { force: true });
    made++;
    console.log(`  voice ${nn} ${ln.who} (${provider})`);
  }
} catch (e) {
  if (e instanceof UserError) { console.error('\nVOICE STOPPED: ' + e.message); process.exit(1); }
  throw e;
}
console.log(`voice ${id}: ${spoken} spoken lines, ${made} made with "${provider}", ${cached} kept from cache`);
