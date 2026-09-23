const JOB_TYPES = new Set(['HISTORY_BACKFILL', 'DAILY_UPDATE', 'REPAIR_MISSING', 'VALIDATE_HISTORY', 'CHECK_AMSTERDAM']);
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const safeEqual = (a, b) => {
  const left = new TextEncoder().encode(String(a || '')), right = new TextEncoder().encode(String(b || ''));
  if (left.length !== right.length) return false;
  let diff = 0; for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
};
const isFactory = (request, env) => safeEqual(request.headers.get('authorization'), `Bearer ${env.FACTORY_TOKEN}`);
const adminEmail = (request) => request.headers.get('Cf-Access-Authenticated-User-Email') || '';
const isAdmin = (request, env) => Boolean(env.ADMIN_EMAIL && adminEmail(request).toLowerCase() === env.ADMIN_EMAIL.toLowerCase());

function cors(request, env) {
  const origin = request.headers.get('origin');
  return origin && origin === env.ALLOWED_ORIGIN ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};
}
function verifyMutation(request, env) {
  if (!isAdmin(request, env)) return json({ error: 'Niet geautoriseerd' }, 401);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Ongeldige origin' }, 403);
  return null;
}
async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(object) {
  if (!object) return [];
  const stream = object.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return text.trim().split('\n').filter(Boolean).map(JSON.parse);
}
function normalize(bar) {
  const optional = (value) => value === null || value === undefined || value === '' ? null : Number(value);
  const result = { date: String(bar.date || ''), open: optional(bar.open), high: optional(bar.high), low: optional(bar.low), close: Number(bar.close), volume: optional(bar.volume), adjustedClose: optional(bar.adjustedClose ?? bar.adjusted_close) };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date) || !Number.isFinite(result.close) || result.close < 0) throw new Error(`Ongeldige koersdag ${result.date}`);
  for (const field of ['open', 'high', 'low']) if (result[field] !== null && (!Number.isFinite(result[field]) || result[field] < 0)) throw new Error(`Ongeldige ${field} op ${result.date}`);
  if (result.high !== null && result.low !== null && result.high < result.low) throw new Error(`High lager dan low op ${result.date}`);
  if (result.volume !== null && (!Number.isFinite(result.volume) || result.volume < 0)) result.volume = null;
  if (result.adjustedClose !== null && (!Number.isFinite(result.adjustedClose) || result.adjustedClose < 0)) result.adjustedClose = null;
  return result;
}
const merge = (...sets) => [...new Map(sets.flat().map(normalize).map((bar) => [bar.date, bar])).values()].sort((a, b) => a.date.localeCompare(b.date));
async function sha256(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((n) => n.toString(16).padStart(2, '0')).join(''); }

async function instrument(env, isin) {
  return env.DB.prepare(`SELECT i.*, h.status history_status, h.first_date, h.last_date, h.record_count, h.provider, h.manifest_key
    FROM instruments i LEFT JOIN history_status h ON h.instrument_id=i.id WHERE i.isin=?`).bind(isin).first();
}

async function historyDocument(env, isin) {
  const item = await instrument(env, isin);
  if (!item) return null;
  const partitions = await env.DB.prepare('SELECT * FROM history_partitions WHERE instrument_id=? ORDER BY period').bind(item.id).all();
  const bars = [];
  for (const partition of partitions.results) bars.push(...await gunzip(await env.HISTORY.get(partition.object_key)));
  return {
    schemaVersion: 1,
    instrument: { name: item.company, symbol: item.ticker, isin: item.isin, mic: item.mic, market: item.mic, currency: item.currency },
    provider: { name: item.provider || 'unknown', role: 'technical-adapter', retrievedAt: item.updated_at || now(), licenseNote: 'Provider- en herdistributierechten moeten voor productie afzonderlijk worden vastgesteld.' },
    coverage: { firstDate: item.first_date, lastDate: item.last_date, recordCount: item.record_count },
    bars
  };
}

