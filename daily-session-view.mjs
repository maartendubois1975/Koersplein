export const approvedMarkets=new Set();
let contractsPromise;
const loadContracts=load=>(contractsPromise??=load('data/company-register-contracts.json').catch(e=>{contractsPromise=null;throw e}));
export async function browserMarkets(legacy,load){
 const contracts=await loadContracts(load);
 const reviewed=Object.entries(contracts.markets).flatMap(([mic,contract])=>contract.navigation
  ? [{...contract.navigation,mic,id:contract.navigation.code,status:'available',state:'COMPLETE',sharesData:contract.file}]
  : []);
 const byMic=new Map(legacy.map(market=>[market.mic,market]));
 for(const market of reviewed)byMic.set(market.mic,market);
 return [...byMic.values()];
}
export async function browserCatalog(mic,fallback,load){
 const contracts=await loadContracts(load);
 for(const key of Object.keys(contracts.markets))approvedMarkets.add(key);
 const contract=contracts.markets[mic]||contracts.catalogPreviews?.[mic];
 if(!contract)return load(fallback);
 const catalog=await load('data/'+contract.file);
 if(catalog.shares.length!==contract.expectedCount)throw Error('Bedrijvenregister onvolledig');
 if(!approvedMarkets.has(mic))return {...catalog,catalogPreview:true};
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
function validDailyBar(bar){
 return validSessionDate(bar?.date)&&[bar.open,bar.high,bar.low,bar.close,bar.volume].every(x=>Number.isFinite(x)&&x>0)&&
  bar.high>=Math.max(bar.open,bar.close)&&bar.low<=Math.min(bar.open,bar.close)&&bar.high>=bar.low;
}
export function previousConfirmedBar(state){
 const bar=state?.lastConfirmedBar;
 return validDailyBar(bar)&&bar.date<state.date?bar:null;
}
export function dailyRow(snapshot,share,mic){
 if(!share||!validSessionDate(snapshot?.session)||snapshot.market!==mic)return null;
 const identity=listingIdentity(share,mic,snapshot.session);
 const row=snapshot?.results?.find(x=>x.isin===identity.isin&&x.symbol===identity.symbol&&x.mic===identity.mic);
 const b=row?.bar;
 if(row?.status!=='TRADED'||!validDailyBar(b)||b.date!==snapshot.session)return null;
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

// A retrospective status decision is not knowledge available on its trade date.
// Keep the original observation usable for an explicitly earlier as-of query.
export function sessionSnapshotAt(snapshot, asOf) {
 const cutoff=new Date(asOf).getTime();if(!Number.isFinite(cutoff))throw Error('INVALID_SESSION_EVIDENCE_AS_OF');
 let changed=false;
 const results=snapshot.results.map(row=>{
  if(row.evidence?.scope!=='RETROSPECTIVE_SESSION_STATUS_ONLY')return row;
  const known=Date.parse(row.evidence.knownAt);
  if(!Number.isFinite(known)||known>cutoff){
   if(!row.priorUnverifiedEvidence)throw Error('RETROSPECTIVE_SESSION_ORIGINAL_MISSING');
   changed=true;return row.priorUnverifiedEvidence;
  }
  return row;
 });
 if(!changed)return snapshot;
 const counts={};for(const row of results)counts[row.status]=(counts[row.status]??0)+1;
 return {...snapshot,results,counts};
}

export function historyAvailability(document, identity) {
 const key=identity.mic+':'+identity.isin;
 const row=document?.schemaVersion===1?document.instruments?.[key]:null;
 if(!row||row.isin!==identity.isin||row.mic!==identity.mic||row.symbol!==identity.symbol||
    !validSessionDate(document.reviewedOn)||!validSessionDate(row.historyWindow?.startDate)||
    !validSessionDate(row.historyWindow?.endDate)||row.historyWindow.startDate>row.historyWindow.endDate||
    row.historyWindow.endDate>document.reviewedOn||(row.lastTradeDateReported!=null&&
     (!validSessionDate(row.lastTradeDateReported)||row.lastTradeDateReported>document.reviewedOn))||
    !Number.isSafeInteger(row.completeOhlcv)||row.completeOhlcv<0)return null;
 return {reviewedOn:document.reviewedOn,lastTradeDateReported:row.lastTradeDateReported,
   historyWindow:row.historyWindow,completeOhlcv:row.completeOhlcv};
}

export function historyAvailabilityText(review) {
 if(!review||review.completeOhlcv!==0)return null;
 const lastTrade=review.lastTradeDateReported
  ? ' De beurs vermeldde '+review.lastTradeDateReported+' als laatste transactiedatum.'
  : ' De beurs vermeldde geen laatste transactiedatum.';
 return 'De beursbron leverde bij de controle van '+review.reviewedOn+' geen volledige koersdag voor '+
  review.historyWindow.startDate+' t/m '+review.historyWindow.endDate+'.'+lastTrade;
}
