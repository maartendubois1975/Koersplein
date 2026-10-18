import fs from 'node:fs/promises';
import {euronextDailySnapshot,euronextProviderMic} from '../history/providers/euronext-live.mjs';
const csv=await fs.readFile('research/europe-missing-120-dossier.csv','utf8');
const rows=csv.trim().split('\n').slice(1).map(line=>{
 const v=[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(x=>x[1].replaceAll('""','"'));
 return {mic:v[0],isin:v[2],symbol:v[3],company:v[4]};
});
if(rows.length!==120)throw Error('Missing-listing dossier changed: expected 120');
const eur=new Set(['XPAR','XAMS','XBRU','XLIS','XDUB']);
const candidates=rows.filter(x=>eur.has(x.mic));
if(candidates.length!==78)throw Error('Expected 78 Euronext targets, got '+candidates.length);
const year=new Date().getUTCFullYear();
const dates=[year+'-10-16',year+'-06-15',year+'-02-16',(year-1)+'-10-16'];
const results=new Array(candidates.length);
let cursor=0;
async function worker(){
 while(cursor<candidates.length){
  const index=cursor++,r=candidates[index],attempts=[];
  for(const date of dates){
   try{
    const signal=AbortSignal.timeout(12000);
    const data=await euronextDailySnapshot(r,date,signal);
    const bars=data.rows.filter(b=>b.date===date&&Number(b.open)>0&&Number(b.close)>0);
    attempts.push({date,sourceUrl:data.sourceUrl,validDailyBars:bars.length,open:bars[0]?.open??null,close:bars[0]?.close??null});
   }catch(e){attempts.push({date,error:String(e.message).slice(0,220)});}
   if(attempts.at(-1).validDailyBars)break;
  }
  const found=attempts.find(a=>a.validDailyBars);
  results[index]={...r,officialMic:euronextProviderMic(r.mic),status:found?'OFFICIAL_EXACT_VENUE_BAR_CANDIDATE':'OFFICIAL_DAILY_SAMPLES_NOT_FOUND',attempts,publicationApproved:false};
  console.log('EUROPE_OFFICIAL_PROBE',JSON.stringify({mic:r.mic,isin:r.isin,symbol:r.symbol,status:results[index].status}));
 }
}
await Promise.all(Array.from({length:3},worker));
const remaining=rows.filter(x=>!eur.has(x.mic)).map(r=>({...r,status:'OTHER_EXCHANGE_ARCHIVE_REQUIRED',publicationApproved:false}));
const summary={targets:120,euronextProbed:results.length,exactVenueCandidates:results.filter(x=>x.status==='OFFICIAL_EXACT_VENUE_BAR_CANDIDATE').length,
 euronextNoSample:results.filter(x=>x.status!=='OFFICIAL_EXACT_VENUE_BAR_CANDIDATE').length,otherExchangeArchives:remaining.length,
 warning:'Single-day probes cannot establish no-trading or complete history; candidates require full OHLC and publication rights validation.'};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-block2-official-source-evidence.json',JSON.stringify({generatedAt:new Date().toISOString(),mode:'READ_ONLY_NO_IMPORT',summary,results:[...results,...remaining]},null,2)+'\n');
console.log('EUROPE_BLOCK2_OFFICIAL_SUMMARY',JSON.stringify(summary));
