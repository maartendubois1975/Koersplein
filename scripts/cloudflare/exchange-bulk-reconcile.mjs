// Exchange-first daily bar reconciliation. Pure/read-only; does not write production data.
export function normalizeBulkBars(rows,{date}={}){
 if(!Array.isArray(rows))throw Error('Expected exchange bulk rows');
 const map=new Map(),errors=[],duplicates=new Set();
 for(const [index,row] of rows.entries()){
  const symbol=String(row.code||row.Code||'').trim().toUpperCase();
  const day=String(row.date||row.Date||'').slice(0,10);
  const nums=['open','high','low','close'].map(k=>{const v=row[k]??row[k[0].toUpperCase()+k.slice(1)];return v===null||v===undefined||v===''?NaN:Number(v);});
  const rawVolume=row.volume??row.Volume;
  const volume=rawVolume===null||rawVolume===undefined||rawVolume===''?NaN:Number(rawVolume);
  if(!symbol||!/^\d{4}-\d{2}-\d{2}$/.test(day)||nums.some(n=>!Number.isFinite(n)||n<=0)||nums[1]<Math.max(nums[0],nums[3],nums[2])||nums[2]>Math.min(nums[0],nums[3],nums[1])||!Number.isFinite(volume)||volume<0){
   errors.push({index,symbol,reason:'INVALID_OHLCV'});continue;
  }
  if(date&&day!==date){errors.push({index,symbol,reason:'WRONG_TRADING_DATE',day});continue;}
  const key=symbol+'|'+day;
  if(map.has(key)||duplicates.has(key)){errors.push({index,symbol,reason:'DUPLICATE_SYMBOL_DAY'});map.delete(key);duplicates.add(key);continue;}
  map.set(key,{symbol,date:day,open:nums[0],high:nums[1],low:nums[2],close:nums[3],volume});
 }
 return {bars:[...map.values()],errors};
}
export function reconcileBulkWithCatalog({catalog,providerListings,bulkBars}){
 const listingByCode=new Map(),ambiguousCodes=new Set();
 for(const listing of providerListings){
  const code=String(listing.Code||listing.code||'').trim().toUpperCase();
  const isin=String(listing.Isin||listing.ISIN||listing.isin||'').trim().toUpperCase();
  if(!code||!isin)continue;
  const prior=listingByCode.get(code);
  if(prior&&prior!==isin)ambiguousCodes.add(code);
  listingByCode.set(code,isin);
 }
 const byIsin=new Map(),ambiguousIsins=new Set();
 for(const [code,isin] of listingByCode){
  if(ambiguousCodes.has(code))continue;
  if(byIsin.has(isin))ambiguousIsins.add(isin);
  else byIsin.set(isin,code);
 }
 const bars=new Map(bulkBars.map(b=>[b.symbol,b]));
 const matched=[],missing=[],ambiguous=[];
 for(const item of catalog){
  const isin=String(item.isin||'').toUpperCase();
  if(ambiguousIsins.has(isin)){ambiguous.push({isin,reason:'MULTIPLE_PROVIDER_CODES'});continue;}
  const code=byIsin.get(isin);
  if(!code){missing.push({isin,reason:'NO_ISIN_MATCH'});continue;}
  const bar=bars.get(code);
  if(!bar){missing.push({isin,code,reason:'NO_BULK_BAR'});continue;}
  matched.push({isin,mic:item.mic,code,...bar});
 }
 return {matched,missing,ambiguous,providerBars:bulkBars.length};
}
