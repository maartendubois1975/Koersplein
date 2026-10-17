// Private NYSE historical SIP OHLCV ingestion. Requires licensed Alpaca API credentials.
// No public redistribution; stores research artifacts for validation only.
import fs from 'node:fs/promises';
import path from 'node:path';
import {selectVerifiedNYSEHistoryUniverse} from './usa-history-eligibility.mjs';
import {validateDailyOHLCV} from './usa-ohlcv-validation.mjs';
const dir='research/output/usa/XNYS';
const universe=JSON.parse(await fs.readFile(path.join(dir,'universe.json'),'utf8')).securities;
const {approved,quarantined}=selectVerifiedNYSEHistoryUniverse(universe);
const quarantineReasons={};
for(const row of quarantined)for(const reason of row.reasons)quarantineReasons[reason]=(quarantineReasons[reason]||0)+1;
await fs.writeFile(path.join(dir,'history-eligibility.json'),JSON.stringify({
 generatedAt:new Date().toISOString(),mic:'XNYS',total:universe.length,
 approved:approved.length,quarantined:quarantined.length,quarantineReasons,
 rightsFlagSet:process.env.USA_HISTORY_SIP_RIGHTS_APPROVED==='true',
 backfillApproved:false,publicationApproved:false
},null,2));
if(!approved.length)throw Error('NO_VERIFIED_NYSE_HISTORY_UNIVERSE');
if(process.env.USA_HISTORY_SIP_RIGHTS_APPROVED!=='true')throw Error('USA_HISTORY_SIP_RIGHTS_NOT_APPROVED');
const key=process.env.ALPACA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY;
if(!key||!secret)throw Error('ALPACA_CREDENTIALS_MISSING: configure repository secrets before historical import');
const max=Number(process.env.NYSE_HISTORY_BATCH_SIZE||20);
if(!Number.isInteger(max)||max<1||max>250)throw Error('Invalid NYSE_HISTORY_BATCH_SIZE (1..250)');
const offset=Number(process.env.NYSE_HISTORY_OFFSET||0);
if(!Number.isInteger(offset)||offset<0)throw Error('Invalid NYSE_HISTORY_OFFSET');
const symbols=approved.slice(offset,offset+max);
const start=process.env.NYSE_HISTORY_START||'2016-01-01';
const end=process.env.NYSE_HISTORY_END||new Date(Date.now()-86400000).toISOString().slice(0,10);
const manifest=[];
for(const item of symbols){
 const bars=[];let token;let error=null;let pages=0;
 try{
  do{
   const u=new URL('https://data.alpaca.markets/v2/stocks/'+encodeURIComponent(item.symbol)+'/bars');
   for(const [k,v] of Object.entries({timeframe:'1Day',start,end,feed:'sip',adjustment:'raw',limit:'10000'}))u.searchParams.set(k,v);
   if(token)u.searchParams.set('page_token',token);
   const response=await fetch(u,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret}});
   if(!response.ok)throw Error('ALPACA_HTTP_'+response.status+' '+(await response.text()).slice(0,180));
   const data=await response.json();
   if(!Array.isArray(data.bars))throw Error('ALPACA_INVALID_BARS');
   bars.push(...data.bars.map(b=>({date:b.t?.slice(0,10),open:b.o,high:b.h,low:b.l,close:b.c,volume:b.v,tradeCount:b.n})));
   token=data.next_page_token;pages++;
   if(pages>20)throw Error('ALPACA_PAGE_LIMIT');
  }while(token);
  validateDailyOHLCV(bars,{start,end});
  await fs.mkdir(path.join(dir,'history'),{recursive:true});
  await fs.writeFile(path.join(dir,'history',encodeURIComponent(item.symbol)+'.json'),JSON.stringify({symbol:item.symbol,exchange:'XNYS',feed:'SIP',adjustment:'raw',source:'Alpaca',start,end,bars}));
 }catch(e){error=String(e.message||e)}
 manifest.push({symbol:item.symbol,records:error?0:bars.length,firstDate:error?null:bars[0]?.date,lastDate:error?null:bars.at(-1)?.date,status:error?'FAILED':bars.length>=260?'HISTORY_AVAILABLE':'INSUFFICIENT_HISTORY',error});
 console.log(item.symbol,manifest.at(-1).status,manifest.at(-1).records);
}
const report={generatedAt:new Date().toISOString(),market:'XNYS',source:'Alpaca SIP',adjustment:'raw',start,end,offset,requested:symbols.length,successful:manifest.filter(x=>x.status==='HISTORY_AVAILABLE').length,failed:manifest.filter(x=>x.status==='FAILED').length,results:manifest,publicationApproved:false,independentValidation:false};
await fs.writeFile(path.join(dir,'history-coverage.json'),JSON.stringify(report,null,2));
if(report.failed>0 || report.successful!==report.requested || report.requested===0)process.exitCode=1;
