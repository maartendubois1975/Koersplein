const e=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const p=v=>Number.isFinite(Number(v))?(Number(v)*100).toFixed(1)+'%':'—';
fetch('data/top5-three-month.json').then(r=>r.ok?r.json():Promise.reject()).then(x=>{
 const root=document.querySelector('#top5-markets');if(!root)return;
 const cards=Object.entries(x.markets||{}).map(([mic,m])=>{if(m.status!=='READY')return `<article class="finder-card"><p class="eyebrow">${e(m.name)} · ${e(mic)}</p><h3>Nog niet berekenbaar</h3><p>De gevalideerde catalogus/historie is nog niet beschikbaar voor deze dagelijkse ranglijst.</p></article>`;
 const rows=(m.top5||[]).map(q=>`<tr><td><strong>#${q.rank} ${e(q.name)}</strong><br><small>${e(q.ticker||q.isin)}</small></td><td>${p(q.expected3m)}</td><td>${p(q.chancePositive)}</td><td>${p(q.chanceUp10)}</td></tr>`).join('');
 return `<article class="finder-card"><p class="eyebrow">${e(m.name)} · ${e(mic)} · 3 maanden</p><h3>Top 5 verwachte stijgers</h3><div class="table-wrap"><table><thead><tr><th>Aandeel</th><th>Modelverwachting</th><th>Kans positief</th><th>Kans +10%</th></tr></thead><tbody>${rows}</tbody></table></div><small>Gebaseerd op de 40 meest vergelijkbare historische situaties per aandeel. Geen rendementsbelofte.</small></article>`}).join('');
 root.innerHTML=`<div class="section-heading"><div><p class="eyebrow">Dagelijkse 3-maandsranglijst</p><h2>Top 5 grootste kanshebbers per beurs</h2></div><p>Niet op een vaste +30%-grens: ieder aandeel wordt gerangschikt op zijn eigen verwachte 3-maandsbeweging en historische trefkans.</p></div><div class="share-groups">${cards}</div>`;
}).catch(()=>{});
