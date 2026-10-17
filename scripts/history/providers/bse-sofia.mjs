const ROOT='https://www.bse-sofia.bg/en/';
const identities=new Map();
export function parseBseIdentity(payload,symbol,isin){
 const rows=payload?.['1']?.result?.data;
 if(!Array.isArray(rows))throw Error('BSE identity response missing');
 const fields=new Map(rows.map(([key,value])=>[String(key).trim(),String(value).trim()]));
 if(fields.get('BSE Code')!==symbol||!/^[A-Z]{2}[A-Z0-9]{10}$/.test(fields.get('ISIN Code')||'')||(isin&&fields.get('ISIN Code')!==isin))throw Error('BSE symbol/ISIN identity mismatch');
 if(!/^(?:preferred )?shares$/i.test(fields.get('Security Type')||''))throw Error('BSE security is not shares');
 const currency=fields.get('Trading currency');
 if(!['EUR','BGN'].includes(currency))throw Error('BSE unknown trading currency');
 return {symbol,isin:fields.get('ISIN Code'),currency,firstTradingDate:fields.get('First Trading Date'),market:fields.get('Market')};
}
export function parseBseBars(payload,{startDate,endDate},currency){
 if(payload?.s==='no_data')return [];
 if(payload?.s!=='ok')throw Error('BSE chart error: '+(payload?.errmsg||payload?.s));
 const keys=['t','o','h','l','c','v'];
 if(!keys.every(k=>Array.isArray(payload[k])&&payload[k].length===payload.t.length))throw Error('BSE chart array lengths mismatch');
 const bars=payload.t.map((t,i)=>({date:Number.isFinite(t)?new Date(t*1000).toISOString().slice(0,10):null,open:payload.o[i],high:payload.h[i],low:payload.l[i],close:payload.c[i],volume:payload.v[i],currency}));
 return [...new Map(bars.filter(b=>b.date&&b.date>=startDate&&b.date<=endDate&&[b.open,b.high,b.low,b.close].every(n=>Number.isFinite(n)&&n>0)&&Number.isFinite(b.volume)&&b.volume>0&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)).map(b=>[b.date,b])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export async function bseOfficialIdentity(symbol,signal){
 symbol=String(symbol).toUpperCase();
 if(identities.has(symbol))return identities.get(symbol);
 const body=new URLSearchParams({'profilmarketinfo_1[parameters][code]':symbol,'profilmarketinfo_1[parameters][language]':'en','profilmarketinfo_1[frequency]':'0'});
 const r=await fetch(ROOT+'dashboard/dispatcher/',{method:'POST',body,signal});
 if(!r.ok)throw Error('BSE identity HTTP '+r.status);
 const value=parseBseIdentity(await r.json(),symbol,null);identities.set(symbol,value);return value;
}
async function identity(instrument,signal){
 const symbol=String(instrument.symbol||instrument.ticker||'').toUpperCase(),isin=instrument.officialIsin||instrument.isin;
 const verified=await bseOfficialIdentity(symbol,signal);
 if(verified.isin!==isin)throw Error('BSE symbol/ISIN identity mismatch');
 return verified;
}
export class BseSofiaProvider{
 id='bse-sofia-official';name='Bulgarian Stock Exchange official daily OHLC';requiresApiKey=false;
 supports(i){return String(i.mic||i.market||'').toUpperCase()==='XBUL'&&Boolean(i.symbol||i.ticker)&&Boolean(i.officialIsin||i.isin);}
 async fetchDaily(i,{startDate='1990-01-01',endDate=new Date().toISOString().slice(0,10),signal}={}){
  const verified=await identity(i,signal);
  const url=new URL(ROOT+'get/charts/history');
  url.search=new URLSearchParams({symbol:verified.symbol,resolution:'1D',from:String(Date.parse(startDate+'T00:00:00Z')/1000),to:String(Date.parse(endDate+'T00:00:00Z')/1000+86400),countback:'10000'});
  const r=await fetch(url,{signal});if(!r.ok)throw Error('BSE history HTTP '+r.status);
  const bars=parseBseBars(await r.json(),{startDate,endDate},verified.currency);
  if(!bars.length)throw Error('BSE no traded daily bars in requested range');
  return {bars,requestUrl:url.toString(),providerMeta:{...verified,mic:'XBUL',source:'Bulgarian Stock Exchange',currencyPolicy:'Official chart values in current quote currency; existing stored dates are preserved'}};
 }
}

// The dated official session table lists executed trades. Require both equity
// market tables and the server-rendered date before using an absent symbol as
// evidence of no trades; an omitted/failed market is never a no-trade result.
export function parseBseSession(payload,html,date){
 const asOf=html.match(/Trading Session Results\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
 if(asOf!==date)throw Error('BSE session date mismatch');
 const tables=payload?.['1']?.result?.tables;
 if(!Array.isArray(tables))throw Error('BSE session tables missing');
 const symbols=new Set(),markets=new Set();
 for(const table of tables){
  if(!/Equities Segment/i.test(table.table_name||'')&&!/EuroBridge Market Segment|Special Purpose Vehicles Segment/i.test(table.table_name||''))continue;
  const market=/^BSE MAIN MARKET/i.test(table.table_name)?'BSE Main Market':/^BASE ALTERNATIVE MARKET/i.test(table.table_name)?'BaSE Alternative Market':null;
  if(!market)continue;
  const code=table.names?.indexOf('code'),volume=table.names?.indexOf('volume');
  if(!Number.isInteger(code)||!Number.isInteger(volume)||code<0||volume<0||!Array.isArray(table.data))throw Error('BSE session table malformed');
  markets.add(market);
  for(const row of table.data){
   if(!Array.isArray(row)||row.length!==table.names.length||!Number.isFinite(row[volume])||row[volume]<0)throw Error('BSE session row malformed');
   if(row[volume]>0)symbols.add(String(row[code]).split('#link:')[0]);
  }
 }
 if(!markets.has('BSE Main Market')||!markets.has('BaSE Alternative Market'))throw Error('BSE session equity markets incomplete');
 return {symbols,markets};
}
export async function bseSessionSnapshot(date,signal){
 const sourceUrl=ROOT+'Content/trading-data/trading-on-a-regulated-market/'+date;
 const r=await fetch(sourceUrl,{signal});if(!r.ok)throw Error('BSE dated session HTTP '+r.status);
 const html=await r.text();
 const body=new URLSearchParams({'sessionresults_1[parameters][language]':'en','sessionresults_1[parameters][type]':'SESS','sessionresults_1[parameters][sessdate]':date,'sessionresults_1[frequency]':'0'});
 const response=await fetch(ROOT+'dashboard/dispatcher/',{method:'POST',body,signal});if(!response.ok)throw Error('BSE session data HTTP '+response.status);
 return {...parseBseSession(await response.json(),html,date),sourceUrl};
}
