import { randomUUID } from 'node:crypto';
import { createDefaultProviderRegistry } from '../history/provider-registry.mjs';
import { getInstrument } from './catalog.mjs';
import { refreshHistoryStatus, storeBars } from './history-store.mjs';
import { transaction } from './db.mjs';

export const JOB_TYPES = Object.freeze(['HISTORY_BACKFILL', 'DAILY_UPDATE', 'REPAIR_MISSING', 'VALIDATE_HISTORY', 'CHECK_AMSTERDAM']);
const terminal = new Set(['COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED']);
const today = () => new Date().toISOString().slice(0, 10);
const nextDate = (date) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); };

function selectInstrumentIds(db, type, mic) {
  let condition = 'i.active=1';
  if (type === 'HISTORY_BACKFILL') condition += " AND h.status IN ('MISSING','PARTIAL','ERROR')";
  if (type === 'REPAIR_MISSING') condition += " AND h.status='ERROR'";
  return db.prepare(`SELECT i.id FROM instruments i JOIN markets m ON m.id=i.market_id
    LEFT JOIN history_status h ON h.instrument_id=i.id WHERE m.mic=? AND ${condition} ORDER BY i.company`).all(mic).map((row) => row.id);
}

export function createJob(db, type, { mic = 'XAMS', requestedBy = 'system', instrumentIds = null } = {}) {
  if (!JOB_TYPES.includes(type)) throw new Error(`Onbekend jobtype ${type}`);
  const ids = instrumentIds || selectInstrumentIds(db, type, mic);
  const id = randomUUID();
  const now = new Date().toISOString();
  transaction(db, () => {
    db.prepare(`INSERT INTO jobs(id,type,status,created_at,total,checkpoint,requested_by)
      VALUES (?,?,'QUEUED',?,?,?,?)`).run(id, type, now, ids.length, JSON.stringify({ mic, lastInstrumentId: null }), requestedBy);
    const insert = db.prepare("INSERT INTO job_items(job_id,instrument_id,status) VALUES (?,?,'PENDING')");
    for (const instrumentId of ids) insert.run(id, instrumentId);
  });
  return db.prepare('SELECT * FROM jobs WHERE id=?').get(id);
}

export function validateInstrumentHistory(db, instrument) {
  const rows = db.prepare(`SELECT trading_date, open, high, low, close FROM daily_prices
    WHERE instrument_id=? ORDER BY trading_date`).all(instrument.id);
  const errors = [];
  let previous = null;
  for (const row of rows) {
    if (previous && row.trading_date <= previous) errors.push(`Datumvolgorde bij ${row.trading_date}`);
    if (!Number.isFinite(row.close) || row.close <= 0) errors.push(`Ongeldige slotkoers ${row.trading_date}`);
    for (const field of ['open', 'high', 'low']) if (row[field] !== null && (!Number.isFinite(row[field]) || row[field] < 0)) errors.push(`Ongeldige ${field} ${row.trading_date}`);
    if (row.high !== null && row.low !== null && row.high < row.low) errors.push(`Hoog lager dan laag ${row.trading_date}`);
    previous = row.trading_date;
  }
  const status = refreshHistoryStatus(db, instrument.id, { error: errors.length ? errors.slice(0, 10).join('; ') : null });
  return { records: rows.length, firstDate: status.firstDate, lastDate: status.lastDate, errors };
}

