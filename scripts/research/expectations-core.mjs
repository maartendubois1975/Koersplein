export function latestEligibleEstimate(rows, cutoff, signalName) {
  const t = new Date(cutoff).toISOString();
  return rows.filter(r => r.signalName===signalName && r.trainingEligible && r.tradableTime && r.tradableTime<=t).sort((a,b)=>b.tradableTime.localeCompare(a.tradableTime))[0] ?? null;
}
export function revision(current, previous) {
  if (!current || !previous || current.normalizedValue==null || previous.normalizedValue==null) return null;
  if (current.tradableTime <= previous.tradableTime) throw new Error('REVISION_ORDER_INVALID');
  return Number(current.normalizedValue)-Number(previous.normalizedValue);
}
export function surprise(actual, estimate) {
  if (!actual || !estimate) return null;
  if (!actual.publishedTime || !estimate.tradableTime || estimate.tradableTime>=actual.publishedTime) throw new Error('EXPECTATION_FUTURE_LEAK');
  const a=Number(actual.normalizedValue), e=Number(estimate.normalizedValue);
  if (!Number.isFinite(a)||!Number.isFinite(e)) return null;
  return {absolute:a-e,relative:e===0?null:(a-e)/Math.abs(e),estimateEvidenceId:estimate.evidenceId,actualEvidenceId:actual.evidenceId};
}
