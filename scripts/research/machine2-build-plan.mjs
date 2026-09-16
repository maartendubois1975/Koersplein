import fs from 'node:fs/promises';
const input=process.argv[2]||'research/input/amsterdam-machine1-results.jsonl';
const rows=(await fs.readFile(input,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const byCompany=new Map();
for(const r of rows){const key=r.instrument||r.isin||r.ticker;if(!byCompany.has(key))byCompany.set(key,{instrument:key,ticker:r.ticker,company:r.company,dates:new Set(),observations:0});const x=byCompany.get(key);x.dates.add(r.predictionDate);x.observations++;}
const jobs=[];
for(const x of byCompany.values()){
 const dates=[...x.dates].sort();
 jobs.push({jobId:`M2-${x.instrument}`,market:'XAMS',instrument:x.instrument,ticker:x.ticker,company:x.company,status:'PENDING',predictionDates:dates,observationCount:x.observations,phases:['IDENTITY_AND_LISTING_HISTORY','OFFICIAL_FILINGS','FUNDAMENTALS_POINT_IN_TIME','EXPECTATIONS_REVISIONS','NEWS_EVENTS','MACRO_MARKET_SECTOR','FLOWS_SHORT_OPTIONS','ATTENTION_POLICY_GEOPOLITICS','FUTURE_PATH_POSTMORTEM','SIGNAL_ATTRIBUTION','HYPOTHESIS_EXTRACTION'],checkpoint:null});
}
const plan={version:1,createdAt:new Date().toISOString(),market:'XAMS',machine1Frozen:true,predictionMutationForbidden:true,observations:rows.length,instruments:jobs.length,strategy:'DEDUPLICATE_BY_INSTRUMENT_DATE_EVENT_WITH_CHECKPOINTS',jobs};
await fs.mkdir('research/output',{recursive:true});await fs.writeFile('research/output/amsterdam-machine2-deep-plan.json',JSON.stringify(plan,null,2));console.log(JSON.stringify({observations:plan.observations,instruments:plan.instruments,jobs:jobs.length},null,2));