// Read-only bulk-source pilot. No production writes, no credentials in reports.
import fs from 'node:fs/promises';
const token=process.env.EODHD_API_TOKEN;
if(!token)throw Error('EODHD_API_TOKEN is required for the read-only pilot');
const exchanges=[['PA','XPAR'],['XETRA','XETR'],['BR','XBRU']];
const official=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8')).shares;
const reports=[];
async function get(path,params={}){
 const u=new URL('https://eodhd.com/api/'+path);
 u.searchParams.set('api_token',token);u.searchParams.set('fmt','json');
 for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));
 const response=await fetch(u,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error(path+' HTTP '+response.status);
 const data=await response.json();
 if(!Array.isArray(data))throw Error(path+' expected an array');
 return data;
}
for(const [exchange,mic] of exchanges){
 const listings=await get('exchange-symbol-list/'+exchange);
 const byIsin=new Map();
 for(const x of listings){
  const isin=String(x.Isin||x.ISIN||'').trim().toUpperCase();
  if(!isin)continue;
  const group=byIsin.get(isin)||[];group.push(x);byIsin.set(isin,group);
 }
 const report={exchange,mic,providerListings:listings.length,providerWithIsin:listings.filter(x=>x.Isin||x.ISIN).length};
 if(exchange==='PA'){
  const matched=official.map(s=>({share:s,matches:byIsin.get(s.isin)||[]})); 
  report.officialParis=official.length;
  report.exactIsinMatches=matched.filter(x=>x.matches.length===1).length;
  report.ambiguousIsinMatches=matched.filter(x=>x.matches.length>1).length;
  report.unmatched=matched.filter(x=>x.matches.length===0).map(x=>({isin:x.share.isin,mic:x.share.mic,symbol:x.share.symbol}));
  report.matchedByMic={};
  for(const m of [...new Set(official.map(x=>x.mic))])report.matchedByMic[m]=matched.filter(x=>x.share.mic===m&&x.matches.length===1).length;
 }
 reports.push(report);
 console.log('BULK_COVERAGE',JSON.stringify({...report,unmatched:report.unmatched?.length}));
}
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/eodhd-bulk-pilot.json',JSON.stringify({generatedAt:new Date().toISOString(),readOnly:true,livePricesFetched:false,coverage:reports},null,2)+'\n');
console.log('READ_ONLY_PILOT_COMPLETE');
