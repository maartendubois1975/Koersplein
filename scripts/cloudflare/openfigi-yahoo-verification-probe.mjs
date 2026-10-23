// Bounded read-only validation of OpenFIGI references against independent
// Yahoo symbol, venue, currency and complete recent OHLC. No production writes.
import fs from 'node:fs/promises';
import {latestClosedWeekday,mapConcurrent} from './europe-run-policy.mjs';
import {selectOpenFigiYahooCandidates,findOpenFigiSymbolCollisions,evaluateYahooReference,fetchYahooReferenceChart} from './openfigi-yahoo-evidence.mjs';

const request=JSON.parse(await fs.readFile('config/openfigi-yahoo-verify-request.json','utf8'));
if(request.mode!=='READ_ONLY_REFERENCE_VALIDATION'||!Number.isInteger(request.sourceRunId)||request.sourceRunId<1)throw Error('Unsafe or invalid verification request');
const source='research/output/openfigi-reference-probe.json';
const input=JSON.parse(await fs.readFile(source,'utf8'));
if(input.mode!=='READ_ONLY_NO_PRICE_WRITES'||!input.queueGeneratedAt||!Array.isArray(input.items))throw Error('OpenFIGI artifact lacks read-only audited provenance');
const selected=selectOpenFigiYahooCandidates(input,{offset:request.offset,limit:request.limit});
if(!selected.items.length)throw Error('No eligible references in selected verification page');
const collisions=findOpenFigiSymbolCollisions(input);
const catalogs={};
for(const [mic,path] of Object.entries({XSWX:'data/euronext-zurich.json',XLON:'data/euronext-london.json'})){
 const c=JSON.parse(await fs.readFile(path,'utf8'));
 const map=new Map();
 for(const share of c.shares||c.instruments||[]){
  if(!map.has(share.isin))map.set(share.isin,[]);
  map.get(share.isin).push(share);
 }
 catalogs[mic]=map;
}
const asOf=latestClosedWeekday();
const output='research/output/openfigi-yahoo-verification.json';
const report={generatedAt:new Date().toISOString(),mode:'READ_ONLY_NO_CATALOG_OR_HISTORY_WRITES',sourceRunId:request.sourceRunId,sourceReferenceGeneratedAt:input.generatedAt,sourceQueueGeneratedAt:input.queueGeneratedAt,asOf,eligibleReferences:selected.totalEligible,ambiguousReferencesDeferred:selected.ambiguousDeferred,offset:selected.offset,limit:selected.limit,selected:selected.items.length,counts:{},results:[],warning:'OpenFIGI+Yahoo symbol/venue/currency/OHLC agreement is NOT official confirmation of a current ISIN listing. No mappings or prices may be promoted automatically.'};
await fs.mkdir('research/output',{recursive:true});
async function checkpoint(){
 report.generatedAt=new Date().toISOString();
 report.counts=report.results.filter(Boolean).reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{});
 await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
}
report.results=new Array(selected.items.length);
await mapConcurrent(selected.items,2,async(item,index)=>{
 const base={mic:item.mic,isin:item.isin,providerSymbol:item.candidates[0].providerSymbol,readOnly:true};
 const stored=catalogs[item.mic]?.get(item.isin)||[];
 if(stored.length!==1){report.results[index]={...base,status:'CATALOG_ISIN_NOT_UNIQUE_OR_MISSING'};return;}
 const share=stored[0],storedSymbol=share.symbol||share.ticker;
 if(share.mic&&share.mic!==item.mic){report.results[index]={...base,status:'CATALOG_MIC_MISMATCH'};return;}
 if(String(storedSymbol)!==String(item.catalogSymbol)){report.results[index]={...base,status:'CATALOG_SYMBOL_CHANGED'};return;}
 if(!share.currency||String(share.currency).toUpperCase()!==String(item.currency||'').toUpperCase()){report.results[index]={...base,status:'CATALOG_CURRENCY_CHANGED_OR_UNKNOWN'};return;}
 if(collisions.has(String(base.providerSymbol).toUpperCase())){report.results[index]={...base,status:'CROSS_ISIN_SYMBOL_COLLISION'};return;}
 try{
  const from=new Date(asOf+'T00:00:00Z');from.setUTCDate(from.getUTCDate()-44);
  const chart=await fetchYahooReferenceChart(base.providerSymbol,{startDate:from.toISOString().slice(0,10),endDate:asOf,timeoutMs:12000});
  report.results[index]=evaluateYahooReference(item,chart,{asOf,recentDays:45});
 }catch(e){
  report.results[index]={...base,status:'YAHOO_READ_ONLY_REQUEST_FAILED',error:String(e.message||e).slice(0,220)};
 }
 await new Promise(resolve=>setTimeout(resolve,350));
 if(index%10===0)console.log('OPENFIGI_YAHOO_PROGRESS',JSON.stringify({processed:report.results.filter(Boolean).length,total:report.selected}));
});
await checkpoint();
console.log('OPENFIGI_YAHOO_READ_ONLY',JSON.stringify({sourceRunId:report.sourceRunId,selected:report.selected,eligible:report.eligibleReferences,offset:report.offset,counts:report.counts,output}));
