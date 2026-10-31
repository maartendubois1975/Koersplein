import {loadCatalog} from './engine.mjs';
import {YahooChartProvider} from './providers/yahoo-chart.mjs';
import {EuronextLiveProvider} from './providers/euronext-live.mjs';
const symbols=new Set(['AALB','ADYEN','ASML','ABN','AMUND','MTRK','PORF','INPST']);
const selected=(await loadCatalog()).filter(x=>symbols.has(x.symbol));
const endDate=new Date().toISOString().slice(0,10);
const startDate=new Date(Date.now()-9*86400000).toISOString().slice(0,10);
const providers=[new YahooChartProvider(),new EuronextLiveProvider()];
const report=[];
for(const instrument of selected){
 for(const provider of providers){
  try{
   const result=await provider.fetchDaily(instrument,{startDate,endDate});
   const dates=result.bars.map(x=>x.date).sort();
   report.push({symbol:instrument.symbol,isin:instrument.isin,provider:provider.id,latest:dates.at(-1)||null,days:dates.slice(-6),count:dates.length,partialHistory:result.providerMeta?.partialHistory||false});
  }catch(error){report.push({symbol:instrument.symbol,isin:instrument.isin,provider:provider.id,error:String(error.message).slice(0,240)});}
 }
}
console.log('AMSTERDAM_FRESHNESS_DIAGNOSTIC '+JSON.stringify({startDate,endDate,report}));
