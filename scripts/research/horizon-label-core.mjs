// Horizon labels are retrospective outcomes, never prediction-time features.
// Month ends are clamped; missing/illiquid trading beyond 10 calendar days is unlabeled.
export function addCalendarMonthsClamped(date, months) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(months) || months < 0) throw new Error('INVALID_HORIZON_DATE');
  const [year, month, day] = date.split('-').map(Number);
  const original = new Date(Date.UTC(year, month - 1, day));
  if (original.toISOString().slice(0, 10) !== date) throw new Error('INVALID_HORIZON_DATE');
  const start = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(day, lastDay));
  return start.toISOString().slice(0, 10);
}

export function findMaturedHorizonBar(bars, targetDate, maxLagDays = 10) {
  const candidate = bars.find(b => typeof b?.date === 'string' && b.date >= targetDate);
  if (!candidate) return null;
  const lag = (Date.parse(candidate.date + 'T00:00:00Z') - Date.parse(targetDate + 'T00:00:00Z')) / 86400000;
  return Number.isFinite(lag) && lag >= 0 && lag <= maxLagDays ? candidate : null;
}
