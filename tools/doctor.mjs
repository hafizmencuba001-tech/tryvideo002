// Checks that this computer can render: Node, ffmpeg, a browser with WebGL, and the installed styles.   npm run doctor
// With --quiet (used after npm install) it only checks Node and ffmpeg and never fails the install.
// Works with zero styles installed (a fresh engine): it then says how to add one.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ROOT, ffmpegPath, launchBrowser, describeGpu, installedStyles, loadCast, loadVoices, setInfo, checkOwnSet } from './lib/common.mjs';

const quiet = process.argv.includes('--quiet');
let problems = 0;
const ok = (m) => !quiet && console.log('  OK   ' + m);
const bad = (m) => { problems++; console.log('  FIX  ' + m); };

const major = Number(process.versions.node.split('.')[0]);
major >= 18 ? ok(`Node ${process.versions.node}`) : bad(`Node ${process.versions.node} is too old. Mac: bash tools/get-node-mac.sh, then export PATH="$HOME/.video-claude/node/bin:$PATH". Windows: winget install OpenJS.NodeJS.LTS`);
try {
  const r = spawnSync(ffmpegPath(), ['-version'], { encoding: 'utf8' });
  r.status === 0 ? ok(r.stdout.split('\n')[0]) : bad('ffmpeg is installed but does not run. Delete node_modules and run: npm install');
} catch (e) { bad(e.message); }

let styles = [];
if (!quiet) {
  try {
    styles = installedStyles();
    const cast = loadCast(), voices = loadVoices();
    const infos = styles.map((s) => setInfo(s)), own = infos.filter((i) => i.own);
    styles = infos.filter((i) => !i.own).map((i) => i.id);
    const prefixes = styles.map((s) => s.split('-')[0]);
    if (!styles.length) ok('Styles: none installed yet (paste a style link from https://pandaitech.my/v/gaya to add one)');
    else ok(`Styles (${styles.length}): ${styles.join(', ')}  |  ${Object.keys(cast).length} characters, ${Object.keys(voices.characters || {}).length} voices`);
    for (const s of styles) {
      const p = s.split('-')[0];
      if (!fs.existsSync(path.join(ROOT, 'comp', `${p}-story.js`))) bad(`Style ${s} is incomplete (comp/${p}-story.js missing). Add it again from its link.`);
    }
    for (const i of own) {
      const probs = checkOwnSet(i);
      if (!fs.existsSync(path.join(ROOT, 'library', i.id, 'README.md'))) probs.push(`library/${i.id}/README.md is missing (not saved yet)`);
      probs.length ? bad(`Own set ${i.id} (style ${i.base}): ${probs.join('; ')}`) : ok(`Own set ${i.id} (style ${i.base}): ${Object.keys(i.keys).join(', ')}`);
    }
    if (new Set(prefixes).size !== prefixes.length) bad('Two installed styles use the same set number: ' + prefixes.join(', '));
  } catch (e) { bad(e.message); }
  try {
    const b = await launchBrowser();
    ok(`Browser: ${b.__name}`);
    const g = await describeGpu(b);
    g.ok && !g.soft ? ok(g.text) : bad(g.text);
    await b.close();
  } catch (e) { bad(e.message); }
}
if (quiet) { if (problems) console.log('Run  npm run doctor  for details.'); else console.log('Setup OK. Check the browser with:  npm run doctor'); }
else if (problems) console.log('\nSome things need fixing (see FIX lines above).');
else {
  const first = styles[0] && fs.existsSync(path.join(ROOT, 'stories', styles[0].split('-')[0] + '-e1.json')) ? styles[0].split('-')[0] + '-e1' : null;
  console.log(first ? `\nAll good. Try:  npm run video -- ${first}` : '\nAll good. Next: add a style (paste its link from https://pandaitech.my/v/gaya to Claude).');
}
process.exit(quiet ? 0 : problems ? 1 : 0);
