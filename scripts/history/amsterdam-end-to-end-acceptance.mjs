// Amsterdam end-to-end acceptance: catalog -> manifest -> stored histories -> public pages.
// This is an offline staging gate. It never invents missing sessions or proves data licenses.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {validateBars,loadCatalog} from './engine.mjs';
import {sessionReadiness} from './session-readiness.mjs';
const root=new URL('../../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const catalog=await read('data/euronext-amsterdam.json');
const manifest=await read('data/amsterdam-history-manifest.json');
const mappings=await loadCatalog();
const pages=await Promise.all(['amsterdam.html','amsterdam-week.js','share.js','chart.js'].map(path=>readFile(new URL(path,root),'utf8')));
const issues=[];
if(catalog.shares.length!==85)issues.push({kind:'CATALOG_COUNT',actual:catalog.shares.length});
if(mappings.length!==80)issues.push({kind:'MAPPING_COUNT',actual:mappings.length});
if(Object.keys(manifest.instruments||{}).length!==80)issues.push({kind:'MANIFEST_COUNT',actual:Object.keys(manifest.instruments||{}).length});
const mapped=new Set(mappings.map(x=>x.isin));
if(mapped.size!==mappings.length)issues.push({kind:'DUPLICATE_MAPPING'});
for(const instrument of mappings) {
 const entry=manifest.instruments?.[instrument.isin];
 if(!entry||entry.mic!=='XAMS'||entry.symbol!==instrument.symbol||entry.currency!==instrument.currency)
   issues.push({kind:'MANIFEST_IDENTITY',isin:instrument.isin});
}
const reference=catalog.shares.filter(x=>x.historyStatus==='canonical-on-other-market');
if(reference.length!==5)issues.push({kind:'REFERENCE_COUNT',actual:reference.length});
for(const x of reference)if(mapped.has(x.isin))issues.push({kind:'REFERENCE_DUPLICATE',isin:x.isin});
const rows=await Promise.all(mappings.map(async instrument=>{
 try{
  const h=await read('data/history/'+instrument.isin+'.json');
  const raw=h.bars||[],valid=validateBars(raw),last=valid.at(-1);
  if(h.instrument?.isin!==instrument.isin||h.instrument?.symbol!==instrument.symbol||h.instrument?.mic!=='XAMS')
    issues.push({kind:'HISTORY_IDENTITY',isin:instrument.isin});
  if(!raw.length||valid.length!==raw.length)issues.push({kind:'HISTORY_INVALID_BARS',isin:instrument.isin,raw:raw.length,valid:valid.length});
  if(h.coverage?.records!==raw.length||h.coverage?.firstDate!==valid[0]?.date||h.coverage?.lastDate!==last?.date)
    issues.push({kind:'HISTORY_COVERAGE',isin:instrument.isin});
  return {isin:instrument.isin,symbol:instrument.symbol,latestDate:last?.date||null,
    open:last?.open??null,close:last?.close??null,records:valid.length,
    rejectedRecords:raw.length-valid.length,provider:h.provider?.id||null};
 }catch(error){
  issues.push({kind:'HISTORY_UNAVAILABLE',isin:instrument.isin,error:String(error.message)});
  return {isin:instrument.isin,symbol:instrument.symbol,error:String(error.message),latestDate:null};
 }
}));
if(!pages[0].includes('amsterdam-week.js'))issues.push({kind:'AMSTERDAM_PAGE_SCRIPT'});
if(!pages[1].includes('collectMarketWeek'))issues.push({kind:'WEEK_RENDERER_INTEGRATION'});
if(!pages[2].includes('validateHistoryDocument'))issues.push({kind:'SHARE_PAGE_HISTORY'});
if(!pages[3].includes('export function validateHistoryDocument'))issues.push({kind:'CHART_VALIDATION'});
const readiness=sessionReadiness(rows);
const report={schemaVersion:1,generatedAt:new Date().toISOString(),
 scope:'STAGING_OFFLINE_ACCEPTANCE_NO_LIVE_DATA_VERIFICATION',
 catalogCount:catalog.shares.length,mappedCount:mappings.length,
 crossMarketReferences:reference.map(x=>({symbol:x.symbol,isin:x.isin})),
 historyCount:rows.filter(x=>!x.error).length,
 historyRows:rows.reduce((n,x)=>n+(x.records||0),0),
 readiness,issues,
 structuralPass:issues.length===0&&readiness.countMatches&&readiness.identityUnique,
 liveReady:false,
 caveats:['Historical corporate actions and adjusted returns unverified',
 'Provider observed date does not prove official close',
 'Redistribution rights not verified','Staging deployment and daily scheduler not verified']};
const path=new URL('../../research/output/amsterdam-end-to-end-acceptance.json',import.meta.url);
await mkdir(new URL('.',path),{recursive:true});
await writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log('AMSTERDAM_E2E_ACCEPTANCE '+JSON.stringify({
 structuralPass:report.structuralPass,catalog:report.catalogCount,mapped:report.mappedCount,
 histories:report.historyCount,historyRows:report.historyRows,issues:issues.length,
 observedDate:readiness.newestDate,lagging:readiness.laggingCount}));
if(!report.structuralPass)process.exitCode=1;