async function processItem(db, job, item, registry) {
  const instrument = getInstrument(db, item.isin);
  if (job.type === 'VALIDATE_HISTORY' || job.type === 'CHECK_AMSTERDAM') {
    const result = validateInstrumentHistory(db, instrument);
    if (result.errors.length) throw new Error(result.errors.join('; '));
    return { ...result, added: 0, providerRequest: false };
  }
  const status = db.prepare('SELECT * FROM history_status WHERE instrument_id=?').get(instrument.id);
  if (job.type === 'HISTORY_BACKFILL' && status?.status === 'COMPLETE') return { records: status.record_count, firstDate: status.first_available_date, lastDate: status.last_available_date, added: 0, providerRequest: false };
  const startDate = status?.last_available_date ? nextDate(status.last_available_date) : '1900-01-01';
  const endDate = today();
  if (startDate > endDate) return { records: status.record_count, firstDate: status.first_available_date, lastDate: status.last_available_date, added: 0, providerRequest: false };
  const { provider, result } = await registry.fetchDaily(instrument, { startDate, endDate }, status?.provider);
  if (!result.bars?.length && !status?.record_count) throw new Error(`Geen dagkoersen gevonden voor ${instrument.isin}`);
  const stored = storeBars(db, instrument, result.bars, provider.id, { providerMeta: result.providerMeta, requestUrl: result.requestUrl, technicalTestSource: provider.id === 'yahoo-chart' }, { complete:job.type === 'HISTORY_BACKFILL' || status?.status === 'COMPLETE' });
  return { records: stored.records, firstDate: stored.firstDate, lastDate: stored.lastDate, added: stored.added, providerRequest: true };
}

export async function runJob(db, jobId, { registry = createDefaultProviderRegistry(), batchSize = Number(process.env.KOERSPLEIN_JOB_BATCH_SIZE || 5) } = {}) {
  let job = db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId);
  if (!job) throw new Error(`Job ${jobId} bestaat niet`);
  if (terminal.has(job.status)) return job;
  const now = new Date().toISOString();
  db.prepare("UPDATE job_items SET status='PENDING', error=NULL WHERE job_id=? AND status='RUNNING'").run(jobId);
  db.prepare("UPDATE jobs SET status='RUNNING', started_at=COALESCE(started_at,?) WHERE id=?").run(now, jobId);
  while (true) {
    const items = db.prepare(`SELECT ji.*, i.isin FROM job_items ji JOIN instruments i ON i.id=ji.instrument_id
      WHERE ji.job_id=? AND ji.status='PENDING' ORDER BY ji.id LIMIT ?`).all(jobId, batchSize);
    if (!items.length) break;
    for (const item of items) {
      const startedAt = new Date().toISOString();
      db.prepare("UPDATE job_items SET status='RUNNING', attempts=attempts+1, started_at=? WHERE id=?").run(startedAt, item.id);
      try {
        const result = await processItem(db, job, item, registry);
        db.prepare(`UPDATE job_items SET status='COMPLETED', first_date=?, last_date=?, records_added=?, error=NULL, finished_at=? WHERE id=?`)
          .run(result.firstDate || null, result.lastDate || null, result.added || 0, new Date().toISOString(), item.id);
      } catch (error) {
        refreshHistoryStatus(db, item.instrument_id, { error: error.message });
        db.prepare("UPDATE job_items SET status='FAILED', error=?, finished_at=? WHERE id=?").run(error.message, new Date().toISOString(), item.id);
      }
      const counts = db.prepare(`SELECT COUNT(*) progress,
        SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) success,
        SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) failed FROM job_items WHERE job_id=? AND status IN ('COMPLETED','FAILED')`).get(jobId);
      db.prepare('UPDATE jobs SET progress=?, success_count=?, failed_count=?, checkpoint=? WHERE id=?')
        .run(counts.progress, counts.success || 0, counts.failed || 0, JSON.stringify({ lastInstrumentId: item.instrument_id, updatedAt: new Date().toISOString() }), jobId);
    }
  }
  const counts = db.prepare('SELECT success_count,failed_count,total FROM jobs WHERE id=?').get(jobId);
  const finalStatus = counts.failed_count ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
  db.prepare('UPDATE jobs SET status=?, finished_at=?, error_summary=? WHERE id=?')
    .run(finalStatus, new Date().toISOString(), counts.failed_count ? `${counts.failed_count} instrument(en) mislukt` : null, jobId);
  return db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId);
}

export async function resumeInterruptedJobs(db, options = {}) {
  const jobs = db.prepare("SELECT id FROM jobs WHERE status IN ('QUEUED','RUNNING') ORDER BY created_at").all();
  const results = [];
  for (const job of jobs) results.push(await runJob(db, job.id, options));
  return results;
}
