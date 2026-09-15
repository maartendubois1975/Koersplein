import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './db.mjs';
import { getInstrument, seedAmsterdam } from './catalog.mjs';
import { historyDocument, historyManifest, refreshHistoryStatus, storeBars } from './history-store.mjs';
import { createJob, runJob } from './jobs.mjs';
import { ProviderRegistry } from '../history/provider-registry.mjs';
import { calculateMovers } from './movers.mjs';
import { createSession, readSession, validCredentials } from './auth.mjs';

const directory = await mkdtemp(join(tmpdir(), 'koersplein-factory-'));
const db = openDatabase(join(directory, 'test.sqlite'));
try {
  const seeded = await seedAmsterdam(db);
  assert.equal(seeded.instruments, 124);
  assert.deepEqual(db.prepare('SELECT index_group,COUNT(*) count FROM instruments GROUP BY index_group ORDER BY index_group').all().map((row) => ({ ...row })), [
    { index_group:'AEX', count:30 }, { index_group:'AMX', count:25 }, { index_group:'AScX', count:20 }, { index_group:'Overig', count:49 }
  ]);

  const asml = getInstrument(db, 'NL0010273215');
  const adyen = getInstrument(db, 'NL0012969182');
  const bars = [
    { date:'2026-09-14', open:100, high:103, low:99, close:102, volume:null, adjustedClose:102 },
    { date:'2026-09-15', open:102, high:105, low:101, close:104, volume:1000, adjustedClose:104 }
  ];
  assert.equal(storeBars(db, asml, bars, 'fixture').added, 2);
  assert.equal(storeBars(db, asml, bars, 'fixture').added, 0, 'herhaalde import is idempotent');
  storeBars(db, adyen, bars.map((bar) => ({ ...bar, close:bar.close * 2, high:bar.high * 2, low:bar.low * 2, open:bar.open * 2, adjustedClose:bar.adjustedClose * 2 })), 'fixture');
  assert.equal(historyManifest(db).instruments[asml.isin].records, 2);
  assert.equal(historyDocument(db, asml.isin).bars.length, 2);

  const validation = createJob(db, 'VALIDATE_HISTORY', { requestedBy:'test', instrumentIds:[asml.id, adyen.id] });
  const validationResult = await runJob(db, validation.id);
  assert.equal(validationResult.status, 'COMPLETED');
  assert.equal(validationResult.success_count, 2);

  let providerRequests = 0;
  const provider = { id:'fixture-provider', supports:() => true, async fetchDaily() { providerRequests += 1; return { bars:[] }; } };
  const daily = createJob(db, 'DAILY_UPDATE', { requestedBy:'test', instrumentIds:[asml.id, adyen.id] });
  const dailyResult = await runJob(db, daily.id, { registry:new ProviderRegistry([provider]) });
  assert.equal(dailyResult.status, 'COMPLETED');
  assert.equal(providerRequests, 0, 'actuele reeksen veroorzaken geen providerrequest');

  db.prepare("DELETE FROM daily_prices WHERE trading_date='2026-09-15'").run();
  refreshHistoryStatus(db, asml.id);
  refreshHistoryStatus(db, adyen.id);
  const isolatingProvider = { id:'fixture', supports:() => true, async fetchDaily(instrument) {
    if (instrument.isin === adyen.isin) throw new Error('geïsoleerde testfout');
    return { bars:[bars[1]], providerMeta:{ fixture:true } };
  } };
  const isolated = createJob(db, 'DAILY_UPDATE', { requestedBy:'test', instrumentIds:[asml.id, adyen.id] });
  const isolatedResult = await runJob(db, isolated.id, { registry:new ProviderRegistry([isolatingProvider]) });
  assert.equal(isolatedResult.status, 'COMPLETED_WITH_ERRORS');
  assert.equal(isolatedResult.success_count, 1);
  assert.equal(isolatedResult.failed_count, 1, 'één fout stopt het andere instrument niet');

  const interrupted = createJob(db, 'VALIDATE_HISTORY', { requestedBy:'test', instrumentIds:[asml.id] });
  db.prepare("UPDATE jobs SET status='RUNNING' WHERE id=?").run(interrupted.id);
  db.prepare("UPDATE job_items SET status='RUNNING' WHERE job_id=?").run(interrupted.id);
  assert.equal((await runJob(db, interrupted.id)).status, 'COMPLETED', 'lopende job hervat via checkpoint');

  assert.equal(calculateMovers(db).status, 'DATASET_UNAVAILABLE', 'twee aandelen worden niet als marktbrede top-10 getoond');
  process.env.KOERSPLEIN_ADMIN_USERNAME = 'maarten';
  process.env.KOERSPLEIN_ADMIN_PASSWORD = 'test-password';
  process.env.KOERSPLEIN_SESSION_SECRET = '0123456789abcdef0123456789abcdef';
  assert.equal(validCredentials('maarten', 'test-password'), true);
  const token = createSession('maarten');
  assert.equal(readSession(`kp_admin=${token}`).username, 'maarten');
  assert.equal(readSession(`kp_admin=${token}x`), null);
  console.log('Factorytests groen: schema, 124 instrumenten, idempotentie, jobs, resume, auth en veilige movers-empty-state.');
} finally {
  db.close();
  await rm(directory, { recursive:true, force:true });
}
