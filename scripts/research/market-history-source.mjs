import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {verifiedBackfillComplete} from '../history/bars.mjs';
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

// Shared approved-company history reader: new daily history and old archives use
// the same instrument+bars document. Compatibility sources remain read-only.
export async function loadApprovedHistory(item,parentMic,{api='',cutoff,dataDir='data',fetchImpl=globalThis.fetch,requirePredictionEvidence=false}={}){
 const {listingIdentity}=await import('../../daily-session-view.mjs');
 const {inspectDailyBarIntegrity}=await import('../cloudflare/europe-run-policy.mjs');
 const id=listingIdentity(item,parentMic),documents=[];
 for(const key of [id.storageKey,id.isin]){try{documents.push(JSON.parse(await fs.readFile(path.join(dataDir,'history',key+'.json'),'utf8')))}catch(e){if(e.code!=='ENOENT')throw e;}}
 if(api){
  let found=false;
  for(const key of [id.storageKey,id.isin]){
   const response=await fetchImpl(api.replace(/\/$/,'')+'/api/history/'+encodeURIComponent(key),{signal:AbortSignal.timeout(30000)});
   if(response.status===404)continue;
   if(!response.ok)throw Error('HISTORY_HTTP_'+response.status);
   const document=await response.json();
   if(document.instrument?.mic!==id.mic||![id.isin,id.storageKey].includes(document.instrument?.isin)||String(document.instrument?.symbol||document.instrument?.ticker)!==id.symbol)throw Error('HISTORY_IDENTITY_MISMATCH '+id.storageKey);
   documents.unshift(document);found=true;break;
  }
  if(!found&&!documents.length)throw Error('HISTORY_NOT_FOUND '+id.storageKey);
 }
 if(!documents.length)throw Error('HISTORY_NOT_FOUND '+id.storageKey);
 if(requirePredictionEvidence&&!documents.some(doc=>verifiedBackfillComplete(doc)&&Boolean(doc.provider?.metadata?.corporateActionsSource||doc.provider?.metadata?.adjustmentMethod)&&doc.coverage?.lastDate===cutoff))throw Error('PREDICTION_SOURCE_PROVENANCE_UNVERIFIED '+id.storageKey);
 const byDate=new Map();
 for(const document of documents){
  const instrument=document.instrument;
  if(!instrument||instrument.mic!==id.mic||![id.isin,id.storageKey].includes(instrument.isin)||(instrument.symbol||instrument.ticker)!==id.symbol)throw Error('HISTORY_IDENTITY_MISMATCH '+id.storageKey);
  const source=document.bars;
  if(!Array.isArray(source))throw Error('HISTORY_PAYLOAD_INVALID');
  if(source.some(b=>b.date>cutoff))throw Error('HISTORY_AFTER_REFERENCE_SESSION');
  const checked=inspectDailyBarIntegrity({bars:source},{startDate:'0001-01-01',endDate:cutoff});
  if(checked.conflicts.length||checked.bars.length!==source.length)throw Error('HISTORY_INVALID_OR_DUPLICATE_BARS');
  for(const bar of checked.bars){
   const existing=byDate.get(bar.date),signature=b=>JSON.stringify(['open','high','low','close','volume'].map(k=>Number(b[k])));
   if(existing&&signature(existing)!==signature(bar))throw Error('HISTORY_SOURCE_CONFLICT '+bar.date);
   byDate.set(bar.date,bar);
  }
 }
 return [...byDate.values()].map(bar=>({...bar,...Object.fromEntries(['open','high','low','close','volume'].map(k=>[k,Number(bar[k])]))})).sort((a,b)=>a.date.localeCompare(b.date));
}
