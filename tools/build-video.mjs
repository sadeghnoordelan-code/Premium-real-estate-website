/* ============================================================
   Re-encode the film for scroll scrubbing.

     npm i ffmpeg-static
     node tools/build-video.mjs "../4_5796466014182976619.MOV"

   Every frame is a keyframe (keyint=1). That is the difference between
   3-6ms and 13-20ms per seek, and it is what makes wheel scrubbing land
   on the exact frame instead of the nearest keyframe. The file is bigger
   than a normal encode; that is the trade being made deliberately.
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ffmpeg = (await import('ffmpeg-static')).default;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] || path.join(root, '4_5796466014182976619.MOV'));
const out = path.join(root, 'assets', 'video');
mkdirSync(out, { recursive: true });

for (const [tag, w, crf] of [['lg', 1600, 21], ['md', 1280, 21], ['sm', 960, 22]]) {
  const dest = path.join(out, `hero-${tag}.mp4`);
  execFileSync(ffmpeg, [
    '-v', 'error', '-i', src, '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
    '-x264-params', 'keyint=1:min-keyint=1:scenecut=0',
    '-vf', `scale=${w}:-2:flags=lanczos`,
    '-movflags', '+faststart', '-y', dest
  ], { stdio: 'inherit' });
  console.log(`hero-${tag}.mp4  ${w}w  ${(statSync(dest).size / 1048576).toFixed(1)} MB`);
}
