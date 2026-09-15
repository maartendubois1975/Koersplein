import { resolve } from 'node:path';
import { openDatabase } from './db.mjs';
import { seedAmsterdam } from './catalog.mjs';
import { importGoldenHistory } from './history-store.mjs';
import { createJob, runJob } from './jobs.mjs';

const [command, argument] = process.argv.slice(2);
const db = openDatabase();
await seedAmsterdam(db);
try {
  if (command === 'init') console.log(JSON.stringify({ database:'ready', instruments:db.prepare('SELECT COUNT(*) count FROM instruments').get().count }, null, 2));
  else if (command === 'import-golden') {
    const source = resolve(argument || process.env.KOERSPLEIN_HISTORY_SOURCE_DIR || 'data/history');
    console.log(JSON.stringify(await importGoldenHistory(db, source), null, 2));
  } else if (command === 'status') {
    console.log(JSON.stringify(db.prepare(`SELECT i.company,i.ticker,i.isin,h.* FROM instruments i JOIN history_status h ON h.instrument_id=i.id ORDER BY i.company`).all(), null, 2));
  } else if (command === 'run') {
    const job = createJob(db, argument, { requestedBy:'cli' });
    console.log(JSON.stringify(await runJob(db, job.id), null, 2));
  } else throw new Error('Gebruik: init | import-golden [map] | status | run <JOBTYPE>');
} finally { db.close(); }
