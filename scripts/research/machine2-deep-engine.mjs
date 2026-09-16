import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const input=process.argv[2]||'research/input/amsterdam-machine1-results.jsonl';
const out='research/output/machine2-deep';
const rows=(await fs.readFile(input,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const families=['PRICE','TRADING','FUNDAMENTALS','FUND_CHANGE','VALUATION','EXPECTATIONS','MANAGEMENT','NETWORK','SECTOR','MARKET','EUROPE','GLOBAL','RATES','INFLATION','FX','COMMODITIES','CREDIT','RISK','FLOWS','INDEX','NEWS','ATTENTION','POLITICS','CENTRAL_BANKS','GEOPOLITICS','CALENDAR','SMART_MONEY','SHORT','OPTIONS','CORRELATION','REGIME','EVENT_REACTION','RELATIVE','INTERACTIONS'];
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const dossiers=new Map();
for(const r of rows){const key=`${r.instrument}|${r.predictionDate}`;if(!dossiers.has(key))dossiers.set(key,{key,instrument:r.instrument,ticker:r.ticker,company:r.company,cutoff:r.predictionDate,predictions:[],evidence:[],missing:[],hypotheses:[]});dossiers.get(key).predictions.push(r);}
await fs.mkdir(`${out}/dossiers`,{recursive:true});
let n=0;for(const d of dossiers.values()){
 for(const family of families){d.missing.push({family,status:'SOURCE_REQUIRED',rule:'Geen waarde invullen zonder bron met publishedAt/availableAt <= cutoff voor kenbaar-op-T analyse.'});}
 d.futureWindows=['+1d','+1w','+1m','+3m','+6m','+12m','+24m'];d.rules={machine1Immutable:true,pointInTimeRequired:true,revisionsSeparate:true,unknownStaysUnknown:true,noCausalClaimWithoutEvidence:true,machine2CannotPromoteSignal:true};d.dossierHash=hash({key:d.key,predictions:d.predictions});
 await fs.writeFile(`${out}/dossiers/${String(n++).padStart(6,'0')}.json`,JSON.stringify(d));
}
const manifest={generatedAt:new Date().toISOString(),stage:'DEEP_HISTORICAL_DETECTIVE',market:'XAMS',machine1Rows:rows.length,dossiers:dossiers.size,families,futureWindows:['+1d','+1w','+1m','+3m','+6m','+12m','+24m'],state:'EVIDENCE_COLLECTION_READY',important:'Engine fabriceert geen historische signalen. Connectors/providers vullen evidence alleen met bron, observedAt, publishedAt, availableAt, revision status en provenance. Ontbrekende bron blijft missing.',checkpoint:{completed:0,total:dossiers.size},schemaVersion:1};
await fs.writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));