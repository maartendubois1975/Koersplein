import {browserCatalog,browserMarkets} from './daily-session-view.mjs';
const q=s=>document.querySelector(s);const countries={NL:'Nederland',BE:'België',FR:'Frankrijk',IT:'Italië',NO:'Noorwegen',PT:'Portugal',CH:'Zwitserland',ES:'Spanje',SE:'Zweden',DK:'Denemarken',FI:'Finland',IS:'IJsland',GR:'Griekenland',PL:'Polen',AT:'Oostenrijk',CZ:'Tsjechië',HU:'Hongarije'};const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');async function load(u){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}async function run(){
 const plan=await load('data/world-fill-plan.json');
 const markets=await browserMarkets(plan.markets||[],load);
 const catalogs=await Promise.all(markets.map(async m=>{
  try{const d=await browserCatalog(m.mic,'data/euronext-'+m.code+'.json',load);return {count:Array.isArray(d)?d.length:(d.shares||[]).length,preview:d.catalogPreview===true}}
  catch{return null}
 }));
 // Catalog availability and verified five-day price completeness are separate.
 q('#venue-market-count').textContent=markets.length;
 q('#europe-summary').textContent=markets.length+' beurscatalogi beschikbaar · dagkoersdekking wordt afzonderlijk gecontroleerd';
 q('#market-navigation').innerHTML=markets.map((m,i)=>
  '<a class="market-card'+(m.state==='COMPLETE'?' active':'')+'" href="market.html?market='+encodeURIComponent(m.code)+'">'+
  '<small>'+esc(countries[m.country]||m.country)+' · '+esc(m.mic)+'</small>'+
  '<strong>'+esc(m.name)+'</strong><span>'+
  (catalogs[i]===null?'Open markt':catalogs[i].count+' aandelen')+
  (catalogs[i]?.preview?' · Koersdata in voorbereiding':m.state==='COMPLETE'?'':' · Historie in opbouw')+
  ' <i>→</i></span></a>'
 ).join('');
}
run().catch(()=>q('#market-navigation').innerHTML='<p class="empty-state">Markten konden niet worden geladen.</p>');
