import fs from 'node:fs/promises';
import { join } from 'node:path';

// The daily archiver and reviewed local repair share this one writer gate.
// A crash leaves an explicit lock; never guess that a live writer is stale.
export async function withArchiveWriter(dataDir, operation) {
  await fs.mkdir(dataDir, { recursive: true });
  const lock = join(dataDir, '.archive-writer-lock');
  try { await fs.mkdir(lock); }
  catch (error) { if (error.code === 'EEXIST') throw Error('HISTORY_WRITER_BUSY'); throw error; }
  try {
    await fs.writeFile(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return await operation();
  } finally { await fs.rm(lock, { recursive: true, force: true }); }
}
