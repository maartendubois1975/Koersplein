import crypto from 'node:crypto';

const REQUIRED = ['evidenceId','entityId','family','signalName','validTime','retrievedTime','vintageId','sourceId','publisher','sourceTier','licenseStatus','ingestionAdapter','adapterVersion'];

export function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function isoOrNull(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Ongeldige tijd: ${value}`);
  return d.toISOString();
}

export function normalizePitEvidence(input) {
  const e = { ...input };
  for (const key of REQUIRED) if (e[key] == null || e[key] === '') throw new Error(`PIT ontbreekt: ${key}`);
  e.validTime = isoOrNull(e.validTime);
  e.publishedTime = isoOrNull(e.publishedTime);
  e.tradableTime = isoOrNull(e.tradableTime);
  e.retrievedTime = isoOrNull(e.retrievedTime);
  e.supersededTime = isoOrNull(e.supersededTime);
  e.missing = Boolean(e.missing);
  if (e.missing && (e.rawValue === 0 || e.normalizedValue === 0)) throw new Error('Missing mag nooit als nul worden opgeslagen');
  e.timestampProven = Boolean(e.timestampProven && e.publishedTime && e.tradableTime);
  e.pointInTimeSafe = Boolean(e.pointInTimeSafe && e.timestampProven);
  e.trainingEligible = Boolean(e.trainingEligible && e.pointInTimeSafe && !e.missing);
  e.quarantineReasons = Array.isArray(e.quarantineReasons) ? e.quarantineReasons : [];
  if (!e.publishedTime) e.quarantineReasons.push('PUBLISHED_TIME_NOT_PROVEN');
  if (!e.tradableTime) e.quarantineReasons.push('TRADABLE_TIME_NOT_PROVEN');
  if (!e.timestampProven) e.quarantineReasons.push('TIMESTAMP_NOT_PROVEN');
  if (!e.contentHash) e.contentHash = sha256({ sourceId:e.sourceId, rawValue:e.rawValue, validTime:e.validTime, publishedTime:e.publishedTime, vintageId:e.vintageId });
  e.parentEvidenceIds = Array.isArray(e.parentEvidenceIds) ? e.parentEvidenceIds : [];
  e.transformations = Array.isArray(e.transformations) ? e.transformations : [];
  e.quarantineReasons = [...new Set(e.quarantineReasons)];
  return e;
}

export function visibleAt(evidence, cutoff) {
  const e = normalizePitEvidence(evidence);
  const t = isoOrNull(cutoff);
  return Boolean(e.pointInTimeSafe && e.tradableTime && e.tradableTime <= t);
}

export function projectWorldAt(evidenceRows, cutoff) {
  const visible = evidenceRows.map(normalizePitEvidence).filter(e => visibleAt(e, cutoff));
  const byVintageKey = new Map();
  for (const e of visible) {
    const key = `${e.entityId}::${e.family}::${e.signalName}`;
    const previous = byVintageKey.get(key);
    if (!previous || e.tradableTime > previous.tradableTime || (e.tradableTime === previous.tradableTime && String(e.vintageId) > String(previous.vintageId))) byVintageKey.set(key, e);
  }
  return [...byVintageKey.values()];
}

export function assertNoFutureLeak(world, cutoff) {
  const t = isoOrNull(cutoff);
  for (const e of world) if (!e.tradableTime || e.tradableTime > t) throw new Error(`FUTURE_LEAK ${e.evidenceId}`);
  return true;
}
