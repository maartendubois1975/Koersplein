import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadCompanyCatalog} from '../history/company-register.mjs';
import {validateBars} from '../history/bars.mjs';
const catalog=await loadCompanyCatalog('XPAR');
const ledger=JSON.parse(await fs.readFile('research/paris/2026-11-16/company-decisions.json','utf8'));
const recovery=JSON.parse(await fs.readFile('research/output/paris-recovery-evidence.json','utf8'));
const known=new Map(catalog.shares.map(s=>[s.isin,s]));
const lineage=new Map(ledger.isinLineage.map(x=>[x.newIsin,x]));
const decisions=[];
for(const r of recovery.results){
 const s=known.get(r.isin);assert(s&&s.mic===r.mic);
 const event=lineage.get(s.isin);
 const raw=r.bars||[];
 const valid=validateBars(raw).filter(b=>Number.isFinite(b.high)&&Number.isFinite(b.low)&&b.volume>0);
 const allowed=valid.filter(b=>!event||b.date>=event.effectiveDate);
 const rejected=raw.length-allowed.length;
 // Successor-series prices can be split-adjusted historical values. Keep only
 // post-event candidates and require independent identity/price-scale evidence.
 const status=!allowed.length?'NO_VERIFIED_SOURCE_CANDIDATE':event?'SUCCESSOR_SCALE_REVIEW':r.action==='REVIEW_IDENTITY'?'EXISTING_IDENTITY_REVIEW':'NEW_SERIES_CANDIDATE';
 decisions.push({isin:s.isin,mic:s.mic,symbol:s.symbol,status,source:r.provider||null,requestUrl:r.requestUrl||null,event:event?{oldIsin:event.oldIsin,effectiveDate:event.effectiveDate,oldSharesPerNewShare:event.oldSharesPerNewShare}:null,rawCount:raw.length,rejected,firstDate:allowed[0]?.date||null,lastDate:allowed.at(-1)?.date||null,sha256:createHash('sha256').update(JSON.stringify(raw)).digest('hex'),bars:allowed,productionWriteAllowed:false});
}
assert.equal(decisions.length,36);
const counts={};for(const d of decisions)counts[d.status]=(counts[d.status]||0)+1;
await fs.writeFile('research/output/paris-staged-recovery.json',JSON.stringify({mode:'ISOLATED_CANDIDATES_ONLY',counts,decisions},null,2)+'\n');
console.log('PARIS_STAGED_RECOVERY '+JSON.stringify(counts));
