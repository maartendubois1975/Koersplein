import {readFile,writeFile} from 'node:fs/promises';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/verify-amsterdam.mjs candidates.json verified.json');
const data=JSON.parse(await readFile(input,'utf8'));
const manifest=JSON.parse(await readFile(new URL('../data/amsterdam-history-manifest.json',import.meta.url),'utf8'));
if(data.market!=='XAMS'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(data.date)||!Array.isArray(data.candidates))throw Error('Invalid XAMS report');
const date=new Date(data.date+'T00:00:00Z');
if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==data.date||[0,6].includes(date.getUTCDay()))throw Error('Invalid trading session');
const now=new Date();
const amsterdamDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const amsterdamHour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',hour:'2-digit',hourCycle:'h23'}).format(now));
if(data.date>amsterdamDate||(data.date===amsterdamDate&&amsterdamHour<20))throw Error('Session not completed');
const rows=[],rejected=[],seen=new Set();
for(const row of data.candidates){
 const key=String(row.isin||'UNKNOWN')+':'+String(row.date||'UNKNOWN');
 try{
  if(seen.has(row.isin))throw Error('Duplicate ISIN');
  seen.add(row.isin);
  const meta=manifest.instruments[row.isin];
  if(!meta||row.symbol!==meta.symbol||row.mic!=='XAMS'||row.date!==data.date)throw Error('Identity or session mismatch');
  const expected='https://live.euronext.com/en/ajax/getHistoricalPricePopup/'+encodeURIComponent(row.isin+'-XAMS');
  if(row.source!=='Euronext public historical table'||row.sourceUrl!==expected||!Number.isFinite(Date.parse(row.retrievedAt))||Date.parse(row.retrievedAt)>now.getTime()+60000)throw Error('Unrecognized provenance');
  if(![row.open,row.high,row.low,row.close].every(x=>Number.isFinite(x)&&x>0)||row.low>Math.min(row.open,row.close)||row.high<Math.max(row.open,row.close)||row.high<row.low||!Number.isSafeInteger(row.volume)||row.volume<=0)throw Error('Invalid OHLCV');
  rows.push({...row,sourceVerified:true,sessionClosedVerified:true});
 }catch(error){rejected.push({key,reason:error.message});}
}
await writeFile(output,JSON.stringify({market:'XAMS',date:data.date,rows,rejected,verification:'direct-euronext-historical-table-after-session'},null,2)+'\\n');
console.log(JSON.stringify({date:data.date,accepted:rows.length,rejected:rejected.length,exceptions:rejected}));
