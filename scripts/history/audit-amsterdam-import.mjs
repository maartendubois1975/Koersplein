import { readFile, writeFile, readdir } from 'node:fs/promises';
const base = new URL('../../data/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('euronext-amsterdam.json', base), 'utf8'));
const mapping = JSON.parse(await readFile(new URL('history-instruments.json', base), 'utf8'));
const files = (await readdir(new URL('history/', base))).filter(n => /^[A-Z0-9]{12}\.json$/.test(n));
const instruments = [];
for (const file of files) {
 const data = JSON.parse(await readFile(new URL('history/' + file, base), 'utf8'));
 const bars = data.bars || [];
 const latest = bars.at(-1);
 const latestDay = latest ? { date: latest.date, open: latest.open, close: latest.close, absolute: +(latest.close-latest.open).toFixed(6), percent: +((latest.close/latest.open-1)*100).toFixed(4) } : null;
 const invalidRows = bars.filter(b => !Number.isFinite(b.open)||b.open<=0||!Number.isFinite(b.close)||b.close<=0||(Number.isFinite(b.high)&&Number.isFinite(b.low)&&b.high<b.low)||(Number.isFinite(b.high)&&b.high<b.open)||(Number.isFinite(b.high)&&b.high<b.close)||(Number.isFinite(b.low)&&b.low>b.open)||(Number.isFinite(b.low)&&b.low>b.close));
 const invalid = invalidRows.length;
 if(invalid) console.log('INVALID_OHLC',data.instrument.symbol,JSON.stringify(invalidRows.slice(0,5)));
 const unique = new Set(bars.map(b=>b.date)).size===bars.length;
 instruments.push({isin:data.instrument.isin,symbol:data.instrument.symbol,records:bars.length,firstDate:bars[0]?.date||null,lastDate:latest?.date||null,invalid,uniqueDates:unique,latestDay});
}
const missing = catalog.shares.filter(s => !instruments.some(x=>x.isin===s.isin)).map(s=>({isin:s.isin,symbol:s.symbol}));
const result = {generatedAt:new Date().toISOString(),catalog:catalog.shares.length,mapped:mapping.providerMappings.length,imported:instruments.length,records:instruments.reduce((n,x)=>n+x.records,0),invalid:instruments.reduce((n,x)=>n+x.invalid,0),missing,instruments:instruments.sort((a,b)=>a.symbol.localeCompare(b.symbol))};
await writeFile(new URL('amsterdam-import-audit.json',base),JSON.stringify(result,null,2)+'\n');
console.log('AMSTERDAM_AUDIT',JSON.stringify({catalog:result.catalog,mapped:result.mapped,imported:result.imported,records:result.records,invalid:result.invalid,missing:result.missing}));
if (result.invalid || instruments.some(x=>!x.uniqueDates)) process.exitCode=1;
