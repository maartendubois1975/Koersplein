import fs from 'node:fs/promises';
const API=(process.env.KOERSPLEIN_API_URL||'').replace(/\/$/,'');if(!API)throw Error('KOERSPLEIN_API_URL ontbreekt');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function getJson(path){
 let last;
 for(let attempt=0;attempt<6;attempt++){
  try{const r=await fetch(API+path,{headers:{accept:'application/json'}});if(r.ok)return r.json();last=new Error(`HTTP ${r.status}`);if(![429,500,502,503,504].includes(r.status))break;
   const ra=Number(r.headers.get('retry-after'));await sleep(Number.isFinite(ra)&&ra>0?ra*1000:Math.min(30000,1000*(2**attempt)));
  }catch(e){last=e;await sleep(Math.min(30000,1000*(2**attempt)))}
 }
 throw last||new Error('API onbereikbaar');
}
const raw=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8')),shares=raw.shares||[];
let nonEquitySet=new Set(),alternativeEquitySet=new Set(),knownUnavailable=new Set();
try{const c=JSON.parse(await fs.readFile('research/output/paris/instrument-classification.json','utf8'));nonEquitySet=new Set((c.nonEquity||[]).map(x=>x.isin));alternativeEquitySet=new Set((c.equities||[]).map(x=>x.isin))}catch{}
try{const r=JSON.parse(await fs.readFile('research/output/paris/repair-invalid-summary.json','utf8'));knownUnavailable=new Set([...(r.unavailableItems||[]),...(r.failedItems||[])].map(x=>x.isin))}catch{}
const manifest=await getJson('/api/history/manifest.json'),stored=manifest.instruments||{};
let valid=0,records=0,first=null,last=null,invalid=[],unavailable=[],excludedNonEquity=[];
for(const s of shares){
 if(nonEquitySet.has(s.isin)){excludedNonEquity.push({isin:s.isin,symbol:s.symbol,mic:s.mic||'XPAR',reason:'NON_EQUITY_INSTRUMENT'});continue}
 const h=stored[s.isin],explicitGap=alternativeEquitySet.has(s.isin)||knownUnavailable.has(s.isin);
 if(!h){const row={isin:s.isin,symbol:s.symbol,mic:s.mic||'XPAR',error:'geen opgeslagen historie'};if(explicitGap)unavailable.push({...row,reason:'ALTERNATIVE_SOURCE_REQUIRED'});else invalid.push(row);continue}
 const count=Number(h.recordCount),fd=h.firstDate,ld=h.lastDate;
 if(!Number.isFinite(count)||count<=0||!/^\d{4}-\d{2}-\d{2}$/.test(fd||'')||!/^\d{4}-\d{2}-\d{2}$/.test(ld||'')||fd>ld){invalid.push({isin:s.isin,symbol:s.symbol,mic:s.mic||'XPAR',error:'ongeldige manifestdekking'});continue}
 valid++;records+=count;first=!first||fd<first?fd:first;last=!last||ld>last?ld:last;
}
const report={generatedAt:new Date().toISOString(),market:'PARIS',validationMode:'STORED_MANIFEST',catalog:shares.length,equityUniverse:shares.length-excludedNonEquity.length,researchEligible:valid,alternativeSourceRequired:unavailable.length,providerUnavailable:unavailable.length,excludedNonEquityCount:excludedNonEquity.length,invalidCount:invalid.length,records,firstDate:first,lastDate:last,excludedNonEquity,unavailable,invalid,gate:invalid.length===0?'PASS_WITH_EXPLICIT_EXCLUSIONS':'FAIL'};
await fs.mkdir('research/output/paris',{recursive:true});await fs.writeFile('research/output/paris/validation-summary.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,invalid:undefined,unavailable:undefined,excludedNonEquity:undefined}));if(invalid.length)process.exitCode=2;
