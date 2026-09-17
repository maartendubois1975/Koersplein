import fs from 'node:fs/promises';

const root=process.argv[2]||'research/output/machine2-deep';
const summary=JSON.parse(await fs.readFile(`${root}/learning-summary.json`,'utf8'));
const candidates=summary.candidates||[];
const baseline=new Map(candidates.filter(x=>x.key.startsWith('BASELINE|')).map(x=>[x.key.split('|')[1],x]));
const minN=100;

const enriched=candidates.filter(x=>!x.key.startsWith('BASELINE|')).map(x=>{
  const parts=x.key.split('|');
  const horizon=parts.at(-1); const family=parts[0]; const bucket=parts[1];
  const b=baseline.get(horizon);
  const lift=b?x.directionAccuracy-b.directionAccuracy:null;
  const coverage=b?x.n/b.n:null;
  return {...x,family,bucket,horizon,baselineAccuracy:b?.directionAccuracy??null,lift,coverage};
});

const classify=x=>{
  if(x.n<minN) return 'TE_WEINIG_BEWIJS';
  if(x.lift===null) return 'ONVOLLEDIG';
  if(Math.abs(x.lift)<0.005) return 'GEEN_DUIDELIJK_EFFECT';
  if(x.lift>=0.03&&x.coverage>=0.10) return 'STERKE_KANDIDAAT';
  if(x.lift>=0.015&&x.coverage>=0.05) return 'INTERESSANTE_KANDIDAAT';
  if(x.lift>0) return 'ZWAKKE_KANDIDAAT';
  if(x.lift<=-0.03&&x.coverage>=0.10) return 'STERK_NEGATIEF_SIGNAL';
  return 'NEGATIEF_OF_INSTABIEL';
};
const findings=enriched.map(x=>({...x,assessment:classify(x)}));

// Stabiliteit: een familie is interessanter als hetzelfde teken van lift in meerdere horizons terugkomt.
const familyMap=new Map();
for(const x of findings){
  const key=`${x.family}|${x.bucket}`; const a=familyMap.get(key)||[]; a.push(x); familyMap.set(key,a);
}
const families=[...familyMap.entries()].map(([key,rows])=>{
  const usable=rows.filter(r=>r.n>=minN&&Number.isFinite(r.lift));
  const positive=usable.filter(r=>r.lift>0).length, negative=usable.filter(r=>r.lift<0).length;
  const weightedLift=usable.length?usable.reduce((s,r)=>s+r.lift*r.n,0)/usable.reduce((s,r)=>s+r.n,0):null;
  return {key,horizons:usable.length,positiveHorizons:positive,negativeHorizons:negative,weightedLift,stableDirection:usable.length>=2&&(positive===usable.length||negative===usable.length)};
}).sort((a,b)=>Math.abs(b.weightedLift||0)-Math.abs(a.weightedLift||0));

const strongest=findings.filter(x=>['STERKE_KANDIDAAT','INTERESSANTE_KANDIDAAT'].includes(x.assessment)).sort((a,b)=>(b.lift||0)-(a.lift||0));
const warnings=[];
if(summary.integrity?.violations!==0) warnings.push('Integriteitscontrole rapporteert afwijkingen.');
warnings.push('Dit is discovery, geen bewijs voor toekomstig rendement. Kandidaten mogen Machine 1 niet aanpassen zonder blinde out-of-sample test.');
warnings.push('Huidige Amsterdam-universe kan survivorship bias bevatten; historische/delisted universes moeten later worden toegevoegd.');
warnings.push('Overlappende 3/6/12/24-maandsvensters zijn afhankelijk; nominale aantallen zijn geen onafhankelijke steekproefgrootte.');

const report={
  generatedAt:new Date().toISOString(),
  purpose:'Zelfstandig verklaren welke historische omstandigheden samenhangen met betere of slechtere voorspellingen, zonder toekomstinformatie terug te lekken.',
  integrity:summary.integrity||null,
  baseline:Object.fromEntries(baseline),
  strongestCandidates:strongest.slice(0,50),
  familyStability:families.slice(0,100),
  allFindings:findings,
  warnings,
  nextResearchActions:[
    'Test sterkste kandidaten blind op onaangeraakte perioden en daarna andere markten.',
    'Voeg block-bootstrap per kalenderperiode en aandeel toe om overlap en clustering te respecteren.',
    'Voeg multiple-testing correctie (Benjamini-Hochberg/FDR) toe voordat kandidaten worden gepromoveerd.',
    'Breid point-in-time evidence uit met fundamentals, officiële bedrijfsberichten, rente, inflatie, krediet, shortposities, marktbreedte, sector en relatieve performance.',
    'Bouw future post-mortem paden +1d/+1w/+1m/+3m/+6m/+12m/+24m uitsluitend voor diagnose van waarom een voorspelling goed of fout was.',
    'Gebruik later historische indexsamenstelling en delistings om survivorship bias terug te dringen.'
  ],
  promotionRule:'NOOIT automatisch modelgewicht. Eerst blinde out-of-sample bevestiging.'
};
await fs.writeFile(`${root}/autonomous-analysis.json`,JSON.stringify(report,null,2));

const pct=v=>Number.isFinite(v)?`${(v*100).toFixed(2)}%`:'n.v.t.';
const lines=['# Machine 2 — autonoom onderzoeksrapport','',`Gegenereerd: ${report.generatedAt}`,'','## Doel','Historische patronen ontdekken die kunnen verklaren wanneer voorspellingen beter of slechter werken. Dit rapport is discovery en verandert Machine 1 niet.','','## Baselines'];
for(const [h,b] of baseline) lines.push(`- ${h}: ${b.n} gevallen, richtingsscore ${pct(b.directionAccuracy)}, gemiddeld gerealiseerd rendement ${pct(b.meanRealizedReturn)}`);
lines.push('','## Sterkste kandidaatpatronen');
for(const x of strongest.slice(0,25)) lines.push(`- ${x.family} / ${x.bucket} / ${x.horizon}: n=${x.n}, score=${pct(x.directionAccuracy)}, baseline=${pct(x.baselineAccuracy)}, lift=${pct(x.lift)}, dekking=${pct(x.coverage)} — ${x.assessment}`);
lines.push('','## Stabiliteit over horizons');
for(const x of families.slice(0,25)) lines.push(`- ${x.key}: ${x.horizons} horizons, positief=${x.positiveHorizons}, negatief=${x.negativeHorizons}, gewogen lift=${pct(x.weightedLift)}, stabiele richting=${x.stableDirection?'ja':'nee'}`);
lines.push('','## Waarschuwingen',...warnings.map(x=>`- ${x}`),'','## Volgende onderzoeksstappen',...report.nextResearchActions.map(x=>`- ${x}`),'','**Promotieregel:** geen enkel ontdekt patroon gaat rechtstreeks Machine 1 in; eerst nieuwe blinde out-of-sample validatie.');
await fs.writeFile(`${root}/autonomous-analysis.md`,lines.join('\n'));
console.log(`autonome-analyse findings=${findings.length} sterke/interessante kandidaten=${strongest.length}`);
