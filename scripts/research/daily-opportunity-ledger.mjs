import fs from 'node:fs/promises';

const API=(process.env.KOERSPLEIN_API_URL||'').replace(/\/$/,'');
if(!API) throw Error('KOERSPLEIN_API_URL ontbreekt');

const config=JSON.parse(await fs.readFile('data/markets.json','utf8'));
const marketList=Array.isArray(config)?config:Array.isArray(config.markets)?config.markets:(config.venues||[]).flatMap(v=>v.markets||[]);
const active=marketList.filter(x=>x.available===true||String(x.status).toLowerCase()==='available'||x.status==='ACTIVE').filter(x=>['XAMS','XBRU'].includes(x.mic));
if(!active.length) throw Error('Geen actieve markten gevonden');

const files={XAMS:'data/euronext-amsterdam.json',XBRU:'data/euronext-brussels.json'};
const currency={XAMS:'EUR',XBRU:'EUR'};
const histCache=new Map();

async function hist(isin){
  if(histCache.has(isin)) return histCache.get(isin);
  const r=await fetch(`${API}/api/history/${encodeURIComponent(isin)}`);
  if(!r.ok) throw Error(`history ${r.status}`);
  const x=await r.json();
  const bars=(Array.isArray(x)?x:(x.bars||x.records||x.history||[]))
    .filter(b=>b?.date&&Number.isFinite(+b.close))
    .map(b=>({date:b.date,close:+b.close}))
    .sort((a,b)=>a.date.localeCompare(b.date));
  histCache.set(isin,bars);
  return bars;
}
const pct=(a,b)=>a&&b?b/a-1:0;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const sd=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
const round=(n,d=8)=>Number(Number(n).toFixed(d));

let ledger=[];
try{ledger=JSON.parse(await fs.readFile('data/opportunity-ledger.json','utf8'))}catch{}

const candidatesByMarket=new Map();
for(const m of active){
  const raw=JSON.parse(await fs.readFile(files[m.mic],'utf8'));
  const ins=raw.shares||raw.instruments||raw;
  const rows=[];
  let failed=0;
  for(const x of ins){
    try{
      const b=await hist(x.isin),i=b.length-1;
      if(i<252) continue;
      const c=b[i].close,r=[];
      for(let j=i-125;j<=i;j++) r.push(pct(b[j-1].close,b[j].close));
      const w=b.slice(i-252,i+1).map(v=>v.close);
      const features={
        m1:pct(b[i-21].close,c),
        m3:pct(b[i-63].close,c),
        m6:pct(b[i-126].close,c),
        m12:pct(b[i-252].close,c),
        volatility126:sd(r),
        recovery52w:c/Math.min(...w)-1,
        drawdown52w:c/Math.max(...w)-1,
        previous3m:pct(b[i-126].close,b[i-63].close)
      };
      features.acceleration3m=features.m3-features.previous3m;
      const scores={
        momentum:features.m6+.5*features.m3,
        balanced:features.m12+features.m6-features.volatility126+.25*features.recovery52w,
        acceleration:features.acceleration3m+features.m3-.5*features.volatility126,
        breakout:features.m6+features.drawdown52w+.2*features.recovery52w
      };
      rows.push({x,date:b[i].date,close:c,features,scores,componentRanks:{},consensusRank:0});
    }catch{failed++}
  }
  for(const key of ['momentum','balanced','acceleration','breakout']){
    [...rows].sort((a,b)=>b.scores[key]-a.scores[key]).forEach((r,i)=>{r.componentRanks[key]=i+1;r.consensusRank+=i+1});
  }
  rows.sort((a,b)=>a.consensusRank-b.consensusRank);
  candidatesByMarket.set(m.mic,{market:m,rows,universeCount:ins.length,eligibleCount:rows.length,failedCount:failed});
}

const latestReferenceDates=[...candidatesByMarket.values()].map(v=>v.rows[0]?.date).filter(Boolean).sort();
const runReferenceDate=latestReferenceDates.at(-1);
if(!runReferenceDate) throw Error('Geen geldige referentiedatum gevonden');

const usedIsins=new Set();
const newSelections=[];
for(const m of active){
  const pack=candidatesByMarket.get(m.mic);
  if(!pack) continue;
  if(ledger.some(x=>x.referenceDate===runReferenceDate&&x.market===m.mic)) continue;
  const sameDate=pack.rows.filter(r=>r.date===runReferenceDate);
  const coverage=sameDate.length/Math.max(1,pack.universeCount);
  if(coverage<0.90) throw Error(`Onvoldoende dekking ${m.mic} op ${runReferenceDate}: ${sameDate.length}/${pack.universeCount}`);
  let q=sameDate.find(r=>!usedIsins.has(r.x.isin));
  if(!q) q=sameDate[0];
  if(!q) continue;
  usedIsins.add(q.x.isin);
  const selection={
    selectionDate:runReferenceDate,
    market:m.mic,
    venue:m.name||m.mic,
    currency:currency[m.mic]||null,
    targetPct:30,
    horizonMonths:3,
    status:'OPEN',
    frozen:true,
    modelVersion:'consensus-price-v2-auditable',
    name:q.x.name||q.x.company||q.x.symbol||q.x.isin,
    ticker:q.x.ticker||q.x.symbol||null,
    isin:q.x.isin,
    referenceDate:q.date,
    referenceClose:q.close,
    consensusRank:q.consensusRank,
    componentRanks:q.componentRanks,
    componentScores:Object.fromEntries(Object.entries(q.scores).map(([k,v])=>[k,round(v)])),
    features:Object.fromEntries(Object.entries(q.features).map(([k,v])=>[k,round(v)])),
    audit:{universeCount:pack.universeCount,eligibleCount:sameDate.length,failedCount:pack.failedCount,coveragePct:round(coverage*100,4)}
  };
  ledger.push(selection);
  newSelections.push(selection);
}

for(const p of ledger){
  try{
    const b=await hist(p.isin),after=b.filter(x=>x.date>p.referenceDate);
    if(!after.length) continue;
    const latest=after.at(-1);
    p.latestDate=latest.date;p.latestClose=latest.close;p.currentReturn=latest.close/p.referenceClose-1;
    p.maxReturn=Math.max(...after.map(x=>x.close/p.referenceClose-1));
    let peak=p.referenceClose,maxDD=0;
    for(const x of after){peak=Math.max(peak,x.close);maxDD=Math.min(maxDD,x.close/peak-1)}
    p.maxDrawdown=maxDD;
    for(const level of [10,20,30]){
      const hit=after.find(x=>x.close>=p.referenceClose*(1+level/100));
      if(hit){p[`hit${level}`]=true;p[`hit${level}Date`]=hit.date}
    }
    const end=new Date(p.referenceDate+'T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+3);
    if(new Date(latest.date+'T00:00:00Z')>=end){p.status='CLOSED';p.result30=!!p.hit30}
  }catch{}
}

await fs.writeFile('data/opportunity-ledger.json',JSON.stringify(ledger,null,2));
await fs.writeFile('data/opportunity-latest.json',JSON.stringify({generatedAt:new Date().toISOString(),referenceDate:runReferenceDate,target:'+30% binnen 3 maanden',selections:newSelections},null,2));
console.log(JSON.stringify({referenceDate:runReferenceDate,activeMarkets:active.map(x=>x.mic),newSelections:newSelections.map(x=>({market:x.market,isin:x.isin,name:x.name,rank:x.consensusRank})),total:ledger.length}));
