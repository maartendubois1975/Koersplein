import {latestClosedSession,sessionCalendar} from '../history/trading-calendar.mjs';
import fs from 'node:fs/promises';
import {loadApprovedHistory} from './market-history-source.mjs';
import {mapConcurrent} from '../cloudflare/europe-run-policy.mjs';
import {validSessionDate} from '../../daily-session-view.mjs';
import {assessPeriod} from './amsterdam-period-quality.mjs';
import {evaluateOpportunity} from './exam-outcomes-core.mjs';
import {sealOpportunity,verifyOpportunityAppend,opportunityScoreboard,evaluateBenchmark} from './prediction-ledger-core.mjs';
import {loadCompanyCatalog,companyContracts} from '../history/company-register.mjs';

const API=(process.env.KOERSPLEIN_API_URL||'').replace(/\/$/,'');


const active=await Promise.all(Object.keys(companyContracts).map(async mic=>{const catalog=await loadCompanyCatalog(mic);return {mic,name:catalog.exchange||mic,catalog};}));
const runReferenceDate=process.env.TARGET_SESSION||latestClosedSession(active[0].mic);
if(!validSessionDate(runReferenceDate)||runReferenceDate>latestClosedSession(active[0].mic)||[0,6].includes(new Date(runReferenceDate+'T12:00:00Z').getUTCDay()))throw Error('INVALID_RESEARCH_REFERENCE_SESSION');
const diagnostics=[];
const histCache=new Map();
async function hist(share,market,{prediction=false}={}){
 const key=(share.primaryMic||share.mic||market)+':'+share.isin+':'+prediction;
 if(!histCache.has(key))histCache.set(key,loadApprovedHistory(share,market,{api:API,cutoff:runReferenceDate,requirePredictionEvidence:prediction}));
 return histCache.get(key);
}
const pct=(a,b)=>a&&b?b/a-1:0;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const sd=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
const round=(n,d=8)=>Number(Number(n).toFixed(d));

