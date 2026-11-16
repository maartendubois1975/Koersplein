import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadCompanyCatalog,companyContracts} from '../history/company-register.mjs';
import {dailyRow} from '../../daily-session-view.mjs';
const markets=Object.keys(companyContracts);
let session;
for(const mic of markets){
 const catalog=await loadCompanyCatalog(mic);
 const n=catalog.shares.length;
 const snap=JSON.parse(await fs.readFile('data/daily-session-'+mic+'.json','utf8'));
 assert.equal(snap.market,mic);assert.equal(snap.results.length,n);
 assert.equal(new Set(snap.results.map(r=>r.isin)).size,n);
 assert(!session||session===snap.session);session=snap.session;
 const rows=new Map(snap.results.map(r=>[r.isin,r]));
 for(const s of catalog.shares){
  const r=rows.get(s.isin);assert(r&&r.symbol===s.symbol&&r.mic===(s.primaryMic||s.mic||mic));
  if(r.status==='TRADED')assert(dailyRow(snap,s,mic));else assert.equal(r.bar,null);
 }
 // Keep immutable dated session evidence; never overwrite an existing traded row.
 const dir='data/daily-sessions/'+mic;await fs.mkdir(dir,{recursive:true});
 const path=dir+'/'+session+'.json';
 let prior;try{prior=JSON.parse(await fs.readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(prior){
  const current=new Map(snap.results.map(r=>[r.isin,r]));
  for(const old of prior.results){if(old.status==='TRADED'){const next=current.get(old.isin);assert(next);if(next.status==='TRADED'&&JSON.stringify(old.bar)!==JSON.stringify(next.bar))console.warn('SESSION_CONFLICT_PRESERVED',mic,old.isin);current.set(old.isin,old);}}
  snap.results=[...current.values()].sort((a,b)=>a.isin.localeCompare(b.isin));
 }
 snap.counts={};for(const r of snap.results)snap.counts[r.status]=(snap.counts[r.status]||0)+1;
 await fs.writeFile(path,JSON.stringify(snap,null,2)+'\n');
 await fs.writeFile('data/daily-session-'+mic+'.json',JSON.stringify(snap,null,2)+'\n');
 console.log('ARCHIVED_SESSION',mic,session,JSON.stringify(snap.counts));
}
