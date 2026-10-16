import fs from 'node:fs';
const p='data/euronext-warsaw.json';
const report=JSON.parse(fs.readFileSync(process.argv[2]||'gpw-isin-evidence.json','utf8'));
const catalog=JSON.parse(fs.readFileSync(p,'utf8'));
if(report.mic!=='XWAR'||report.total!==catalog.shares.length||report.accepted.length<390)throw Error('Evidence coverage mismatch');
const shares=new Map(catalog.shares.map(s=>[s.symbol,s]));
const seen=new Set();
for(const e of report.accepted){
 if(!shares.has(e.symbol)||seen.has(e.symbol)||!/^https:\/\/www\.gpw\.pl\/spolki$/.test(e.sourceUrl)||!/^\d{4}-\d\d-\d\d$/.test(e.sourceDate)||!/^([A-Z]{2}[A-Z0-9]{9}[0-9])$/.test(e.isin))throw Error('Invalid evidence '+e.symbol);
 seen.add(e.symbol);
 const s=shares.get(e.symbol);
 if(s.isin&&s.isin!==e.isin)throw Error('Existing ISIN conflict '+e.symbol);
 s.isin=e.isin;
 s.isinEvidence={sourceUrl:e.sourceUrl,sourceDate:e.sourceDate,sourceDocument:e.sourceDocument};
}
catalog.isinReconciliation={source:'Official GPW Main Market listing',date:report.accepted[0].sourceDate,accepted:seen.size,remaining:catalog.shares.filter(s=>!s.isin).length};
fs.writeFileSync(p,JSON.stringify(catalog,null,2)+'\n');
console.log(catalog.isinReconciliation);
