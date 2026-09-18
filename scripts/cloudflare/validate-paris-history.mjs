import fs from 'node:fs/promises';
const API=(process.env.KOERSPLEIN_API_URL||'').replace(/\/$/,'');if(!API)throw Error('KOERSPLEIN_API_URL ontbreekt');
const raw=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8')),shares=raw.shares||[];
let valid=0,invalid=[],records=0,first=null,last=null;
for(const s of shares){try{const r=await fetch(`${API}/api/history/${encodeURIComponent(s.isin)}`);if(!r.ok)throw Error(`HTTP ${r.status}`);const h=await r.json(),bars=(h.bars||h.records||h.history||[]).filter(x=>x?.date&&Number.isFinite(+x.close));if(!bars.length)throw Error('geen historie');for(let i=0;i<bars.length;i++){if(+bars[i].close<=0)throw Error('niet-positieve slotkoers');if(i&&bars[i].date<=bars[i-1].date)throw Error('datums niet strikt oplopend')}valid++;records+=bars.length;first=!first||bars[0].date<first?bars[0].date:first;last=!last||bars.at(-1).date>last?bars.at(-1).date:last}catch(e){invalid.push({isin:s.isin,symbol:s.symbol,mic:s.mic||'XPAR',error:e.message})}}
const report={generatedAt:new Date().toISOString(),market:'PARIS',catalog:shares.length,valid,invalidCount:invalid.length,records,firstDate:first,lastDate:last,invalid};
await fs.mkdir('research/output/paris',{recursive:true});await fs.writeFile('research/output/paris/validation-summary.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,invalid:undefined}));if(invalid.length)process.exitCode=2;
