import { renderHistoryChart, validateHistoryDocument } from './chart.js';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const isin=new URLSearchParams(location.search).get('isin'),detail=document.querySelector('#share-detail'),historyState=document.querySelector('#history-state');
const load=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()};
const optional=async url=>{try{return await load(url)}catch{return null}};
const fail=m=>{historyState.className='history-empty';historyState.innerHTML=`<strong>Historie tijdelijk niet beschikbaar</strong><p>${esc(m)}.</p>`;document.querySelector('#history-range').textContent='—'};
Promise.all([
 optional('data/euronext-amsterdam.json'),optional('data/euronext-brussels.json'),optional('data/euronext-paris.json'),optional('data/euronext-oslo.json'),
 load('data/runtime-config.json').catch(()=>({apiBaseUrl:''}))
]).then(async ([ams,bru,par,osl,runtime])=>{
 const catalogs=[
  {data:ams,venue:'Amsterdam',defaultMic:'XAMS',back:'index.html#amsterdam'},
  {data:bru,venue:'Brussel',defaultMic:'XBRU',back:'brussel.html'},
  {data:par,venue:'Parijs',defaultMic:'XPAR',back:'parijs.html'},
  {data:osl,venue:'Oslo',defaultMic:'XOSL',back:'oslo.html'}
 ].filter(x=>x.data);
 let found=null;
 for(const cat of catalogs){const s=(cat.data.shares||[]).find(x=>x.isin===isin);if(s){found={...cat,share:s};break}}
 if(!found)throw Error('Aandeel niet gevonden');
 const {share,venue,defaultMic,back}=found,mic=share.mic||defaultMic;
 document.title=`${share.name} — Koersplein`;document.querySelector('#crumb-share').textContent=share.name;
 const backLink=document.querySelector('.back-link');backLink.href=back;backLink.textContent=`← ${venue}`;
 detail.innerHTML=`<div><p class="eyebrow">Euronext ${esc(venue)} · ${esc(mic)}</p><h1>${esc(share.name)}</h1><div class="identity-line"><span class="ticker">${esc(share.symbol)}</span><span>${esc(share.isin)}</span><span>${esc(mic)}</span></div></div><div class="latest-price"><span>Laatste koers</span><strong>—</strong><small>Historie wordt geladen</small></div>`;
 try{
  const api=String(runtime.apiBaseUrl||'').replace(/\/$/,'');if(!api)throw Error('Koersplein API is niet geconfigureerd');
  const h=await load(`${api}/api/history/${encodeURIComponent(share.isin)}`);
  if(h.coverage?.recordCount!=null&&h.coverage.records==null)h.coverage.records=h.coverage.recordCount;
  const bars=validateHistoryDocument(h,share),first=bars[0],last=bars.at(-1),currency=h.instrument?.currency||'EUR';
  document.querySelector('#history-range').textContent=`${first.date} — ${last.date}`;
  renderHistoryChart(historyState,bars,{currency});
  const p=document.createElement('p');p.className='history-source';p.textContent=`${bars.length.toLocaleString('nl-NL')} gevalideerde dagrecords · ${first.date} t/m ${last.date}`;historyState.append(p);
  detail.querySelector('.latest-price').innerHTML=`<span>Laatste slotkoers</span><strong>${Number(last.close).toLocaleString('nl-NL',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small>${esc(last.date)} · historie vanaf ${esc(first.date)}</small>`;
 }catch(e){fail(e.message)}
}).catch(e=>{detail.innerHTML=`<div><p class="eyebrow">Niet beschikbaar</p><h1>${esc(e.message)}</h1></div>`;fail('Aandeelgegevens konden niet worden geladen')});
