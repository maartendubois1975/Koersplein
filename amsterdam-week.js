import {AMSTERDAM_REFERENCE_WEEK,collectMarketWeek,sessionChange,positiveNumber,verifiedNoTradeStatus} from './market-week-core.mjs?v=20261026xams-isin2';
const target=document.getElementById('week-prices-table');
const search=document.getElementById('search');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(value,currency)=>{const n=positiveNumber(value);if(n===null)return '—';try{return new Intl.NumberFormat('nl-NL',{style:'currency',currency:currency||'EUR',minimumFractionDigits:2,maximumFractionDigits:4}).format(n)}catch{return new Intl.NumberFormat('nl-NL',{maximumFractionDigits:4}).format(n)}};
const signed=(value,digits=2)=>new Intl.NumberFormat('nl-NL',{signDisplay:'always',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const change=(open,close,currency)=>{const d=sessionChange(open,close);if(!d)return '—';return signed(d.absolute,2)+' '+esc(currency||'EUR')+' / '+signed(d.percent,2)+'%';};
const days=AMSTERDAM_REFERENCE_WEEK;
let snapshot=null,statusAudit=null;
const isNoTrade=(row,date)=>!row.bars.has(date)&&verifiedNoTradeStatus(statusAudit,row.share,'XAMS',date,days);
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
   const previous=i>0?row.bars.get(days[i-1]):null;
   return '<td class="price"'+tag+'>'+fmt(b.open,currency)+'</td><td class="price">'+fmt(b.close,currency)+'</td><td class="price">'+change(b.open,b.close,currency)+'</td><td class="price">'+(previous?change(previous.close,b.close,currency):'—')+'</td>';
  }).join('');
  const first=row.bars.get(days[0]),last=row.bars.get(days.at(-1));
  const weekly=first&&last?change(first.open,last.close,currency):'—';
  const source=row.error?row.error:row.provider||'—';
  return '<tr><td><a class="share-link" href="share.html?isin='+encodeURIComponent(row.share.isin)+'&mic=XAMS&symbol='+encodeURIComponent(row.share.symbol)+'">'+esc(row.share.name)+'</a><br><small>'+esc(row.share.symbol)+' · '+esc(row.share.isin)+'</small></td>'+cells+'<td class="price">'+weekly+'</td><td><small>'+esc(source)+'</small></td></tr>';
 }).join('');
 const totals=days.map(d=>{const valid=snapshot.coverage.perDay[d].valid,noTrade=snapshot.rows.filter(row=>isNoTrade(row,d)).length;return '<span>'+esc(d.slice(8))+' okt: '+valid+' koers · '+noTrade+' geen handel · '+(snapshot.coverage.catalog-valid-noTrade)+' open</span>'}).join(' · ');
 const statusCount=days.reduce((sum,d)=>sum+snapshot.rows.filter(row=>isNoTrade(row,d)).length,0);
 const explained=snapshot.rows.filter(row=>days.every(date=>row.bars.has(date)||isNoTrade(row,date))).length;
 const missingByDay=days.map(date=>{
  const reasons={};
  for(const row of snapshot.rows){
   if(row.bars.has(date)||isNoTrade(row,date))continue;
   const reason=row.conflicts.find(x=>x.date===date)?.reason||row.error||'NO_VALID_STORED_BAR';
   reasons[reason]=(reasons[reason]||0)+1;
  }
  return '<li><strong>'+esc(date)+'</strong>: '+Object.entries(reasons).map(([reason,count])=>esc(reason)+' '+count).join(' · ')+'</li>';
 }).join('');
 target.innerHTML='<p><strong>'+explained+' van '+snapshot.coverage.catalog+'</strong> aandelen hebben vijf verklaarde handelsdagen (echte koers of gecontroleerd geen handel). '+snapshot.coverage.validSessions+' geldige koersdagen · '+statusCount+' dagen zonder handel · '+(snapshot.coverage.expectedSessions-snapshot.coverage.validSessions-statusCount)+' nog niet verklaard. '+totals+'.</p><p>Dag ± = slot minus opening; Slot t.o.v. vorig slot = dagslot minus slot van de vorige handelsdag (alleen wanneer beide geldig zijn). Week ± = vrijdagslot minus maandagopening. Geen handel wordt uitsluitend getoond bij expliciete gedateerde beursstatus; een nulvolume-referentiekoers is nooit een echte openings- of slotkoers. Historische koersen; bron en handelsdatum staan vermeld. <a href="https://github.com/maartendubois1975/Koersplein/actions/runs/40196069402" rel="noopener">Bronstatus-audit 25 oktober</a>.</p><details><summary>Ontbrekende handelsdagen en technische oorzaken</summary><ul>'+missingByDay+'</ul><p>ZERO_VOLUME_REFERENCE_BAR is geen bewezen handel. NO_MATCHING_MIC_TICKER_HISTORY betekent dat geen veilig gekoppelde beursnotering is gevonden. NO_VALID_STORED_BAR betekent dat voor deze datum geen geldige koers is opgeslagen. Dit is geen bewijs van NO_TRADES.</p></details><div class="table-wrap" style="overflow-x:auto"><table><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div><p>Resultaten zijn afhankelijk van bronbeschikbaarheid en rechten op herpublicatie. Niet beschikbare of conflicterende koersen worden niet geschat.</p>';
}
async function start(){
 if(!target)return;
 try{
  const catalogResponse=await fetch('data/euronext-amsterdam.json',{cache:'no-store'});
  if(!catalogResponse.ok)throw Error('CATALOG_HTTP_'+catalogResponse.status);
  const catalog=await catalogResponse.json();
  const api=String(window.KOERSPLEIN_MARKET?.api||'https://koersplein.maarten-dubois1975.workers.dev').replace(/\/$/,'');
  const manifestResponse=await fetch(api+'/api/history/manifest.json',{cache:'no-store'});
  if(!manifestResponse.ok)throw Error('MANIFEST_HTTP_'+manifestResponse.status);
  const manifest=await manifestResponse.json();
  const shares=catalog.shares||[];
  // A failed status snapshot must never hide validated traded prices.
  try{const statusResponse=await fetch('data/amsterdam-no-trades-2026-10-19-23.json',{cache:'no-store'});if(statusResponse.ok)statusAudit=await statusResponse.json();}catch{statusAudit=null;}
  document.getElementById('share-count').textContent=shares.length;
  target.textContent='Vijf handelsdagen voor '+shares.length+' aandelen worden gecontroleerd…';
  snapshot=await collectMarketWeek({catalog:shares,manifest,apiBase:api,mic:'XAMS',dates:days,concurrency:8});
  render();
 }catch(e){target.textContent='Amsterdamse weekkoersen niet beschikbaar: '+e.message;}
}
search?.addEventListener('input',render);
start();
