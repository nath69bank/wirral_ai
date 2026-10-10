#!/usr/bin/env node
// Local preview: serves public/ and routes /api/<name> to api/<name>.js, the
// same layout Vercel uses. Without BLOB_READ_WRITE_TOKEN, cards come from ./.data.
//   SESSION_SECRET=... node scripts/dev.js   ->  http://localhost:3000
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.resolve('public');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };

http
  .createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    const route = pathname.match(/^\/api\/([a-z-]+)$/);
    if (route) {
      try {
        const { default: handler } = await import(path.resolve('api', `${route[1]}.js`));
        return await handler(req, res);
      } catch (e) {
        console.error(e);
        res.statusCode = 404;
        return res.end('not found');
      }
    }
    const file = path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(PUBLIC)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}`));
