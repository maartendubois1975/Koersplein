const normalized=value=>String(value||'').trim().toUpperCase();
const listingKey=(mic,ticker)=>`${normalized(mic)}\0${normalized(ticker)}`;

// D1 is authoritative for writable identities. A manifest entry alone can be orphaned.
export function storageIdentityResolver(rows, defaultMic) {
  const byListing=new Map(),byIdentity=new Map();
  for(const row of rows){
    const id=row.isin||row.id,mic=row.mic||defaultMic,ticker=row.ticker||row.symbol;
    if(!id)continue;
    byIdentity.set(id,row);
    if(!ticker)continue;
    const key=listingKey(mic,ticker);
    if(byListing.has(key)&&byListing.get(key)!==id)throw Error(`AMBIGUOUS_STORAGE_IDENTITY ${mic}:${ticker}`);
    byListing.set(key,id);
  }
  return share=>{
    const mic=share.mic||defaultMic,ticker=share.symbol||share.ticker;
    const listed=ticker&&byListing.get(listingKey(mic,ticker));
    if(listed)return listed;
    const exact=byIdentity.get(share.isin);
    return exact&&normalized(exact.mic||defaultMic)===normalized(mic)?share.isin:null;
  };
}
