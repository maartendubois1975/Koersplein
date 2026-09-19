import fs from 'node:fs/promises';
const API=(process.env.KOERSPLEIN_API_URL||'').replace(/\/$/,'');if(!API)throw Error('KOERSPLEIN_API_URL ontbreekt');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const raw=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8')),shares=raw.shares||[];
let valid=0,invalid=[],records=0,first=null,last=null;\nlet unavailableSet=new Set();try{const rr=JSON.parse(await fs.readFile('research/output/paris/repair-invalid-summary.json','utf8'));unavailableSet=new Set((rr.unavailableItems||[]).map(x=>x.isin))}catch{}\nlet unavailable=[];
for(const s of shares){
  try{
    let r,lastErr;
    for(let attempt=1;attempt<=4;attempt++){
      try{r=await fetch(`${API}/api/history/${encodeURIComponent(s.isin)}`);if(r.ok)break;lastErr=new Error(`HTTP ${r.status}`);if(![429,500,502,503,504].includes(r.status))break;}catch(e){lastErr=e}
      if(attempt<4)await sleep(750*attempt);
    }
    if(!r?.ok)throw(lastErr||new Error(`HTTP ${r?.status||'onbekend'}`));
    const h=await r.json(),bars=(h.bars||h.records||h.history||[]).filter(x=>x?.date&&Number.isFinite(+x.close));
    if(!bars.length)throw Error('geen historie');
    for(let i=0;i<bars.length;i++){if(+bars[i].close<=0)throw Error('niet-positieve slotkoers');if(i&&bars[i].date<=bars[i-1].date)throw Error('datums niet strikt oplopend')}
    valid++;records+=bars.length;first=!first||bars[0].date<first?bars[0].date:first;last=!last||bars.at(-1).date>last?bars.at(-1).date:last;
  }catch(e){const item={isin:s.isin,symbol:s.symbol,mic:s.mic||'XPAR',error:e.message};if(unavailableSet.has(s.isin))unavailable.push({...item,reason:'PROVIDER_UNAVAILABLE'});else invalid.push(item)}
  await sleep(75);
}
const report={generatedAt:new Date().toISOString(),market:'PARIS',catalog:shares.length,researchEligible:valid,providerUnavailable:unavailable.length,invalidCount:invalid.length,records,firstDate:first,lastDate:last,unavailable,invalid,gate:invalid.length===0?'PASS_WITH_EXPLICIT_EXCLUSIONS':'FAIL'};
await fs.mkdir('research/output/paris',{recursive:true});await fs.writeFile('research/output/paris/validation-summary.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,invalid:undefined}));if(invalid.length)process.exitCode=2;
