import fs from 'node:fs/promises';
const root=process.argv[2]||'research/output/machine2-deep';
const a=JSON.parse(await fs.readFile(`${root}/autonomous-analysis.json`,'utf8'));
const rows=(a.allFindings||[]).filter(x=>x.n>=100&&Number.isFinite(x.directionAccuracy)&&Number.isFinite(x.baselineAccuracy));
const erf=x=>{const s=x<0?-1:1; x=Math.abs(x);const t=1/(1+.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return s*y};
const normCdf=z=>.5*(1+erf(z/Math.sqrt(2)));
for(const r of rows){const p0=r.baselineAccuracy;const se=Math.sqrt(Math.max(1e-12,p0*(1-p0)/r.n));r.z=(r.directionAccuracy-p0)/se;r.pValue=Math.min(1,2*(1-normCdf(Math.abs(r.z))))}
const sorted=[...rows].sort((x,y)=>x.pValue-y.pValue);const m=sorted.length;let prev=1;for(let i=m-1;i>=0;i--){const q=Math.min(prev,sorted[i].pValue*m/(i+1));sorted[i].fdrQ=q;prev=q}
for(const r of sorted){r.discoveryStatus=r.fdrQ<=.05&&r.lift>0?'FDR_OVERLEEFT_DISCOVERY':r.fdrQ<=.10&&r.lift>0?'FDR_ZWAK':'NIET_BEVESTIGD';r.promotionForbidden=true}
await fs.writeFile(`${root}/statistical-guard.json`,JSON.stringify({generatedAt:new Date().toISOString(),tests:m,method:'two-sided normal approximation versus horizon baseline + Benjamini-Hochberg FDR',warning:'Observaties overlappen in tijd en per aandeel. FDR is slechts discovery-screen; onafhankelijke/purged/block validatie blijft verplicht.',rows:sorted},null,2));
console.log(`statistical tests=${m} fdr05=${sorted.filter(x=>x.fdrQ<=.05).length}`);