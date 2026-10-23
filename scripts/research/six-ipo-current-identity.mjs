// Read-only cross-check: official SIX historical IPO ISIN/symbol pairs against
// today's SIX ISIN-keyed share-page title. Historical IPO tickers are NOT
// automatically current listings or approved provider mappings.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {parseSixIpoPairs} from '../cloudflare/six-ipo-symbol-evidence.mjs';
import {isValidIsin,officialSixUrl,evaluateSixPage,fetchOfficialSixHtml,verifyYahooCandidate} from './six-official-symbol-evidence.mjs';
export const IPO_URL='https://www.six-group.com/en/market-data/shares/ipo-history.html';
const CCY=new Set(['CHF','EUR','USD']);
export async function fetchSixIpoHtml(fetchFn=fetch){
 const r=await fetchFn(IPO_URL,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'text/html','User-Agent':'Koersplein-readonly-reference/1.0'}});
 if(!r.ok||r.url!==IPO_URL||!String(r.headers.get('content-type')||'').toLowerCase().includes('text/html'))throw Error('OFFICIAL_IPO_SOURCE_NOT_VERIFIED');
 if(Number(r.headers.get('content-length')||0)>3000000)throw Error('OFFICIAL_IPO_TOO_LARGE');
 const html=await r.text();
 if(html.length>3000000)throw Error('OFFICIAL_IPO_TOO_LARGE');
 return html;
}
export function selectIpoIdentityCandidates(shares,ipoPairs,{limit=12,rotation=0}={}){
 if(!Number.isInteger(limit)||limit<1||limit>24||!Number.isSafeInteger(rotation)||rotation<0)throw Error('INVALID_IPO_PROBE_BOUNDS');
 const eligible=(shares||[]).filter(i=>i.mic==='XSWX'&&/^\\d{4,}$/.test(String(i.symbol||''))&&!i.providerSymbol&&isValidIsin(i.isin)&&CCY.has(i.currency)&&ipoPairs.has(i.isin));
 const unique=new Map();
 for(const i of eligible){if(!unique.has(i.isin))unique.set(i.isin,i);else unique.set(i.isin,null);}
 const all=[...unique.values()].filter(Boolean).sort((a,b)=>a.isin.localeCompare(b.isin));
 const offset=all.length?(rotation*limit)%all.length:0;
 return {totalEligible:all.length,selected:[...all.slice(offset),...all.slice(0,offset)].slice(0,limit)};
}
export async function probeSixIpoCurrent(shares,{ipoHtml,fetchHtml=fetchOfficialSixHtml,fetchYahoo=null,limit=12,rotation=0,asOfDate=new Date().toISOString().slice(0,10)}={}){
 if(typeof ipoHtml!=='string'||ipoHtml.length>3000000)throw Error('INVALID_OFFICIAL_IPO_HTML');
 const pairs=parseSixIpoPairs(ipoHtml);
 if(pairs.size<20)throw Error('OFFICIAL_IPO_LIST_TOO_SMALL');
 const {selected,totalEligible}=selectIpoIdentityCandidates(shares,pairs,{limit,rotation});
 const results=[];
 for(const i of selected){
  const historicalSymbols=[...pairs.get(i.isin)].sort();
  const base={isin:i.isin,valor:i.symbol,mic:'XSWX',currency:i.currency,historicalSymbols,officialIpoUrl:IPO_URL,readOnly:true,approvedForProduction:false};
  if(historicalSymbols.length!==1||!/^[A-Z][A-Z0-9.-]{0,11}$/.test(historicalSymbols[0])){
   results.push({...base,status:'AMBIGUOUS_HISTORICAL_IPO_SYMBOL'});continue;
  }
  const url=officialSixUrl(i);
  try{
   const page=evaluateSixPage(i,await fetchHtml(url),url);
   if(!page.symbol||page.symbol!==historicalSymbols[0]){
    results.push({...base,status:'IPO_SYMBOL_NOT_CURRENT_TITLE_MATCH',currentTitleSymbol:page.symbol||null,pageStatus:page.status});continue;
   }
   const yahoo=fetchYahoo?await verifyYahooCandidate(i,page.symbol,fetchYahoo,{asOfDate}):null;
   const yahooMatches=yahoo?.status==='YAHOO_VENUE_CURRENCY_OHLC_MATCH_ISIN_UNPROVEN';
   results.push({...base,status:yahooMatches?'OFFICIAL_IPO_AND_CURRENT_TITLE_YAHOO_MATCH_REVIEW_ONLY':'OFFICIAL_IPO_AND_CURRENT_TITLE_MATCH_REVIEW_ONLY',currentTitleSymbol:page.symbol,pageStatus:page.status,yahooEvidence:yahoo,officialCurrentUrl:url,requiresCurrentIdentityAndRightsReview:true});
  }catch(e){results.push({...base,status:'CURRENT_SIX_PAGE_UNAVAILABLE',error:String(e.message).slice(0,140)});}
 }
 const counts={};for(const r of results)counts[r.status]=(counts[r.status]||0)+1;
 return {mode:'READ_ONLY_HISTORICAL_IPO_CURRENT_TITLE_CROSSCHECK',generatedAt:new Date().toISOString(),officialIpoPairs:pairs.size,totalEligible,requested:results.length,rotation,counts,productionMappingsCreated:0,priceWrites:0,policy:'HISTORICAL_IPO_NOT_PROOF_OF_CURRENT_LISTING_NO_AUTO_MAPPING',results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const catalog=JSON.parse(await fs.readFile('data/euronext-zurich.json','utf8'));
 const {YahooChartProvider}=await import('../history/providers/yahoo-chart.mjs');
 const yahoo=new YahooChartProvider();
 const endDate=new Date(Date.now()-86400000).toISOString().slice(0,10);
 const startDate=new Date(Date.now()-14*86400000).toISOString().slice(0,10);
 let report;
 try{report=await probeSixIpoCurrent(catalog.shares||[],{ipoHtml:await fetchSixIpoHtml(),rotation:Number(process.env.GITHUB_RUN_NUMBER||0),fetchYahoo:i=>yahoo.fetchDaily(i,{startDate,endDate,signal:AbortSignal.timeout(12000)})});}
 catch(e){report={mode:'READ_ONLY_HISTORICAL_IPO_CURRENT_TITLE_CROSSCHECK',status:'OFFICIAL_SOURCE_UNAVAILABLE',error:String(e.message).slice(0,180),productionMappingsCreated:0,priceWrites:0,results:[]};}
 await fs.mkdir('research/output',{recursive:true});
 await fs.writeFile('research/output/six-ipo-current-identity.json',JSON.stringify(report,null,2)+'\n');
 console.log('SIX_IPO_CURRENT_IDENTITY_READ_ONLY',JSON.stringify({status:report.status||'EVIDENCE_ONLY',officialIpoPairs:report.officialIpoPairs||0,totalEligible:report.totalEligible||0,requested:report.requested||0,counts:report.counts||{},productionMappingsCreated:0,priceWrites:0}));
}
