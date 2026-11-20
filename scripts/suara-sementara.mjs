// Placeholder voices for stills on Linux (the free voice only works on macOS/Windows): one quiet pink-noise WAV per spoken line,
// length ~ words/2.6 s, so timing and stills work without spending API credits. Usage: node scripts/suara-sementara.mjs "$PWD" <story-id>
// Delete comp/vo/<story-id> before a real render so the real voices are made.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const root = process.argv[2], id = process.argv[3];
const ff = (await import(path.join(root,'node_modules/ffmpeg-static/index.js'))).default;
const story = JSON.parse(fs.readFileSync(path.join(root,'stories',id+'.json'),'utf8'));
const dir = path.join(root,'comp/vo',id); fs.mkdirSync(dir,{recursive:true});
story.lines.forEach((ln,i)=>{ if(!ln.who) return; const nn=String(i).padStart(2,'0');
  const d = Math.max(1.2, ln.text.split(/\s+/).length/2.6);
  execFileSync(ff,['-y','-loglevel','error','-f','lavfi','-i','anoisesrc=r=24000:a=0.08:c=pink','-t',d.toFixed(2),'-c:a','pcm_s16le',path.join(dir,nn+'.wav')]);
  console.log(nn, d.toFixed(2)); });
