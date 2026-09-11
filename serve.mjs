/* Minimal static server for the BOREAL site.
   Usage:  node serve.mjs [port]        default 5173          */
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

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
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';

  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

  let st;
  try { st = statSync(file); if (st.isDirectory()) throw 0; }
  catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }

  const ext = extname(file).toLowerCase();
  const immutable = /\/assets\/(hero|fonts|projects)\//.test(path.replace(/\\/g, '/'));

  res.writeHead(200, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache'
  });
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`BOREAL  ->  http://localhost:${PORT}`);
});
