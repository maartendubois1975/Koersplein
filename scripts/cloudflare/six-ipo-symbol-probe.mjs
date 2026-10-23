import fs from 'node:fs/promises';
import {parseSixIpoPairs} from './six-ipo-symbol-evidence.mjs';
const sourceUrl='https://www.six-group.com/en/market-data/shares/ipo-history.html';
const catalog=JSON.parse(await fs.readFile('data/euronext-zurich.json','utf8'));
const shares=catalog.shares||catalog.instruments||[];
const numeric=shares.filter(s=>/^\d{4,}$/.test(String(s.symbol||s.ticker||'')));
let status='SOURCE_UNAVAILABLE',error=null,matches=[],officialPairs=0;
try{
 const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(25000),headers:{Accept:'text/html','User-Agent':'Koersplein-research/1.0'}});
 if(!response.ok)throw Error('SIX IPO history HTTP '+response.status);
 const pairs=parseSixIpoPairs(await response.text());
 officialPairs=pairs.size;
 if(officialPairs<20)throw Error('SIX IPO reference response lacks sufficient verified ISIN/symbol pairs: '+officialPairs);
 matches=numeric.filter(s=>pairs.has(s.isin)).map(s=>({
  isin:s.isin,storedIdentifier:s.symbol||s.ticker,name:s.name,currency:s.currency,
  officialIpoSymbols:[...pairs.get(s.isin)],classification:pairs.get(s.isin).size===1?'IPO_SYMBOL_CANDIDATE_REQUIRES_CURRENT_VERIFICATION':'AMBIGUOUS_HISTORICAL_IPO_SYMBOLS'
 }));
 status='REFERENCE_EVIDENCE_ONLY';
}catch(e){error=String(e.message||e).slice(0,350)}
const output={generatedAt:new Date().toISOString(),mode:'READ_ONLY_NO_PRICE_WRITES',status,sourceUrl,error,swissCatalog:shares.length,numericIdentifiers:numeric.length,officialPairs,matchedNumericIdentifiers:matches.length,unmatchedNumericIdentifiers:numeric.length-matches.length,matches,warning:'IPO symbols may be obsolete. Do not use in production until current official SIX listing and Yahoo exchange/currency identity are independently verified.'};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/six-ipo-symbol-probe.json',JSON.stringify(output,null,2));
console.log('SIX_IPO_SYMBOL_PROBE',JSON.stringify({status,swissCatalog:shares.length,numericIdentifiers:numeric.length,officialPairs,matchedNumericIdentifiers:matches.length,error}));
