import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const out='research/output/machine2-feed';
await fs.mkdir(out,{recursive:true});
const retrievedAt=new Date().toISOString();
const series=[
 {family:'FX',signalName:'USD_EUR',source:'ECB_DATA_PORTAL',url:'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=csvdata'},
 {family:'FX',signalName:'GBP_EUR',source:'ECB_DATA_PORTAL',url:'https://data-api.ecb.europa.eu/service/data/EXR/D.GBP.EUR.SP00.A?format=csvdata'}
];
function csvRows(text){const lines=text.trim().split(/\r?\n/);const h=lines.shift().split(',').map(x=>x.replace(/^"|"$/g,''));return lines.map(l=>{const c=l.split(',').map(x=>x.replace(/^"|"$/g,''));return Object.fromEntries(h.map((k,i)=>[k,c[i]]));});}
const evidence=[];const report={retrievedAt,requests:0,records:0,failures:[]};
for(const s of series){try{report.requests++;const r=await fetch(s.url,{headers:{Accept:'text/csv'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);const text=await r.text();for(const row of csvRows(text)){const date=row.TIME_PERIOD||row.TIME_PERIOD_START||row.TIME_PERIOD_END;const raw=row.OBS_VALUE;if(!date||raw===''||!Number.isFinite(Number(raw)))continue;const publishedAt=`${date}T16:00:00Z`;const e={source:s.source,sourceTier:'A',urlOrStableId:s.url,observedAt:`${date}T00:00:00Z`,publishedAt,availableAt:publishedAt,entity:'EURO_AREA',family:s.family,signalName:s.signalName,valueOrClaim:Number(raw),revisionStatus:'CURRENT_OBSERVATION_NOT_PROVEN_VINTAGE',retrievedAt};e.contentHash=crypto.createHash('sha256').update(JSON.stringify(e)).digest('hex');evidence.push(e);}}catch(err){report.failures.push({signalName:s.signalName,error:String(err)});}}
report.records=evidence.length;
await fs.writeFile(`${out}/official-macro-evidence.jsonl`,evidence.map(x=>JSON.stringify(x)).join('\n')+'\n');
await fs.writeFile(`${out}/official-macro-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
