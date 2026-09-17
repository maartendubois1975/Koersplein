export function deriveCompanySignals(records){
  const rows=[...records].filter(x=>x.trainingEligible).sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt));
  const bySignal=new Map();
  const out=[];
  for(const r of rows){
    const key=`${r.instrumentId}|${r.signalName}`;
    const prev=bySignal.get(key);
    const value=Number(r.value);
    if(Number.isFinite(value)){
      out.push({...base(r),derivedSignal:`${r.signalName}_LEVEL`,value});
      if(prev && Number.isFinite(Number(prev.value)) && Number(prev.value)!==0){
        out.push({...base(r),derivedSignal:`${r.signalName}_CHANGE`,value:value/Number(prev.value)-1,priorAvailableAt:prev.availableAt});
      }
    }
    bySignal.set(key,r);
  }
  return out;
}
function base(r){return {instrumentId:r.instrumentId,family:'FUNDAMENTALS',sourceSignal:r.signalName,availableAt:r.availableAt,sourceStableId:r.sourceStableId,contentHash:r.contentHash};}

export function snapshotAt(records,instrumentId,cutoff){
  const latest=new Map();
  for(const r of records){
    if(r.instrumentId!==instrumentId || !r.trainingEligible || Date.parse(r.availableAt)>Date.parse(cutoff)) continue;
    const old=latest.get(r.signalName);
    if(!old || Date.parse(r.availableAt)>Date.parse(old.availableAt)) latest.set(r.signalName,r);
  }
  return Object.fromEntries([...latest].map(([k,v])=>[k,{value:v.value,availableAt:v.availableAt,sourceStableId:v.sourceStableId}]));
}
