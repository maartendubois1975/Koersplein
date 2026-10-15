import fs from 'node:fs/promises';
import {loadMarketBars} from './market-history-source.mjs';
import {assessHistoricalCoverage} from './europe-historical-quality-core.mjs';

// Fail closed before any model computation. This checks historical row coverage,
// not OHLCV integrity, corporate actions, source rights, OOS or holdout.
const mic=process.env.MARKET_MIC;
const api=(process.env.KOERSPLEIN_API_URL||'').replace(/\/$/,'');
if(!mic||!api)throw Error('MARKET_MIC of KOERSPLEIN_API_URL ontbreekt');
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const market=plan.markets.find(x=>x.mic===mic);
if(!market||market.state!=='COMPLETE')throw Error('MARKET_NOT_COMPLETE '+mic);
const raw=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8'));
const instruments=Array.isArray(raw)?raw:(raw.instruments||raw.shares||[]);
const records=[];let usableInstruments=0,failed=0,insufficientHistory=0,skippedMissingIsin=0,provisionalIdentities=0;
const history=async isin=>{const response=await fetch(`${api}/api/history/${encodeURIComponent(isin)}`);if(!response.ok)throw Error('history '+response.status);return response.json()};
for(const item of instruments){
 if(typeof item.isin!=='string'||!item.isin.trim()){
  skippedMissingIsin++;provisionalIdentities++;
  records.push({identity:item.providerSymbol||item.ticker||item.symbol||null,status:'MISSING_ISIN',provisionalIdentity:true});
  continue;
 }
 try{
  const loaded=await loadMarketBars(item,mic,history);
  const bars=(Array.isArray(loaded.bars)?loaded.bars:(loaded.bars?.bars||loaded.bars?.records||loaded.bars?.history||[]))
   .filter(b=>b?.date&&Number.isFinite(Number(b.close))&&Number(b.close)>0);
  if(loaded.provisionalIdentity)provisionalIdentities++;
  const record={identity:loaded.identityKey,source:loaded.source,bars:bars.length,firstDate:bars[0]?.date||null,lastDate:bars.at(-1)?.date||null,provisionalIdentity:loaded.provisionalIdentity};
  if(bars.length<260){insufficientHistory++;records.push({...record,status:'INSUFFICIENT_HISTORY'});}
  else{usableInstruments++;records.push({...record,status:'HISTORY_AVAILABLE'});}
 }catch(error){failed++;records.push({identity:item.isin,status:'HISTORY_FETCH_ERROR',error:error.message});}
}
const coverage={instruments:instruments.length,usableInstruments,failed,insufficientHistory,skippedMissingIsin,provisionalIdentities,observations:usableInstruments};
const evidence={market:mic,catalogInstruments:instruments.length,usableInstruments,failed,insufficientHistory,missingIsin:skippedMissingIsin,provisionalIdentities,records};
const assessed=assessHistoricalCoverage(coverage,evidence);
const output={market:mic,generatedAt:new Date().toISOString(),status:assessed.complete?'HISTORY_ROW_PREFLIGHT_PASS':'HISTORY_ROW_PREFLIGHT_BLOCKED',issues:assessed.issues,coverage,evidence};
await fs.mkdir(`research/output/${mic}`,{recursive:true});
await fs.writeFile(`research/output/${mic}/history-preflight.json`,JSON.stringify(output,null,2));
console.log(JSON.stringify({market:mic,status:output.status,issues:assessed.issues,coverage}));
if(!assessed.complete)process.exitCode=1;
