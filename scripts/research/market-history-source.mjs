import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {YahooChartProvider} from '../history/providers/yahoo-chart.mjs';

const yahoo=new YahooChartProvider();
const barsOf=raw=>Array.isArray(raw)?raw:(raw?.bars||raw?.history||raw?.records||raw?.data||[]);

export async function loadMarketBars(item,mic,loadByIsin){
 const isin=typeof item.isin==='string'&&item.isin.trim()?item.isin.trim():null;
 if(isin){
  const raw=await loadByIsin(isin);
  return {bars:barsOf(raw),identityKey:isin,isin,provisionalIdentity:false,source:'KOERSPLEIN_HISTORY_API'};
 }
 const symbol=String(item.providerSymbol||'').trim();
 if(!symbol||!item.identitySource||!item.identityResolution)throw Error('MISSING_ISIN_AND_SOURCE_PROVEN_SYMBOL '+(item.ticker||item.symbol||''));
 const identityKey=mic+':'+symbol;
 const cache=path.join(os.tmpdir(),'koersplein-arena-price-cache',mic,encodeURIComponent(symbol)+'.json');
 try{return JSON.parse(await fs.readFile(cache,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
 const result=await yahoo.fetchDaily({...item,mic,providerSymbol:symbol},{startDate:'1990-01-01',endDate:new Date().toISOString().slice(0,10)});
 const payload={bars:result.bars,identityKey,isin:null,provisionalIdentity:true,source:'YAHOO_CHART_VERIFIED_SYMBOL_NOT_ISIN',retrievedAt:new Date().toISOString(),providerMeta:result.providerMeta};
 await fs.mkdir(path.dirname(cache),{recursive:true});
 await fs.writeFile(cache,JSON.stringify(payload));
 return payload;
}