async function createJob(env, { type, mic = null, requestedBy = 'scheduler' }) {
  if (!JOB_TYPES.has(type)) throw new Error('Onbekend jobtype');
  const jobId = id(), created = now();
  await env.DB.prepare('INSERT INTO jobs(id,type,mic,status,created_at,requested_by) VALUES(?,?,?,?,?,?)').bind(jobId, type, mic, 'QUEUED', created, requestedBy).run();
  const filter = mic ? 'WHERE i.active=1 AND i.mic=?' : 'WHERE i.active=1';
  const values = mic ? [jobId, mic] : [jobId];
  await env.DB.prepare(`INSERT INTO job_items(job_id,instrument_id) SELECT ?,i.id FROM instruments i ${filter}`).bind(...values).run();
  await env.DB.prepare('UPDATE jobs SET total=(SELECT COUNT(*) FROM job_items WHERE job_id=?) WHERE id=?').bind(jobId, jobId).run();
  return jobId;
}

async function dispatch(env, jobId, type, mic) {
  if (!env.GITHUB_DISPATCH_TOKEN) throw new Error('GITHUB_DISPATCH_TOKEN ontbreekt');
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/${env.GITHUB_WORKFLOW}/dispatches`, {
    method: 'POST', headers: { authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'koersplein-worker' },
    body: JSON.stringify({ ref: env.GITHUB_REF || 'main', inputs: { job_id: jobId, job_type: type, mic: mic || '', batch_size: '25' } })
  });
  if (!response.ok) throw new Error(`GitHub dispatch HTTP ${response.status}: ${await response.text()}`);
}

function adminPage() {
  return new Response(`<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Koersplein Beheer</title><style>
  :root{color-scheme:dark;font:16px system-ui;background:#0b0b0c;color:#f4f1e8}body{max-width:1100px;margin:auto;padding:32px 18px}h1{color:#d9b45b}.card{background:#171719;border:1px solid #333;border-radius:14px;padding:18px;margin:15px 0}button{background:#d9b45b;color:#111;border:0;border-radius:9px;padding:12px 14px;margin:5px;font-weight:700}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px;border-bottom:1px solid #333}.muted{color:#aaa}.error{color:#ef767a}</style>
  <h1>KOERSPLEIN BEHEER</h1><p class="muted">Beveiligde datafabriek · taken lopen server-side via één batchworkflow.</p><div class="card" id="summary">Laden…</div><div class="card"><h2>Acties</h2>
  <button data-type="CHECK_AMSTERDAM">Controleer Amsterdam</button><button data-type="HISTORY_BACKFILL">Vul ontbrekende historie</button><button data-type="DAILY_UPDATE">Werk dagkoersen bij</button><button data-type="REPAIR_MISSING">Herstel mislukte aandelen</button><button data-type="VALIDATE_HISTORY">Valideer historie</button><p id="message"></p></div><div class="card"><h2>Laatste jobs</h2><div id="jobs"></div></div><script>
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function load(){const r=await fetch('/api/admin/summary');if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();summary.innerHTML='<b>'+d.instruments.total+' instrumenten</b> · compleet '+d.instruments.complete+' · ontbreekt '+d.instruments.missing+' · fout '+d.instruments.failed+'<br><span class="muted">'+d.history.records.toLocaleString('nl-NL')+' dagrecords · '+esc(d.history.firstDate||'—')+' t/m '+esc(d.history.lastDate||'—')+'</span>';jobs.innerHTML='<table><tr><th>Type</th><th>Status</th><th>Voortgang</th><th>Aangemaakt</th></tr>'+d.jobs.map(j=>'<tr><td>'+esc(j.type)+'</td><td>'+esc(j.status)+'</td><td>'+j.processed+'/'+j.total+' ('+j.failed_count+' fout)</td><td>'+esc(j.created_at)+'</td></tr>').join('')+'</table>'}document.querySelectorAll('button').forEach(b=>b.onclick=async()=>{message.textContent='Job starten…';const r=await fetch('/api/admin/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:b.dataset.type,mic:'XAMS'})});const d=await r.json();message.className=r.ok?'':'error';message.textContent=r.ok?'Job '+d.id+' gestart.':d.error;await load()});load().catch(e=>summary.textContent=e.message)</script></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function route(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors(request, env), 'access-control-allow-methods': 'GET,POST,PATCH,PUT,OPTIONS', 'access-control-allow-headers': 'content-type,authorization' } });
  if (path === '/health') return json({ ok: true, storage: { metadata: 'D1', history: 'R2' } });
  if (path === '/beheer' || path === '/beheer/') return isAdmin(request, env) ? adminPage() : json({ error: 'Beheer vereist Cloudflare Access' }, 401);
  if (path === '/api/history/manifest.json') {
    const rows = await env.DB.prepare(`SELECT i.isin,i.ticker symbol,i.mic,h.first_date firstDate,h.last_date lastDate,h.record_count recordCount,h.provider FROM instruments i JOIN history_status h ON h.instrument_id=i.id WHERE h.record_count>0`).all();
    return json({ schemaVersion: 1, generatedAt: now(), instruments: Object.fromEntries(rows.results.map((row) => [row.isin, { ...row, file: `/api/history/${row.isin}` }])) }, 200, cors(request, env));
  }
  const partitionListMatch = path.match(/^\/api\/factory\/history\/([A-Z]{2}[A-Z0-9]{10})\/partitions$/);
  if (partitionListMatch && request.method === 'GET') {
    if (!isFactory(request, env)) return json({ error: 'Niet geautoriseerd' }, 401);
    const item = await instrument(env, partitionListMatch[1]); if (!item) return json({ error: 'Instrument ontbreekt' }, 404);
    const partitions = await env.DB.prepare('SELECT period,object_key,record_count,first_date,last_date,provider,checksum FROM history_partitions WHERE instrument_id=? ORDER BY period').bind(item.id).all();
    return json({ instrument: { name: item.company, symbol: item.ticker, isin: item.isin, mic: item.mic, market: item.mic, currency: item.currency }, provider: { name: item.provider || 'unknown', retrievedAt: item.updated_at || now() }, partitions: partitions.results });
  }
  const partitionGetMatch = path.match(/^\/api\/factory\/history\/([A-Z]{2}[A-Z0-9]{10})\/partition\/(\d{4})$/);
  if (partitionGetMatch && request.method === 'GET') {
    if (!isFactory(request, env)) return json({ error: 'Niet geautoriseerd' }, 401);
    const item = await instrument(env, partitionGetMatch[1]); if (!item) return json({ error: 'Instrument ontbreekt' }, 404);
    const partition = await env.DB.prepare('SELECT object_key FROM history_partitions WHERE instrument_id=? AND period=?').bind(item.id, partitionGetMatch[2]).first();
    if (!partition) return json({ error: 'Partitie ontbreekt' }, 404);
    return json({ bars: await gunzip(await env.HISTORY.get(partition.object_key)) });
  }
  const coverageMatch = path.match(/^\/api\/history\/([A-Z]{2}[A-Z0-9]{10})\/coverage$/);
  if (coverageMatch && request.method === 'GET') {
    const item = await instrument(env, coverageMatch[1]);
    return item ? json({ instrument:{isin:item.isin,symbol:item.ticker,mic:item.mic}, coverage:{firstDate:item.first_date,lastDate:item.last_date,recordCount:item.record_count}, provider:item.provider },200,cors(request,env)) : json({error:'Historie niet gevonden'},404,cors(request,env));
  }
  const historyMatch = path.match(/^\/api\/history\/([A-Z]{2}[A-Z0-9]{10})$/);
  if (historyMatch && request.method === 'GET') {
    const document = await historyDocument(env, historyMatch[1]);
    return document ? json(document, 200, cors(request, env)) : json({ error: 'Historie niet gevonden' }, 404, cors(request, env));
  }
  if (path === '/api/admin/summary' && request.method === 'GET') {
    if (!isAdmin(request, env)) return json({ error: 'Niet geautoriseerd' }, 401);
    const instruments = await env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN h.status='COMPLETE' THEN 1 ELSE 0 END) complete,SUM(CASE WHEN h.status='FAILED' THEN 1 ELSE 0 END) failed,SUM(CASE WHEN h.status IS NULL OR h.status='NOT_LOADED' THEN 1 ELSE 0 END) missing FROM instruments i LEFT JOIN history_status h ON h.instrument_id=i.id`).first();
    const history = await env.DB.prepare('SELECT COALESCE(SUM(record_count),0) records,MIN(first_date) firstDate,MAX(last_date) lastDate FROM history_status').first();
    const jobs = await env.DB.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 20').all();
    return json({ instruments, history, jobs: jobs.results });
  }
  if (path === '/api/admin/jobs' && request.method === 'POST') {
    const denied = verifyMutation(request, env); if (denied) return denied;
    const body = await request.json(); if (!JOB_TYPES.has(body.type)) return json({ error: 'Onbekend jobtype' }, 400);
    const jobId = await createJob(env, { type: body.type, mic: body.mic || null, requestedBy: adminEmail(request) });
    try { await dispatch(env, jobId, body.type, body.mic || ''); }
    catch (error) { await env.DB.prepare("UPDATE jobs SET status='FAILED',finished_at=?,error_summary=? WHERE id=?").bind(now(), error.message, jobId).run(); return json({ error: error.message, id: jobId }, 502); }
    return json({ id: jobId, status: 'QUEUED' }, 202);
  }
  if (path === '/api/factory/catalog' && request.method === 'PUT') {
    if (!isFactory(request, env)) return json({ error: 'Niet geautoriseerd' }, 401);
    const body = await request.json();
    for (const market of body.markets || []) await env.DB.prepare(`INSERT INTO markets(mic,code,name,exchange_group,country_code,currency,timezone) VALUES(?,?,?,?,?,?,?) ON CONFLICT(mic) DO UPDATE SET code=excluded.code,name=excluded.name,exchange_group=excluded.exchange_group,country_code=excluded.country_code,currency=excluded.currency,timezone=excluded.timezone,updated_at=CURRENT_TIMESTAMP`).bind(market.mic, market.code, market.name, market.exchangeGroup || null, market.countryCode || null, market.currency || null, market.timezone || null).run();
    for (const item of body.instruments || []) {
      await env.DB.prepare(`INSERT INTO instruments(isin,mic,ticker,company,country_code,sector,index_group,currency) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(isin) DO UPDATE SET mic=excluded.mic,ticker=excluded.ticker,company=excluded.company,country_code=excluded.country_code,sector=excluded.sector,index_group=excluded.index_group,currency=excluded.currency,updated_at=CURRENT_TIMESTAMP`).bind(item.isin, item.mic, item.ticker, item.company, item.countryCode || null, item.sector || null, item.indexGroup || null, item.currency || null).run();
      await env.DB.prepare(`INSERT INTO history_status(instrument_id) SELECT id FROM instruments WHERE isin=? ON CONFLICT(instrument_id) DO NOTHING`).bind(item.isin).run();
    }
    return json({ markets: body.markets?.length || 0, instruments: body.instruments?.length || 0 });
  }
  const jobGet = path.match(/^\/api\/factory\/jobs\/([^/]+)$/);
  if (jobGet && request.method === 'GET') { if (!isFactory(request, env)) return json({ error: 'Niet geautoriseerd' }, 401); return json(await env.DB.prepare('SELECT * FROM jobs WHERE id=?').bind(jobGet[1]).first()); }
  const claim = path.match(/^\/api\/factory\/jobs\/([^/]+)\/claim$/);
  if (claim && request.method === 'POST') {
    if (!isFactory(request, env)) return json({ error: 'Niet geautoriseerd' }, 401);
    const body = await request.json(), limit = Math.max(1, Math.min(100, Number(body.limit) || 25));
    await env.DB.prepare("UPDATE jobs SET status='RUNNING',started_at=COALESCE(started_at,?) WHERE id=?").bind(now(), claim[1]).run();
    const queued = await env.DB.prepare(`SELECT i.*,h.status history_status,h.first_date,h.last_date,h.record_count,h.provider FROM job_items ji JOIN instruments i ON i.id=ji.instrument_id LEFT JOIN history_status h ON h.instrument_id=i.id WHERE ji.job_id=? AND ji.status IN ('PENDING','RETRY') ORDER BY i.id LIMIT ?`).bind(claim[1], limit).all();
    for (const item of queued.results) await env.DB.prepare("UPDATE job_items SET status='RUNNING',attempts=attempts+1,started_at=? WHERE job_id=? AND instrument_id=?").bind(now(), claim[1], item.id).run();
    return json({ items: queued.results });
  }
  const itemPatch = path.match(/^\/api\/factory\/jobs\/([^/]+)\/items\/([A-Z]{2}[A-Z0-9]{10})$/);
  if (itemPatch && request.method === 'PATCH') {
    if (!isFactory(request, env)) return json({ error: 'Niet geautoriseerd' }, 401);
    const body = await request.json(), target = await instrument(env, itemPatch[2]); if (!target) return json({ error: 'Instrument ontbreekt' }, 404);
    const status = body.status === 'FAILED' ? 'FAILED' : 'COMPLETE';
    await env.DB.prepare('UPDATE job_items SET status=?,records_added=?,first_date=?,last_date=?,error=?,finished_at=? WHERE job_id=? AND instrument_id=?').bind(status, body.recordsAdded || 0, body.firstDate || null, body.lastDate || null, body.error || null, now(), itemPatch[1], target.id).run();
    const totals = await env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status IN ('COMPLETE','FAILED') THEN 1 ELSE 0 END) processed,SUM(CASE WHEN status='COMPLETE' THEN 1 ELSE 0 END) success,SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) failed FROM job_items WHERE job_id=?`).bind(itemPatch[1]).first();
    const finished = totals.processed === totals.total;
    await env.DB.prepare('UPDATE jobs SET processed=?,success_count=?,failed_count=?,checkpoint=?,status=?,finished_at=? WHERE id=?').bind(totals.processed, totals.success, totals.failed, itemPatch[2], finished ? (totals.failed ? 'COMPLETED_WITH_ERRORS' : 'COMPLETE') : 'RUNNING', finished ? now() : null, itemPatch[1]).run();
    return json({ ...totals, finished });
  }
  const partitionPut = path.match(/^\/api\/factory\/history\/([A-Z]{2}[A-Z0-9]{10})\/(\d{4})$/);
  if (partitionPut && request.method === 'PUT') {
    if (!isFactory(request, env)) return json({ error: 'Niet geautoriseerd' }, 401);
    const target = await instrument(env, partitionPut[1]); if (!target) return json({ error: 'Instrument ontbreekt' }, 404);
    const body = await request.json(), period = partitionPut[2], key = `history/v1/mic=${target.mic}/isin=${target.isin}/year=${period}/prices.ndjson.gz`;
    const existing = await gunzip(await env.HISTORY.get(key)); const bars = merge(existing, body.bars || []).filter((bar) => bar.date.startsWith(period));
    if (!bars.length) return json({ error: 'Lege partitie' }, 400);
    const bytes = await gzip(bars.map((bar) => JSON.stringify(bar)).join('\n') + '\n'), hash = await sha256(bytes);
    await env.HISTORY.put(key, bytes, { httpMetadata: { contentType: 'application/x-ndjson', contentEncoding: 'gzip' }, customMetadata: { isin: target.isin, mic: target.mic, period, provider: body.provider || 'unknown', checksum: hash } });
    await env.DB.prepare(`INSERT INTO history_partitions(instrument_id,period,object_key,record_count,first_date,last_date,provider,checksum,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(instrument_id,period) DO UPDATE SET object_key=excluded.object_key,record_count=excluded.record_count,first_date=excluded.first_date,last_date=excluded.last_date,provider=excluded.provider,checksum=excluded.checksum,updated_at=excluded.updated_at`).bind(target.id, period, key, bars.length, bars[0].date, bars.at(-1).date, body.provider || 'unknown', hash, now()).run();
    return json({ period, records: bars.length, firstDate: bars[0].date, lastDate: bars.at(-1).date, checksum: hash });
  }
  const complete = path.match(/^\/api\/factory\/history\/([A-Z]{2}[A-Z0-9]{10})\/complete$/);
  if (complete && request.method === 'POST') {
    if (!isFactory(request, env)) return json({ error: 'Niet geautoriseerd' }, 401);
    const target = await instrument(env, complete[1]); if (!target) return json({ error: 'Instrument ontbreekt' }, 404);
    const body = await request.json(), coverage = await env.DB.prepare('SELECT SUM(record_count) record_count,MIN(first_date) first_date,MAX(last_date) last_date FROM history_partitions WHERE instrument_id=?').bind(target.id).first();
    await env.DB.prepare(`UPDATE history_status SET status='COMPLETE',first_date=?,last_date=?,record_count=?,provider=?,storage_format='ndjson+gzip-v1',manifest_key=?,last_checked=?,error=NULL,updated_at=? WHERE instrument_id=?`).bind(coverage.first_date, coverage.last_date, coverage.record_count || 0, body.provider || target.provider || 'unknown', `history/v1/mic=${target.mic}/isin=${target.isin}/manifest.json`, now(), now(), target.id).run();
    const last = await env.DB.prepare('SELECT object_key FROM history_partitions WHERE instrument_id=? ORDER BY period DESC LIMIT 1').bind(target.id).first();
    if (last) { const bars = await gunzip(await env.HISTORY.get(last.object_key)); const bar = bars.at(-1); await env.DB.prepare(`INSERT INTO latest_prices(instrument_id,trading_date,open,high,low,close,volume,adjusted_close,provider,imported_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(instrument_id) DO UPDATE SET trading_date=excluded.trading_date,open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume,adjusted_close=excluded.adjusted_close,provider=excluded.provider,imported_at=excluded.imported_at`).bind(target.id, bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume, bar.adjustedClose, body.provider || 'unknown', now()).run(); }
    return json({ isin: target.isin, ...coverage });
  }
  return json({ error: 'Niet gevonden' }, 404);
}

async function scheduled(env) {
  if (env.SCHEDULER_ENABLED !== 'true') return;
  const date = new Date().toISOString().slice(0, 10), key = 'daily:XAMS';
  const existing = await env.DB.prepare('SELECT last_date FROM scheduler_runs WHERE schedule_key=?').bind(key).first(); if (existing?.last_date === date) return;
  const jobId = await createJob(env, { type: 'DAILY_UPDATE', mic: 'XAMS', requestedBy: 'cloudflare-cron' });
  await dispatch(env, jobId, 'DAILY_UPDATE', 'XAMS');
  await env.DB.prepare(`INSERT INTO scheduler_runs(schedule_key,last_date,last_job_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(schedule_key) DO UPDATE SET last_date=excluded.last_date,last_job_id=excluded.last_job_id,updated_at=excluded.updated_at`).bind(key, date, jobId, now()).run();
}

export default {
  fetch(request, env, ctx) { return route(request, env).catch((error) => json({ error: error.message }, 500)); },
  scheduled(event, env, ctx) { ctx.waitUntil(scheduled(env)); }
};

export { merge, normalize, route };
