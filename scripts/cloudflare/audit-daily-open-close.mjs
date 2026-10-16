import fs from 'node:fs/promises';
import { FactoryApiClient } from './client.mjs';

const client=new FactoryApiClient();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const complete=plan.markets.filter(x=>x.state==='COMPLETE');
const out=[];
const MAX_STALE_CALENDAR_DAYS=7;
const cutoff=new Date(Date.now()-MAX_STALE_CALENDAR_DAYS*86400000).toISOString().slice(0,10);
for(const market of complete){
  const file=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8'));
  const shares=file.shares||file.instruments||[];
  const unavailable=new Set((market.dataUnavailable||[]).map(x=>x.isin));
  let ok=0,missing=[],skipped=0;
  for(const s of shares){
    if(unavailable.has(s.isin)){ skipped++; continue; }
    try{
      // /coverage contains metadata only; inspect the actual history for the latest bar.
      const h=await client.history(s.isin);
      const bars=h?.bars||h?.history||[];
      const b=bars.at?.(-1);
      if(!b||!Number.isFinite(Number(b.open))||Number(b.open)<=0||!Number.isFinite(Number(b.close))||Number(b.close)<=0||!/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')||b.date<cutoff||b.date>new Date().toISOString().slice(0,10)){
        missing.push({isin:s.isin,symbol:s.symbol||s.ticker,lastDate:b?.date||null,reason:'MISSING_INVALID_OR_STALE_OHLC'});
        continue;
      }
      ok++;
    }catch(e){missing.push({isin:s.isin,symbol:s.symbol||s.ticker,error:e.message})}
  }
  out.push({mic:market.mic,name:market.name,catalog:shares.length,openCloseOk:ok,skippedDataUnavailable:skipped,missingOpenClose:missing.length,missing});
}
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/daily-open-close-audit.json',JSON.stringify({generatedAt:new Date().toISOString(),freshnessCutoff:cutoff,markets:out},null,2));
console.log(JSON.stringify(out.map(x=>({mic:x.mic,catalog:x.catalog,openCloseOk:x.openCloseOk,skippedDataUnavailable:x.skippedDataUnavailable,missingOpenClose:x.missingOpenClose})),null,2));
if(out.some(x=>x.missingOpenClose)) process.exitCode=2;
