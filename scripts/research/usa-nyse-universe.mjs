// NYSE universe bootstrap: official Nasdaq Trader directory, no price-data claims.
// Usage: node scripts/research/usa-nyse-universe.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
const SOURCE='https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt';
const response=await fetch(SOURCE,{headers:{'User-Agent':'Koersplein-NYSE-universe/1.0'}});
if(!response.ok)throw Error('NYSE directory HTTP '+response.status);
const raw=await response.text();
const lines=raw.trim().split(/\r?\n/);
const header=lines.shift().split('|');
for(const field of ['ACT Symbol','Security Name','Exchange','ETF','Test Issue'])if(!header.includes(field))throw Error('Missing source field '+field);
const all=lines.filter(line=>line&&!line.startsWith('File Creation Time')).map(line=>{
 const values=line.split('|');return Object.fromEntries(header.map((key,i)=>[key,values[i]??'']));
});
const nyse=all.filter(x=>x.Exchange==='N'&&x['Test Issue']==='N');
const excluded=nyse.filter(x=>x.ETF==='Y');
const eligible=nyse.filter(x=>x.ETF==='N').map(x=>({
 symbol:x['ACT Symbol'],name:x['Security Name'],exchange:'XNYS',securityType:'UNVERIFIED_NON_ETF',
 cqsSymbol:x['CQS Symbol'],nasdaqSymbol:x['NASDAQ Symbol'],
 source:SOURCE,priceHistoryStatus:'NOT_FETCHED',verifiedCommonStock:false
}));
const unique=new Set(eligible.map(x=>x.symbol));
if(unique.size!==eligible.length)throw Error('Duplicate NYSE symbols');
if(eligible.length<1000)throw Error('Unexpectedly small NYSE universe '+eligible.length);
const out='research/output/usa/XNYS';
await fs.mkdir(out,{recursive:true});
const generatedAt=new Date().toISOString();
await fs.writeFile(path.join(out,'universe.json'),JSON.stringify({generatedAt,source:SOURCE,exchange:'XNYS',securities:eligible},null,2));
await fs.writeFile(path.join(out,'coverage.json'),JSON.stringify({
 generatedAt,exchange:'XNYS',source:SOURCE,totalNYSEListings:nyse.length,
 excludedETFs:excluded.length,nonETFCandidates:eligible.length,verifiedCommonStocks:0,
 historicalBarsFetched:0,usableForTraining:0,status:'UNIVERSE_ONLY_NOT_HISTORICALLY_VALIDATED',
 note:'Non-ETF candidates include preferred shares, ADRs, funds and other instruments; do not count as verified common stocks.'
},null,2));
console.log(JSON.stringify({totalNYSEListings:nyse.length,excludedETFs:excluded.length,nonETFCandidates:eligible.length,output:out},null,2));
