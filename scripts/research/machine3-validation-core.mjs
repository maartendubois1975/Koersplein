function msMonths(n){return n*30.4375*24*3600*1000;}
export function makePurgedWalkForward(rows,{trainMonths=60,testMonths=12,embargoMonths=24,horizonMonths=24}={}){
 const sorted=[...rows].sort((a,b)=>Date.parse(a.predictionDate)-Date.parse(b.predictionDate));
 if(!sorted.length)return [];
 const start=Date.parse(sorted[0].predictionDate), end=Date.parse(sorted.at(-1).predictionDate); const folds=[];
 for(let testStart=start+msMonths(trainMonths);testStart<end;testStart+=msMonths(testMonths)){
  const testEnd=testStart+msMonths(testMonths); const purgeBefore=testStart-msMonths(horizonMonths); const trainEnd=purgeBefore-msMonths(embargoMonths);
  const train=sorted.filter(r=>Date.parse(r.predictionDate)<trainEnd); const test=sorted.filter(r=>{const t=Date.parse(r.predictionDate);return t>=testStart&&t<testEnd;});
  if(train.length&&test.length)folds.push({train,test,trainEnd:new Date(trainEnd).toISOString(),testStart:new Date(testStart).toISOString(),testEnd:new Date(testEnd).toISOString()});
 }
 return folds;
}
export function instrumentBreadth(rows){return new Set(rows.map(r=>r.entityId||r.isin)).size;}
export function calibrationBrier(rows){const x=rows.filter(r=>Number.isFinite(r.probabilityPositive)&&r.actualDirection!=null);return x.length?x.reduce((s,r)=>s+(r.probabilityPositive-(r.actualDirection>0?1:0))**2,0)/x.length:null;}
export function blockBootstrap(values,{block=12,reps=1000,seed=17}={}){let state=seed>>>0;const rnd=()=>((state=(1664525*state+1013904223)>>>0)/2**32);if(!values.length)return null;const means=[];for(let k=0;k<reps;k++){const s=[];while(s.length<values.length){const i=Math.floor(rnd()*values.length);for(let j=0;j<block&&s.length<values.length;j++)s.push(values[(i+j)%values.length]);}means.push(s.reduce((a,b)=>a+b,0)/s.length);}means.sort((a,b)=>a-b);return{mean:values.reduce((a,b)=>a+b,0)/values.length,lo:means[Math.floor(.025*reps)],hi:means[Math.floor(.975*reps)]};}
export function benjaminiHochberg(tests){const s=[...tests].sort((a,b)=>a.pValue-b.pValue),m=s.length;let prev=1;for(let i=m-1;i>=0;i--){const q=Math.min(prev,s[i].pValue*m/(i+1));s[i]={...s[i],qValue:q};prev=q;}return s;}
