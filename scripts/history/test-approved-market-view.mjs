import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {approvedCompanyUniverse} from './company-register.mjs';
const venues=JSON.parse(await fs.readFile('data/markets.json','utf8'));
for(const catalog of await approvedCompanyUniverse()){
 const market=venues.venues.flatMap(v=>v.markets||[]).find(m=>m.mic===catalog.mic),nodes=new Map();
 globalThis.document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',innerHTML:'',addEventListener(){}});return nodes.get(selector);}};
 globalThis.location={search:'?market='+market.id};
 globalThis.fetch=async url=>{try{return {ok:true,status:200,json:async()=>JSON.parse(await fs.readFile(new URL('../../'+url,import.meta.url),'utf8'))}}catch{return {ok:false,status:404}}};
 await import('../../generic-market.js?approved-view='+catalog.mic);
 let output='';for(let i=0;i<200;i++){output=nodes.get('#share-groups')?.innerHTML||'';if(nodes.get('#market-meta')?.textContent.includes('bevestigde koersen'))break;await new Promise(r=>setTimeout(r,10));}
 assert.equal((output.match(/class="share-link"/g)||[]).length,catalog.shares.length,catalog.mic+' must render the full approved register');
 assert.match(nodes.get('#market-meta').textContent,/bevestigde koersen/);
 const snapshot=JSON.parse(await fs.readFile('data/daily-session-'+catalog.mic+'.json','utf8'));
 assert.match(nodes.get('#market-meta').textContent,new RegExp(snapshot.session));
 assert.doesNotMatch(output,/<td>€\s*0,00<\/td>/,'Unverified prices must not be shown as zero');
 if(catalog.mic==='XDUB'||catalog.mic==='XLIS'){
  const symbol=catalog.mic==='XDUB'?'SENUS':'ALSMB';
  const sessionUrl='data/daily-session-'+catalog.mic+'.json';
  const noTradeRow=html=>html.match(/<tr>[^]*?<\/tr>/g).find(row=>row.includes('symbol='+symbol));
  const fixture=JSON.parse(await fs.readFile('data/daily-sessions/'+catalog.mic+'/2026-11-25.json','utf8'));
  assert.equal(fixture.results.find(row=>row.symbol===symbol)?.status,'NO_TRADES');
  const fetchSnapshot=globalThis.fetch;
  const withoutEvidence={...fixture,counts:{...fixture.counts,NO_TRADES:fixture.counts.NO_TRADES-1,SESSION_UNVERIFIED:1},results:fixture.results.map(row=>
   row.symbol===symbol?{...row,status:'SESSION_UNVERIFIED',evidence:null,lastConfirmedBar:null}:row
  )};
  globalThis.fetch=(url,...args)=>url===sessionUrl?
   Promise.resolve({ok:true,json:async()=>withoutEvidence}):fetchSnapshot(url,...args);
  nodes.get('#market-meta').textContent='';
  try{
   await import('../../generic-market.js?approved-view-unverified='+catalog.mic);
   for(let i=0;i<200&&!nodes.get('#market-meta').textContent.includes('1 niet bevestigd');i++)await new Promise(r=>setTimeout(r,10));
   assert.match(noTradeRow(nodes.get('#share-groups').innerHTML),/<td>—<\/td><td>—<\/td><td>—<\/td><td>Koers niet bevestigd<\/td>/);
   const share=catalog.shares.find(row=>row.symbol===symbol);
   const path='data/history/'+(share.primaryMic||share.mic||catalog.mic)+':'+share.isin+'.json';
   const history=JSON.parse(await fs.readFile(path,'utf8'));
   const confirmedBar=history.bars.findLast(bar=>bar.date<fixture.session&&bar.volume>0);
   assert(confirmedBar,'A preceding real traded session is required');
   withoutEvidence.results.find(row=>row.symbol===symbol).lastConfirmedBar=confirmedBar;
   nodes.get('#market-meta').textContent='';
   await import('../../generic-market.js?approved-view-previous='+catalog.mic);
   for(let i=0;i<200&&!nodes.get('#market-meta').textContent.includes('1 niet bevestigd');i++)await new Promise(r=>setTimeout(r,10));
   const fallbackRow=noTradeRow(nodes.get('#share-groups').innerHTML);
   assert(fallbackRow.includes('<td>'+confirmedBar.date+'</td>'));
   assert.match(fallbackRow,/<td>—<\/td><td>€[^<]+<\/td><td>—<\/td><td>Koers niet bevestigd · laatst bevestigd slot<\/td>/);
  }finally{globalThis.fetch=fetchSnapshot;}
 }
 console.log('Actual canonical market renderer, complete approved identity list and daily open/close display: '+catalog.mic+' PASS');
}

const homeNodes=new Map();globalThis.document={querySelector(selector){if(!homeNodes.has(selector))homeNodes.set(selector,{textContent:'',innerHTML:''});return homeNodes.get(selector);}};
await import('../../home-markets.js?approved-home-counts');
for(let i=0;i<300&&!homeNodes.get('#market-navigation')?.innerHTML;i++)await new Promise(r=>setTimeout(r,10));
const navigation=homeNodes.get('#market-navigation').innerHTML;
for(const c of await approvedCompanyUniverse()){
 const marker=c.mic+'</small>',card=navigation.split('<a ').find(part=>part.includes(marker));assert(card,'Home market '+c.mic);assert(card.includes(c.shares.length+' aandelen'),'Home must use approved count for '+c.mic);
}
console.log('Actual homepage navigation uses the same approved market catalogs PASS');

const previewNodes=new Map(),previewRequests=[];
globalThis.document={querySelector(selector){
 if(!previewNodes.has(selector))previewNodes.set(selector,{value:'',textContent:'',innerHTML:'',addEventListener(){},querySelector:s=>this.querySelector(s),querySelectorAll:()=>[]});
 return previewNodes.get(selector);
}};
globalThis.location={search:'?market=milan'};
const localFetch=globalThis.fetch;
globalThis.fetch=(url,...args)=>{previewRequests.push(url);return localFetch(url,...args);};
await import('../../generic-market.js?reviewed-milan-preview');
for(let i=0;i<200&&!previewNodes.get('#market-meta')?.textContent.includes('Bedrijvenregister gecontroleerd');i++)await new Promise(r=>setTimeout(r,10));
assert.equal((previewNodes.get('#share-groups')?.innerHTML.match(/class="share-link"/g)||[]).length,360);
assert.match(previewNodes.get('#market-meta').textContent,/Koersdata in voorbereiding/);
assert(!previewRequests.some(url=>url.includes('daily-session')||url.startsWith('https://')),'Preview must not fetch legacy/active prices');
const previewCard=navigation.split('<a ').find(part=>part.includes('XMIL</small>'));
assert.match(previewCard,/360 aandelen · Koersdata in voorbereiding/);
globalThis.location={search:'?isin=IT0001233417&mic=MTAA&symbol=A2A'};
await import('../../share.js?reviewed-milan-preview');
for(let i=0;i<200&&!previewNodes.get('#history-state')?.textContent.includes('Koershistorie in voorbereiding');i++)await new Promise(r=>setTimeout(r,10));
assert.match(previewNodes.get('#share-detail').innerHTML,/<h1>A2A<\/h1>/);
assert.equal(previewNodes.get('#history-state').textContent,'Koershistorie in voorbereiding.');
assert(!previewRequests.some(url=>url.includes('daily-session')||url.startsWith('https://')||url.startsWith('data/history/')));
console.log('Milan reviewed catalog, navigation and company detail without legacy quote access: PASS');
