import fs from 'node:fs/promises';
import {euronextDailySnapshot} from '../history/providers/euronext-live.mjs';
const quality=JSON.parse(await fs.readFile('research/output/amsterdam-history-quality-audit.json','utf8'));
const cases=(quality.issues||[]).filter(x=>x.issue==='PRICE_JUMP_REQUIRES_CORPORATE_ACTION_REVIEW');
const out=[];
const earliestSupported=new Date();earliestSupported.setUTCFullYear(earliestSupported.getUTCFullYear()-2);
const earliestDate=earliestSupported.toISOString().slice(0,10);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(const item of cases){
 const observations={};
 if(item.date<earliestDate){out.push({isin:item.isin,name:item.name,date:item.date,previousDate:item.previousDate,storedPreviousClose:item.previousClose,storedClose:item.currentClose,storedRatio:item.ratio,adjustedRequested:null,unadjustedRequested:null,requestModesDiffer:null,classification:'HISTORICAL_SOURCE_REQUIRED',reason:'Public Euronext AJAX history generally limits requests to roughly two years; no false verification from empty responses'});continue;}
 for(const adjusted of ['Y','N']){
  try{
   const result=await euronextDailySnapshot({isin:item.isin,mic:'XAMS'},item.date,undefined,adjusted);
   observations[adjusted]={rows:result.rows.filter(x=>x.date===item.date),url:result.sourceUrl};
   await sleep(350);
  }catch(error){observations[adjusted]={error:String(error.message||error)}}
 }
 const y=observations.Y.rows?.[0],n=observations.N.rows?.[0];
 out.push({isin:item.isin,name:item.name,date:item.date,previousDate:item.previousDate,storedPreviousClose:item.previousClose,storedClose:item.currentClose,storedRatio:item.ratio,adjustedRequested:y?.close??null,unadjustedRequested:n?.close??null,requestModesDiffer:!!y&&!!n?Math.abs(y.close-n.close)>1e-8:null,observations,classification:'REQUIRES_INDEPENDENT_EVIDENCE'});
 console.log('COMPARE',item.isin,item.date,JSON.stringify({adjusted:y?.close,unadjusted:n?.close}));
}
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/amsterdam-euronext-y-n-comparison.json',JSON.stringify({generatedAt:new Date().toISOString(),policy:'No inferred corporate actions; differences are not proof of return adjustment',cases:out},null,2)+'\n');
console.log('EURONEXT_Y_N_COMPARE',JSON.stringify({cases:out.length,historicalSourceRequired:out.filter(x=>x.classification==='HISTORICAL_SOURCE_REQUIRED').length,completePairs:out.filter(x=>x.adjustedRequested!==null&&x.unadjustedRequested!==null).length,differingPairs:out.filter(x=>x.requestModesDiffer===true).length}));
