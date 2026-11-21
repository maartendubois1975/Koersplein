export const approvedMarkets=new Set();
let contractsPromise;
export async function browserCatalog(mic,fallback,load){
 const contracts=await (contractsPromise??=load('data/company-register-contracts.json').catch(e=>{contractsPromise=null;throw e}));
 for(const key of Object.keys(contracts.markets))approvedMarkets.add(key);
 if(!approvedMarkets.has(mic))return load(fallback);
 const contract=contracts.markets[mic];
 const catalog=await load('data/'+contract.file);
 if(catalog.shares.length!==contract.expectedCount)throw Error('Bedrijvenregister onvolledig');
 const resolved=catalogWithListingEvents(catalog,(await load('data/instrument-events.json')).events);
 return {...resolved,shares:resolved.shares.map(share=>share.currentListing?.status==='VERIFIED_SUCCESSOR'?{...share,...listingIdentity(share,mic),primaryMic:listingIdentity(share,mic).mic,companyIsin:share.isin,previousListing:{...share,currentListing:undefined}}:share)};
}
export function catalogWithListingEvents(catalog,events){
 return {...catalog,shares:catalog.shares.map(share=>{
  const event=events?.find(e=>e.oldIsin===share.isin&&e.successorStatus==='VERIFIED_SUCCESSOR');
  if(!event)return share;
  if(!validSessionDate(event.activeFromSession)||event.activeFromSession<event.effectiveDate||event.activeFromSession>event.successorVerifiedThrough)throw Error('Opvolgende notering is niet volledig geverifieerd');
  return {...share,currentListing:{status:event.successorStatus,isin:event.newIsin,mic:event.mic,symbol:event.symbol,effectiveDate:event.effectiveDate,activeFromSession:event.activeFromSession}};
 })};
}
export function listingIdentity(share,parentMic,session=new Date().toISOString().slice(0,10)){
 const active=share.currentListing?.status==='VERIFIED_SUCCESSOR'&&session>=share.currentListing.activeFromSession?share.currentListing:null;
 const mic=active?.mic||share.primaryMic||share.mic||parentMic,isin=active?.isin||share.isin,symbol=active?.symbol||share.symbol||share.ticker;
 return {isin,mic,symbol,name:share.name||share.company,storageKey:mic+':'+isin};
}
export function listingForRequest(share,parentMic,request){
 const selected=share.isin===request.isin?share:share.previousListing?.isin===request.isin?{...share.previousListing,historicalListing:true,successorListing:share.currentListing}:null;
 if(!selected)return null;
 if(request.mic&&String(selected.primaryMic||selected.mic||parentMic).toUpperCase()!==request.mic.toUpperCase())return null;
 if(request.symbol&&String(selected.symbol||selected.ticker).toUpperCase()!==request.symbol.toUpperCase())return null;
 return selected;
}
export function validSessionDate(date){
 return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
}
export function dailyHistoryPath(share,parentMic){return 'data/history/'+encodeURIComponent(listingIdentity(share,parentMic).storageKey)+'.json';}
export function dailyRow(snapshot,share,mic){
 if(!share||!validSessionDate(snapshot?.session)||snapshot.market!==mic)return null;
 const identity=listingIdentity(share,mic,snapshot.session);
 const row=snapshot?.results?.find(x=>x.isin===identity.isin&&x.symbol===identity.symbol&&x.mic===identity.mic);
 const b=row?.bar;
 if(row?.status!=='TRADED'||!b||b.date!==snapshot.session||![b.open,b.high,b.low,b.close,b.volume].every(x=>Number.isFinite(x)&&x>0)||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||b.high<b.low)return null;
 return b;
}
export function dailyState(snapshot,share,mic){
 if(!share||!validSessionDate(snapshot?.session)||snapshot.market!==mic)return null;
 const identity=listingIdentity(share,mic,snapshot.session);
 const row=snapshot.results?.find(r=>r.isin===identity.isin&&r.symbol===identity.symbol&&r.mic===identity.mic);
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
