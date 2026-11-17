import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadCompanyCatalog,companyContracts} from '../history/company-register.mjs';
import {dailyRow,listingIdentity,validSessionDate} from '../../daily-session-view.mjs';

const readOptional=async file=>{try{return JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;return null}};
const write=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(value,null,2)+'\n');await fs.rename(tmp,file);};
const signature=bar=>JSON.stringify(['open','high','low','close','volume'].map(k=>bar[k]));
export function validateSnapshot(snapshot,catalog,market){
 if(snapshot?.market!==market||!validSessionDate(snapshot.session)||snapshot.results?.length!==catalog.shares.length||new Set(snapshot.results.map(r=>r.isin)).size!==catalog.shares.length)throw Error('Session register mismatch '+market);
 const rows=new Map(snapshot.results.map(r=>[r.isin,r]));
 for(const share of catalog.shares){
  const row=rows.get(share.isin),id=listingIdentity(share,market);
  if(!row||row.symbol!==id.symbol||row.mic!==id.mic)throw Error('Session identity mismatch '+share.isin);
  if(row.status==='TRADED'?!dailyRow(snapshot,share,market):!['SESSION_UNVERIFIED','NO_TRADES','MARKET_CLOSED'].includes(row.status)||row.bar!==null)throw Error('Invalid session evidence '+share.isin);
 }
 return snapshot;
}
export async function archiveApprovedSessions({inputDir='research/output',dataDir='data',markets=Object.keys(companyContracts),loadCatalog=loadCompanyCatalog}={}){
 const report={markets:[],errors:[],conflicts:[]};
 for(const market of markets){
  try{
   const incoming=await readOptional(path.join(inputDir,'daily-session-'+market+'.json'));
   if(!incoming){report.errors.push({market,error:'SESSION_ARTIFACT_MISSING'});continue;}
   const catalog=await loadCatalog(market);const snap=validateSnapshot(incoming,catalog,market);
   const archivePath=path.join(dataDir,'daily-sessions',market,snap.session+'.json');
   const prior=await readOptional(archivePath);
   if(prior){
    validateSnapshot(prior,catalog,market);
    const current=new Map(snap.results.map(r=>[r.isin,r]));
    for(const old of prior.results)if(['TRADED','NO_TRADES','MARKET_CLOSED'].includes(old.status)){
     const next=current.get(old.isin);
     if(old.status!=='TRADED'&&next.status==='TRADED')report.conflicts.push({market,isin:old.isin,date:snap.session,code:'SESSION_STATUS_CONFLICT_PRESERVED',priorStatus:old.status,incomingStatus:next.status,incomingBar:next.bar});
     if(old.status==='TRADED'&&next.status==='TRADED'&&signature(next.bar)!==signature(old.bar))report.conflicts.push({market,isin:old.isin,date:snap.session,code:'SESSION_CONFLICT_PRESERVED'});
     current.set(old.isin,old);
    }
    snap.results=[...current.values()].sort((a,b)=>a.isin.localeCompare(b.isin));
   }
   // One exchange-scoped history document format; old remote/local archives are read-only compatibility sources.
   // Keep every existing raw bar, including old defects; never replace a same-date stored observation.
   const historyWrites=[];
   for(const share of catalog.shares){
    const bar=dailyRow(snap,share,market);if(!bar)continue;
    const identity=listingIdentity(share,market),file=path.join(dataDir,'history',identity.storageKey+'.json');
    const doc=await readOptional(file);
    if(doc&&(doc.instrument?.isin!==identity.isin||doc.instrument?.mic!==identity.mic||doc.instrument?.symbol!==identity.symbol||!Array.isArray(doc.bars)))throw Error('Stored history identity mismatch '+identity.storageKey);
    const bars=doc?[...doc.bars]:[],existing=bars.find(b=>b.date===bar.date);
    if(existing){
     if(signature(existing)!==signature(bar)){
      report.conflicts.push({market,isin:share.isin,date:bar.date,code:'HISTORY_CONFLICT_PRESERVED'});
      if(!prior?.results.some(r=>r.isin===share.isin&&r.status==='TRADED')){const row=snap.results.find(r=>r.isin===share.isin);row.status='SESSION_UNVERIFIED';row.bar=null;row.error='Stored history conflicts with session; raw history retained';}
     }
    }else bars.push(bar);
    bars.sort((a,b)=>a.date.localeCompare(b.date));
    historyWrites.push([file,{...(doc||{}),schemaVersion:1,instrument:doc?.instrument||{isin:identity.isin,mic:identity.mic,symbol:identity.symbol,name:identity.name,currency:share.currency||catalog.currency||'EUR'},provider:doc?.provider||{name:'approved-daily-session',role:'verified-session-source',metadata:{backfillComplete:false}},coverage:{...(doc?.coverage||{}),firstDate:bars[0]?.date,lastDate:bars.at(-1)?.date,recordCount:bars.length,records:bars.length},bars}]);
   }
   // Validate all identities before persisting this market; another market's failure cannot prevent this commit.
   for(const [file,doc] of historyWrites)await write(file,doc);
   snap.counts={};for(const row of snap.results)snap.counts[row.status]=(snap.counts[row.status]||0)+1;
   snap.archiveConflicts=report.conflicts.filter(x=>x.market===market);
   await write(archivePath,snap);
   const latestPath=path.join(dataDir,'daily-session-'+market+'.json');const latest=await readOptional(latestPath);
   if(!latest||latest.session<=snap.session)await write(latestPath,snap);
   report.markets.push({market,session:snap.session,counts:snap.counts,historyDocuments:historyWrites.length});
  }catch(error){report.errors.push({market,error:error.message});}
 }
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await archiveApprovedSessions();await fs.mkdir('research/output',{recursive:true});await write('research/output/approved-session-archive-report.json',report);console.log(JSON.stringify(report));if(!report.markets.length)process.exitCode=1;
}
