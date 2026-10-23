// Deterministic append-only missing-history selection. Newly verified Swiss
// symbol overrides must not wait for an unrelated global rotation window.
export function verifiedSwissPriorityKey(share,marketMic){
 const mic=share?.mic||marketMic,isin=share?.isin,providerSymbol=share?.providerSymbol;
 const evidence=share?.providerSymbolEvidence;
 if(mic!=='XSWX'||!isin||!share.currency||!providerSymbol||!evidence?.officialSix||!evidence?.yahooSwiss)return null;
 if(!/^https:\/\/www\.six-group\.com\//.test(evidence.officialSix)||!/^https:\/\/finance\.yahoo\.com\/quote\//.test(evidence.yahooSwiss))return null;
 if(!/^[A-Z0-9][A-Z0-9.\-]{0,19}\.SW$/i.test(providerSymbol)||/^\d{4,}\.SW$/i.test(providerSymbol))return null;
 if(!evidence.yahooSwiss.includes('/quote/'+providerSymbol+'/'))return null;
 return mic+'|'+(share.symbol||share.ticker||isin)+'|'+isin;
}
export function selectEuropeMissingBackfill(pool,{limit=35,dayIndex=0,fullRequested=false,priorityKeys=[]}={}){
 if(!Array.isArray(pool)||!Number.isInteger(limit)||limit<1||limit>80||!Number.isInteger(dayIndex)||dayIndex<0||!Array.isArray(priorityKeys))throw Error('Invalid missing-history selection');
 const unique=[...new Set(pool)],valid=new Set(unique);
 const selected=new Set(priorityKeys.filter(key=>valid.has(key)));
 const rotation=unique.length?(dayIndex*limit)%unique.length:0;
 for(let i=0;i<(fullRequested?unique.length:Math.min(limit,unique.length));i++)selected.add(unique[(rotation+i)%unique.length]);
 return {selected,rotation,prioritySelected:priorityKeys.filter(key=>selected.has(key)).length};
}
