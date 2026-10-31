import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadCatalog, validateBars } from './engine.mjs';
import { sessionReadiness } from './session-readiness.mjs';
const root=new URL('../../data/',import.meta.url);
const instruments=await loadCatalog();
const rows=await Promise.all(instruments.map(async instrument=>{
  try {
    const history=JSON.parse(await readFile(new URL('history/'+instrument.isin+'.json',root),'utf8'));
    const source=history.bars||[];
    const valid=validateBars(source);
    const latest=valid.at(-1);
    return {symbol:instrument.symbol,isin:instrument.isin,latestDate:latest?.date||null,
      open:latest?.open??null,close:latest?.close??null,
      changePct:latest?.open>0?+((latest.close/latest.open-1)*100).toFixed(4):null,
      records:valid.length,rejectedRecords:source.length-valid.length,
      provider:history.provider?.id||null};
  } catch(error) {
    return {symbol:instrument.symbol,isin:instrument.isin,latestDate:null,
      open:null,close:null,changePct:null,records:0,error:String(error.message)};
  }
}));
const report={generatedAt:new Date().toISOString(),...sessionReadiness(rows)};
const output=new URL('../../research/output/amsterdam-session-readiness.json',import.meta.url);
await mkdir(new URL('.',output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log('AMSTERDAM_LATEST_SESSION '+JSON.stringify({
  newestDate:report.newestDate,expected:report.expectedCount,observed:report.observedCount,
  current:report.currentCount,lagging:report.laggingCount,
  invalid:report.invalidCount,unavailable:report.unavailableCount,
  completeForObservedSession:report.completeForObservedSession
}));
if(!report.countMatches){console.error('Unexpected Amsterdam instrument count');process.exitCode=1;}
if(!report.completeForObservedSession)console.warn('Amsterdam session incomplete: inspect research/output/amsterdam-session-readiness.json. Missing trading is not automatically provider failure.');
