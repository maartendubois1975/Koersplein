import { FactoryApiClient } from './client.mjs';
import { cloudflareCatalog } from './catalog.mjs';
import { createDefaultProviderRegistry } from '../history/provider-registry.mjs';
import { partitionBars } from './history-format.mjs';

const client = new FactoryApiClient();
const registry = createDefaultProviderRegistry();
const catalog = await cloudflareCatalog();
await client.seedCatalog(catalog);
const FAILED_LAST_RUN=new Set(['NL0015002K91','NL0011794037','LU0569974404','NL0015002IE0','FR0010208488','NL0015000K93','NL0006294274','BE0003818359','FR0000062796','BE0974334667']);
const ROUTES={
 'NL0011794037':{providerSymbol:'AD.AS',allowProviderExchangeMismatch:true},
 'LU0569974404':{providerSymbol:'APAM.AS',allowProviderExchangeMismatch:true},
 'NL0015002IE0':{providerSymbol:'AVTX.AS',allowProviderExchangeMismatch:true},
 'FR0010208488':{providerSymbol:'ENGI.PA',allowProviderExchangeMismatch:true},
 'NL0015000K93':{providerSymbol:'ECMPA.AS',allowProviderExchangeMismatch:true},
 'NL0006294274':{providerSymbol:'ENX.PA',allowProviderExchangeMismatch:true},
 'BE0003818359':{providerSymbol:'GLPG.AS',allowProviderExchangeMismatch:true},
 'FR0000062796':{providerSymbol:'POMRY.PA',allowProviderExchangeMismatch:true},
 'BE0974334667':{providerSymbol:'ALWIN.PA',allowProviderExchangeMismatch:true}
};
const selected = catalog.instruments.filter(item=>item.mic==='XBRU'&&FAILED_LAST_RUN.has(item.isin));
const today=()=>new Date().toISOString().slice(0,10);
const addDay=date=>{const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)};
let complete=0,unchanged=0,resolvedNoProvider=0,failed=0;
for(const item of selected){
 try{
  let existing=null;try{existing=await client.history(item.isin)}catch(error){if(!String(error.message).includes('HTTP 404'))throw error}
  const startDate=existing?.coverage?.lastDate?addDay(existing.coverage.lastDate):'1990-01-01';
  if(startDate>today()){unchanged++;console.log(JSON.stringify({isin:item.isin,status:'UNCHANGED'}));continue}
  if(item.isin==='NL0015002K91'){
   // ADEC Innovations: nieuwe Euronext Access-notering 2025; Yahoo heeft geen symbool.
   // Niet fabriceren: als aparte opgeloste provider-gap registreren totdat een gelicenseerde/official feed is aangesloten.
   resolvedNoProvider++;console.log(JSON.stringify({isin:item.isin,status:'RESOLVED_PROVIDER_GAP',ticker:'MLADE',knownReferencePrice:10,historyFrom:'2025-07-30',note:'Geen Yahoo feed; geen synthetische OHLC geschreven'}));continue;
  }
  const routed={...item,name:item.company,symbol:item.ticker,market:item.mic,...ROUTES[item.isin]};
  const {provider,result}=await registry.fetchDaily(routed,{startDate,endDate:today()},item.provider||'yahoo-chart');
  if(!result.bars.length&&!existing?.coverage?.recordCount)throw new Error('Geen koershistorie ontvangen');
  for(const [period,bars] of partitionBars(result.bars))await client.putPartition(item.isin,period,{bars,provider:provider.id});
  const coverage=await client.completeHistory(item.isin,{provider:provider.id});complete++;
  console.log(JSON.stringify({isin:item.isin,status:'COMPLETE',providerSymbol:routed.providerSymbol,records:coverage.record_count,firstDate:coverage.first_date,lastDate:coverage.last_date}));
 }catch(error){failed++;console.error(JSON.stringify({isin:item.isin,status:'FAILED',error:error.message}))}
}
console.log(JSON.stringify({market:'XBRU',repairSelected:selected.length,complete,unchanged,resolvedNoProvider,failed,resolved:complete+unchanged+resolvedNoProvider},null,2));
if(failed)process.exitCode=2;
