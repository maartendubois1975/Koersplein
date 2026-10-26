import {manifestResolver,validTradedBar,sessionChange,collectMarketWeek,AMSTERDAM_REFERENCE_WEEK,verifiedNoTradeStatus} from './market-week-core.mjs?v=20261026xams-retry1';
const q=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const code=new URLSearchParams(location.search).get('market');let shares=[],prices=new Map(),market=null,amsterdamWeek=null,noTradesAudit=null;
async function load(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
const fmt=(n,c)=>Number.isFinite(Number(n))?new Intl.NumberFormat('nl-NL',{style:'currency',currency:c||'EUR',maximumFractionDigits:4}).format(Number(n)):'—';

const fmtXams=n=>n===null||n===undefined||n===''?'—':fmt(n,'EUR');
// Amsterdam's historical reference week is a five-session table, not a latest-price
// snapshot. The same identity and OHLCV gates are used by the production audit.
function renderAmsterdamWeek(){
 const root=q('#share-groups');
 if(!amsterdamWeek){root.innerHTML='<p class="loading">Historische Amsterdamse handelsweek laden…</p>';return;}
 const dates=AMSTERDAM_REFERENCE_WEEK;
 const totals=Object.fromEntries(dates.map(date=>[date,{valid:0,noTrades:0,invalid:0,stale:0,missing:0}]));
 const classify=(row,date)=>{
  if(row.bars.has(date))return 'valid';
  // An explicitly audited NO_TRADES day takes precedence over an invalid
  // zero-volume reference candle: the candle is NOT an executed trade.
  if(verifiedNoTradeStatus(noTradesAudit,row.share,'XAMS',date,dates))return 'noTrades';
  if(row.conflicts.some(c=>c.date===date))return 'invalid';
  if(row.lastStoredDate&&row.lastStoredDate<date&&!row.error)return 'stale';
  return 'missing';
 };
 for(const row of amsterdamWeek.rows)for(const date of dates)totals[date][classify(row,date)]++;
 const search=(q('#search')?.value||'').toLocaleLowerCase('nl');
 const rows=amsterdamWeek.rows.filter(({share:x})=>!search||[x.name,x.company,x.symbol,x.ticker,x.isin].some(v=>String(v||'').toLocaleLowerCase('nl').includes(search)));
 const total=Object.values(totals).reduce((a,b)=>{for(const k of Object.keys(a))a[k]+=b[k];return a;},{valid:0,noTrades:0,invalid:0,stale:0,missing:0});
 q('#market-meta').textContent='EUR · XAMS · 19–23 oktober 2026 (afgesloten) · '+total.valid+'/'+(amsterdamWeek.rows.length*dates.length)+' echte koersdagen';
 const summary='<p class="muted">Historische handelsweek 19–23 oktober 2026. Geen handel is alleen vermeld met afzonderlijk gecontroleerd officieel bewijs. Onopgeloste dagen hebben geen fictieve openings- of slotkoers.</p>'+
 '<div class="table-wrap"><table><thead><tr><th>Datum</th><th>OHLCV</th><th>Geen handel</th><th>Ongeldig</th><th>Verouderd</th><th>Ontbreekt</th></tr></thead><tbody>'+
 dates.map(d=>'<tr><td>'+esc(d)+'</td><td>'+totals[d].valid+'</td><td>'+totals[d].noTrades+'</td><td>'+totals[d].invalid+'</td><td>'+totals[d].stale+'</td><td>'+totals[d].missing+'</td></tr>').join('')+
 '<tr><th>Totaal</th><th>'+total.valid+'</th><th>'+total.noTrades+'</th><th>'+total.invalid+'</th><th>'+total.stale+'</th><th>'+total.missing+'</th></tr></tbody></table></div>';
 const body=rows.flatMap(row=>dates.map(date=>{
  const x=row.share,bar=row.bars.get(date),type=classify(row,date),delta=bar?sessionChange(bar.open,bar.close):null;
  const label={valid:'Geldige koers',noTrades:'Geen handel (officieel)',invalid:'Ongeldige koers',stale:'Verouderde historie',missing:'Niet bevestigd'}[type];
  const change=delta?(delta.absolute>=0?'+':'')+delta.absolute.toFixed(2)+' EUR / '+(delta.percent>=0?'+':'')+delta.percent.toFixed(2)+'%':'—';
  return '<tr><td>'+esc(x.name||x.company)+'</td><td>'+esc(x.symbol||x.ticker)+'</td><td>'+esc(x.isin)+'</td><td>'+esc(date)+'</td><td>'+fmtXams(bar?.open)+'</td><td>'+fmtXams(bar?.close)+'</td><td>'+esc(change)+'</td><td>'+esc(label)+'</td></tr>';
 })).join('');
 root.innerHTML='<section class="share-group"><header><div><p>Geverifieerde handelskoersen</p><h3>Amsterdam · vijf afgesloten handelsdagen</h3></div><span>'+rows.length+' aandelen</span></header>'+
 summary+'<div class="table-wrap"><table><thead><tr><th>Bedrijf</th><th>Ticker</th><th>ISIN</th><th>Handelsdatum</th><th>Opening</th><th>Slot</th><th>Verschil</th><th>Status</th></tr></thead><tbody>'+body+'</tbody></table></div></section>';
}
async function loadAmsterdamWeek(){
 const api='https://koersplein.maarten-dubois1975.workers.dev';
 const manifest=await load(api+'/api/history/manifest.json');
 // Failure to load the audited status must never be interpreted as no trading.
 try{noTradesAudit=await load('data/amsterdam-no-trades-2026-10-19-23.json');}catch{noTradesAudit=null;}
 amsterdamWeek=await collectMarketWeek({catalog:shares,manifest,apiBase:api,mic:'XAMS',dates:AMSTERDAM_REFERENCE_WEEK,concurrency:6});
 render();
}
function render(){if(market?.mic==='XAMS')return renderAmsterdamWeek();const search=(q('#search')?.value||'').toLocaleLowerCase('nl');const rows=shares.filter(x=>!search||[x.name,x.company,x.symbol,x.ticker,x.isin].some(v=>String(v||'').toLocaleLowerCase('nl').includes(search)));q('#share-groups').innerHTML='<section class="share-group"><header><div><p>Geverifieerde handelskoersen</p><h3>Alle aandelen</h3></div><span>'+rows.length+' aandelen</span></header><div class="table-wrap"><table><thead><tr><th>Bedrijf</th><th>Ticker</th><th>ISIN</th><th>Handelsdatum</th><th>Opening</th><th>Slot</th><th>Verschil</th></tr></thead><tbody>'+rows.map(x=>{const p=prices.get(x),d=p?sessionChange(p.open,p.close):null;const diff=d?(d.absolute>=0?'+':'')+d.absolute.toFixed(2)+' '+esc(p.currency)+' / '+(d.percent>=0?'+':'')+d.percent.toFixed(2)+'%':'—';return '<tr><td><a class="share-link" href="share.html?isin='+encodeURIComponent(x.isin||'')+'&mic='+encodeURIComponent(market.mic)+'&symbol='+encodeURIComponent(x.symbol||x.ticker||'')+'">'+esc(x.name||x.company)+'</a></td><td>'+esc(x.symbol||x.ticker)+'</td><td>'+esc(x.isin||'—')+'</td><td>'+esc(p?.date||'Geen geldige koers')+'</td><td>'+fmt(p?.open,p?.currency||market.currency)+'</td><td>'+fmt(p?.close,p?.currency||market.currency)+'</td><td>'+diff+'</td></tr>'}).join('')+'</tbody></table></div></section>'}
async function run(){const plan=await load('data/world-fill-plan.json');market=(plan.markets||[]).find(x=>x.code===code);if(!market)throw Error('Onbekende beurs');const d=await load('data/euronext-'+market.code+'.json');shares=Array.isArray(d)?d:(d.shares||[]);document.title='Koersplein — '+market.name;q('#market-name').textContent=market.name;q('#market-country').textContent='Europa · '+market.country;q('#market-meta').textContent=(market.currency||'')+' · '+market.mic;q('#share-count').textContent=shares.length;render();await (market.mic==='XAMS'?loadAmsterdamWeek():loadPrices())}
async function loadPrices(){const api='https://koersplein.maarten-dubois1975.workers.dev';const manifest=await load(api+'/api/history/manifest.json');const resolve=manifestResolver(manifest,market.mic);let i=0;await Promise.all(Array.from({length:8},async()=>{while(i<shares.length){const x=shares[i++],id=resolve(x);if(!id||!/^[A-Z0-9][A-Z0-9:-]{2,31}$/.test(id))continue;try{const h=await load(api+'/api/history/'+encodeURIComponent(id).replace(/%3A/gi,':'));if(String(h.instrument?.mic||'').toUpperCase()!==String(market.mic).toUpperCase()||String(h.instrument?.symbol||'').toUpperCase()!==String(x.symbol||x.ticker||'').toUpperCase())continue;const b=(h.bars||[]).filter(validTradedBar).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);if(b)prices.set(x,{...b,currency:h.instrument?.currency||market.currency});}catch{}}}));render()}
q('#search')?.addEventListener('input',render);run().catch(e=>q('#share-groups').innerHTML='<p class="empty-state">Deze beurs kon niet worden geladen: '+esc(e.message)+'</p>');
