import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(process.cwd());
const manifest=JSON.parse(await readFile(join(root,'data/amsterdam-history-manifest.json'),'utf8'));
const input=process.argv[2];
if(!input)throw Error('Usage: node scripts/import-amsterdam.mjs reviewed-snapshot.json [--apply]');
const payload=JSON.parse(await readFile(resolve(input),'utf8'));
const apply=process.argv.includes('--apply');
const partial=process.argv.includes('--partial');
if(payload.market!=='XAMS'||!Array.isArray(payload.rows))throw Error('Expected XAMS rows');
if(Object.keys(manifest.instruments).length!==80)throw Error('Expected 80 mapped instruments');
const seen=new Set(),decisions=[],staged=[];
for(const row of payload.rows){
 const key=row.isin+':'+row.date;
 if(seen.has(key))throw Error('Duplicate '+key);
 seen.add(key);
 const meta=manifest.instruments[row.isin];
 if(!meta||meta.symbol!==row.symbol||row.mic!=='XAMS')throw Error('Identity mismatch '+key);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date+'T00:00:00Z'))||new Date(row.date+'T00:00:00Z').toISOString().slice(0,10)!==row.date||row.date>new Date().toISOString().slice(0,10))throw Error('Invalid date '+key);
 if(![row.open,row.high,row.low,row.close].every(x=>Number.isFinite(x)&&x>0)||row.low>Math.min(row.open,row.close)||row.high<Math.max(row.open,row.close)||row.high<row.low||!Number.isSafeInteger(row.volume)||row.volume<=0)throw Error('Invalid OHLC or volume '+key);
 if(!row.source||!row.sourceUrl||!row.retrievedAt)throw Error('Missing provenance '+key);
 const path=join(root,'data/history',row.isin+'.json');
 const doc=JSON.parse(await readFile(path,'utf8'));
 if(doc.instrument?.isin!==row.isin||doc.instrument?.mic!=='XAMS'||doc.instrument?.symbol!==row.symbol)throw Error('Stored identity mismatch '+key);
 const old=doc.bars.find(b=>b.date===row.date);
 if(old){decisions.push({key,status:old.open===row.open&&old.close===row.close&&old.volume===row.volume?'UNCHANGED':'CONFLICT_REVIEW_REQUIRED'});continue;}
 if(doc.bars.at(-1)?.date>=row.date){decisions.push({key,status:'HISTORICAL_GAP_REVIEW_REQUIRED'});continue;}
 if(row.sourceVerified!==true||row.sessionClosedVerified!==true){decisions.push({key,status:'UNVERIFIED_SOURCE_OR_SESSION'});continue;}
 const bar={date:row.date,open:row.open,high:row.high,low:row.low,close:row.close,volume:row.volume,adjustedClose:null};
 const bars=[...doc.bars,bar];
 const updated={...doc,bars,coverage:{...doc.coverage,lastDate:row.date,records:bars.length,volumeRecords:bars.filter(b=>b.volume!=null).length,missingVolumeRecords:bars.filter(b=>b.volume==null).length},provider:{...doc.provider,metadata:{...doc.provider?.metadata,lastImportSource:row.source,lastImportSourceUrl:row.sourceUrl,lastImportRetrievedAt:row.retrievedAt}}};
 staged.push({path,updated});decisions.push({key,status:'APPROVED'});
}
const summary={mode:apply?'APPLY':'DRY_RUN',partial,received:payload.rows.length,approved:staged.length,skipped:decisions.filter(d=>!['APPROVED','UNCHANGED'].includes(d.status)).length,decisions};
if(apply){
 if(!partial&&decisions.some(d=>!['APPROVED','UNCHANGED'].includes(d.status)))throw Error('Apply refused: unresolved conflicts');
 for(const {path,updated} of staged)await writeFile(path,JSON.stringify(updated,null,2)+'\n');
}
console.log(JSON.stringify(summary,null,2));
