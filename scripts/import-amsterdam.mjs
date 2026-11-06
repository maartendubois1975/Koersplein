import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
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
const seen=new Set(),decisions=[],staged=new Map(),originals=new Map();
for(const row of payload.rows){
 try {
 const key=row.isin+':'+row.date;
 if(seen.has(key))throw Error('Duplicate '+key);
 seen.add(key);
 const meta=manifest.instruments[row.isin];
 if(!meta||meta.symbol!==row.symbol||row.mic!=='XAMS')throw Error('Identity mismatch '+key);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date+'T00:00:00Z'))||new Date(row.date+'T00:00:00Z').toISOString().slice(0,10)!==row.date||row.date>new Date().toISOString().slice(0,10))throw Error('Invalid date '+key);
 if(![row.open,row.high,row.low,row.close].every(x=>Number.isFinite(x)&&x>0)||row.low>Math.min(row.open,row.close)||row.high<Math.max(row.open,row.close)||row.high<row.low||!Number.isSafeInteger(row.volume)||row.volume<=0)throw Error('Invalid OHLC or volume '+key);
 if(row.sourceVerified!==true||row.sessionClosedVerified!==true||!row.source||!row.sourceUrl||!row.retrievedAt)throw Error('Unverified provenance or session '+key);
 const path=join(root,'data/history',row.isin+'.json');
 const original=staged.has(path)?null:await readFile(path,'utf8');
 if(original!==null)originals.set(path,original);
 const doc=staged.has(path)?staged.get(path):JSON.parse(original);
 if(doc.instrument?.isin!==row.isin||doc.instrument?.mic!=='XAMS'||doc.instrument?.symbol!==row.symbol)throw Error('Stored identity mismatch '+key);
 const old=doc.bars.find(b=>b.date===row.date);
 if(old){decisions.push({key,status:old.open===row.open&&old.high===row.high&&old.low===row.low&&old.close===row.close&&old.volume===row.volume?'UNCHANGED':'CONFLICT_REVIEW_REQUIRED'});continue;}
 
 const bar={date:row.date,open:row.open,high:row.high,low:row.low,close:row.close,volume:row.volume,adjustedClose:null};
 const bars=[...doc.bars,bar].sort((a,b)=>a.date.localeCompare(b.date));
 const updated={...doc,bars,coverage:{...doc.coverage,lastDate:bars.at(-1).date,records:bars.length,volumeRecords:bars.filter(b=>b.volume!=null).length,missingVolumeRecords:bars.filter(b=>b.volume==null).length},provider:{...doc.provider,metadata:{...doc.provider?.metadata,lastImportSource:row.source,lastImportSourceUrl:row.sourceUrl,lastImportRetrievedAt:row.retrievedAt}}};
 staged.set(path,updated);decisions.push({key,status:'APPROVED'});
 } catch(error) {
  if(!partial)throw error;
  decisions.push({key:String(row?.isin||'UNKNOWN')+':'+String(row?.date||'UNKNOWN'),status:'REJECTED_INVALID_ROW',reason:error.message});
 }
}
const blockers=decisions.filter(d=>!['APPROVED','UNCHANGED'].includes(d.status));
const summary={mode:apply?'APPLY':'DRY_RUN',partial,received:payload.rows.length,approved:decisions.filter(d=>d.status==='APPROVED').length,skipped:blockers.length,blocked:blockers.length>0,decisions};
if(apply){
 // Never write a partial batch with invalid, conflicting or unverified candidates.
 // Missing/no-trade instruments are absent from payload.rows and remain eligible for later recovery.
 if(blockers.length)throw Error('Apply refused: '+JSON.stringify(blockers));
 // Stage all files before replacing any history. Roll back completed replacements on failure.
 const stagedFiles=[],replaced=[];
 try {
  for(const [path,updated] of staged){
   const temp=path+'.pending-'+process.pid;
   await writeFile(temp,JSON.stringify(updated,null,2)+'\n',{flag:'wx'});
   stagedFiles.push({path,temp});
  }
  for(const {path,temp} of stagedFiles){await rename(temp,path);replaced.push(path);}
 }catch(error){
  const rollbackErrors=[];
  for(const path of replaced.reverse()){
   try{await writeFile(path,originals.get(path));}catch(rollbackError){rollbackErrors.push({path,error:String(rollbackError)});}
  }
  if(rollbackErrors.length)throw Error('Import failed and rollback incomplete: '+JSON.stringify({error:String(error),rollbackErrors}));
  throw error;
 }finally{
  for(const {temp} of stagedFiles){try{await unlink(temp);}catch(error){if(error.code!=='ENOENT')console.error('Temporary cleanup failed',temp,error);}}
 }
}
console.log(JSON.stringify(summary,null,2));
