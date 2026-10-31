import { renderHistoryChart, validateHistoryDocument, periodStartDate } from './chart.js';
import { manifestResolver } from './market-week-core.mjs';
import { assessPeriod, latestCloseChange } from './scripts/research/amsterdam-period-quality.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const params=new URLSearchParams(location.search),isin=params.get('isin'),requestedMic=params.get('mic'),requestedSymbol=params.get('symbol'),detail=document.querySelector('#share-detail'),historyState=document.querySelector('#history-state');
const load=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()};
const fail=m=>{historyState.className='history-empty';historyState.innerHTML=`<strong>Historie tijdelijk niet beschikbaar</strong><p>${esc(m)}.</p>`;document.querySelector('#history-range').textContent='—'};
load('data/euronext-amsterdam.json').then(async catalog=>{
 const shares=catalog.shares||[];
 const share=shares.find(x=>x.isin===isin&&(!requestedMic||requestedMic==='XAMS')&&(!requestedSymbol||x.symbol===requestedSymbol));
 if(!share)throw Error('Aandeel niet gevonden in Amsterdam');
 const market={id:'amsterdam',mic:'XAMS',name:'Amsterdam',currency:'EUR'};
 const mic='XAMS',back='amsterdam.html';
 document.title=`${share.name} — Koersplein`;document.querySelector('#crumb-share').textContent=share.name;
 const crumbs=document.querySelector('.breadcrumbs');const links=crumbs?.querySelectorAll('a');if(links?.[2]){links[2].href=back;links[2].textContent=market.name}
 const backLink=document.querySelector('.back-link');backLink.href=back;backLink.textContent=`← ${market.name}`;
 detail.innerHTML=`<div><p class="eyebrow">Europa · ${esc(market.name)} · ${esc(mic)}</p><h1>${esc(share.name)}</h1><div class="identity-line"><span class="ticker">${esc(share.symbol||share.ticker)}</span><span>${esc(share.isin)}</span><span>${esc(mic)}</span></div></div><div class="latest-price"><span>Laatste koers</span><strong>—</strong><small>Historie wordt geladen</small></div>`;
 try{
  let h,storageId;
  const manifest=await load('data/amsterdam-history-manifest.json');
  storageId=manifestResolver(manifest,mic)(share);
  if(!storageId)throw Error('Geen gevalideerde Amsterdamse koershistorie');
  h=await load('data/history/'+encodeURIComponent(storageId)+'.json');
  if(h.coverage?.recordCount!=null&&h.coverage.records==null)h.coverage.records=h.coverage.recordCount;
  const bars=validateHistoryDocument(h,{...share,isin:storageId,mic,symbol:share.symbol||share.ticker}),first=bars[0],last=bars.at(-1),currency=h.instrument?.currency||market.currency||'EUR';
  document.querySelector('#history-range').textContent=`${first.date} — ${last.date}`;renderHistoryChart(historyState,bars,{currency});
  let amsterdamQuality=null;
  if(mic==='XAMS'){
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
   explain();
   historyState.querySelector('.periods')?.addEventListener('click',()=>queueMicrotask(explain));
  }
  const p=document.createElement('p');p.className='history-source';p.textContent=`${bars.length.toLocaleString('nl-NL')} opgeslagen dagrecords (structurele broncontrole) · ${first.date} t/m ${last.date}`;historyState.append(p);
  const previous=bars.length>1?bars.at(-2):null;
  // Suppress a latest close-to-close percentage if a discontinuity is not verified.
  const change=mic==='XAMS'?latestCloseChange(bars,amsterdamQuality):{percent:previous?.close>0?(last.close/previous.close-1)*100:null,reason:null};
  const lastDiscontinuity=Boolean(change.reason);
  const delta=change.percent;
  const deltaText=delta===null?'—':new Intl.NumberFormat('nl-NL',{signDisplay:'always',minimumFractionDigits:2,maximumFractionDigits:2}).format(delta)+'%';
  const deltaColor=delta===null?'':delta>=0?'#3fc98c':'#ee6677';
  detail.querySelector('.latest-price').innerHTML=`<span>Laatste slotkoers</span><strong>${Number(last.close).toLocaleString('nl-NL',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2})}</strong><span style="color:${deltaColor};font-weight:700">${esc(deltaText)} t.o.v. vorig slot${lastDiscontinuity?' · koerssprong of historiegat niet geverifieerd':''}</span><small>${esc(last.date)} · historie vanaf ${esc(first.date)}</small>`;
 }catch(e){fail(e.message)}
}).catch(e=>{detail.innerHTML=`<div><p class="eyebrow">Niet beschikbaar</p><h1>${esc(e.message)}</h1></div>`;fail('Aandeelgegevens konden niet worden geladen')});
