import fs from 'node:fs';
const path='data/euronext-athens.json';
const report=JSON.parse(fs.readFileSync(process.argv[2]||'athens-public-evidence.json','utf8'));
const catalog=JSON.parse(fs.readFileSync(path,'utf8'));
if(report.mic!=='XATH'||report.total!==catalog.shares.length||report.accepted.length<100)throw Error('Insufficient verified official Athens evidence');
const bySymbol=new Map(catalog.shares.map(s=>[s.symbol,s]));
const seen=new Set();
for(const e of report.accepted){
 if(!bySymbol.has(e.symbol)||seen.has(e.symbol)||!/^https:\/\/athens\.euronext\.com\//.test(e.sourceUrl)||!/^\d{4}-\d\d-\d\d$/.test(e.sourceDate)||!/^([A-Z]{2}[A-Z0-9]{9}[0-9])$/.test(e.isin))throw Error('Invalid Athens evidence '+e.symbol);
 seen.add(e.symbol);
 const s=bySymbol.get(e.symbol);
 if(s.isin&&s.isin!==e.isin)throw Error('Existing ISIN conflict '+e.symbol);
 s.isin=e.isin;
 s.isinEvidence={sourceUrl:e.sourceUrl,sourceDate:e.sourceDate,sourceDocument:e.sourceDocument};
}
catalog.isinReconciliation={source:'Official Euronext Athens Trading Issuers',date:report.accepted[0].sourceDate,accepted:seen.size,remaining:catalog.shares.filter(s=>!s.isin).length};
fs.writeFileSync(path,JSON.stringify(catalog,null,2)+'\n');
console.log(catalog.isinReconciliation);
