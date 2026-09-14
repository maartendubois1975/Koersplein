import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/scripts\/$/, '');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

createServer((request, response) => {
  const pathname = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const target = normalize(join(root, pathname));

  if (!target.startsWith(root)) {
    response.writeHead(403).end('Verboden');
    return;
  }

  try {
    if (!statSync(target).isFile()) throw new Error('Niet gevonden');
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream' });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404).end('Niet gevonden');
  }
}).listen(port, () => console.log(`Koersplein draait op http://localhost:${port}`));
