// Live preview: play an episode's scene in the browser (no recording, no sound).
//   npm run preview -- <story-id> [--minutes 10]
// Browsers block the scene's modules when the html is opened straight from disk, so this serves the folder on
// localhost, opens comp/<id>.html?play and stops by itself after --minutes. Run it in the background.
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import { ROOT, COMP, runNode } from './lib/common.mjs';

const args = process.argv.slice(2);
const id = args.find(a => !a.startsWith('--'));
if (!id) { console.error('usage: npm run preview -- <story-id> [--minutes 10]'); process.exit(2); }
const mi = args.indexOf('--minutes');
const minutes = mi >= 0 ? Number(args[mi + 1]) || 10 : 10;

if (!fs.existsSync(path.join(COMP, `${id}.html`))) await runNode('tools/make-story.mjs', [id]);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/comp/${id}.html?play`;
  console.log(`Preview: ${url} (stops in ${minutes} min)`);
  const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['open', [url]];
  if (!process.env.PREVIEW_NO_OPEN) spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref();
});
setTimeout(() => { server.close(); process.exit(0); }, minutes * 60 * 1000).unref?.();
setTimeout(() => process.exit(0), minutes * 60 * 1000 + 500);
