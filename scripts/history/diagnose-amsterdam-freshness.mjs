import {readFile} from 'node:fs/promises';
import {loadCatalog, validateBars, historyUrl} from './engine.mjs';
import {YahooChartProvider} from './providers/yahoo-chart.mjs';
import {EuronextLiveProvider} from './providers/euronext-live.mjs';

// Diagnose the current catalog, not a historical hard-coded list that can
// contain delisted instruments or omit newly lagging Amsterdam shares.
const catalog=await loadCatalog();
const stored=await Promise.all(catalog.map(async instrument=>{
  try {
    const document=JSON.parse(await readFile(new URL(instrument.isin+'.json',historyUrl),'utf8'));
    return {instrument,latest:validateBars(document.bars||[]).at(-1)?.date||null};
  } catch(error) {
    return {instrument,latest:null,readError:String(error.message)};
  }
}));
const newestDate=stored.map(x=>x.latest).filter(Boolean).sort().at(-1)||null;
const baseline=new Set(['AALB','ADYEN','ASML','ABN','AMUND','MTRK']);
const selected=stored.filter(x=>x.latest!==newestDate||baseline.has(x.instrument.symbol));
const endDate=new Date().toISOString().slice(0,10);
const startDate=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
const providers=[new YahooChartProvider(),new EuronextLiveProvider()];
const report=[];
const investigations=[];
for(const {instrument,latest,readError} of selected){
  const observations=[];
  for(const provider of providers){
    try{
      const result=await provider.fetchDaily(instrument,{startDate,endDate});
      const dates=result.bars.map(x=>x.date).sort();
      const observation={symbol:instrument.symbol,isin:instrument.isin,storedLatest:latest,readError,
        provider:provider.id,latest:dates.at(-1)||null,days:dates.slice(-6),
        count:dates.length,partialHistory:result.providerMeta?.partialHistory||false};
      report.push(observation);
      observations.push(observation);
    }catch(error){
      const observation={symbol:instrument.symbol,isin:instrument.isin,storedLatest:latest,readError,
        provider:provider.id,error:String(error.message).slice(0,240)};
      report.push(observation);
      observations.push(observation);
    }
  }
  const official=observations.find(x=>x.provider==='euronext-live');
  const fallback=observations.find(x=>x.provider==='yahoo-chart');
  const latestSource=[official?.latest,fallback?.latest].filter(Boolean).sort().at(-1)||null;
  const isLagging=latest!==newestDate;
  // Missing a daily trade does not itself prove an import failure.
  const classification=!isLagging?'REFERENCE_ONLY':
    latestSource&&(!latest||latestSource>latest)?'NEWER_SOURCE_TRADE_AVAILABLE':
    official?.error&&fallback?.error?'BOTH_SOURCES_FAILED':
    'NO_NEWER_EXECUTED_TRADE_CONFIRMED';
  investigations.push({symbol:instrument.symbol,isin:instrument.isin,storedLatest:latest,
    latestSource,classification,officialLatest:official?.latest||null,
    fallbackLatest:fallback?.latest||null,officialError:official?.error||null,
    fallbackError:fallback?.error||null});
}
console.log('AMSTERDAM_FRESHNESS_DIAGNOSTIC '+JSON.stringify({
  startDate,endDate,newestStoredDate:newestDate,catalogCount:catalog.length,
  laggingStored:stored.filter(x=>x.latest!==newestDate).map(x=>({symbol:x.instrument.symbol,isin:x.instrument.isin,latest:x.latest,readError:x.readError})),
  selectedCount:selected.length,investigations,report
}));
