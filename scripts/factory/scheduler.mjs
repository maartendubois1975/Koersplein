import { createJob, runJob } from './jobs.mjs';

const scheduleKey = (date) => `DAILY_UPDATE:XAMS:${date}`;

export async function triggerDailySchedule(db, { date = new Date().toISOString().slice(0, 10), requestedBy = 'scheduler' } = {}) {
  const key = scheduleKey(date);
  const previous = db.prepare('SELECT job_id FROM scheduler_runs WHERE schedule_key=?').get(key);
  if (previous) return { created: false, jobId: previous.job_id };
  const job = createJob(db, 'DAILY_UPDATE', { requestedBy });
  db.prepare('INSERT INTO scheduler_runs(schedule_key,job_id,created_at) VALUES (?,?,?)').run(key, job.id, new Date().toISOString());
  return { created: true, jobId: job.id };
}

export function startScheduler(db) {
  if (process.env.KOERSPLEIN_SCHEDULER_ENABLED !== 'true') return { enabled: false };
  const hour = Number(process.env.KOERSPLEIN_SCHEDULER_UTC_HOUR || 21);
  const tick = async () => {
    const now = new Date();
    if (now.getUTCHours() !== hour || [0, 6].includes(now.getUTCDay())) return;
    const result = await triggerDailySchedule(db);
    if (result.created) await runJob(db, result.jobId);
  };
  const timer = setInterval(() => tick().catch((error) => console.error('[scheduler]', error.message)), 15 * 60 * 1000);
  timer.unref();
  tick().catch((error) => console.error('[scheduler]', error.message));
  return { enabled: true, hour, stop: () => clearInterval(timer) };
}
