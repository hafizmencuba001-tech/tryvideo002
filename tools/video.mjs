// One command: story JSON -> page -> voices -> timing(+sfx) -> render -> out/<id>.mp4
//   npm run video -- s10-e1                         voice provider from .env (VOICE_PROVIDER), default "free"
//   npm run video -- s10-e1 --provider elevenlabs   choose the voice engine for this run
//   npm run video -- s10-e1 --open                  open the MP4 when done
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ROOT, OUT, runNode, readStory } from './lib/common.mjs';

const argv = process.argv.slice(2);
const id = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--provider');
if (!id) { console.error('usage: npm run video -- <story-id> [--provider elevenlabs|gemini|free] [--open]'); process.exit(1); }
const pi = argv.indexOf('--provider');
const providerArgs = pi >= 0 ? ['--provider', argv[pi + 1]] : [];
try { readStory(id); } catch (e) { console.error(e.message); process.exit(1); }

const step = (name, script, args) => {
  console.log(`\n=== ${name} ===`);
  const code = runNode(script, args);
  if (code !== 0) { console.error(`\nStopped at step "${name}" (exit ${code}). Nothing was rendered.`); process.exit(code); }
};
step('1/4 build page', 'tools/make-story.mjs', [id]);
step('2/4 voices', 'tools/voice.mjs', [id, ...providerArgs]);
step('3/4 timing + sound effects', 'tools/timing.mjs', [id]);
step('4/4 render (this takes a few minutes)', 'render.mjs', [id]);

const mp4 = path.join(OUT, id + '.mp4');
if (!fs.existsSync(mp4)) { console.error('Render finished but ' + mp4 + ' is missing.'); process.exit(1); }
console.log(`\nDONE (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB)\n${mp4}`);
if (argv.includes('--open')) {
  const [cmd, a] = process.platform === 'darwin' ? ['open', [mp4]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', mp4]] : ['xdg-open', [mp4]];
  spawn(cmd, a, { stdio: 'ignore', detached: true }).unref();
}
