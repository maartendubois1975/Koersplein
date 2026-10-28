import { renderHistoryChart, validateHistoryDocument } from './chart.js';
import { manifestResolver } from './market-week-core.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const params=new URLSearchParams(location.search),isin=params.get('isin'),requestedMic=params.get('mic'),requestedSymbol=params.get('symbol'),detail=document.querySelector('#share-detail'),historyState=document.querySelector('#history-state');
const load=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()};
const fail=m=>{historyState.className='history-empty';historyState.innerHTML=`<strong>Historie tijdelijk niet beschikbaar</strong><p>${esc(m)}.</p>`;document.querySelector('#history-range').textContent='—'};
Promise.all([load('data/markets.json'),load('data/runtime-config.json').catch(()=>({apiBaseUrl:''}))]).then(async([venues,runtime])=>{
 const venue=venues.venues.find(v=>v.id==='euronext');if(!venue)throw Error('Europese markten niet gevonden');
 let found=null;
 for(const market of venue.markets.filter(m=>m.status==='available'&&m.sharesData)){
  try{const data=await load('data/'+market.sharesData),shares=Array.isArray(data)?data:(data.shares||[]),share=shares.find(x=>x.isin===isin&&(!requestedMic||String(x.mic||market.mic).toUpperCase()===requestedMic.toUpperCase())&&(!requestedSymbol||String(x.symbol||x.ticker).toUpperCase()===requestedSymbol.toUpperCase()));if(share){found={market,share};break}}catch{}
 }
 if(!found)throw Error('Aandeel niet gevonden');
 const {market,share}=found,mic=share.mic||market.mic;const legacyPages={amsterdam:'amsterdam.html',brussels:'brussel.html',paris:'parijs.html',milan:'milaan.html',oslo:'oslo.html',lisbon:'lissabon.html',zurich:'zurich.html',stockholm:'stockholm.html'};const back=legacyPages[market.id]||`market.html?market=${encodeURIComponent(market.slug||market.id)}`;
 document.title=`${share.name} — Koersplein`;document.querySelector('#crumb-share').textContent=share.name;
 const crumbs=document.querySelector('.breadcrumbs');const links=crumbs?.querySelectorAll('a');if(links?.[2]){links[2].href=back;links[2].textContent=market.name}
 const backLink=document.querySelector('.back-link');backLink.href=back;backLink.textContent=`← ${market.name}`;
 detail.innerHTML=`<div><p class="eyebrow">Europa · ${esc(market.name)} · ${esc(mic)}</p><h1>${esc(share.name)}</h1><div class="identity-line"><span class="ticker">${esc(share.symbol||share.ticker)}</span><span>${esc(share.isin)}</span><span>${esc(mic)}</span></div></div><div class="latest-price"><span>Laatste koers</span><strong>—</strong><small>Historie wordt geladen</small></div>`;
 try{
  let h,storageId;
  if(mic==='XAMS'){
   const manifest=await load('data/amsterdam-history-manifest.json');
   storageId=manifestResolver(manifest,mic)(share);
   if(!storageId)throw Error('Geen gevalideerde Amsterdamse koershistorie');
   h=await load('data/history/'+encodeURIComponent(storageId)+'.json');
  }else{
   const api=String(runtime.apiBaseUrl||'').replace(/\\/$/,'');
   if(!api)throw Error('Koersplein API is niet geconfigureerd');
   const manifest=await load(api+'/api/history/manifest.json');
   storageId=manifestResolver(manifest,mic)(share);
   if(!storageId)throw Error('Geen gevalideerde historie voor deze beursnotering');
   h=await load(`${api}/api/history/${encodeURIComponent(storageId).replace(/%3A/gi,':')}`);
  }
  if(h.coverage?.recordCount!=null&&h.coverage.records==null)h.coverage.records=h.coverage.recordCount;
  const bars=validateHistoryDocument(h,{...share,isin:storageId,mic,symbol:share.symbol||share.ticker}),first=bars[0],last=bars.at(-1),currency=h.instrument?.currency||market.currency||'EUR';
  document.querySelector('#history-range').textContent=`${first.date} — ${last.date}`;renderHistoryChart(historyState,bars,{currency});
  const p=document.createElement('p');p.className='history-source';p.textContent=`${bars.length.toLocaleString('nl-NL')} gevalideerde dagrecords · ${first.date} t/m ${last.date}`;historyState.append(p);
  detail.querySelector('.latest-price').innerHTML=`<span>Laatste slotkoers</span><strong>${Number(last.close).toLocaleString('nl-NL',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small>${esc(last.date)} · historie vanaf ${esc(first.date)}</small>`;
 }catch(e){fail(e.message)}
}).catch(e=>{detail.innerHTML=`<div><p class="eyebrow">Niet beschikbaar</p><h1>${esc(e.message)}</h1></div>`;fail('Aandeelgegevens konden niet worden geladen')});
