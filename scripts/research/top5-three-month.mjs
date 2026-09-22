import fs from 'node:fs/promises';
const API=(process.env.KOERSPLEIN_API_URL||'').replace(/\/$/,'');
if(!API) throw Error('KOERSPLEIN_API_URL ontbreekt');
const cfg=JSON.parse(await fs.readFile('data/markets.json','utf8'));
const markets=(cfg.venues||[]).flatMap(v=>v.markets||[]).filter(m=>String(m.status).toLowerCase()==='available'&&m.sharesData);
const cache=new Map(), pct=(a,b)=>a&&b?b/a-1:0, mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const sd=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),n=x.length;return n%2?x[(n-1)/2]:(x[n/2-1]+x[n/2])/2};
const round=(n,d=4)=>n==null?null:Number(Number(n).toFixed(d));
async function hist(isin){if(cache.has(isin))return cache.get(isin);const r=await fetch(`${API}/api/history/${encodeURIComponent(isin)}`);if(!r.ok)throw Error('history '+r.status);const x=await r.json();const b=(Array.isArray(x)?x:(x.bars||x.records||x.history||[])).filter(v=>v?.date&&Number.isFinite(+v.close)).map(v=>({date:v.date,close:+v.close})).sort((a,b)=>a.date.localeCompare(b.date));cache.set(isin,b);return b}
function feat(b,i){if(i<252)return null;const c=b[i].close,r=[];for(let j=i-125;j<=i;j++)r.push(pct(b[j-1].close,b[j].close));const w=b.slice(i-252,i+1).map(v=>v.close),m3=pct(b[i-63].close,c),prev=pct(b[i-126].close,b[i-63].close);return {m1:pct(b[i-21].close,c),m3,m6:pct(b[i-126].close,c),m12:pct(b[i-252].close,c),vol:sd(r),draw:c/Math.max(...w)-1,recovery:c/Math.min(...w)-1,acc:m3-prev}}
function dist(a,b){const scale={m1:.15,m3:.30,m6:.50,m12:.80,vol:.03,draw:.30,recovery:.80,acc:.30};return Object.keys(scale).reduce((s,k)=>s+((a[k]-b[k])/scale[k])**2,0)}
const out={generatedAt:new Date().toISOString(),horizonMonths:3,method:'historische nearest-neighbour analogs + momentum/breakout consensus; voorspelling wordt dagelijks bevroren',markets:{}};
for(const m of markets){
 let raw;try{raw=JSON.parse(await fs.readFile('data/'+m.sharesData,'utf8'))}catch{out.markets[m.mic]={name:m.name,status:'NO_CATALOG_FILE',top5:[]};continue}
 const ins=raw.shares||raw.instruments||raw, rows=[];let failed=0;
 for(const x of ins){try{const b=await hist(x.isin),i=b.length-1,f=feat(b,i);if(!f||i<315)continue;const analog=[];
   for(let j=252;j+63<=i-20;j+=5){const z=feat(b,j);if(z)analog.push({d:dist(f,z),ret:pct(b[j].close,b[j+63].close)})}
   analog.sort((a,b)=>a.d-b.d);const near=analog.slice(0,Math.min(40,analog.length));if(near.length<20)continue;
   const rets=near.map(z=>z.ret),positive=rets.filter(v=>v>0).length/rets.length,up10=rets.filter(v=>v>=.10).length/rets.length;
   const expected=median(rets),score=(expected??-1)+.10*positive+.05*up10+.05*f.m3+.03*f.m6-.10*f.vol;
   rows.push({name:x.name||x.company||x.symbol||x.isin,ticker:x.ticker||x.symbol||null,isin:x.isin,referenceDate:b[i].date,referenceClose:b[i].close,expected3m:round(expected),chancePositive:round(positive),chanceUp10:round(up10),analogCount:near.length,score,signals:{m1:round(f.m1),m3:round(f.m3),m6:round(f.m6),breakoutDistance:round(f.draw),volatility:round(f.vol)}})
 }catch{failed++}}
 rows.sort((a,b)=>b.score-a.score);out.markets[m.mic]={name:m.name,currency:m.currency||null,status:'READY',universeCount:ins.length,eligibleCount:rows.length,failedCount:failed,top5:rows.slice(0,5).map((x,i)=>({...x,rank:i+1,score:undefined}))};
}
await fs.writeFile('data/top5-three-month.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.markets).map(([k,v])=>[k,{status:v.status,top5:(v.top5||[]).map(x=>x.name)}]))));
