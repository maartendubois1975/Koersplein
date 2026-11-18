import fs from 'node:fs/promises';
import { assessPeriod } from './amsterdam-period-quality.mjs';
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
const shares=(catalog.shares||[]).filter(s=>s.displayPolicy!=='cross-market-reference-only');
const rows=[];
for(const share of shares){
 try {
  const doc=JSON.parse(await fs.readFile('data/history/'+share.isin+'.json','utf8'));
  rows.push({isin:share.isin,symbol:share.symbol,provider:doc.provider?.id||null,...assessPeriod(doc.bars||[])});
 } catch(error) {
  rows.push({isin:share.isin,symbol:share.symbol,issues:[{kind:'MISSING_HISTORY'}],researchReturnStatus:'BLOCKED_MISSING_HISTORY'});
 }
}
const output={schemaVersion:1,status:'DIAGNOSTIC_ONLY_NOT_BACKTEST_APPROVED',rows};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/amsterdam-period-quality.json',JSON.stringify(output,null,2));
console.log('AMSTERDAM_PERIOD_QUALITY',JSON.stringify({instruments:rows.length,issues:rows.reduce((n,r)=>n+r.issues.length,0)}));
