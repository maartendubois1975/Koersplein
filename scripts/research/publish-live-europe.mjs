import fs from 'node:fs/promises';import {buildDailySnapshot,officialWeeklySnapshot,intradaySignalPolicy} from './live-publication-core.mjs';
const input=process.env.LIVE_RANKINGS_FILE||'research/output/live/rankings.json';let rankings;try{const x=JSON.parse(await fs.readFile(input,'utf8'));rankings=x.rankings||x}catch(e){if(e.code==='ENOENT')throw Error('LIVE_RANKINGS_MISSING: publication blocked');throw e}
if(!rankings||typeof rankings!=='object'||![3,6,12,24].every(h=>Array.isArray(rankings[h+'m'])&&rankings[h+'m'].length>0))throw Error('LIVE_RANKINGS_INVALID: four nonempty horizons required');
for(const h of [3,6,12,24])for(const row of rankings[h+'m'])if(row?.validationStatus!=='VALIDATED'||row?.holdoutValidated!==true||row?.outOfSampleValidated!==true)throw Error('LIVE_RANKINGS_UNVERIFIED: publication blocked');
const evidenceFile=process.env.LIVE_VALIDATION_EVIDENCE_FILE||'research/output/live/validation-evidence.json';
let evidence;try{evidence=JSON.parse(await fs.readFile(evidenceFile,'utf8'))}catch(e){if(e.code==='ENOENT')throw Error('LIVE_VALIDATION_EVIDENCE_MISSING: publication blocked');throw e}
if(evidence?.status!=='VALIDATED'||evidence?.outOfSampleValidated!==true||evidence?.holdoutValidated!==true||!evidence?.reportId)throw Error('LIVE_VALIDATION_EVIDENCE_INVALID: publication blocked');
if(![3,6,12,24].every(h=>evidence?.horizons?.[h+'m']?.status==='VALIDATED'))throw Error('LIVE_VALIDATION_HORIZONS_UNVERIFIED: publication blocked');
const crypto=await import('node:crypto');
const digest=crypto.createHash('sha256').update(await fs.readFile(input)).digest('hex');
if(evidence?.rankingsSha256!==digest)throw Error('LIVE_VALIDATION_RANKINGS_HASH_MISMATCH: publication blocked');
if(evidence?.reportId===digest)throw Error('LIVE_VALIDATION_REPORT_NOT_DISTINCT: publication blocked');
let previous=null;try{previous=JSON.parse(await fs.readFile('data/live-europe-latest.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const now=new Date(),daily=buildDailySnapshot(rankings,{asOf:now.toISOString(),previous,topN:5});await fs.mkdir('data/live-history',{recursive:true});const day=now.toISOString().slice(0,10);await fs.writeFile('data/live-europe-latest.json',JSON.stringify(daily,null,2));await fs.writeFile('data/live-history/'+day+'-'+daily.snapshotId.slice(0,12)+'.json',JSON.stringify(daily,null,2));await fs.writeFile('data/live-meaningful-changes.json',JSON.stringify({asOf:daily.asOf,signals:intradaySignalPolicy(daily)},null,2));
if(now.getUTCDay()===1||process.env.FORCE_WEEKLY==='1'){const weekly=officialWeeklySnapshot(daily,{publishedAt:now.toISOString()});await fs.writeFile('data/live-europe-weekly.json',JSON.stringify(weekly,null,2));}
console.log(JSON.stringify({status:'LIVE_SNAPSHOT_FROZEN',snapshotId:daily.snapshotId,changes:daily.meaningfulChanges.length,horizons:Object.fromEntries(Object.entries(daily.horizons).map(([k,v])=>[k,v.top.filter(x=>x.status!=='EXIT').length]))}));
