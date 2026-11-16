import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadCompanyCatalog} from '../history/company-register.mjs';
import {validateBars} from '../history/bars.mjs';
const base='https://koersplein.maarten-dubois1975.workers.dev';
const plan=JSON.parse(await fs.readFile('research/output/paris-storage-plan.json','utf8'));
const catalog=await loadCompanyCatalog('XPAR');
const known=new Map(catalog.shares.map(s=>[s.isin,s]));
const targets=plan.rows.filter(r=>r.action==='AUDIT_EXISTING');
async function check(row){
 const s=known.get(row.isin);assert(s&&s.mic===row.mic&&row.keys.length===1);
 const key=row.keys[0];
 try{
 let data;
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(base+'/api/history/'+encodeURIComponent(key),{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();break;}catch(e){if(attempt===2)throw e;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
 }
 const bars=data.bars??data.history?.bars??data.data?.bars;
 if(!Array.isArray(bars))throw Error('Unrecognized history payload');
 const instrument=data.instrument??data.history?.instrument??data.data?.instrument;
 const valid=validateBars(bars);
 const validDates=new Set(valid.map(x=>x.date));
 const counts={records:bars.length,valid:valid.length,invalid:bars.length-valid.length,incomplete:valid.filter(x=>!Number.isFinite(x.high)||!Number.isFinite(x.low)).length,nonPositiveVolume:valid.filter(x=>!(x.volume>0)).length,duplicateDates:bars.length-new Set(bars.map(x=>x.date)).size};
 const identity=instrument?{isin:instrument.isin,mic:instrument.mic,ticker:instrument.ticker??instrument.symbol}:null;
 const exact=identity&&[key,s.isin].includes(identity.isin)&&identity.mic===s.mic&&identity.ticker===s.symbol;
 return {...row,identity,counts,first:valid[0]?.date??null,last:valid.at(-1)?.date??null,sha256:createHash('sha256').update(JSON.stringify(bars)).digest('hex'),invalidDates:bars.filter(x=>!validDates.has(x.date)).map(x=>x.date),status:!exact?'IDENTITY_UNVERIFIED':counts.records!==row.records?'COUNT_MISMATCH':counts.invalid||counts.incomplete||counts.nonPositiveVolume?'BAR_REVIEW':'STRUCTURAL_PASS'};
 }catch(e){return {...row,status:'READ_FAILED',error:e.message};}
}
const results=[];
for(let i=0;i<targets.length;i+=4){
 results.push(...await Promise.all(targets.slice(i,i+4).map(check)));
 if(i%40===0)console.log('PARIS_AUDITED '+results.length);
 await new Promise(r=>setTimeout(r,250));
}
const counts={};for(const x of results)counts[x.status]=(counts[x.status]||0)+1;
await fs.writeFile('research/output/paris-full-history-audit.json',JSON.stringify({readOnly:true,counts,results},null,2)+'\n');
console.log('PARIS_FULL_HISTORY_AUDIT '+JSON.stringify({counts,records:results.reduce((n,r)=>n+(r.counts?.records||0),0)}));
