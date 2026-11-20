// Look before you render: a still at the middle of every line (plus optional extra times).
//   npm run stills -- s10-e1              PNGs in out/stills/   (fast)
//   npm run check  -- s10-e1              same + one contact sheet out/s10-e1-sheet.jpg (labels: time, speaker, shot, action, text)
//   add  --times 1.2,3.4  for extra moments
//   npm run stills -- s10-e1 --two        only 2 stills: one wide shot + one close shot (the quick look before asking "ok render?")
//   npm run stills -- s10-e1 --lines 0,4  only the stills of these line numbers
// Uses voices already made for this story (any provider); missing ones are made with the free voice, so this never spends API credits.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { ROOT, COMP, OUT, runNode, readStory, launchBrowser } from './lib/common.mjs';

const argv = process.argv.slice(2);
const stillsOnly = argv.includes('--stills-only');
const ti = argv.indexOf('--times');
const extra = ti >= 0 ? argv[ti + 1].split(',').map(Number).filter((n) => !Number.isNaN(n)) : [];
const li = argv.indexOf('--lines');
const onlyLines = li >= 0 ? argv[li + 1].split(',').map(Number).filter((n) => Number.isInteger(n)) : null;
const two = argv.includes('--two');
const id = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--times' && argv[i - 1] !== '--lines');
if (!id) { console.error('usage: npm run stills|check -- <story-id> [--two] [--lines 0,4] [--times 1.2,3.4]'); process.exit(1); }
let story;
try { story = readStory(id); } catch (e) { console.error(e.message); process.exit(1); }

const must = (code, what) => { if (code !== 0) { console.error(`Stopped: ${what} failed.`); process.exit(code); } };
must(runNode('tools/make-story.mjs', [id]), 'building the page');
must(runNode('tools/voice.mjs', [id, '--provider', 'free', '--keep-existing']), 'making voices');
must(runNode('tools/timing.mjs', [id]), 'timing');

const w = {}; new Function('window', fs.readFileSync(path.join(COMP, 'vo', id, 'timing.js'), 'utf8'))(w);
// --two: the first wide/two-shot line and the first close shot (a character or screen shot) after it
const WIDE = /^(wide|two|ws|establish)/i;
let pick = onlyLines;
if (two) {
  const tl = w.TIMING.lines;
  const wide = tl.find((l) => WIDE.test(l.shot || '')) || tl[0];
  const close = tl.find((l) => l.who && l.i !== wide.i && !WIDE.test(l.shot || '') && !/screen/i.test(l.shot || '')) ||
    tl.find((l) => l.i !== wide.i && !WIDE.test(l.shot || '')) || tl[Math.floor(tl.length / 2)];
  pick = [wide.i, close.i];
}
const cells = w.TIMING.lines.filter((l) => !pick || pick.includes(l.i)).map((l) => {
  const sl = story.lines[l.i];
  return { t: +(l.start + l.dur / 2).toFixed(2), label: `${l.i} ${l.who || 'beat'} | ${l.shot}${l.action ? ' | ' + l.action : ''}`, text: sl.text || sl.beat || '' };
}).concat(extra.map((t) => ({ t, label: 'extra ' + t, text: '' })));
must(runNode('render.mjs', [id, '--stills', cells.map((c) => c.t).join(',')]), 'rendering stills');
const stillPath = (c) => path.join(OUT, 'stills', `${id}-${c.t}.png`);

if (stillsOnly) {
  console.log('\nStills:');
  for (const c of cells) console.log(`  ${stillPath(c)}   (${c.label})`);
  process.exit(0);
}

const SW = 300, SH = Math.round(SW * 16 / 9), COLS = Math.min(cells.length, 6);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:16px;background:#10131f;font:13px/1.25 Menlo,Consolas,monospace;color:#cfd6ee;width:max-content}
.g{display:grid;grid-template-columns:repeat(${COLS},${SW}px);gap:12px}.c img{width:${SW}px;height:${SH}px;display:block;border-radius:6px}
.c b{color:#19e3ff}.c div{margin-top:4px;height:48px;overflow:hidden}</style>
<div class="g">${cells.map((c) => `<div class="c"><img src="${pathToFileURL(stillPath(c)).href}"><div><b>${c.t}s</b> ${esc(c.label)}<br>${esc(c.text)}</div></div>`).join('')}</div>`;
const tmp = path.join(OUT, `.${id}-sheet.html`);
fs.writeFileSync(tmp, html);
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: COLS * (SW + 12) + 40, height: 800 } });
await page.goto(pathToFileURL(tmp).href);
await page.waitForLoadState('load');
await page.waitForTimeout(500);
const sheet = path.join(OUT, `${id}-sheet.jpg`);
await page.screenshot({ path: sheet, type: 'jpeg', quality: 88, fullPage: true });
await browser.close();
fs.rmSync(tmp, { force: true });
console.log('\nContact sheet (open it and LOOK at it):\n' + sheet);
console.log('Single stills are in ' + path.join(OUT, 'stills'));
