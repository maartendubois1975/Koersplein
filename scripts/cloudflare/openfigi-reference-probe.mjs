import fs from 'node:fs/promises';
import {figiJob,classifyFigiEvidence} from './openfigi-reference-evidence.mjs';

const input=process.env.EUROPE_RECOVERY_QUEUE_PATH||'research/output/europe-recovery-queue.json';
const output='research/output/openfigi-reference-probe.json';
const sourceUrl='https://api.openfigi.com/v3/mapping';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const queue=JSON.parse(await fs.readFile(input,'utf8'));
if(queue.mode!=='READ_ONLY_RECOVERY_QUEUE'||!Array.isArray(queue.markets))throw Error('Expected audited read-only Europe recovery queue');
const catalogFiles={XSWX:'data/euronext-zurich.json',XLON:'data/euronext-london.json'};
const catalogs={};
for(const [mic,path] of Object.entries(catalogFiles)){
 const data=JSON.parse(await fs.readFile(path,'utf8'));
 catalogs[mic]=new Map((data.shares||data.instruments||[]).map(s=>[s.isin,s]));
}
const max=Math.max(1,Math.min(500,Number(process.env.OPENFIGI_MAX_INSTRUMENTS||500)));
const markets=['XSWX','XLON'];
const items=markets.flatMap(mic=>(queue.markets.find(m=>m.mic===mic)?.instruments||[]).map(x=>({...x,mic,currency:catalogs[mic].get(x.isin)?.currency||null}))).slice(0,max);
if(!items.length)throw Error('No Swiss or London missing instruments in audited queue');
const result={generatedAt:new Date().toISOString(),mode:'READ_ONLY_NO_PRICE_WRITES',sourceUrl,input,queueGeneratedAt:queue.generatedAt,itemsRequested:items.length,counts:{},items:[],errors:[],warning:'OpenFIGI ISIN+MIC candidates can be historical/delisted or have different trading currency. No production mapping or price writes. Verify against current official listing and Yahoo chart identity before promotion.'};
await fs.mkdir('research/output',{recursive:true});
async function checkpoint(){
 result.generatedAt=new Date().toISOString();
 result.counts=result.items.reduce((a,x)=>(a[x.classification]=(a[x.classification]||0)+1,a),{});
 result.byMarket={};
 for(const item of result.items){const counts=result.byMarket[item.mic]??={};counts[item.classification]=(counts[item.classification]||0)+1;}
 await fs.writeFile(output,JSON.stringify(result,null,2));
}
for(let start=0;start<items.length;start+=10){
 const batch=items.slice(start,start+10);
 const headers={'Content-Type':'application/json','Accept':'application/json','User-Agent':'Koersplein-reference-research/1.0'};
 if(process.env.OPENFIGI_API_KEY)headers['X-OPENFIGI-APIKEY']=process.env.OPENFIGI_API_KEY;
 try{
  let response,lastRequestError;
  for(let attempt=0;attempt<3;attempt++){
   try{
    response=await fetch(sourceUrl,{method:'POST',headers,body:JSON.stringify(batch.map(figiJob)),signal:AbortSignal.timeout(30000)});
    if(response.ok)break;
    lastRequestError=Error('OpenFIGI HTTP '+response.status);
    if(![429,500,502,503,504].includes(response.status)||attempt===2)throw lastRequestError;
    const retry=response.status===429?Number(response.headers.get('retry-after')||60)*1000:5000*(attempt+1);
    await sleep(Math.min(65000,Math.max(3000,retry)));
   }catch(error){
    lastRequestError=error;
    if(attempt===2||!/(?:fetch failed|timeout|AbortError|ETIMEDOUT)/i.test(String(error.message)))throw error;
    await sleep(5000*(attempt+1));
   }
  }
  if(!response?.ok)throw lastRequestError||Error('OpenFIGI unavailable');
  const data=await response.json();
  if(!Array.isArray(data)||data.length!==batch.length)throw Error('OpenFIGI result count does not match requested ISINs');
  for(let i=0;i<batch.length;i++)result.items.push(classifyFigiEvidence(batch[i],data[i]));
 }catch(e){
  const error=String(e?.message||e).slice(0,250);
  result.errors.push({batchStart:start,count:batch.length,error});
  console.error('OPENFIGI_BATCH_FAILED',JSON.stringify({batchStart:start,count:batch.length,error}));
  for(const item of batch)result.items.push({mic:item.mic,isin:item.isin,catalogSymbol:item.symbol,currency:item.currency,classification:'REQUEST_FAILED',candidates:[],sourceError:error});
 }
 await checkpoint();
 // Unauthenticated OpenFIGI: 25 requests/minute, max 10 jobs/request.
 // Three seconds per request stays below 20 requests/minute.
 if(start+10<items.length)await sleep(3000);
}
console.log('OPENFIGI_READ_ONLY_REFERENCE',JSON.stringify({itemsRequested:result.itemsRequested,counts:result.counts,byMarket:result.byMarket,batchErrors:result.errors.length,output}));
if(result.errors.length)process.exitCode=2;
