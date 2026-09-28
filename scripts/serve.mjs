// dist/ をローカルで確認するための簡易サーバー
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const DIST_DIR = path.resolve(import.meta.dirname, '..', 'dist');
const PORT = Number(process.env.PORT ?? 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
};

http
  .createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(DIST_DIR, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
    if (!file.startsWith(DIST_DIR)) return res.writeHead(403).end();
    try {
      const body = await fs.readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('Not Found');
    }
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}/`));
