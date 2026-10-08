import fs from 'node:fs/promises';
const mic=process.env.MARKET_MIC;if(!mic)throw Error('MARKET_MIC ontbreekt');
const file=`research/output/${mic}/machine1-results.jsonl`;
const rows=(await fs.readFile(file,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const byDate=new Map();for(const r of rows){if(!byDate.has(r.predictionDate))byDate.set(r.predictionDate,[]);byDate.get(r.predictionDate).push(r)}
const sixMonth=r=>r.availableSignals?.momentum6m;
for(const group of byDate.values()){
 const market6=group.map(sixMonth).filter(Number.isFinite);
 const marketMean=market6.length?market6.reduce((a,b)=>a+b,0)/market6.length:null;
 for(const r of group){const v=sixMonth(r);
  r.availableSignals.marketContext={marketMomentum6mMean:marketMean,relativeMomentum6m:Number.isFinite(v)&&marketMean!=null?v-marketMean:null};
  const c=r.availableSignals?.classification;
  if(c?.eligibleForPeerModel){const peers=group.filter(x=>x!==r&&x.availableSignals?.classification?.sector===c.sector&&Number.isFinite(sixMonth(x)));
   const vals=peers.map(sixMonth);
   r.availableSignals.peerContext={sector:c.sector,peerCount:vals.length,relativeMomentum6m:vals.length&&Number.isFinite(v)?v-vals.reduce((a,b)=>a+b,0)/vals.length:null};
  }else r.availableSignals.peerContext={sector:'UNKNOWN',peerCount:0,relativeMomentum6m:null};
 }
}
await fs.writeFile(file,rows.map(JSON.stringify).join('\n')+'\n');
const summary={market:mic,observations:rows.length,dates:byDate.size,relativeMarketSignals:rows.filter(r=>Number.isFinite(r.availableSignals?.marketContext?.relativeMomentum6m)).length,sectorPeerSignals:rows.filter(r=>Number.isFinite(r.availableSignals?.peerContext?.relativeMomentum6m)).length,sectorUnknown:rows.filter(r=>r.availableSignals?.classification?.sector==='UNKNOWN').length};
await fs.writeFile(`research/output/${mic}/relative-specialist-summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
