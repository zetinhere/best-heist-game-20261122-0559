// Dev-only static server for play-testing and screenshots.
// Serves the repository root (game/, screenshots/) over plain HTTP.
// Usage: node serve.ts [--port 8080]
//
// Standard library only. Never part of the graded entry: main.ts copies
// only game/ and screenshots/ to /output.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
let port = 8080;
const pi = args.indexOf('--port');
if (pi >= 0 && args[pi + 1]) port = Number(args[pi + 1]) || 8080;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

const server = createServer((req, res) => {
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = normalize(raw).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]/, '');
  let path = join(root, rel === '' ? 'game/index.html' : rel);
  if (raw === '/' || raw === '') path = join(root, 'game/index.html');
  if (!existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found\n');
    return;
  }
  const ext = extname(path).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  res.end(readFileSync(path));
});

server.listen(port, () => {
  console.log(`serving ${root} at http://localhost:${port}/`);
});
