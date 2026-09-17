import { FactoryApiClient } from './client.mjs';
import { cloudflareCatalog } from './catalog.mjs';
import { createDefaultProviderRegistry } from '../history/provider-registry.mjs';
import { partitionBars } from './history-format.mjs';

const client = new FactoryApiClient();
const registry = createDefaultProviderRegistry();
const catalog = await cloudflareCatalog();
await client.seedCatalog(catalog);

// Laatste twee Brusselse uitzonderingen. Lakefront/Galapagos veranderde op 8 mei 2026
// van GLPG naar LKFT; Yahoo voert de doorlopende Euronext-reeks onder LKFT.AS.
// ADEC heeft geen Yahoo-feed en vrijwel geen handel. We slaan uitsluitend werkelijk
// gepubliceerde OHLC-waarnemingen op; ontbrekende handelsdagen worden nooit verzonnen.
const SELECTED = new Set(['NL0015002K91', 'BE0003818359']);
const ROUTES = {
  'BE0003818359': { providerSymbol: 'LKFT.AS', allowProviderExchangeMismatch: true }
};
const ADEC_OBSERVED_BARS = [
  ['2025-07-30',10],['2025-07-31',10],['2025-08-01',10],['2025-08-04',10],
  ['2025-08-05',10],['2025-08-06',10],['2025-08-07',10],['2025-08-08',10]
].map(([date, price]) => ({ date, open:price, high:price, low:price, close:price, volume:null }));

const selected = catalog.instruments.filter(item => item.mic === 'XBRU' && SELECTED.has(item.isin));
const today = () => new Date().toISOString().slice(0,10);
const addDay = date => { const d=new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10); };
let complete=0, unchanged=0, failed=0;

for (const item of selected) {
  try {
    let existing=null;
    try { existing=await client.history(item.isin); }
    catch(error) { if(!String(error.message).includes('HTTP 404')) throw error; }

    if (item.isin === 'NL0015002K91') {
      // Broncontrole: Euronext bevestigt direct listing 25-07-2025 à EUR 10;
      // publieke historische tabel rapporteert 30-07 t/m 08-08-2025 dagelijks OHLC EUR 10.
      // Geen volume en geen latere transacties: dus geen synthetische dagelijkse reeks.
      for (const [period,bars] of partitionBars(ADEC_OBSERVED_BARS)) {
        await client.putPartition(item.isin, period, { bars, provider:'published-observed-history' });
      }
      const coverage=await client.completeHistory(item.isin,{provider:'published-observed-history'});
      complete++;
      console.log(JSON.stringify({isin:item.isin,status:'COMPLETE_SPARSE',provider:'published-observed-history',records:coverage.record_count,firstDate:coverage.first_date,lastDate:coverage.last_date,note:'Alleen waargenomen handelsdata; geen synthetische bars'}));
      continue;
    }

    const startDate=existing?.coverage?.lastDate ? addDay(existing.coverage.lastDate) : '2005-05-06';
    if(startDate>today()){unchanged++;console.log(JSON.stringify({isin:item.isin,status:'UNCHANGED'}));continue;}
    const routed={...item,name:item.company,symbol:item.ticker,market:item.mic,...ROUTES[item.isin]};
    const {provider,result}=await registry.fetchDaily(routed,{startDate,endDate:today()},item.provider||'yahoo-chart');
    if(!result.bars.length&&!existing?.coverage?.recordCount) throw new Error('Geen koershistorie ontvangen');
    for(const [period,bars] of partitionBars(result.bars)) await client.putPartition(item.isin,period,{bars,provider:provider.id});
    const coverage=await client.completeHistory(item.isin,{provider:provider.id});
    complete++;
    console.log(JSON.stringify({isin:item.isin,status:'COMPLETE',providerSymbol:routed.providerSymbol,records:coverage.record_count,firstDate:coverage.first_date,lastDate:coverage.last_date}));
  } catch(error) {
    failed++;
    console.error(JSON.stringify({isin:item.isin,status:'FAILED',error:error.message}));
  }
}
console.log(JSON.stringify({market:'XBRU',repairSelected:selected.length,complete,unchanged,failed,resolved:complete+unchanged},null,2));
if(failed) process.exitCode=2;
