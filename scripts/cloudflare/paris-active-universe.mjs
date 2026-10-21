import fs from 'node:fs/promises';
import {storageIdentityResolver} from './storage-identity.mjs';

const config=JSON.parse(await fs.readFile('config/paris-follow-policy.json','utf8'));
const official=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8')).shares;
const url=process.env.KOERSPLEIN_API_URL;
if(!url)throw Error('KOERSPLEIN_API_URL required');
const response=await fetch(url.replace(/\/$/,'')+'/api/history/manifest.json',{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('History manifest HTTP '+response.status);
const manifest=await response.json();
if(!manifest?.instruments||typeof manifest.instruments!=='object')throw Error('Invalid history manifest');
const resolve=storageIdentityResolver(Object.entries(manifest.instruments).map(([isin,row])=>({...row,isin})));
const eligible=[],inactive=[];
for(const share of official){
 if(!config.mics.includes(share.mic))continue;
 const key=resolve(share);
 const record=key&&manifest.instruments[key];
 const hasHistory=Boolean(record?.lastDate&&Number(record.recordCount||record.records||0)>0);
 (hasHistory?eligible:inactive).push({isin:share.isin,mic:share.mic,symbol:share.symbol,storageKey:key||null});
}
const output={generatedAt:new Date().toISOString(),policy:'existing-history-only',eligibleCount:eligible.length,inactiveCount:inactive.length,eligible,inactive};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/paris-active-universe.json',JSON.stringify(output,null,2)+'\n');
console.log('PARIS_ACTIVE_UNIVERSE',JSON.stringify({eligible:eligible.length,inactive:inactive.length}));
if(eligible.length+inactive.length!==official.filter(s=>config.mics.includes(s.mic)).length)throw Error('Paris universe mismatch');
