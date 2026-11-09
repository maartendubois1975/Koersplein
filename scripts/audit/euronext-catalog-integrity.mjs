/**
 * Read-only integrity audit of raw Euronext source catalogs.
 * Does not decide which issuers qualify for the public Koersplein universe.
 */
import { readFileSync } from 'node:fs';
export function inspectCatalog(document) {
  const shares=document.shares||document.instruments;
  if(!Array.isArray(shares)) throw new Error('Catalog shares must be an array');
  const errors=[],warnings=[],byListing=new Map(),byIsin=new Map();
  shares.forEach((share,index)=>{
    const isin=String(share.isin||'').trim().toUpperCase();
    const symbol=String(share.symbol||share.ticker||'').trim().toUpperCase();
    if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) errors.push({index,kind:'invalid-isin',isin});
    if(!symbol) errors.push({index,kind:'missing-symbol',isin});
    if(!String(share.name||'').trim()) errors.push({index,kind:'missing-name',isin});
    const listing=isin+'|'+symbol;
    if(byListing.has(listing)) errors.push({index,kind:'duplicate-listing',isin,symbol,firstIndex:byListing.get(listing)});
    else byListing.set(listing,index);
    const other=byIsin.get(isin)||[];
    other.push({index,symbol});byIsin.set(isin,other);
  });
  for(const [isin,listings] of byIsin) if(listings.length>1) warnings.push({kind:'multiple-listings-same-isin',isin,listings});
  return {mic:document.mic||null,total:shares.length,uniqueIsins:byIsin.size,errors,warnings};
}
export function auditCatalogFiles(paths) {
  return paths.map(path=>({path,...inspectCatalog(JSON.parse(readFileSync(path,'utf8')))}));
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  const paths=process.argv.slice(2);
  if(!paths.length) throw Error('Provide catalog paths');
  const report=auditCatalogFiles(paths);
  console.log(JSON.stringify(report,null,2));
  if(report.some(x=>x.errors.length))process.exitCode=1;
}
