import crypto from 'node:crypto';

export const REQUIRED_TIME_FIELDS = ['valid_time','published_time','tradable_time','retrieved_time'];

export function normalizeEvidence(input) {
  const e = {...input};
  for (const k of REQUIRED_TIME_FIELDS) {
    if (!e[k]) throw new Error(`Evidence mist ${k}`);
    const t = Date.parse(e[k]);
    if (!Number.isFinite(t)) throw new Error(`Ongeldige tijd in ${k}`);
  }
  if (!e.source?.name || !e.source?.url) throw new Error('Evidence mist bronnaam of bron-URL');
  if (!e.signal_family || !e.signal_name) throw new Error('Evidence mist signal_family/signal_name');
  if (e.value === undefined || e.value === null) e.status = 'UNKNOWN';
  if (e.status === 'UNKNOWN') delete e.value;
  e.revision_id ??= 'ORIGINAL';
  e.content_hash ??= crypto.createHash('sha256').update(JSON.stringify({source:e.source,signal_family:e.signal_family,signal_name:e.signal_name,value:e.value,valid_time:e.valid_time,published_time:e.published_time,tradable_time:e.tradable_time,revision_id:e.revision_id})).digest('hex');
  return e;
}

export function knownAt(evidence, cutoff) {
  const e = normalizeEvidence(evidence);
  return Date.parse(e.tradable_time) <= Date.parse(cutoff);
}

export function assertNoFutureLeak(evidence, cutoff) {
  if (!knownAt(evidence, cutoff)) throw new Error(`TOEKOMSTLEK: ${evidence.signal_family}:${evidence.signal_name} was pas ${evidence.tradable_time} verhandelbaar, cutoff ${cutoff}`);
  return true;
}