await fs.mkdir('research/output',{recursive:true});
let ledger=[];
try{ledger=JSON.parse(await fs.readFile('data/opportunity-ledger.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e;}

const savedLedger=structuredClone(ledger);
verifyOpportunityAppend(savedLedger,ledger);

const candidatesByMarket=new Map();
for(const m of active){
  const raw=m.catalog;
  const ins=raw.shares||raw.instruments||raw;
  const rows=[];
  let failed=0;
  await mapConcurrent(ins,6,async x=>{
    try{
      const b=await hist(x,m.mic,{prediction:true}),i=b.length-1;
      if(b[i]?.date!==runReferenceDate){diagnostics.push({market:m.mic,isin:x.isin,status:'STALE_HISTORY',lastDate:b[i]?.date});return;}
      if(i<252){diagnostics.push({market:m.mic,isin:x.isin,status:'INSUFFICIENT_HISTORY',records:b.length});return;}
      const quality=assessPeriod(b.slice(i-252));
      if(quality.issues.length){diagnostics.push({market:m.mic,isin:x.isin,status:'HISTORY_QUALITY_BLOCKED',issues:quality.issues});return;}
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
    }catch(e){failed++;diagnostics.push({market:m.mic,isin:x.isin,status:'HISTORY_FAILED',error:e.message});console.warn('HISTORY_FAILED',m.mic,x.isin,e.message)}
  });
  rows.sort((a,b)=>a.x.isin.localeCompare(b.x.isin));
  for(const key of ['momentum','balanced','acceleration','breakout']){
    [...rows].sort((a,b)=>b.scores[key]-a.scores[key]).forEach((r,i)=>{r.componentRanks[key]=i+1;r.consensusRank+=i+1});
  }
  rows.sort((a,b)=>a.consensusRank-b.consensusRank);
  candidatesByMarket.set(m.mic,{market:m,rows,universeCount:ins.length,eligibleCount:rows.length,failedCount:failed});
}

const usedIsins=new Set();
const newSelections=[];
for(const m of active){
  const pack=candidatesByMarket.get(m.mic);
  if(!pack) continue;
  if(!sessionCalendar(m.mic,runReferenceDate).open||runReferenceDate!==latestClosedSession(m.mic)){diagnostics.push({market:m.mic,status:'HISTORICAL_REFERENCE_NO_NEW_PREDICTIONS'});continue;}
  if(ledger.some(x=>x.referenceDate===runReferenceDate&&x.market===m.mic)) continue;
  const sameDate=pack.rows.filter(r=>r.date===runReferenceDate);
  const coverage=sameDate.length/Math.max(1,pack.universeCount);
  let q=sameDate.find(r=>!usedIsins.has(r.x.isin));
  if(!q) q=sameDate[0];
  if(!q) continue;
  usedIsins.add(q.x.isin);
  const selection={
    selectionDate:runReferenceDate,
    market:m.mic,
    venue:m.name||m.mic,
    currency:q.x.currency||m.catalog.currency||'EUR',
    targetPct:30,
    horizonMonths:3,
    status:'OPEN',
    frozen:true,
    createdAt:new Date().toISOString(),
    modelVersion:'consensus-price-v2-auditable',
    signalType:'consensus',
    benchmarkAtSelection:sameDate.map(row=>({isin:row.x.isin,referenceClose:row.close})).sort((a,b)=>a.isin.localeCompare(b.isin)),
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
  const sealed=sealOpportunity(selection);ledger.push(sealed);
  newSelections.push(sealed);
}

for(const p of ledger){
  try{
    if(!p.recordHash){p.legacyUnverified=true;diagnostics.push({market:p.market,isin:p.isin,status:'LEGACY_PREDICTION_NOT_PRESEALED'});}
    const market=active.find(x=>x.mic===p.market),share=market?.catalog.shares.find(x=>x.isin===p.isin);
    if(!share)throw Error('PREDICTION_OUTSIDE_APPROVED_REGISTER');
    const bars=await hist(share,p.market);
    if(p.evaluationVersion!=='bounded-calendar-v1'&&p.latestDate)p.previousEvaluation={latestDate:p.latestDate,latestClose:p.latestClose,result30:p.result30,hit30:p.hit30,hit30Date:p.hit30Date,maxReturn:p.maxReturn};
    const outcome=evaluateOpportunity(p,bars,{asOf:runReferenceDate});
    Object.assign(p,outcome);delete p.evaluationError;
    p.benchmarkReturn=null;
    try{
      p.benchmarkReturn=await evaluateBenchmark(p,outcome,async member=>{
        const benchmarkShare=market.catalog.shares.find(x=>x.isin===member.isin);
        return benchmarkShare ? hist(benchmarkShare,p.market) : [];
      });
    }catch(error){diagnostics.push({market:p.market,isin:p.isin,status:'BENCHMARK_UNVERIFIED',error:error.message});}
  }catch(error){p.evaluationError=error.message;p.status='EVALUATION_UNVERIFIED';p.result30=null;p.benchmarkReturn=null;diagnostics.push({market:p.market,isin:p.isin,status:'EVALUATION_FAILED',error:error.message});}
}

verifyOpportunityAppend(savedLedger,ledger);
await fs.writeFile('research/output/daily-opportunity-diagnostics.json',JSON.stringify({referenceDate:runReferenceDate,diagnostics},null,2)+'\n');
await fs.writeFile('data/opportunity-ledger.json.tmp',JSON.stringify(ledger,null,2));
await fs.rename('data/opportunity-ledger.json.tmp','data/opportunity-ledger.json');
const latestByMarket={};
for(const mic of Object.keys(companyContracts)){
  const xs=ledger.filter(x=>x.market===mic).sort((a,b)=>String(b.selectionDate||b.referenceDate).localeCompare(String(a.selectionDate||a.referenceDate)));
  if(xs[0]) latestByMarket[mic]=xs[0];
}
const closed=ledger.filter(x=>x.status==='CLOSED'&&x.recordHash&&!x.legacyUnverified&&!x.evaluationError);
const learning={
  generatedAt:new Date().toISOString(),
  referenceDate:runReferenceDate,
  purpose:'Bevries iedere voorspelling vooraf, volg de uitkomst en leer van raak en mis.',
  target:'+30% binnen 3 maanden',
  latestByMarket,
  scoreboard:{totalPredictions:ledger.length,...opportunityScoreboard(ledger,Object.keys(companyContracts))},
  lessons:closed.slice(-50).map(x=>({
    market:x.market,name:x.name,isin:x.isin,selectionDate:x.selectionDate,referenceDate:x.referenceDate,
    referenceClose:x.referenceClose,latestDate:x.latestDate,latestClose:x.latestClose,
    maxReturn:x.maxReturn,maxDrawdown:x.maxDrawdown,result30:x.result30,
    componentRanks:x.componentRanks||null,componentScores:x.componentScores||null,features:x.features||null,
    explanation:x.result30===true?'Doel gehaald: bewaar welke signalen vooraf aanwezig waren.':'Doel niet gehaald: vergelijk vooraf bevroren signalen met succesvolle gevallen.'
  }))
};
await fs.writeFile('data/opportunity-latest.json',JSON.stringify({generatedAt:new Date().toISOString(),referenceDate:runReferenceDate,target:'+30% binnen 3 maanden',selections:newSelections,latestByMarket},null,2));
await fs.writeFile('data/opportunity-learning.json',JSON.stringify(learning,null,2));
console.log(JSON.stringify({referenceDate:runReferenceDate,activeMarkets:active.map(x=>x.mic),newSelections:newSelections.map(x=>({market:x.market,isin:x.isin,name:x.name,rank:x.consensusRank})),total:ledger.length}));
