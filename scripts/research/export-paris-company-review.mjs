import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'research/paris/2026-11-16');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const ledger=await read(path.join(dir,'company-decisions.json'));
const rows=ledger.rows, included=rows.filter(x=>x.decision==='INCLUDE');
assert.equal(rows.length,769);
assert.equal(new Set(rows.map(x=>x.isin+'|'+x.mic)).size,769);
assert.deepEqual(Object.fromEntries(['XPAR','ALXP','XMLI'].map(m=>[m,rows.filter(x=>x.mic===m).length])),{XPAR:337,ALXP:293,XMLI:139});
assert(rows.every(x=>['INCLUDE','EXCLUDE','PENDING'].includes(x.decision)&&x.reason&&x.reasonCode&&x.sources.length));
assert(included.every(x=>x.identityConfirmed&&['Common Stock','Others'].includes(x.instrumentSubtype)));
for(const field of ['isin','symbol','companyId']) assert.equal(new Set(included.map(x=>x[field])).size,included.length,'Duplicate approved '+field);
assert.equal(ledger.legacyHistoryAudit.length,28);
assert(ledger.legacyHistoryAudit.every(x=>x.actualBarsRead===x.manifest.recordCount));
assert.equal(ledger.legacyHistoryAudit.filter(x=>x.classification==='SINGLE_INVALID_OHLC_ROW_QUARANTINE').length,18);
assert.equal(ledger.isinLineage.length,2);
assert(ledger.isinLineage.every(x=>!x.successorInManifest));
assert.equal(ledger.archivedBaselineRows.length,9);
assert.equal(ledger.supplementalCurrencyExclusions.length,2);
const evidence=JSON.parse(gunzipSync(await fs.readFile(path.join(dir,'evidence/individual-evidence.json.gz'))));
assert.equal(evidence.length,769);
const evidenceIds=new Set(evidence.map(x=>x.isin+'|'+x.mic));
assert(rows.every(x=>evidenceIds.has(x.isin+'|'+x.mic)));
for(const [file,count] of [['euronext-amsterdam.json',80],['euronext-brussels.json',105]]){
 const catalog=await read(path.join(root,'data',file));assert.equal(catalog.shares.length,count);
 const otherIds=new Set(catalog.shares.map(x=>x.isin));assert(!included.some(x=>otherIds.has(x.isin)));
}
const countBy=(set,key)=>Object.fromEntries([...new Set(set.map(x=>x[key]))].sort().map(k=>[k,set.filter(x=>x[key]===k).length]));
const summary={asOf:ledger.asOf,totalReviewed:rows.length,decisions:countBy(rows,'decision'),bySegment:Object.fromEntries(['XPAR','ALXP','XMLI'].map(m=>[m,countBy(rows.filter(x=>x.mic===m),'decision')])),reasons:countBy(rows,'reasonCode'),includedHistory:countBy(included.map(x=>x.history),'status'),includedHistoryRecordsReported:included.reduce((n,x)=>n+x.history.recordsReported,0),allCurrentHistory:countBy(rows.map(x=>x.history),'status'),individualEvidence:{productIdentity:evidence.filter(x=>x.product.identityMatch).length,factsheetIdentity:evidence.filter(x=>x.factsheet.identityMatch).length,businessProfile:evidence.filter(x=>x.business.present).length,quoteIdentity:evidence.filter(x=>x.quote.identityPresent).length},sourceRunIds:[43809738322,43810891249],legacyAudit:{total:28,micMismatch:ledger.legacyHistoryAudit.filter(x=>x.identityMismatch).length,invalidSingleBar:18},lineage:ledger.isinLineage.map(({oldIsin,newIsin,effectiveDate,oldSharesPerNewShare,postEffectiveRowsStillUnderOldIsin})=>({oldIsin,newIsin,effectiveDate,oldSharesPerNewShare,postEffectiveRowsStillUnderOldIsin})),limits:ledger.policy.primaryEvidenceLimit};
const csvCell=x=>'"'+String(x??'').replaceAll('"','""')+'"';
const columns=['name','symbol','isin','mic','companyId','instrumentSubtype','decision','reasonCode','reason','primaryMarket','primaryEvidenceBasis','primaryConclusionIsInference','lastTradedDate','storageKey','historyStatus','recordsReported','sources'];
function csv(set){return columns.join(',')+'\n'+set.map(x=>columns.map(k=>csvCell(k==='sources'?x.sources.join(' | '):k==='storageKey'?x.history.storageKey:k==='historyStatus'?x.history.status:k==='recordsReported'?x.history.recordsReported:x[k])).join(',')).join('\n')+'\n';}
const outputs={
 'summary.json':JSON.stringify(summary,null,2)+'\n',
 'all-listings.csv':csv(rows),
 'included-companies.csv':csv(included),
 'excluded-listings.csv':csv(rows.filter(x=>x.decision==='EXCLUDE')),
 'pending-cases.csv':csv(rows.filter(x=>x.decision==='PENDING')),
 'approved-research-catalog.json':JSON.stringify({exchange:'Euronext Paris research selection',asOf:ledger.asOf,sourceOfTruth:'company-decisions.json',notRuntimeCatalog:true,unresolvedExcluded:true,shares:included.map(({name,symbol,isin,mic,companyId})=>({name,symbol,isin,mic,companyId,primaryMic:mic}))},null,2)+'\n'
};
for(const [name,content] of Object.entries(outputs)){
 const p=path.join(dir,name);
 if(process.argv.includes('--check'))assert.equal(await fs.readFile(p,'utf8'),content,'Stale derivative '+name);
 else await fs.writeFile(p,content);
}
console.log(JSON.stringify({result:'PASS',mode:process.argv.includes('--check')?'read-only check':'export research derivatives',counts:summary.decisions,bySegment:summary.bySegment,history:summary.includedHistory,ledgerSha256:createHash('sha256').update(await fs.readFile(path.join(dir,'company-decisions.json'))).digest('hex')},null,2));
