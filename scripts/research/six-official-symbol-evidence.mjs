// Read-only SIX reference evidence. Never changes catalog, provider mappings or prices.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const ISIN=/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/,CCY=/^(CHF|EUR|USD)$/;
export function officialSixUrl(i){
 const isin=String(i?.isin||'').toUpperCase(),currency=String(i?.currency||'').toUpperCase();
 if(i?.mic!=='XSWX'||!ISIN.test(isin)||!CCY.test(currency))throw Error('INVALID_SIX_CATALOG_IDENTITY');
 return `https://www.six-group.com/en/market-data/shares/share-explorer/share-details.${isin}${currency}4.html`;
}
export function evaluateSixPage(i,html,actualUrl){
 const url=officialSixUrl(i);
 if(actualUrl!==url)return {status:'OFFICIAL_URL_MISMATCH'};
 if(typeof html!=='string'||html.length>2000000)return {status:'INVALID_OFFICIAL_HTML'};
 const titles=[...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(x=>x[1].replace(/\s+/g,' ').trim());
 if(titles.length!==1)return {status:'OFFICIAL_TITLE_NOT_UNIQUE'};
 const title=titles[0].replace(/&amp;/g,'&').replace(/&#39;/g,"'");
 const m=title.match(/\bStock Price\s*-\s*([A-Z0-9][A-Z0-9.-]{0,11})\s*\|\s*SIX\s*$/i);
 if(!m)return {status:'NO_OFFICIAL_TRADING_SYMBOL',title:title.slice(0,130)};
 const symbol=m[1].toUpperCase();
 if(/^\d{4,}$/.test(symbol))return {status:'NUMERIC_VALOR_NOT_SYMBOL'};
 const isinEvidence=new RegExp(`(?:^|[^A-Z0-9])${i.isin}(?:$|[^A-Z0-9])`,'i').test(html);
 return {status:isinEvidence?'OFFICIAL_ISIN_SYMBOL_EVIDENCE':'TITLE_ONLY_ISIN_NOT_PROVEN',symbol,isinEvidence,title:title.slice(0,130)};
}
export function selectSwissCandidates(shares,{limit=12,rotation=0}={}){
 if(!Number.isInteger(limit)||limit<1||limit>24)throw Error('INVALID_PROBE_LIMIT');
 const eligible=shares.filter(x=>x.mic==='XSWX'&&/^\d{4,}$/.test(String(x.symbol))&&!x.providerSymbol&&ISIN.test(String(x.isin))&&CCY.test(String(x.currency)));
 const sorted=[...eligible].sort((a,b)=>a.isin.localeCompare(b.isin));
 const offset=sorted.length?(Math.abs(Math.trunc(rotation))*limit)%sorted.length:0;
 return [...sorted.slice(offset),...sorted.slice(0,offset)].slice(0,limit);
}
export async function fetchOfficialSixHtml(url,fetchFn=fetch){
 if(!/^https:\/\/www\.six-group\.com\/en\/market-data\/shares\/share-explorer\/share-details\.[A-Z]{2}[A-Z0-9]{9}[0-9](CHF|EUR|USD)4\.html$/.test(url))throw Error('UNAPPROVED_OFFICIAL_URL');
 const response=await fetchFn(url,{redirect:'error',signal:AbortSignal.timeout(18000),headers:{Accept:'text/html','User-Agent':'Koersplein-readonly-reference/1.0'}});
 if(!response.ok)throw Error('OFFICIAL_HTTP_'+response.status);
 if(response.url!==url)throw Error('OFFICIAL_REDIRECT_OR_URL_MISMATCH');
 if(!String(response.headers.get('content-type')||'').toLowerCase().includes('text/html'))throw Error('OFFICIAL_NOT_HTML');
 if(Number(response.headers.get('content-length')||0)>2000000)throw Error('OFFICIAL_HTML_TOO_LARGE');
 const html=await response.text();
 if(html.length>2000000)throw Error('OFFICIAL_HTML_TOO_LARGE');
 return html;
}
export async function verifyYahooCandidate(instrument,symbol,fetchYahoo){
 if(!fetchYahoo||!/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(String(symbol||'')))return null;
 const providerSymbol=symbol+'.SW';
 try{
  const response=await fetchYahoo({...instrument,providerSymbol});
  const meta=response?.providerMeta||{};
  const venue=[meta.exchangeName,meta.fullExchangeName].join(' ').toLowerCase();
  const venueValid=/(?:ebs|swx|six swiss|swiss exchange|zurich)/.test(venue);
  const identityValid=String(meta.symbol||'').toUpperCase()===providerSymbol.toUpperCase()&&String(meta.currency||'').toUpperCase()===instrument.currency&&venueValid;
  const valid=(response?.bars||[]).filter(b=>{
   const n=['open','high','low','close'].map(k=>Number(b[k]));
   return /^\d{4}-\d{2}-\d{2}$/.test(String(b.date||''))&&n.every(x=>Number.isFinite(x)&&x>0)&&n[1]>=Math.max(n[0],n[3])&&n[2]<=Math.min(n[0],n[3]);
  });
  return {status:identityValid&&valid.length?'YAHOO_VENUE_CURRENCY_OHLC_MATCH_ISIN_UNPROVEN':'YAHOO_IDENTITY_OR_OHLC_NOT_PROVEN',validDays:valid.length,lastValidDate:valid.at(-1)?.date||null,readOnly:true};
 }catch(error){return {status:'YAHOO_PROBE_FAILED',error:String(error.message).slice(0,140),readOnly:true};}
}
export async function probeSwissReference(shares,{limit=12,rotation=0,fetchHtml=fetchOfficialSixHtml,fetchYahoo=null}={}){
 const selected=selectSwissCandidates(shares,{limit,rotation}),results=[];
 for(const i of selected){
  const url=officialSixUrl(i);
  try{
   const evidence=evaluateSixPage(i,await fetchHtml(url),url);
   const yahooEvidence=evidence.symbol?await verifyYahooCandidate(i,evidence.symbol,fetchYahoo):null;
   results.push({isin:i.isin,valor:i.symbol,currency:i.currency,mic:'XSWX',officialUrl:url,...evidence,yahooEvidence,readOnly:true,approvedForProduction:false});
  }catch(e){results.push({isin:i.isin,valor:i.symbol,currency:i.currency,mic:'XSWX',officialUrl:url,status:'OFFICIAL_FETCH_FAILED',error:String(e.message).slice(0,160),readOnly:true,approvedForProduction:false});}
 }
 const statuses={};for(const row of results)statuses[row.status]=(statuses[row.status]||0)+1;
 return {mode:'READ_ONLY_SIX_REFERENCE_EVIDENCE',generatedAt:new Date().toISOString(),rotation,requested:results.length,statuses,policy:'NO_PROVIDER_MAPPING_NO_PRICE_WRITES_NO_AUTO_APPROVAL',results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const catalog=JSON.parse(await fs.readFile('data/euronext-zurich.json','utf8'));
 const {YahooChartProvider}=await import('../history/providers/yahoo-chart.mjs');
 const yahoo=new YahooChartProvider();
 const endDate=new Date(Date.now()-86400000).toISOString().slice(0,10);
 const startDate=new Date(Date.now()-14*86400000).toISOString().slice(0,10);
 const report=await probeSwissReference(catalog.shares||[],{rotation:Number(process.env.GITHUB_RUN_NUMBER||0),fetchYahoo:i=>yahoo.fetchDaily(i,{startDate,endDate,signal:AbortSignal.timeout(12000)})});
 await fs.mkdir('research/output',{recursive:true});
 await fs.writeFile('research/output/six-official-symbol-evidence.json',JSON.stringify(report,null,2)+'\n');
 console.log('SIX_REFERENCE_READ_ONLY',JSON.stringify({requested:report.requested,statuses:report.statuses,productionMappingsCreated:0}));
}