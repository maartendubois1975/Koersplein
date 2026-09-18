const box=document.querySelector('#history-coverage');
const load=async u=>{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error();return r.json()};
(async()=>{try{
 const cfg=await load('data/runtime-config.json'),api=String(cfg.apiBaseUrl||'').replace(/\/$/,'');
 const manifest=await load(`${api}/api/history/manifest.json`);
 const cats=await Promise.all([
  load('data/euronext-amsterdam.json').then(x=>['Amsterdam','XAMS',x]).catch(()=>null),
  load('data/euronext-brussels.json').then(x=>['Brussel','XBRU',x]).catch(()=>null),
  load('data/euronext-paris.json').then(x=>['Parijs','PARIS',x]).catch(()=>null)
 ]);
 const cards=[];
 for(const item of cats.filter(Boolean)){const [name,mic,cat]=item,shares=cat.shares||[],entries=shares.map(s=>manifest.instruments?.[s.isin]).filter(Boolean);
  const first=entries.map(e=>e.coverage?.firstDate||e.coverage?.first_date).filter(Boolean).sort()[0];
  const last=entries.map(e=>e.coverage?.lastDate||e.coverage?.last_date).filter(Boolean).sort().at(-1);
  cards.push(`<div class="count-card"><strong>${entries.length}/${shares.length}</strong><span>${name} · koershistorie${first&&last?` · ${first} — ${last}`:''}</span></div>`);
 }
 box.innerHTML=cards.join('');
}catch{box.innerHTML='<p class="muted">Koershistorie wordt gecontroleerd.</p>'}})();