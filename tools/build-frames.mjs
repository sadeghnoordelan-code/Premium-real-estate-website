/* ============================================================
   Rebuild the hero frame sequence from the source film.
   Only needed if the film is replaced.

     npm i ffmpeg-static
     node tools/build-frames.mjs "../4_5796466014182976619.MOV"

   Produces three tiers under assets/hero/. The renderer picks one
   at runtime from viewport width, DPR and connection quality.
   If the frame COUNT changes, update TIERS in js/hero.js and the
   "/ 391" denominator in index.html + hero.js updateHud().
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ffmpeg = (await import('ffmpeg-static')).default;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] || path.join(root, '4_5796466014182976619.MOV'));

const TIERS = [
  { dir: 'w1600', w: 1600, quality: 70, every: 1 },  // large desktop
  { dir: 'w1100', w: 1100, quality: 70, every: 1 },  // laptop
  { dir: 'w720',  w: 720,  quality: 70, every: 2 }   // phone / save-data
];

for (const t of TIERS) {
  const out = path.join(root, 'assets', 'hero', t.dir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const vf = [
    t.every > 1 ? `select='not(mod(n\,${t.every}))'` : null,
    `scale=${t.w}:-2:flags=lanczos`
  ].filter(Boolean).join(',');
  console.log(`-> ${t.dir}`);
  execFileSync(ffmpeg, [
    '-v', 'error', '-i', src, '-vf', vf, '-vsync', '0',
    '-c:v', 'libwebp', '-quality', String(t.quality),
    '-compression_level', '6', '-y', path.join(out, '%04d.webp')
  ], { stdio: 'inherit' });
}

/* poster + a plain mp4, kept as a fallback asset */
const vid = path.join(root, 'assets', 'video');
mkdirSync(vid, { recursive: true });
execFileSync(ffmpeg, ['-v', 'error', '-i', src, '-vf', "select='eq(n\,0)',scale=1600:-2",
  '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', '-y', path.join(vid, 'poster.webp')]);
execFileSync(ffmpeg, ['-v', 'error', '-i', src, '-an', '-c:v', 'libx264', '-preset', 'slow',
  '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-vf', 'scale=1280:-2', '-y', path.join(vid, 'hero.mp4')]);

console.log('done');
