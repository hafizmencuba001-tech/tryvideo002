// stories/<id>.json -> comp/stories/<id>.js (window.STORY = ...) + comp/<id>.html (the story page, no captions).
//   node tools/make-story.mjs s1-e1 [s2-e1 ...]
// Dispatches on story.setup ("s1-kotak" -> prefix "s1"): the page loads comp/<prefix>-story.js (export function startStory(LOC)) and, when
// comp/<setup>.loc-<story.location>.js exists, passes that location module to it (startStory(null) otherwise).
// Own sets (library/my-<slug>/set.json, see setInfo in lib/common.mjs): the page loads the BASE style's player; an import map swaps in the own
// set's replacement modules (comp/my-<slug>.cast.js for comp/<base>.cast.js ...), the location is comp/my-<slug>.loc-<place>.js or else the
// base style's, and window.STORY gets the base keys/shots so the base player works unchanged.
// Camera moves (story "camera" per line / "camera_style"): comp/camera.js is imported before the player; it moves the style's camera per frame.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadCast, setInfo, storyForPlayer, checkOwnSet } from './lib/common.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMP = path.join(HERE, 'comp');
const cast = loadCast();
// camera move names understood by comp/camera.js (keep in sync with MOVES + ALIAS there)
const CAM_MOVES = ['push_in', 'pull_out', 'orbit_left', 'orbit_right', 'crane_up', 'crane_down', 'pan_left', 'pan_right', 'handheld', 'whip', 'dutch', 'zoom_punch', 'dolly_zoom', 'slow_drift', 'rack_focus', 'none',
  'orbit', 'crane', 'pan', 'dolly_in', 'dolly_out', 'zoom', 'shake', 'drift', 'vertigo', 'static'];
const camMoves = (c) => (c == null ? [] : Array.isArray(c) ? c.flatMap(camMoves) : typeof c === 'string' ? c.split('+').map((x) => x.trim()).filter(Boolean) : c.move ? [c.move] : []); // root cast.json + library/<style>/cast.json of every installed style
for (const id of process.argv.slice(2)) {
  const story = JSON.parse(fs.readFileSync(path.join(HERE, 'stories', id + '.json'), 'utf8'));
  const setup = story.setup;
  if (!setup) throw new Error(`${id}: story.setup missing`);
  if (story.id && story.id !== id) console.log(`  warning: stories/${id}.json has "id": "${story.id}" (should be "${id}")`);
  const info = setInfo(setup);
  const prefix = info.prefix, player = info.player;
  if (info.own) { const bad = checkOwnSet(info); if (bad.length) throw new Error(`${id}: own set ${setup}:\n  - ` + bad.join('\n  - ')); }
  else if (!fs.existsSync(path.join(COMP, player))) throw new Error(`${id}: style ${setup} is not installed (comp/${player} is missing). Add it from its link: https://pandaitech.my/v/gaya`);
  if (info.own && !id.startsWith(setup + '-')) console.log(`  warning: story ids of an own set should start with "${setup}-" (this one is "${id}")`);
  story.lines.forEach((l, i) => {
    if (l.who && !cast[l.who]) {
      const own = path.join(HERE, 'library', setup, 'cast.json');
      const allowed = fs.existsSync(own) ? Object.keys(JSON.parse(fs.readFileSync(own, 'utf8'))) : Object.keys(cast).filter((k) => k.startsWith(prefix + '_') || !/^s\d+_/.test(k));
      throw new Error(`${id}: line ${i}: unknown character "${l.who}". Allowed: ${allowed.join(', ')}`);
    }
    if (l.screen && !(story.screens || {})[l.screen]) throw new Error(`${id}: line ${i}: screen "${l.screen}" is not defined in "screens"`);
    for (const m of camMoves(l.camera)) if (!CAM_MOVES.includes(m)) console.log(`  warning: ${id}: line ${i}: unknown camera move "${m}" (ignored). Moves: ${CAM_MOVES.join(', ')}`);
  });
  if (story.camera_style && !['calm', 'lively', 'dramatic', 'none'].includes(story.camera_style)) console.log(`  warning: ${id}: camera_style "${story.camera_style}" is unknown (use calm, lively or dramatic)`);
  let locFile = story.location ? `${setup}.loc-${story.location}.js` : null;
  if (locFile && info.own && !fs.existsSync(path.join(COMP, locFile))) locFile = `${info.base}.loc-${story.location}.js`;
  const hasLoc = locFile && fs.existsSync(path.join(COMP, locFile));
  if (story.location && !hasLoc) console.log(`  note: ${id}: no location module comp/${locFile}; the player gets startStory(null)`);
  fs.mkdirSync(path.join(COMP, 'stories'), { recursive: true });
  fs.writeFileSync(path.join(COMP, 'stories', id + '.js'), 'window.STORY = ' + JSON.stringify(storyForPlayer(story, info)) + ';\n');
  // import map: three.js + (own set) each replacement module; inside a replacement module the base name still means the base module
  const imap = { imports: { three: './lib/three/three.module.js' } };
  if (info.replace.length) {
    imap.scopes = {};
    for (const r of info.replace) { imap.imports['./' + r.baseFile] = './' + r.ownFile; imap.scopes['./' + r.ownFile] = { ['./' + r.baseFile]: './' + r.baseFile }; }
  }
  fs.writeFileSync(path.join(COMP, id + '.html'), `<!doctype html>
<html lang="ms"><head><meta charset="utf-8">
<title>${id}: ${story.title}</title>
<meta name="thumb" content="0.5">
<link rel="stylesheet" href="base.css">
<style>
  #stage { background: #05071a; }
  #gl { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }
</style>
<script type="importmap">${JSON.stringify(imap)}</script>
</head><body>
<!-- generated by tools/make-story.mjs: clean frame, no captions or overlays; all text is drawn on in-scene props -->
<div id="stage"><canvas id="gl" width="1080" height="1920"></canvas></div>
<script src="engine.js"></script>
<script src="stories/${id}.js"></script>
<script src="vo/${id}/timing.js"></script>
<script type="module">
import { cameraInit } from './camera.js';
${hasLoc ? `import * as LOC from './${locFile}';\n` : ''}import { startStory } from './${player}';
startStory(${hasLoc ? 'LOC' : 'null'});
cameraInit();
</script>
</body></html>
`);
  console.log(`make-story ${id}: comp/${id}.html (${player}${hasLoc ? ' + ' + locFile : ''}${info.replace.map((r) => ' + ' + r.ownFile).join('')})`);
}
