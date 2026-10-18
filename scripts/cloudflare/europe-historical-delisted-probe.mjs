import fs from 'node:fs/promises';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {mapConcurrent} from './europe-run-policy.mjs';
const csv=await fs.readFile('research/europe-missing-120-dossier.csv','utf8');
const rows=csv.trim().split('\n').slice(1).map(line=>{
 const v=[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(m=>m[1].replaceAll('""','"'));
 return {mic:v[0],market:v[1],isin:v[2],symbol:v[3],company:v[4]};
});
if(rows.length!==120)throw Error('Expected 120 missing listings');
const registry=createDefaultProviderRegistry();
const results=[];
const windows=[['2020-01-01','2024-12-31'],['2015-01-01','2019-12-31'],['2005-01-01','2014-12-31']];
await mapConcurrent(rows,3,async row=>{
 const instrument={isin:row.isin,symbol:row.symbol,ticker:row.symbol,mic:row.mic,name:row.company};
 const attempts=[];let candidate=null;
 for(const [startDate,endDate] of windows){
  // Use only Yahoo chart/ISIN for broad historical windows: Euronext Live
  // expands each long window into many expensive network calls.
  for(const id of ['yahoo-chart','yahoo-isin-resolver']){
   const provider=registry.get(id);
   if(!provider?.supports(instrument))continue;
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),12000);
   try{
    const result=await provider.fetchDaily(instrument,{startDate,endDate,signal:controller.signal});
    const bars=(result.bars||[]).filter(b=>b.date>=startDate&&b.date<=endDate&&Number(b.open)>0&&Number(b.close)>0);
    if(bars.length){candidate={provider:id,firstDate:bars[0].date,lastDate:bars.at(-1).date,bars:bars.length,window:startDate+'..'+endDate};break;}
    attempts.push({provider:id,window:startDate+'..'+endDate,reason:'NO_VALID_BARS'});
   }catch(e){attempts.push({provider:id,window:startDate+'..'+endDate,reason:String(e.message).slice(0,180)});}
   finally{clearTimeout(timer);}
  }
  if(candidate)break;
 }
 const record={...row,status:candidate?'HISTORICAL_CANDIDATE_REQUIRES_INDEPENDENT_VERIFICATION':'NO_HISTORICAL_PUBLIC_PROVIDER_BARS',candidate,attempts,publicationApproved:false};
 results.push(record);
 console.log('EUROPE_HISTORICAL_PROBE',JSON.stringify({mic:row.mic,isin:row.isin,symbol:row.symbol,status:record.status,candidate}));
});
results.sort((a,b)=>a.mic.localeCompare(b.mic)||a.isin.localeCompare(b.isin));
const summary={total:results.length,historicalCandidates:results.filter(x=>x.candidate).length,stillUnresolved:results.filter(x=>!x.candidate).length};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-120-historical-delisted-probe.json',JSON.stringify({generatedAt:new Date().toISOString(),mode:'READ_ONLY',windows,summary,results},null,2)+'\n');
console.log('EUROPE_HISTORICAL_PROBE_SUMMARY',JSON.stringify(summary));
