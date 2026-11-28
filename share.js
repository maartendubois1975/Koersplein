import {approvedMarkets,browserCatalog,browserMarkets,dailyRow,dailyHistoryPath,dailyState,dailyStateLabel,listingForRequest,previousConfirmedBar,historyAvailability,historyAvailabilityText} from './daily-session-view.mjs';
import { renderHistoryChart, validateHistoryDocument, periodStartDate, mergeChartHistoryBars, tradedHistoryRows } from './chart.js';
import { manifestResolver } from './market-week-core.mjs';
import { assessPeriod, latestCloseChange } from './scripts/research/amsterdam-period-quality.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const params=new URLSearchParams(location.search),isin=params.get('isin'),requestedMic=params.get('mic'),requestedSymbol=params.get('symbol'),detail=document.querySelector('#share-detail'),historyState=document.querySelector('#history-state');
const load=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()};
const fail=(m,title='Historie tijdelijk niet beschikbaar')=>{historyState.className='history-empty';historyState.innerHTML=`<strong>${esc(title)}</strong><p>${esc(m)}</p>`;document.querySelector('#history-range').textContent='—'};
Promise.all([load('data/markets.json'),load('data/runtime-config.json').catch(()=>({apiBaseUrl:''}))]).then(async([venues,runtime])=>{
 const venue=venues.venues.find(v=>v.id==='euronext');if(!venue)throw Error('Europese markten niet gevonden');
 let found=null;
 for(const market of (await browserMarkets(venue.markets,load)).filter(m=>m.status==='available'&&m.sharesData)){
  try{const data=await browserCatalog(market.mic,'data/'+market.sharesData,load),shares=Array.isArray(data)?data:(data.shares||[]),share=shares.map(x=>listingForRequest(x,market.mic,{isin,mic:requestedMic,symbol:requestedSymbol})).find(Boolean);if(share){found={market,share,catalogPreview:data.catalogPreview};break}}catch(error){console.warn('CATALOG_UNAVAILABLE',market.mic,error.message);}
 }
 if(!found)throw Error('Aandeel niet gevonden');
 const {market,share,catalogPreview}=found,mic=share.primaryMic||share.mic||market.mic;const back=`market.html?market=${encodeURIComponent(market.id)}`;
 document.title=`${share.name} — Koersplein`;document.querySelector('#crumb-share').textContent=share.name;
 const crumbs=document.querySelector('.breadcrumbs');const links=crumbs?.querySelectorAll('a');if(links?.[2]){links[2].href=back;links[2].textContent=market.name}
 const backLink=document.querySelector('.back-link');backLink.href=back;backLink.textContent=`← ${market.name}`;
 const successor=share.historicalListing?share.successorListing:null;
 const previous=share.previousListing;
 const related=successor||previous;
 const listingNote=related?`<p class="history-source">${successor?'Historische notering. De opvolgende notering heeft een aparte koersreeks.':'Nieuwe ISIN. Oudere koersen staan in een aparte historische reeks.'} <a href="share.html?isin=${encodeURIComponent(related.isin)}&mic=${encodeURIComponent(related.mic||related.primaryMic||mic)}&symbol=${encodeURIComponent(related.symbol||related.ticker)}">${esc(related.isin)}</a></p>`:'';
 detail.innerHTML=`<div><p class="eyebrow">Europa · ${esc(market.name)} · ${esc(mic)}</p><h1>${esc(share.name)}</h1><div class="identity-line"><span class="ticker">${esc(share.symbol||share.ticker)}</span><span>${esc(share.isin)}</span><span>${esc(mic)}</span></div>${listingNote}</div><div class="latest-price"><span>Laatste koers</span><strong>—</strong><small>Historie wordt geladen</small></div>`;
 if(catalogPreview){
  detail.querySelector('.latest-price').innerHTML='<span>Koersdata in voorbereiding</span><strong>—</strong>';
  historyState.className='history-empty';
  historyState.textContent='Koershistorie in voorbereiding.';
  document.querySelector('#history-range').textContent='—';
  return;
 }
 let current=null,currentState=null;
 if(approvedMarkets.has(market.mic)){try{const snap=await load('data/daily-session-'+market.mic+'.json');currentState=dailyState(snap,share,market.mic);current=dailyRow(snap,share,market.mic);if(current){const fmt=n=>n.toLocaleString('nl-NL',{style:'currency',currency:share.currency||market.currency||'EUR'});detail.querySelector('.latest-price').innerHTML='<span>Opening / slot</span><strong>'+fmt(current.open)+' / '+fmt(current.close)+'</strong><small>'+esc(current.date)+'</small>';}}catch{}}
 const lastConfirmed=previousConfirmedBar(currentState);
 if(currentState&&!current){
  const savedClose=lastConfirmed?.close.toLocaleString('nl-NL',{style:'currency',currency:share.currency||market.currency||'EUR'});
  detail.querySelector('.latest-price').innerHTML='<span>Handelsdag '+esc(currentState.date)+' · '+esc(dailyStateLabel(currentState))+'</span>'+
   (lastConfirmed?'<strong>'+esc(savedClose)+'</strong><small>Laatst bevestigd slot · '+esc(lastConfirmed.date)+'</small>':
    '<small>Geen bevestigde opening of slot voor deze dag</small>');
 }
 try{
  let h,storageId,dailyHistory=null,resolvedSourceDays=0;
  try{dailyHistory=await load(dailyHistoryPath(share,market.mic));}catch(error){if(!String(error.message).includes('HTTP 404'))throw error;}
  try{
   if(mic==='XAMS'){
    const manifest=await load('data/amsterdam-history-manifest.json');
    storageId=manifestResolver(manifest,mic)(share);
    if(!storageId)throw Error('Geen gevalideerde historische opslagidentiteit');
    h=await load('data/history/'+encodeURIComponent(storageId)+'.json');
   }else{
    if(location.hostname==='koersplein-test.onrender.com'&&approvedMarkets.has(market.mic)){
     // The isolated Render build publishes public, identity-checked history on its own origin.
     storageId=share.isin;
     h=await load(dailyHistoryPath(share,market.mic).replace('/history/','/test-history/'));
    }else{
     const api=String(runtime.apiBaseUrl||'').replace(/\/$/,'');
     if(!api)throw Error('Koersplein API is niet geconfigureerd');
     const manifest=await load(api+'/api/history/manifest.json');
     storageId=manifestResolver(manifest,mic)(share);
     if(!storageId)throw Error('Geen gevalideerde historie voor deze beursnotering');
     h=await load(`${api}/api/history/${encodeURIComponent(storageId).replace(/%3A/gi,':')}`);
    }
   }
  }catch(error){
   if(!dailyHistory)throw error;
   console.warn('LEGACY_HISTORY_UNAVAILABLE',error.message);h=dailyHistory;storageId=share.isin;
  }
  if(dailyHistory&&h!==dailyHistory){
   // Merge the new daily tail with the verified legacy identity; a short tail must not hide old history.
   if(h.coverage?.recordCount!=null&&h.coverage.records==null)h.coverage.records=h.coverage.recordCount;
   const oldBars=validateHistoryDocument(h,{...share,isin:storageId,mic,symbol:share.symbol||share.ticker});
   const tail=validateHistoryDocument(dailyHistory,{...share,mic,symbol:share.symbol||share.ticker});
   const reviews=await load('data/history-chart-resolutions.json').catch(()=>null);
   const review=reviews?.schemaVersion===1?reviews.instruments?.[mic+':'+share.isin]:null;
   const merged=mergeChartHistoryBars(oldBars,tail,{identity:{isin:share.isin,mic,symbol:share.symbol||share.ticker},review,onResolution:()=>resolvedSourceDays++});
   h={...h,bars:merged,coverage:{...h.coverage,records:merged.length,firstDate:merged[0].date,lastDate:merged.at(-1).date}};
  }
  if(h.coverage?.recordCount!=null&&h.coverage.records==null)h.coverage.records=h.coverage.recordCount;
  const validated=validateHistoryDocument(h,{...share,isin:storageId,mic,symbol:share.symbol||share.ticker});
  const executed=tradedHistoryRows(h.bars),dates=new Set(executed.bars.map(bar=>bar.date));
  const bars=validated.filter(bar=>dates.has(bar.date));
  if(!bars.length)throw Error('De opgeslagen reeks bevat geen complete handelsdagen met positief volume');
  const first=bars[0],last=bars.at(-1),currency=h.instrument?.currency||market.currency||'EUR';
  document.querySelector('#history-range').textContent=`${first.date} — ${last.date}`;renderHistoryChart(historyState,bars,{currency});
  let amsterdamQuality=null;
  {
   // Assess the exact displayed bars; no stale or separately published audit file.
   // A structural diagnostic is not independent price or total-return verification.
   const quality=assessPeriod(bars);
   amsterdamQuality=quality;
   const warning=document.createElement('p');
   warning.className='history-source';
   warning.setAttribute('role','status');
   const explain=()=>{
    const selected=historyState.dataset.period||'MAX';
    const from=periodStartDate(last.date,selected)||first.date;
    const flagged=(quality?.issues||[]).filter(issue=>issue.date>=from&&issue.date<=last.date);
    warning.textContent=`Bronkoersen (geen gevalideerd totaalrendement). ${flagged.length} structurele waarschuwingen in deze periode (grote sprongen, lange gaten of ongeldige records). Aandelensplitsingen, dividenden en oude bedrijfsidentiteiten zijn niet onafhankelijk geverifieerd; grafiek niet gebruiken als bewezen beleggingsrendement.`;
   };
   historyState.append(warning);
   if(resolvedSourceDays){const sourceNote=document.createElement('p');sourceNote.className='history-source';sourceNote.textContent=`${resolvedSourceDays} bronverschillen beoordeeld met officiële ongecorrigeerde koersen. Eerdere bronwaarnemingen blijven bewaard; dit is geen totaalrendementsreeks.`;historyState.append(sourceNote);}
   explain();
   historyState.querySelector('.periods')?.addEventListener('click',()=>queueMicrotask(explain));
  }
  const p=document.createElement('p');p.className='history-source';p.textContent=`${bars.length.toLocaleString('nl-NL')} opgeslagen dagrecords (structurele broncontrole) · ${first.date} t/m ${last.date}`;historyState.append(p);
  if(executed.excluded){const note=document.createElement('p');note.className='history-source';note.textContent=`${executed.excluded.toLocaleString('nl-NL')} referentie- of onvolledige bronregels niet als handelsdagen getekend. De oorspronkelijke brongegevens blijven bewaard.`;historyState.append(note);}
  const previous=bars.length>1?bars.at(-2):null;
  // Suppress a latest close-to-close percentage if a discontinuity is not verified.
  const change=latestCloseChange(bars,amsterdamQuality);
  const lastDiscontinuity=Boolean(change.reason);
  const delta=change.percent;
  const deltaText=delta===null?'—':new Intl.NumberFormat('nl-NL',{signDisplay:'always',minimumFractionDigits:2,maximumFractionDigits:2}).format(delta)+'%';
  const deltaColor=delta===null?'':delta>=0?'#3fc98c':'#ee6677';
  if(!current&&(!lastConfirmed||last.date>lastConfirmed.date))detail.querySelector('.latest-price').innerHTML=`<span>${esc(share.historicalListing?'Historische notering':dailyStateLabel(currentState))} · ${esc(currentState?.date||'')}</span><span>Laatst opgeslagen slot</span><strong>${Number(last.close).toLocaleString('nl-NL',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2})}</strong><span style="color:${deltaColor};font-weight:700">${esc(deltaText)} t.o.v. vorig slot${lastDiscontinuity?' · koerssprong of historiegat niet geverifieerd':''}</span><small>${esc(last.date)} · historie vanaf ${esc(first.date)}</small>`;
 }catch(e){
  const availability=market.mic==='XPAR'
   ? await load('data/history-availability.json').catch(()=>null) : null;
  const note=historyAvailabilityText(historyAvailability(availability,{isin:share.isin,mic,symbol:share.symbol||share.ticker}));
  if(note)fail(note,'Geen volledige koersgegevens gevonden');
  else {
   const retained=await load('data/retained-history-review.json').catch(()=>null);
   const review=retained?.companies?.find(row=>row.isin===share.isin&&row.mic===mic&&row.symbol===(share.symbol||share.ticker));
   if(review?.status==='NO_COMPLETE_RETAINED_TRADES')fail(`De bestaande opslag bevat ${review.rawRecords} bronregels, waarvan ${review.zeroVolumeRows} zonder verhandeld volume, en geen complete handelsdag. Een referentieprijs wordt niet als handelskoers getoond.`,'Geen bevestigde handelskoersen');
   else fail(e.message+'.');
  }
 }
}).catch(e=>{detail.innerHTML=`<div><p class="eyebrow">Niet beschikbaar</p><h1>${esc(e.message)}</h1></div>`;fail('Aandeelgegevens konden niet worden geladen')});
