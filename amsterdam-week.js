import {AMSTERDAM_REFERENCE_WEEK,collectMarketWeek,sessionChange,positiveNumber} from './market-week-core.mjs?v=20261025e';
const target=document.getElementById('week-prices-table');
const search=document.getElementById('search');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(value,currency)=>{const n=positiveNumber(value);if(n===null)return '—';try{return new Intl.NumberFormat('nl-NL',{style:'currency',currency:currency||'EUR',minimumFractionDigits:2,maximumFractionDigits:4}).format(n)}catch{return new Intl.NumberFormat('nl-NL',{maximumFractionDigits:4}).format(n)}};
const signed=(value,digits=2)=>new Intl.NumberFormat('nl-NL',{signDisplay:'always',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const change=(open,close,currency)=>{const d=sessionChange(open,close);if(!d)return '—';return signed(d.absolute,2)+' '+esc(currency||'EUR')+' / '+signed(d.percent,2)+'%';};
const days=AMSTERDAM_REFERENCE_WEEK;
let snapshot=null;
function render(){
 if(!snapshot)return;
 const query=(search?.value||'').trim().toLocaleLowerCase('nl');
 const filtered=snapshot.rows.filter(row=>!query||[row.share.name,row.share.symbol,row.share.isin].some(v=>String(v||'').toLocaleLowerCase('nl').includes(query)));
 const head='<tr><th rowspan="2">Aandeel</th>'+days.map(date=>'<th colspan="4">'+esc(date)+' (XAMS)</th>').join('')+'<th rowspan="2">Week ±</th><th rowspan="2">Bron</th></tr><tr>'+days.map(()=>'<th>Open</th><th>Slot</th><th>Dag ±</th><th>t.o.v. vorig slot</th>').join('')+'</tr>';
 const rows=filtered.map(row=>{
  const currency=row.currency||'EUR';
  const cells=days.map((date,i)=>{
   const b=row.bars.get(date),previous=i>0?row.bars.get(days[i-1]):null;
   const defect=row.conflicts.find(x=>x.date===date)?.reason;
   const missingReason=defect||row.error||'NO_VALID_STORED_BAR';
   const status=b?'':(' title="'+esc(missingReason)+'"');
   return '<td class="price"'+status+'>'+fmt(b?.open,currency)+'</td><td class="price"'+status+'>'+fmt(b?.close,currency)+'</td><td class="price"'+status+'>'+(b?change(b.open,b.close,currency):'—')+'</td><td class="price"'+status+'>'+(b&&previous?change(previous.close,b.open,currency):'—')+'</td>';
  }).join('');
  const first=row.bars.get(days[0]),last=row.bars.get(days.at(-1));
  const weekly=first&&last?change(first.open,last.close,currency):'—';
  const source=row.error?row.error:row.provider||'—';
  return '<tr><td><a class="share-link" href="share.html?isin='+encodeURIComponent(row.share.isin)+'&mic=XAMS&symbol='+encodeURIComponent(row.share.symbol)+'">'+esc(row.share.name)+'</a><br><small>'+esc(row.share.symbol)+' · '+esc(row.share.isin)+'</small></td>'+cells+'<td class="price">'+weekly+'</td><td><small>'+esc(source)+'</small></td></tr>';
 }).join('');
 const totals=days.map(d=>'<span>'+esc(d.slice(8))+' okt: '+snapshot.coverage.perDay[d].valid+'/'+snapshot.coverage.catalog+'</span>').join(' · ');
 const missingByDay=days.map(date=>{
  const reasons={};
  for(const row of snapshot.rows){
   if(row.bars.has(date))continue;
   const reason=row.conflicts.find(x=>x.date===date)?.reason||row.error||'NO_VALID_STORED_BAR';
   reasons[reason]=(reasons[reason]||0)+1;
  }
  return '<li><strong>'+esc(date)+'</strong>: '+Object.entries(reasons).map(([reason,count])=>esc(reason)+' '+count).join(' · ')+'</li>';
 }).join('');
 target.innerHTML='<p><strong>'+snapshot.coverage.complete+' van '+snapshot.coverage.catalog+'</strong> aandelen hebben vijf gevalideerde handelsdagen; '+snapshot.coverage.validSessions+'/'+snapshot.coverage.expectedSessions+' dagkoersen beschikbaar. '+totals+'.</p><p>Dag ± = slot minus opening; t.o.v. vorig slot = opening minus slot vorige dag. Week ± = vrijdagslot minus maandagopening. Ontbrekende gegevens zijn niet automatisch dagen zonder handel. Historische koersen; bron en handelsdatum staan vermeld.</p><details><summary>Ontbrekende handelsdagen en technische oorzaken</summary><ul>'+missingByDay+'</ul><p>ZERO_VOLUME_REFERENCE_BAR is geen bewezen handel. NO_MATCHING_MIC_TICKER_HISTORY betekent dat geen veilig gekoppelde beursnotering is gevonden. NO_VALID_STORED_BAR betekent dat voor deze datum geen geldige koers is opgeslagen. Dit is geen bewijs van NO_TRADES.</p></details><div class="table-wrap" style="overflow-x:auto"><table><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div><p>Resultaten zijn afhankelijk van bronbeschikbaarheid en rechten op herpublicatie. Niet beschikbare of conflicterende koersen worden niet geschat.</p>';
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
  document.getElementById('share-count').textContent=shares.length;
  target.textContent='Vijf handelsdagen voor '+shares.length+' aandelen worden gecontroleerd…';
  snapshot=await collectMarketWeek({catalog:shares,manifest,apiBase:api,mic:'XAMS',dates:days,concurrency:8});
  render();
 }catch(e){target.textContent='Amsterdamse weekkoersen niet beschikbaar: '+e.message;}
}
search?.addEventListener('input',render);
start();
