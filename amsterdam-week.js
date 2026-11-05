import {collectMarketWeek,sessionChange,positiveNumber} from './market-week-core.mjs';
const target=document.getElementById('week-prices-table');
const search=document.getElementById('search');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(value,currency)=>{const n=positiveNumber(value);if(n===null)return '—';try{return new Intl.NumberFormat('nl-NL',{style:'currency',currency:currency||'EUR',minimumFractionDigits:2,maximumFractionDigits:4}).format(n)}catch{return new Intl.NumberFormat('nl-NL',{maximumFractionDigits:4}).format(n)}};
const signed=(value,digits=2)=>new Intl.NumberFormat('nl-NL',{signDisplay:'always',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const change=(open,close,currency)=>{const d=sessionChange(open,close);if(!d)return '—';return signed(d.absolute,2)+' '+esc(currency||'EUR')+' / '+signed(d.percent,2)+'%';};
const amsterdamDate=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
const latestFiveSessions=()=>{const d=new Date(amsterdamDate()+'T00:00:00Z');const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',hour:'2-digit',hourCycle:'h23'}).format(new Date()));if(hour<20)d.setUTCDate(d.getUTCDate()-1);const result=[];while(result.length<5){if(d.getUTCDay()!==0&&d.getUTCDay()!==6)result.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()-1);}return result.reverse();};
const days=latestFiveSessions();
const weekLabel=days[0]+' t/m '+days.at(-1);
const LOCAL_HISTORY_BASE='data/history/';
// Previous *traded* close can cross a session only if the exchange explicitly
// confirmed NO_TRADES. Never skip an invalid or unverified missing session:
// doing so would fabricate an uninterrupted close-to-close return.
const previousVerifiedClose=(row,index)=>{
 for(let j=index-1;j>=0;j--){
  const date=days[j],bar=row.bars.get(date);
  if(bar)return bar.close;
  if(!isNoTrade(row,date))break;
 }
 return null;
};
let snapshot=null;
// No current official status feed is available. A missing bar is not proof of no trading.
const isNoTrade=()=>false;
// Identical five-state precedence to the generic Amsterdam renderer. A verified
// NO_TRADES status may supersede a zero-volume reference bar, never a real trade.
const dayStatus=(row,date)=>{
 if(row.bars.has(date))return 'valid';
 if(isNoTrade(row,date))return 'noTrades';
 if(row.conflicts.some(c=>c.date===date))return 'invalid';
 if(row.lastStoredDate&&row.lastStoredDate<date&&!row.error)return 'stale';
 return 'missing';
};
function render(){
 if(!snapshot)return;
 const query=(search?.value||'').trim().toLocaleLowerCase('nl');
 const filtered=snapshot.rows.filter(row=>!query||[row.share.name,row.share.symbol,row.share.isin].some(v=>String(v||'').toLocaleLowerCase('nl').includes(query)));
 const latestRows=filtered.map(row=>{const date=[...days].reverse().find(d=>row.bars.has(d));const bar=date?row.bars.get(date):null;const prior=date?previousVerifiedClose(row,days.indexOf(date)):null;const delta=bar&&prior!==null?sessionChange(prior,bar.close)?.percent:null;return '<tr><td><a class="share-link" href="share.html?isin='+encodeURIComponent(row.share.isin)+'&mic=XAMS&symbol='+encodeURIComponent(row.share.symbol)+'">'+esc(row.share.name)+'</a></td><td class="price">'+(bar?fmt(bar.close,row.currency):'—')+'</td><td class="price">'+(delta===null||delta===undefined?'—':signed(delta,2)+'%')+'</td><td>'+esc(date||'Geen gevalideerde koers')+'</td></tr>';}).join('');
 const latestTable='<h3>Laatste slotkoers en dagrendement</h3><div class="table-wrap" style="overflow-x:auto"><table><thead><tr><th>Aandeel</th><th>Slotkoers</th><th>Dagrendement</th><th>Datum</th></tr></thead><tbody>'+latestRows+'</tbody></table></div>';
 const head='<tr><th rowspan="2">Aandeel</th>'+days.map(date=>'<th colspan="4">'+esc(date)+' (XAMS)</th>').join('')+'<th rowspan="2">Week ±</th><th rowspan="2">Bron</th></tr><tr>'+days.map(()=>'<th>Open</th><th>Slot</th><th>Dag ±</th><th>Slot t.o.v. vorig slot</th>').join('')+'</tr>';
 const rows=filtered.map(row=>{
  const currency=row.currency||'EUR';
  const cells=days.map((date,i)=>{
   const b=row.bars.get(date),state=dayStatus(row,date);
   // One machine-readable session status per share/date makes public API/UI
   // parity independently testable without guessing from CSS or visible text.
   const tag=' data-session-date="'+esc(date)+'" data-session-status="'+state+'"';
   if(state==='noTrades')return '<td class="price" colspan="4"'+tag+'><strong>Geen handel</strong><br><small>Beursstatus bevestigd</small></td>';
   if(state!=='valid'){
    const defect=row.conflicts.find(x=>x.date===date)?.reason;
    const reason=defect||row.error||(state==='stale'?'LAST_STORED_'+row.lastStoredDate:'NO_VALID_STORED_BAR');
    const label={invalid:'Ongeldige koers',stale:'Verouderde historie',missing:'Niet bevestigd'}[state];
    return '<td class="price" colspan="4"'+tag+' title="'+esc(reason)+'"><strong>'+label+'</strong><br><small>'+esc(reason)+'</small></td>';
   }
   const previousClose=previousVerifiedClose(row,i);
   return '<td class="price"'+tag+'>'+fmt(b.open,currency)+'</td><td class="price">'+fmt(b.close,currency)+'</td><td class="price">'+change(b.open,b.close,currency)+'</td><td class="price">'+(previousClose!==null?change(previousClose,b.close,currency):'—')+'</td>';
  }).join('');
  const first=row.bars.get(days[0]),last=row.bars.get(days.at(-1));
  const weekly=first&&last?change(first.open,last.close,currency):'—';
  const source=row.error?row.error:row.provider||'—';
  return '<tr><td><a class="share-link" href="share.html?isin='+encodeURIComponent(row.share.isin)+'&mic=XAMS&symbol='+encodeURIComponent(row.share.symbol)+'">'+esc(row.share.name)+'</a><br><small>'+esc(row.share.symbol)+' · '+esc(row.share.isin)+'</small></td>'+cells+'<td class="price">'+weekly+'</td><td><small>'+esc(source)+'</small></td></tr>';
 }).join('');
 const totals=days.map(d=>{const valid=snapshot.coverage.perDay[d].valid,noTrade=snapshot.rows.filter(row=>isNoTrade(row,d)).length;return '<span>'+esc(d.slice(5))+': '+valid+' koers · '+noTrade+' geen handel · '+(snapshot.coverage.catalog-valid-noTrade)+' open</span>'}).join(' · ');
 const statusCount=days.reduce((sum,d)=>sum+snapshot.rows.filter(row=>isNoTrade(row,d)).length,0);
 const explained=snapshot.rows.filter(row=>days.every(date=>row.bars.has(date)||isNoTrade(row,date))).length;
 const latestDates=snapshot.rows.map(row=>row.lastStoredDate).filter(Boolean).sort();
 const latest=latestDates.at(-1)||null;
 const coverageNotice='<p><strong>Laatste opgeslagen koersdatum: '+esc(latest||'onbekend')+'</strong>. Dit is een historisch overzicht, geen realtime koersfeed. Koersen worden pas als beschikbaar getoond na broncontrole.</p>';
 const missingByDay=days.map(date=>{
  const reasons={};
  for(const row of snapshot.rows){
   if(row.bars.has(date)||isNoTrade(row,date))continue;
   const reason=row.conflicts.find(x=>x.date===date)?.reason||row.error||'NO_VALID_STORED_BAR';
   reasons[reason]=(reasons[reason]||0)+1;
  }
  return '<li><strong>'+esc(date)+'</strong>: '+Object.entries(reasons).map(([reason,count])=>esc(reason)+' '+count).join(' · ')+'</li>';
 }).join('');
 target.innerHTML=latestTable+coverageNotice+'<p><strong>'+explained+' van '+snapshot.coverage.catalog+'</strong> aandelen hebben vijf verklaarde handelsdagen (echte koers of gecontroleerd geen handel). '+snapshot.coverage.validSessions+' geldige koersdagen · '+statusCount+' dagen zonder handel · '+(snapshot.coverage.expectedSessions-snapshot.coverage.validSessions-statusCount)+' nog niet verklaard. '+totals+'.</p><p>Dag ± = slot minus opening; Slot t.o.v. vorig slot = dagslot minus het laatst bevestigde eerdere slot; alleen officieel bevestigde dagen zonder handel mogen worden overgeslagen. Bij ongeldige of ontbrekende tussendagen tonen we geen rendement. Week ± = vrijdagslot minus maandagopening. Geen handel wordt uitsluitend getoond bij expliciete gedateerde beursstatus; een nulvolume-referentiekoers is nooit een echte openings- of slotkoers. Historische koersen; bron en handelsdatum staan vermeld. <a href="https://github.com/maartendubois1975/Koersplein/actions/runs/40196069402" rel="noopener">Bronstatus-audit 25 oktober</a>.</p><details><summary>Ontbrekende handelsdagen en technische oorzaken</summary><ul>'+missingByDay+'</ul><p>ZERO_VOLUME_REFERENCE_BAR is geen bewezen handel. NO_MATCHING_MIC_TICKER_HISTORY betekent dat geen veilig gekoppelde beursnotering is gevonden. NO_VALID_STORED_BAR betekent dat voor deze datum geen geldige koers is opgeslagen. Dit is geen bewijs van NO_TRADES.</p></details><div class="table-wrap" style="overflow-x:auto"><table><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div><p>Resultaten zijn afhankelijk van bronbeschikbaarheid en rechten op herpublicatie. Niet beschikbare of conflicterende koersen worden niet geschat.</p>';
}
async function start(){
 if(!target)return;
 try{
  const heading=document.getElementById('week-heading');if(heading)heading.textContent='Laatste vijf beursdagen '+weekLabel;
  const catalogResponse=await fetch('data/euronext-amsterdam.json',{cache:'no-store'});
  if(!catalogResponse.ok)throw Error('CATALOG_HTTP_'+catalogResponse.status);
  const catalog=await catalogResponse.json();
  const api='https://amsterdam.local.invalid'; // URL used only to resolve local JSON filenames; fetch is intercepted below.
  const manifestResponse=await fetch('data/amsterdam-history-manifest.json',{cache:'no-store'});
  if(!manifestResponse.ok)throw Error('MANIFEST_HTTP_'+manifestResponse.status);
  const manifest=await manifestResponse.json();
  const shares=(catalog.shares||[]).filter(share=>Object.hasOwn(manifest.instruments||{},share.isin));
  document.getElementById('share-count').textContent=shares.length;
  target.textContent='Vijf handelsdagen voor '+shares.length+' aandelen worden gecontroleerd…';
  snapshot=await collectMarketWeek({catalog:shares,manifest,apiBase:api,mic:'XAMS',dates:days,concurrency:8,fetchImpl:async (url,options)=>{const id=decodeURIComponent(url.split('/').at(-1));return fetch(LOCAL_HISTORY_BASE+encodeURIComponent(id)+'.json',options);}});
  render();
 }catch(e){target.textContent='Amsterdamse weekkoersen niet beschikbaar: '+e.message;}
}
search?.addEventListener('input',render);
start();
