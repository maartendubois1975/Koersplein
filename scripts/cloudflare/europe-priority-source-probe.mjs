import fs from 'node:fs/promises';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {mapConcurrent} from './europe-run-policy.mjs';
const markets=new Set(['XPAR','XLON','XCYS','XAMS','XBRU']);
const target=process.env.EUROPE_PROBE_SCOPE==='remaining'?'remaining':'priority';
const csv=await fs.readFile('research/europe-missing-120-dossier.csv','utf8');
const rows=csv.trim().split('\n').slice(1).map(line=>{
 const values=[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(m=>m[1].replaceAll('""','"'));
 return {mic:values[0],market:values[1],isin:values[2],symbol:values[3],company:values[4]};
}).filter(r=>target==='remaining'?!markets.has(r.mic):markets.has(r.mic));
const expected=target==='remaining'?18:102;
if(rows.length!==expected)throw Error('Expected exactly '+expected+' '+target+' listings, got '+rows.length);
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const registry=createDefaultProviderRegistry();
const results=[];
const classify=error=>{
 const s=String(error||'');
 if(/Providerbeurs wijkt af/i.test(s))return 'WRONG_EXCHANGE_MATCH';
 if(/Geen verhandelde Euronext koershistorie/i.test(s))return 'NO_OFFICIAL_PUBLIC_TRADES';
 if(/HTTP 404|no daily bars|no usable bars|Geen Yahoo ISIN-resolutie/i.test(s))return 'NO_PUBLIC_PROVIDER_BARS';
 if(/timeout|timed out|fetch failed/i.test(s))return 'SOURCE_TIMEOUT';
 return 'SOURCE_UNRESOLVED';
};
await mapConcurrent(rows,3,async row=>{
 const market=plan.markets.find(m=>m.mic===row.mic);
 const instrument={isin:row.isin,symbol:row.symbol,ticker:row.symbol,mic:row.mic,name:row.company,currency:market?.currency,countryCode:market?.country};
 const range={startDate:'2025-01-01',endDate:new Date().toISOString().slice(0,10)};
 let result;
 try{
  const {provider,result:daily}=await registry.fetchDaily(instrument,range,null,{timeoutMs:12000});
  const bars=daily.bars.filter(b=>/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')&&Number(b.open)>0&&Number(b.close)>0);
  result={...row,status:bars.length?'CANDIDATE_FOUND_NEEDS_VALIDATION':'NO_VALID_OHLC',provider:provider.id,bars:bars.length,firstDate:bars[0]?.date||null,lastDate:bars.at(-1)?.date||null,publicationApproved:false};
 }catch(e){result={...row,status:'NO_PROVIDER_RESULT',diagnostic:classify(e.message),nextAction:row.mic==='XPAR'||row.mic==='XAMS'||row.mic==='XBRU'?'VERIFY_EURONEXT_EOD_LICENSED_ISIN_MIC':row.mic==='XLON'?'VERIFY_LSE_OFFICIAL_EOD_ARCHIVE':'VERIFY_CYPRUS_EXCHANGE_OFFICIAL_ARCHIVE',error:String(e.message).slice(0,1400),publicationApproved:false};}
 results.push(result);
 console.log('EUROPE_SOURCE_PROBE',JSON.stringify(result));
});
results.sort((a,b)=>a.mic.localeCompare(b.mic)||a.isin.localeCompare(b.isin));
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-'+target+'-'+expected+'-source-probe.json',JSON.stringify({generatedAt:new Date().toISOString(),mode:'READ_ONLY_NO_UPLOAD',total:results.length,found:results.filter(x=>x.status==='CANDIDATE_FOUND_NEEDS_VALIDATION').length,results},null,2)+'\n');
const byDiagnostic=Object.fromEntries([...new Set(results.map(x=>x.diagnostic||x.status))].map(k=>[k,results.filter(x=>(x.diagnostic||x.status)===k).length]));
console.log('EUROPE_SOURCE_PROBE_SUMMARY',JSON.stringify({total:results.length,found:results.filter(x=>x.status==='CANDIDATE_FOUND_NEEDS_VALIDATION').length,byDiagnostic}));
