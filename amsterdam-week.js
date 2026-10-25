// Weekoverzicht toont uitsluitend reeds gevalideerde immutable history; geen writes.
(async function(){
 const target=document.getElementById('week-prices-table');if(!target)return;
 const dates=['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>Number.isFinite(n)?new Intl.NumberFormat('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n):'—';
 const delta=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&a>0?((b-a>=0?'+':'')+money(b-a)+' ('+(b/a*100-100>=0?'+':'')+money((b/a-1)*100)+'%)'):'—';
 const valid=b=>b&&Number(b.open)>0&&Number(b.close)>0&&Number(b.high)>=Math.max(Number(b.open),Number(b.close))&&Number(b.low)>0&&Number(b.low)<=Math.min(Number(b.open),Number(b.close))&&Number(b.volume)>0;
 try{
  const response=await fetch('data/euronext-amsterdam.json',{cache:'no-store'});if(!response.ok)throw Error('catalogus HTTP '+response.status);
  const catalog=await response.json();const shares=catalog.shares||[];
  const api='https://koersplein.maarten-dubois1975.workers.dev';
  let next=0;const result=Array(shares.length);
  await Promise.all(Array.from({length:8},async()=>{while(next<shares.length){const i=next++,s=shares[i];try{const r=await fetch(api+'/api/history/'+encodeURIComponent(s.isin),{cache:'no-store'});if(!r.ok)continue;const h=await r.json();const bars=new Map((h.bars||[]).filter(b=>dates.includes(b.date)&&valid(b)).map(b=>[b.date,b]));result[i]={share:s,bars};}catch{}}}));
  const header='<tr><th>Aandeel</th>'+dates.map(d=>'<th colspan="3">'+d.slice(8)+' okt</th>').join('')+'<th>Weekverschil</th></tr><tr><th></th>'+dates.map(()=>'<th>Open</th><th>Slot</th><th>Dag ±</th>').join('')+'<th></th></tr>';
  const rows=shares.map((s,i)=>{const bars=result[i]?.bars||new Map();const first=bars.get(dates[0]),last=bars.get(dates[4]);return '<tr><td><a href="share.html?isin='+encodeURIComponent(s.isin)+'">'+esc(s.name)+'</a></td>'+dates.map(d=>{const b=bars.get(d);return '<td>'+money(b?Number(b.open):NaN)+'</td><td>'+money(b?Number(b.close):NaN)+'</td><td>'+ (b?delta(Number(b.open),Number(b.close)):'—')+'</td>'}).join('')+'<td>'+ (first&&last?delta(Number(first.open),Number(last.close)):'—')+'</td></tr>'}).join('');
  const complete=shares.filter((_,i)=>dates.every(d=>result[i]?.bars?.has(d))).length;
  target.innerHTML='<p>Volledige week met vijf geldige handelsdagen: <strong>'+complete+' van '+shares.length+'</strong> aandelen. Bedragen in EUR; weekverschil is maandagopening tot vrijdagslot. Geen koers betekent niet automatisch geen handel.</p><div class="table-wrap" style="overflow-x:auto"><table><thead>'+header+'</thead><tbody>'+rows+'</tbody></table></div>';
 }catch(e){target.textContent='Weekoverzicht kon niet worden geladen: '+e.message;}
})();