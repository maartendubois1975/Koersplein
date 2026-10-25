// Read-only verification of source volumes, never writes Cloudflare history.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {YahooChartProvider} from '../history/providers/yahoo-chart.mjs';
const paths=['data/euronext-prague.json','data/euronext-helsinki.json','data/euronext-vienna.json'];
const catalogues=await Promise.all(paths.map(p=>readFile(p,'utf8').then(JSON.parse)));
const targets=[...catalogues[0].shares.filter(s=>['ENERG','FOOT','RMSME','TOMA','EMAN','M2C','M1997'].includes(s.symbol)),
 ...catalogues[1].shares.filter(s=>s.symbol==='DOV1V'),
 ...catalogues[2].shares.filter(s=>['ACAG','BKS','BTS','STM'].includes(s.symbol))];
const provider=new YahooChartProvider(),results=[];
for(const instrument of targets){
 const record={mic:instrument.mic,isin:instrument.isin,symbol:instrument.symbol,providerSymbol:provider.providerSymbolFor(instrument),bars:[],status:'NOT_CHECKED'};
 try{
  const response=await provider.fetchDaily(instrument,{startDate:'2026-10-22',endDate:'2026-10-23',includeIncompleteBars:true,signal:AbortSignal.timeout(12000)});
  record.status='SOURCE_RESPONSE';
  record.providerMeta=response.providerMeta;
  record.bars=response.bars.map(bar=>({date:bar.date,volume:bar.volume,hasCompleteOhlc:[bar.open,bar.high,bar.low,bar.close].every(v=>Number.isFinite(v)),ohlcFingerprint:createHash('sha256').update(JSON.stringify([bar.date,bar.open,bar.high,bar.low,bar.close])).digest('hex').slice(0,16)}));
 }catch(error){record.status='SOURCE_ERROR';record.error=String(error?.message||error).slice(0,180);}
 results.push(record);
}
await mkdir('research/output',{recursive:true});
await writeFile('research/output/yahoo-zero-volume-source-evidence.json',JSON.stringify({mode:'READ_ONLY_SOURCE_VOLUME_EVIDENCE',targetCutoff:'2026-10-23',generatedAt:new Date().toISOString(),results,warning:'No source prices, production writes or trade-status classifications. Cross-check official exchange before use.'},null,2)+'\n');
console.log('YAHOO_ZERO_VOLUME_SOURCE_PROBE',JSON.stringify(results.map(x=>({mic:x.mic,isin:x.isin,status:x.status,volumes:x.bars.map(b=>[b.date,b.volume])}))));
