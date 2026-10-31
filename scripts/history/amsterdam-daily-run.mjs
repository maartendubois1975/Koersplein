// Staging-only batch orchestrator. Never publishes or commits price files.
import {loadCatalog,runBatch} from './engine.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {sessionReadiness} from './session-readiness.mjs';
const args=process.argv.slice(2);
const phase=args.includes('--phase')?args[args.indexOf('--phase')+1]:'close';
if(!['morning','close'].includes(phase))throw Error('Expected --phase morning or close');
const batchSize=8;
const instruments=await loadCatalog();
if(instruments.length!==80)throw Error('Unexpected XAMS catalog size: '+instruments.length);
const startedAt=new Date().toISOString();
const outcomes=await runBatch(instruments,{mode:'update',batchSize});
const rows=await Promise.all(instruments.map(async instrument=>{
  const result=outcomes.find(x=>x.isin===instrument.isin);
  if(result?.outcome==='error')return {isin:instrument.isin,symbol:instrument.symbol,error:result.error,latestDate:null};
  try{
    const file=new URL('../../data/history/'+instrument.isin+'.json',import.meta.url);
    const history=JSON.parse(await readFile(file,'utf8'));
    const bars=history.bars||[],last=bars.at(-1);
    return {isin:instrument.isin,symbol:instrument.symbol,latestDate:last?.date||null,
      open:last?.open??null,close:last?.close??null,records:bars.length,
      provider:history.provider?.id||null,rejectedRecords:0};
  }catch(error){return {isin:instrument.isin,symbol:instrument.symbol,latestDate:null,error:error.message};}
}));
const readiness=sessionReadiness(rows);
const failed=outcomes.filter(x=>x.outcome==='error');
const report={schemaVersion:1,phase,startedAt,completedAt:new Date().toISOString(),
  publishing:'DISABLED_STAGING_ONLY',providerFailures:failed,readiness,
  note:'Morning and close phases are collection labels; actual official exchange close is not independently verified.'};
const output=new URL('../../research/output/amsterdam-daily-run.json',import.meta.url);
await mkdir(new URL('.',output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log('AMSTERDAM_DAILY_RUN '+JSON.stringify({phase,providerFailures:failed.length,
  observedSession:readiness.newestDate,current:readiness.currentCount,
  lagging:readiness.laggingCount,invalid:readiness.invalidCount,unavailable:readiness.unavailableCount}));
if(failed.length)process.exitCode=1;
