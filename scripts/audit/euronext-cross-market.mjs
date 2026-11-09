/**
 * Read-only cross-market Euronext identity audit.
 * The same ISIN may legitimately trade on multiple markets: flag for review,
 * never silently remove or assign a primary listing.
 */
import { readFileSync } from 'node:fs';
import { inspectCatalog } from './euronext-catalog-integrity.mjs';
export function compareMarkets(documents) {
 const catalogs=documents.map(({label,document})=>({label,summary:inspectCatalog(document),document}));
 const byIsin=new Map(),bySymbol=new Map();
 for(const {label,document} of catalogs)for(const share of document.shares||[]){
   const isin=String(share.isin||'').trim().toUpperCase();
   const symbol=String(share.symbol||'').trim().toUpperCase();
   const listing={market:label,isin,symbol,name:share.name,marketDescription:share.market||null};
   if(!byIsin.has(isin))byIsin.set(isin,[]);
   byIsin.get(isin).push(listing);
   if(!bySymbol.has(symbol))bySymbol.set(symbol,[]);
   bySymbol.get(symbol).push(listing);
 }
 const overlaps=[...byIsin].filter(([,rows])=>new Set(rows.map(r=>r.market)).size>1)
   .map(([isin,listings])=>({isin,listings})).sort((a,b)=>a.isin.localeCompare(b.isin));
 const symbolCollisions=[...bySymbol].filter(([,rows])=>new Set(rows.map(r.isin)).size>1)
   .map(([symbol,listings])=>({symbol,listings})).sort((a,b)=>a.symbol.localeCompare(b.symbol));
 return {markets:catalogs.map(x=>({market:x.label,...x.summary})),crossMarketSameIsin:overlaps,symbolCollisions,automaticExclusions:0};
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
 const paths=process.argv.slice(2);
 if(paths.length!==2)throw Error('Usage: node scripts/audit/euronext-cross-market.mjs <amsterdam.json> <brussels.json>');
 const report=compareMarkets(paths.map((path,i)=>({label:i?'XBRU':'XAMS',document:JSON.parse(readFileSync(path,'utf8'))})));
 console.log(JSON.stringify(report,null,2));
 if(report.markets.some(x=>x.errors.length))process.exitCode=1;
}
