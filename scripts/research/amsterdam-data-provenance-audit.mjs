import fs from 'node:fs/promises';
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
const stocks=(catalog.shares||[]).filter(s=>s.displayPolicy!=='cross-market-reference-only');
const rows=[];let missing=0,unverifiedAdjustment=0,unverifiedCompleteness=0,exactAdjustedCopies=0,missingAdjusted=0,partialAdjusted=0,identicalWithAdjusted=0,metadataMismatch=0;
for(const s of stocks){
 try{
  const h=JSON.parse(await fs.readFile('data/history/'+s.isin+'.json','utf8'));
  const bars=h.bars||[];
  const identical=bars.length>0&&bars.every(b=>b.adjustedClose==null||Number(b.adjustedClose)===Number(b.close));
  const adjustmentProvenance=Boolean(h.provider?.metadata?.corporateActionsSource||h.provider?.metadata?.adjustmentMethod);
  const complete=h.coverage?.backfillComplete===true;
  const withAdjusted=bars.filter(b=>b.adjustedClose!=null).length;
  if(withAdjusted===0)missingAdjusted++;
  else if(withAdjusted<bars.length)partialAdjusted++;
  else if(identical)identicalWithAdjusted++;
  if(identical)exactAdjustedCopies++;
  if(h.coverage?.records!=null&&h.coverage.records!==bars.length)metadataMismatch++;
  if(!adjustmentProvenance)unverifiedAdjustment++;
  if(!complete)unverifiedCompleteness++;
  rows.push({isin:s.isin,name:s.name,firstDate:h.coverage?.firstDate,lastDate:h.coverage?.lastDate,bars:bars.length,adjustedCloseIdenticalToClose:identical,adjustedClosePresent:withAdjusted,coverageRecordsMatch:h.coverage?.records===bars.length,adjustmentProvenanceVerified:adjustmentProvenance,backfillComplete:complete,source:h.provider?.id||null});
 }catch(e){missing++;rows.push({isin:s.isin,name:s.name,error:e.message})}
}
const reviewPriority=rows.filter(x=>!x.error).sort((a,b)=>(Number(a.adjustmentProvenanceVerified)-Number(b.adjustmentProvenanceVerified))||(Number(a.backfillComplete)-Number(b.backfillComplete))||a.isin.localeCompare(b.isin)).map((x,i)=>({...x,reviewOrder:i+1,reviewStatus:'UNVERIFIED'}));
const report={reviewPriority,status:'BLOCK_BACKTEST_UNTIL_DATA_PROVENANCE_REVIEWED',catalogSnapshotDate:catalog.retrievedAt,summary:{stocks:stocks.length,missing,exactAdjustedCopies,unverifiedAdjustment,unverifiedCompleteness},rows,interpretation:'Equality of adjustedClose and close does not prove an error, but is not evidence of corporate-action adjustment. Historical constituents and delistings are absent from the current-universe catalog.'};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/amsterdam-data-provenance-audit.json',JSON.stringify(report,null,2));
console.log('AMSTERDAM_DATA_PROVENANCE_AUDIT',JSON.stringify(report.summary));
