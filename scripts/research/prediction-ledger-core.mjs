import fs from 'node:fs/promises';import crypto from 'node:crypto';
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export function makeLedgerRecord(prediction,{dataSnapshotId,modelArtifactId,codeVersion,universeSnapshotId,corporateActionSnapshotId}){
 if(!prediction?.predictionId||prediction.mutable!==false)throw Error('LEDGER_REQUIRES_FROZEN_PREDICTION');
 for(const [k,v] of Object.entries({dataSnapshotId,modelArtifactId,codeVersion,universeSnapshotId,corporateActionSnapshotId}))if(!v)throw Error('LEDGER_MISSING_'+k);
 const core={schemaVersion:'prediction-ledger-v1',predictionId:prediction.predictionId,entityId:prediction.entityId,predictionTime:prediction.predictionTime,modelVersion:prediction.modelVersion,evidenceIds:[...(prediction.evidenceIds||[])].sort(),outputs:prediction.outputs,dataSnapshotId,modelArtifactId,codeVersion,universeSnapshotId,corporateActionSnapshotId,createdAt:prediction.createdAt};
 return {...core,recordHash:hash(core),immutable:true};
}
export function verifyLedger(records){const ids=new Set(),hashes=new Set();for(const r of records){if(!r.immutable)throw Error('LEDGER_MUTABLE_RECORD');if(ids.has(r.predictionId))throw Error('LEDGER_DUPLICATE_PREDICTION_ID');ids.add(r.predictionId);const {recordHash,immutable,...core}=r;if(hash(core)!==recordHash)throw Error('LEDGER_HASH_MISMATCH_'+r.predictionId);if(hashes.has(recordHash))throw Error('LEDGER_DUPLICATE_HASH');hashes.add(recordHash);}return true;}
export async function appendLedger(path,record){let rows=[];try{rows=(await fs.readFile(path,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse)}catch(e){if(e.code!=='ENOENT')throw e}if(rows.some(x=>x.predictionId===record.predictionId))throw Error('IMMUTABLE_LEDGER_ALREADY_CONTAINS_'+record.predictionId);verifyLedger([...rows,record]);await fs.mkdir(path.split('/').slice(0,-1).join('/'),{recursive:true});await fs.appendFile(path,JSON.stringify(record)+'\n');return record;}
export function freezeSnapshot(kind,payload,{asOfTime,sourceIds=[]}={}){if(!kind||!asOfTime)throw Error('SNAPSHOT_IDENTITY_REQUIRED');const body={kind,asOfTime:new Date(asOfTime).toISOString(),sourceIds:[...sourceIds].sort(),payloadHash:hash(payload)};return{...body,snapshotId:hash(body),immutable:true};}

const opportunityFields=['selectionDate','market','venue','currency','targetPct','horizonMonths','frozen','modelVersion','name','ticker','isin','referenceDate','referenceClose','consensusRank','componentRanks','componentScores','features','audit','createdAt','signalType','benchmarkAtSelection'];
export const opportunityCore=p=>Object.fromEntries(opportunityFields.filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
export function sealOpportunity(prediction){return {...prediction,recordHash:hash(opportunityCore(prediction)),immutable:true};}
export function verifyOpportunity(prediction){
 if(!prediction.recordHash||prediction.immutable!==true)throw Error('OPPORTUNITY_NOT_SEALED');
 if(hash(opportunityCore(prediction))!==prediction.recordHash)throw Error('FROZEN_OPPORTUNITY_CHANGED');return true;
}

// Outcome fields may be recomputed. Previously saved selections, including
// legacy records and their original attestations, are append-only.
export function verifyOpportunityAppend(previous, next) {
 const identity = row => JSON.stringify([row.market, row.selectionDate, row.referenceDate]);
 const records = new Map();
 for (const row of next) {
  const key = identity(row);
  if (records.has(key)) throw Error('DUPLICATE_OPPORTUNITY '+key);
  if (row.recordHash) verifyOpportunity(row);
  records.set(key, row);
 }
 for (const row of previous) {
  const key = identity(row);
  const saved = records.get(key);
  if (!saved || saved.recordHash !== row.recordHash || saved.immutable !== row.immutable ||
      hash(opportunityCore(saved)) !== hash(opportunityCore(row))) {
   throw Error('SAVED_OPPORTUNITY_CHANGED '+key);
  }
  records.delete(key);
 }
 for (const row of records.values()) verifyOpportunity(row);
 return true;
}

const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function opportunityScoreboard(ledger, markets = []) {
 const scored = ledger.filter(row => row.recordHash && row.immutable === true && !row.legacyUnverified);
 function summarize(rows) {
  const finished = rows.filter(row => row.status === 'CLOSED' && !row.evaluationError &&
   typeof row.result30 === 'boolean' && Number.isFinite(row.currentReturn));
  const wins = finished.filter(row => row.result30).length;
  const matched = finished.filter(row => Number.isFinite(row.benchmarkReturn));
  return {
   predictions: rows.length, closed: finished.length, hits30: wins, misses30: finished.length - wins,
   hitRate: finished.length ? wins / finished.length * 100 : null,
   averageReturn: average(finished.map(row => row.currentReturn)),
   averageLoss: average(finished.map(row => row.currentReturn).filter(value => value < 0)),
   benchmarkComparisons: matched.length,
   averageBenchmarkReturn: average(matched.map(row => row.benchmarkReturn)),
   averageExcessReturn: average(matched.map(row => row.currentReturn - row.benchmarkReturn)),
  };
 }
 function group(key, initial = []) {
  return Object.fromEntries([...new Set([...initial, ...scored.map(key)])].sort()
   .map(value => [value, summarize(scored.filter(row => key(row) === value))]));
 }
 return { ...summarize(scored), savedRecords: ledger.length, unsealedRecords: ledger.length - scored.length,
  open: scored.filter(row => row.status === 'OPEN').length,
  byMarket: group(row => row.market, markets),
  bySignal: group(row => row.signalType || row.modelVersion || 'unknown'),
  byHorizon: group(row => String(row.horizonMonths || 3)),
 };
}

export async function evaluateBenchmark(prediction, outcome, loadBars) {
 const members = prediction.benchmarkAtSelection;
 if (outcome.status !== 'CLOSED' || !Array.isArray(members) || members.length < 2) return null;
 const returns = [];
 for (const member of members) {
  const bars = await loadBars(member);
  const first = bars.find(row => row.date === prediction.referenceDate);
  const last = bars.find(row => row.date === outcome.latestDate);
  if (!first || first.close !== member.referenceClose || !last || !Number.isFinite(last.close) || last.close <= 0 ||
      outcome.latestDate <= prediction.referenceDate) return null;
  returns.push(last.close / member.referenceClose - 1);
 }
 return average(returns);
}
