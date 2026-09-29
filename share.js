import { renderHistoryChart, validateHistoryDocument } from './chart.js';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const isin=new URLSearchParams(location.search).get('isin'),detail=document.querySelector('#share-detail'),historyState=document.querySelector('#history-state');
const load=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()};
const fail=m=>{historyState.className='history-empty';historyState.innerHTML=`<strong>Historie tijdelijk niet beschikbaar</strong><p>${esc(m)}.</p>`;document.querySelector('#history-range').textContent='—'};
Promise.all([load('data/markets.json'),load('data/runtime-config.json').catch(()=>({apiBaseUrl:''}))]).then(async([venues,runtime])=>{
 const venue=venues.venues.find(v=>v.id==='euronext');if(!venue)throw Error('Europese markten niet gevonden');
 let found=null;
 for(const market of venue.markets.filter(m=>m.status==='available'&&m.sharesData)){
  try{const data=await load('data/'+market.sharesData),shares=Array.isArray(data)?data:(data.shares||[]),share=shares.find(x=>x.isin===isin);if(share){found={market,share};break}}catch{}
 }
 if(!found)throw Error('Aandeel niet gevonden');
 const {market,share}=found,mic=share.mic||market.mic,back=market.id==='amsterdam'?'amsterdam.html':market.slug+'.html';
 document.title=`${share.name} — Koersplein`;document.querySelector('#crumb-share').textContent=share.name;
 const crumbs=document.querySelector('.breadcrumbs');const links=crumbs?.querySelectorAll('a');if(links?.[2]){links[2].href=back;links[2].textContent=market.name}
 const backLink=document.querySelector('.back-link');backLink.href=back;backLink.textContent=`← ${market.name}`;
 detail.innerHTML=`<div><p class="eyebrow">Europa · ${esc(market.name)} · ${esc(mic)}</p><h1>${esc(share.name)}</h1><div class="identity-line"><span class="ticker">${esc(share.symbol||share.ticker)}</span><span>${esc(share.isin)}</span><span>${esc(mic)}</span></div></div><div class="latest-price"><span>Laatste koers</span><strong>—</strong><small>Historie wordt geladen</small></div>`;
 try{
  const api=String(runtime.apiBaseUrl||'').replace(/\/$/,'');if(!api)throw Error('Koersplein API is niet geconfigureerd');
  const h=await load(`${api}/api/history/${encodeURIComponent(share.isin)}`);
  if(h.coverage?.recordCount!=null&&h.coverage.records==null)h.coverage.records=h.coverage.recordCount;
  const bars=validateHistoryDocument(h,share),first=bars[0],last=bars.at(-1),currency=h.instrument?.currency||market.currency||'EUR';
  document.querySelector('#history-range').textContent=`${first.date} — ${last.date}`;renderHistoryChart(historyState,bars,{currency});
  const p=document.createElement('p');p.className='history-source';p.textContent=`${bars.length.toLocaleString('nl-NL')} gevalideerde dagrecords · ${first.date} t/m ${last.date}`;historyState.append(p);
  detail.querySelector('.latest-price').innerHTML=`<span>Laatste slotkoers</span><strong>${Number(last.close).toLocaleString('nl-NL',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small>${esc(last.date)} · historie vanaf ${esc(first.date)}</small>`;
 }catch(e){fail(e.message)}
}).catch(e=>{detail.innerHTML=`<div><p class="eyebrow">Niet beschikbaar</p><h1>${esc(e.message)}</h1></div>`;fail('Aandeelgegevens konden niet worden geladen')});
