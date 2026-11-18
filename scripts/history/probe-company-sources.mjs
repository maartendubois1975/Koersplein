// Evidence collection only: no catalog, provider approval, database or history writes.
import { mkdir, writeFile } from 'node:fs/promises';
import { loadCompanyCatalog } from './company-register.mjs';
import { createDefaultProviderRegistry } from './provider-registry.mjs';
import { inspectDailyBarIntegrity, mapConcurrent } from '../cloudflare/europe-run-policy.mjs';
const mic = process.argv[2] || 'XBRU';
const catalog = await loadCompanyCatalog(mic);
const registry = createDefaultProviderRegistry();
const endDate = new Date().toISOString().slice(0,10);
const startDate = new Date(Date.parse(endDate+'T00:00:00Z')-30*86400000).toISOString().slice(0,10);
const range = { startDate, endDate };
const observations = [];
await mapConcurrent(catalog.shares, 4, async share => {
  const instrument = { ...share, mic: share.primaryMic || catalog.mic, currency:'EUR' };
  const sources = [];
  const observedBars = new Map();
  for (const id of ['yahoo-chart', 'euronext-live']) {
    try {
      const { result } = await registry.fetchDaily(instrument, range, id, { strictPreferred:true, timeoutMs:10000 });
      const check = inspectDailyBarIntegrity(result, range);
      observedBars.set(id,check.bars);
      sources.push({ provider:id, status:check.bars.length?'OBSERVED_TRADED_BARS':'NO_VALID_TRADED_BARS',
        bars:check.bars.length, firstDate:check.bars[0]?.date || null, lastDate:check.bars.at(-1)?.date || null,
        conflicts:check.conflicts, partialHistory:result.providerMeta?.partialHistory === true,
        requestUrl:result.requestUrl, providerMetadata:result.providerMeta });
    } catch (error) { sources.push({provider:id,status:'REQUEST_FAILED',error:error.message}); }
  }
  const yahoo=new Map((observedBars.get('yahoo-chart')||[]).map(b=>[b.date,b]));
  let overlap=0,matchingOhlc=0;
  const differences=[];
  for(const bar of observedBars.get('euronext-live')||[]) {
    const other=yahoo.get(bar.date);if(!other)continue;
    overlap++;
    const changed=['open','high','low','close'].filter(key=>Math.abs(Number(bar[key])-Number(other[key]))>Math.max(1e-6,Math.abs(Number(bar[key]))*1e-6));
    if(!changed.length)matchingOhlc++;else differences.push({date:bar.date,fields:changed});
  }
  observations.push({isin:share.isin,symbol:share.symbol,mic:instrument.mic,sources,
    comparison:{overlap,matchingOhlc,differences,meaning:'Price agreement is not independent corporate-action or licensing verification'}});
});
observations.sort((a,b)=>a.isin.localeCompare(b.isin));
const report = { generatedAt:new Date().toISOString(),mic,range,readOnly:true,
  policy:'OBSERVATIONS_ONLY_NOT_PROVIDER_APPROVAL_OR_NO_TRADE_PROOF',expected:catalog.shares.length,observations };
const output = new URL(`../../research/output/${mic.toLowerCase()}-source-observations.json`,import.meta.url);
await mkdir(new URL('.',output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({mic,companies:observations.length,sources:observations.flatMap(o=>o.sources).reduce((a,s)=>(a[s.provider+':'+s.status]=(a[s.provider+':'+s.status]||0)+1,a),{})}));
