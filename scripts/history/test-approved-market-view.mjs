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
 console.log('Actual canonical market renderer, complete approved identity list and daily open/close display: '+catalog.mic+' PASS');
}

const homeNodes=new Map();globalThis.document={querySelector(selector){if(!homeNodes.has(selector))homeNodes.set(selector,{textContent:'',innerHTML:''});return homeNodes.get(selector);}};
await import('../../home-markets.js?approved-home-counts');
for(let i=0;i<300&&!homeNodes.get('#market-navigation')?.innerHTML;i++)await new Promise(r=>setTimeout(r,10));
const navigation=homeNodes.get('#market-navigation').innerHTML;
for(const c of await approvedCompanyUniverse()){
 const marker=c.mic+'</small>',card=navigation.split('<a ').find(part=>part.includes(marker));assert(card,'Home market '+c.mic);assert(card.includes(c.shares.length+' aandelen'),'Home must use approved count for '+c.mic);
}
console.log('Actual homepage navigation uses the same approved 80/105/664 catalogs PASS');
