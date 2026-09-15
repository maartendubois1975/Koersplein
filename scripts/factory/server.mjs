import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.mjs';
import { seedAmsterdam } from './catalog.mjs';
import { historyDocument, historyManifest } from './history-store.mjs';
import { createJob, resumeInterruptedJobs, runJob } from './jobs.mjs';
import { calculateMovers } from './movers.mjs';
import { triggerDailySchedule } from './scheduler.mjs';
import { authConfigured, clearSessionCookie, createSession, readSession, sessionCookie, validCredentials } from './auth.mjs';
import { dashboardView, loginView } from './admin-view.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };
const loginAttempts = new Map();
const isSecure = (request) => request.headers['x-forwarded-proto'] === 'https';
const redirect = (response, location, cookie) => { response.writeHead(303, { Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) }).end(); };
const json = (response, status, value) => response.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }).end(JSON.stringify(value));
const html = (response, status, value) => response.writeHead(status, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'X-Frame-Options':'DENY', 'Content-Security-Policy':"default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" }).end(value);

async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error('Aanvraag te groot');
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const protocol = request.headers['x-forwarded-proto'] || 'http';
  return origin === `${protocol}://${request.headers.host}`;
}

function serveStatic(pathname, response) {
  const path = pathname === '/' ? '/index.html' : pathname;
  const allowed = new Set(['/index.html','/share.html','/app.js','/share.js','/chart.js','/styles.css','/data/euronext-amsterdam.json','/data/euronext-amsterdam-indices.json','/data/home-contracts.json','/data/markets.json','/data/regions.json']);
  if (!allowed.has(path)) return response.writeHead(404).end('Niet gevonden');
  const target = resolve(join(root, path));
  if (!(target === root || target.startsWith(`${root}${sep}`))) return response.writeHead(403).end('Verboden');
  try {
    if (!statSync(target).isFile()) throw new Error();
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff' });
    createReadStream(target).pipe(response);
  } catch { response.writeHead(404).end('Niet gevonden'); }
}

export async function createKoerspleinServer({ db = openDatabase(), resumeJobs = true } = {}) {
  await seedAmsterdam(db);
  if (resumeJobs) queueMicrotask(() => resumeInterruptedJobs(db).catch((error) => console.error('[jobs]', error.message)));
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const { pathname } = url;
      if (pathname === '/health') return json(response, 200, { status:'ok', datastore:'sqlite' });
      if (pathname === '/data/history/manifest.json') return json(response, 200, historyManifest(db));
      const historyMatch = pathname.match(/^\/data\/history\/([A-Z]{2}[A-Z0-9]{9}[0-9])\.json$/);
      if (historyMatch) {
        const document = historyDocument(db, historyMatch[1]);
        return document ? json(response, 200, document) : json(response, 404, { error:'Historie niet beschikbaar' });
      }
      if (pathname === '/api/market-movers') return json(response, 200, calculateMovers(db));
      if (pathname === '/internal/schedule/daily' && request.method === 'POST') {
        if (!process.env.KOERSPLEIN_SCHEDULER_SECRET || request.headers.authorization !== `Bearer ${process.env.KOERSPLEIN_SCHEDULER_SECRET}`) return json(response, 401, { error:'Niet bevoegd' });
        const scheduled = await triggerDailySchedule(db);
        if (scheduled.created) setImmediate(() => runJob(db, scheduled.jobId).catch((error) => console.error('[job]', error.message)));
        return json(response, 202, scheduled);
      }
      if (pathname.startsWith('/beheer')) {
        if (!authConfigured()) return html(response, 503, loginView('Beheer is uitgeschakeld totdat de drie beveiligde omgevingsvariabelen zijn ingesteld.'));
        if (pathname === '/beheer/login' && request.method === 'GET') return html(response, 200, loginView());
        if (pathname === '/beheer/login' && request.method === 'POST') {
          if (!sameOrigin(request)) return html(response, 403, loginView('Ongeldige herkomst.'));
          const key = request.socket.remoteAddress || 'unknown';
          const state = loginAttempts.get(key) || { count:0, blockedUntil:0 };
          if (state.blockedUntil > Date.now()) return html(response, 429, loginView('Te veel pogingen. Probeer het later opnieuw.'));
          const values = await body(request);
          if (!validCredentials(values.username, values.password)) {
            state.count += 1;
            if (state.count >= 5) { state.count = 0; state.blockedUntil = Date.now() + 15 * 60 * 1000; }
            loginAttempts.set(key, state);
            return html(response, 401, loginView('Onjuiste inloggegevens.'));
          }
          loginAttempts.delete(key);
          return redirect(response, '/beheer', sessionCookie(createSession(values.username), isSecure(request)));
        }
        const session = readSession(request.headers.cookie);
        if (!session) return redirect(response, '/beheer/login');
        if (pathname === '/beheer' && request.method === 'GET') return html(response, 200, dashboardView(db, session, url.searchParams.get('message') || ''));
        if (request.method === 'POST') {
          if (!sameOrigin(request)) return response.writeHead(403).end('Ongeldige herkomst');
          const values = await body(request);
          if (values.csrf !== session.csrf) return response.writeHead(403).end('Ongeldig CSRF-token');
          if (pathname === '/beheer/logout') return redirect(response, '/beheer/login', clearSessionCookie(isSecure(request)));
          if (pathname === '/beheer/jobs') {
            const job = createJob(db, values.type, { requestedBy: session.username });
            setImmediate(() => runJob(db, job.id).catch((error) => console.error('[job]', error.message)));
            return redirect(response, `/beheer?message=${encodeURIComponent(`Job ${values.type} is gestart`)}`);
          }
        }
        return response.writeHead(405).end('Methode niet toegestaan');
      }
      if (!['GET','HEAD'].includes(request.method)) return response.writeHead(405).end('Methode niet toegestaan');
      return serveStatic(pathname, response);
    } catch (error) {
      console.error('[server]', error);
      return json(response, 500, { error:'Interne fout' });
    }
  });
  return { server, db };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const { server } = await createKoerspleinServer();
  server.listen(port, '0.0.0.0', () => console.log(`Koersplein draait op http://0.0.0.0:${port}`));
}
