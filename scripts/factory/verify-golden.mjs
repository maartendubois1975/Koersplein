import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openDatabase } from './db.mjs';
import { seedAmsterdam } from './catalog.mjs';
import { importGoldenHistory } from './history-store.mjs';
import { createJob, runJob } from './jobs.mjs';

const source = resolve(process.env.KOERSPLEIN_HISTORY_SOURCE_DIR || 'data/history');
const directory = await mkdtemp(join(tmpdir(), 'koersplein-golden-'));
const db = openDatabase(join(directory, 'golden.sqlite'));
try {
  await seedAmsterdam(db);
  const first = await importGoldenHistory(db, source);
  const second = await importGoldenHistory(db, source);
  const expected = {
    NL0010273215: { records:7240, first:'1998-07-20', last:'2026-09-11' },
    NL0012969182: { records:2112, first:'2018-06-13', last:'2026-09-11' }
  };
  for (const [isin, values] of Object.entries(expected)) {
    assert.equal(first[isin].records, values.records);
    assert.equal(first[isin].firstDate, values.first);
    assert.equal(first[isin].lastDate, values.last);
    assert.equal(second[isin].added, 0);
    const integrity = db.prepare(`SELECT COUNT(*) records,COUNT(DISTINCT trading_date) dates,MIN(trading_date) first,MAX(trading_date) last,
      SUM(CASE WHEN close<=0 OR open<0 OR high<0 OR low<0 OR high<low THEN 1 ELSE 0 END) invalid
      FROM daily_prices dp JOIN instruments i ON i.id=dp.instrument_id WHERE i.isin=?`).get(isin);
    assert.deepEqual({ ...integrity }, { records:values.records, dates:values.records, first:values.first, last:values.last, invalid:0 });
  }
  const ids = db.prepare("SELECT id FROM instruments WHERE isin IN ('NL0010273215','NL0012969182') ORDER BY isin").all().map((row) => row.id);
  const job = createJob(db, 'VALIDATE_HISTORY', { requestedBy:'golden-test', instrumentIds:ids });
  assert.equal((await runJob(db, job.id)).status, 'COMPLETED');
  console.log(JSON.stringify({ firstImport:first, repeatedImport:second, validationJob:job.id }, null, 2));
} finally { db.close(); await rm(directory, { recursive:true, force:true }); }
