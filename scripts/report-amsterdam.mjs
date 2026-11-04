import {readFile} from 'node:fs/promises';
const report=JSON.parse(await readFile(process.argv[2]||'amsterdam-candidates.json','utf8'));
const manifest=JSON.parse(await readFile(new URL('../data/amsterdam-history-manifest.json',import.meta.url),'utf8'));
const expected=new Set(Object.keys(manifest.instruments));
const groups=['candidates','noTrade','missing','errors'];
const counts=Object.fromEntries(groups.map(key=>[key,report[key]?.length||0]));
const entries=groups.flatMap(group=>(report[group]||[]).map(row=>({isin:row.isin,group,symbol:row.symbol,status:row.status,error:row.error})));
const actual=entries.filter(row=>typeof row.isin==='string'&&row.isin.length>0);
const seen=new Set(),duplicates=[];
for(const row of actual){if(seen.has(row.isin))duplicates.push(row.isin);seen.add(row.isin);}
const missingIsins=[...expected].filter(isin=>!seen.has(isin)).sort();
const unknownIsins=[...seen].filter(isin=>!expected.has(isin)).sort();
const invalidIdentities=entries.length-actual.length;
const accounted=entries.length;
const complete=report.market==='XAMS'&&/^\d{4}-\d{2}-\d{2}$/.test(report.date||'')&&expected.size===80&&missingIsins.length===0&&unknownIsins.length===0&&duplicates.length===0&&invalidIdentities===0;
const summary={date:report.date,market:report.market,complete,accounted,expected:expected.size,uniqueIsins:seen.size,missingIsins,unknownIsins,duplicateIsins:[...new Set(duplicates)],invalidIdentities,...counts,approved:report.approved,exceptions:entries.filter(x=>x.group!=='candidates')};
console.log(JSON.stringify(summary,null,2));
if(!complete)process.exitCode=1;
