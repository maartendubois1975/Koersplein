export const approvedMarkets=new Set();
let contractsPromise;
export async function browserCatalog(mic,fallback,load){
 const contracts=await (contractsPromise??=load('data/company-register-contracts.json').catch(e=>{contractsPromise=null;throw e}));
 for(const key of Object.keys(contracts.markets))approvedMarkets.add(key);
 if(!approvedMarkets.has(mic))return load(fallback);
 const contract=contracts.markets[mic];
 const catalog=await load('data/'+contract.file);
 if(catalog.shares.length!==contract.expectedCount)throw Error('Bedrijvenregister onvolledig');
 return catalog;
}
export function listingIdentity(share,parentMic){
 const mic=share.primaryMic||share.mic||parentMic;
 return {isin:share.isin,mic,symbol:share.symbol||share.ticker,name:share.name||share.company,storageKey:mic+':'+share.isin};
}
export function validSessionDate(date){
 return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
}
export function dailyHistoryPath(share,parentMic){return 'data/history/'+encodeURIComponent(listingIdentity(share,parentMic).storageKey)+'.json';}
export function dailyRow(snapshot,share,mic){
 if(!validSessionDate(snapshot?.session)||snapshot.market!==mic)return null;
 const row=snapshot?.results?.find(x=>x.isin===share.isin&&x.symbol===(share.symbol||share.ticker)&&x.mic===(share.primaryMic||share.mic||mic));
 const b=row?.bar;
 if(row?.status!=='TRADED'||!b||b.date!==snapshot.session||![b.open,b.high,b.low,b.close,b.volume].every(x=>Number.isFinite(x)&&x>0)||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||b.high<b.low)return null;
 return b;
}
export function dailyState(snapshot,share,mic){
 if(!validSessionDate(snapshot?.session)||snapshot.market!==mic)return null;
 const row=snapshot.results?.find(r=>r.isin===share.isin&&r.symbol===(share.symbol||share.ticker)&&r.mic===(share.primaryMic||share.mic||mic));
 if(!row)return null;
 return {...row,status:row.status==='TRADED'&&!dailyRow(snapshot,share,mic)?'SESSION_UNVERIFIED':row.status,date:snapshot.session};
}
export function dailyStateLabel(row){
 if(row?.status==='TRADED')return 'Geldige koers';
 if(row?.status==='NO_TRADES')return 'Geen handel (officieel)';
 if(row?.status==='MARKET_CLOSED')return 'Beurs gesloten';
 if(row?.reasonCode==='IDENTITY_CHANGED')return 'ISIN gewijzigd — verificatie nodig';
 return 'Koers niet bevestigd';
}
