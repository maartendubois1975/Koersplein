import crypto from 'node:crypto';

const numericSignals=new Set(['revenue','operating_income','net_income','eps','operating_margin','free_cash_flow','cash','net_debt','dividend']);

export function normalizeCompanyEvidence(input){
  const e={...input};
  for(const k of ['instrumentId','issuer','family','signalName','sourceId','sourceStableId','retrievedAt']) if(!e[k]) throw new Error(`Company evidence mist ${k}`);
  if(!e.publishedAt) return quarantine(e,'MISSING_PUBLISHED_AT');
  if(!Number.isFinite(Date.parse(e.publishedAt))) return quarantine(e,'INVALID_PUBLISHED_AT');
  if(e.availableAt && !Number.isFinite(Date.parse(e.availableAt))) return quarantine(e,'INVALID_AVAILABLE_AT');
  e.availableAt ||= e.publishedAt;
  if(Date.parse(e.availableAt)<Date.parse(e.publishedAt)) return quarantine(e,'AVAILABLE_BEFORE_PUBLICATION');
  if(numericSignals.has(e.signalName) && !Number.isFinite(Number(e.value))) return quarantine(e,'NON_NUMERIC_VALUE');
  if(e.value===null || e.value===undefined || e.value==='') return quarantine(e,'UNKNOWN_VALUE');
  e.revisionStatus ||= 'ORIGINAL';
  e.trainingEligible=e.revisionStatus==='ORIGINAL' && e.mappingConfidence==='EXACT';
  e.contentHash ||= crypto.createHash('sha256').update(JSON.stringify({instrumentId:e.instrumentId,sourceStableId:e.sourceStableId,signalName:e.signalName,value:e.value,publishedAt:e.publishedAt,availableAt:e.availableAt,revisionStatus:e.revisionStatus})).digest('hex');
  return e;
}

function quarantine(e,reason){return {...e,trainingEligible:false,quarantineReason:reason};}

export function eligibleAt(e,cutoff){
  const n=normalizeCompanyEvidence(e);
  return n.trainingEligible===true && Date.parse(n.availableAt)<=Date.parse(cutoff);
}
