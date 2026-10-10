/* Minimal static server for the BOREAL site.
   Usage:  node serve.mjs [port]        default 5173          */
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname ?? '.');
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  if (path === '/') path = '/index.html';

  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403).end('Forbidden'); return; }

  let st;
  try { st = statSync(file); if (st.isDirectory()) throw 0; }
  catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }

  const ext = extname(file).toLowerCase();
  const immutable = /\/assets\/(hero|fonts|projects)\//.test(path.replace(/\\/g, '/'));

  const headers = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache'
  };
  let range;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (match && (match[1] || match[2])) {
      const from = match[1] ? Number(match[1]) : Math.max(0, st.size - Number(match[2]));
      const to = match[1] && match[2] ? Math.min(Number(match[2]), st.size - 1) : st.size - 1;
      if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from > to || from >= st.size) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }).end(); return;
      }
      range = { start: from, end: to };
      headers['Content-Range'] = 'bytes ' + from + '-' + to + '/' + st.size;
      headers['Content-Length'] = to - from + 1;
    }
  }
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(file, range);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}).listen(PORT, () => {
  console.log(`BOREAL  ->  http://localhost:${PORT}`);
});
