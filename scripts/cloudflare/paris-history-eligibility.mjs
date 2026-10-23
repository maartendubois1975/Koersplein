// Shared, read-only eligibility gate for Paris listings.
// The official catalog keeps all identities, but an empty history shell is not
// permission to create a new price series in existing-history-only mode.
export function hasRecordedHistory(row) {
  return Boolean(
    row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.lastDate || '')) &&
    Number.isFinite(Number(row.recordCount ?? row.records)) &&
    Number(row.recordCount ?? row.records) > 0
  );
}

export function parisHistoryEligible(share, marketMic, policy, manifestInstruments, resolveStorage) {
  const mic = share.mic || marketMic;
  if (policy?.mode !== 'existing-history-only' || !(policy.mics || []).includes(mic)) return true;
  const key = resolveStorage({...share, mic});
  return hasRecordedHistory(key ? manifestInstruments?.[key] : null);
}
