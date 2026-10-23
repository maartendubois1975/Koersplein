// Official MSE price list: read-only evidence of the last actual trade.
// It does NOT publish opening prices, so this module must never produce OHLC
// candles or be registered as a history provider.
import {execFileSync} from 'node:child_process';

export const MSE_PRICE_LIST_URL='https://cdn.borzamalta.com.mt/download/statistics/Price_List/Price%20List.pdf';
const MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
function day(year,month,date){
 const value=new Date(Date.UTC(year,month-1,date));
 if(value.getUTCFullYear()!==year||value.getUTCMonth()!==month-1||value.getUTCDate()!==date)throw Error('MSE official price list contains invalid date');
 return value.toISOString().slice(0,10);
}
function parseTradeDate(value){
 const m=String(value).match(/^(\d{2})-(\d{2})-(\d{2})$/);
 return m?day(2000+Number(m[3]),Number(m[2]),Number(m[1])):null;
}
export function parseMseOfficialPriceList(text,{expectedDate=null}={}){
 const header=String(text).match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})\b/i);
 if(!header||!/Malta Stock Exchange/i.test(text)||!/Price List/i.test(text))throw Error('MSE official price list identity or date unavailable');
 const snapshotDate=day(Number(header[3]),MONTHS[header[1].toLowerCase()],Number(header[2]));
 if(expectedDate&&snapshotDate!==expectedDate)throw Error('MSE official price list date mismatch: '+snapshotDate+' != '+expectedDate);
 const section=String(text).split(/\bEquities\b/i)[1]?.split(/\bCorporate Bonds\b/i)[0];
 if(!section)throw Error('MSE official equity section missing');
 const rows=new Map();let duplicates=0;
 const rowPattern=/^\s*(MT[A-Z0-9]{10})\s+([\d,]+)\s+([A-Z0-9]+)\s+(.+?)\s+(\d+(?:\.\d+)?|N\/a)\s+(\d+(?:\.\d+)?|N\/a)\s+\((\d{2}-\d{2}-\d{2})\)\s+(\d+(?:\.\d+)?|N\/a)\s+(\d+(?:\.\d+)?|N\/a)(?=\s|$)/i;
 for(const line of section.split(/\r?\n/)){
  const match=line.match(rowPattern);
  if(!match)continue;
  const [_,isin,issued,symbol,security,average,lastClose,rawLastTrade,high,low]=match;
  const lastTradeDate=parseTradeDate(rawLastTrade);
  if(!lastTradeDate||lastTradeDate>snapshotDate)throw Error('MSE official future/invalid last trade for '+isin);
  if(rows.has(isin)){duplicates++;continue;}
  rows.set(isin,{isin,symbol:symbol.toUpperCase(),lastTradeDate,lastClose:Number(lastClose),high:Number(high),low:Number(low),security:security.trim()});
 }
 if(duplicates)throw Error('MSE official price list duplicate ISINs: '+duplicates);
 // This is a full exchange price list, not a sample. Never accept a PDF
 // extraction that silently lost most of the official equity table.
 if(rows.size<25||rows.size>100)throw Error('MSE official equity extraction incomplete: '+rows.size);
 return {snapshotDate,rows,sourceUrl:MSE_PRICE_LIST_URL,readOnly:true,ohlcAvailable:false};
}
export function mseOfficialNoTradeStatus(snapshot,instrument,date){
 if(!snapshot||snapshot.snapshotDate!==date||instrument?.mic!=='XMAL')return null;
 const isin=instrument.officialIsin||instrument.isin;
 const row=snapshot.rows.get(isin);
 const symbol=String(instrument.symbol||instrument.ticker||'').trim().toUpperCase();
 if(!row||!symbol||row.symbol!==symbol||row.lastTradeDate>=date)return null;
 // The published last-traded date precedes the snapshot date. This does not
 // prove missing intermediate history is complete; callers must compare the
 // official lastTradeDate with the actual last stored bar.
 return {date,mic:'XMAL',isin,status:'NO_TRADES',lastTradeDate:row.lastTradeDate,provider:'mse-official-price-list',sourceUrl:snapshot.sourceUrl,verification:'OFFICIAL_LAST_TRADE_BEFORE_PRICE_LIST_SESSION',readOnly:true};
}
export async function fetchMseOfficialPriceList(date,{fetchFn=fetch,extractPdf=null,signal=AbortSignal.timeout(20000)}={}){
 const response=await fetchFn(MSE_PRICE_LIST_URL,{signal,headers:{Accept:'application/pdf','User-Agent':'Koersplein-official-status/1.0'}});
 if(!response.ok)throw Error('MSE official price list HTTP '+response.status);
 const url=new URL(response.url||MSE_PRICE_LIST_URL);
 if(url.protocol!=='https:'||url.hostname!=='cdn.borzamalta.com.mt')throw Error('MSE official PDF redirected to unapproved host');
 const buffer=Buffer.from(await response.arrayBuffer());
 if(buffer.length<100||buffer.length>8*1024*1024||buffer.subarray(0,5).toString()!=='%PDF-')throw Error('MSE official response is not a bounded PDF');
 const extract=extractPdf||((pdf)=>execFileSync('pdftotext',['-f','1','-l','1','-layout','-','-'],{input:pdf,timeout:10000,maxBuffer:2*1024*1024}).toString('utf8'));
 return parseMseOfficialPriceList(extract(buffer),{expectedDate:date});
}
