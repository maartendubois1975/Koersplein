// Canonical Amsterdam identity contract: catalog -> provider mappings -> public manifest.
// This is a read-only guard; historical price validation is handled by separate gates.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
export function verifyAmsterdamIdentity(catalog,mapping,manifest){
 const shares=catalog.shares, providers=mapping.providerMappings, publicRows=manifest.instruments;
 assert.equal(catalog.mic,'XAMS','Catalog must identify XAMS');
 assert.equal(mapping.mic,'XAMS','Provider mappings must identify XAMS');
 assert.equal(manifest.market,'XAMS','Public manifest must identify XAMS');
 assert.equal(shares.length,80,'Expected exactly 80 active Amsterdam companies');
 assert.equal(providers.length,shares.length,'Every active share requires exactly one provider mapping');
 assert.equal(Object.keys(publicRows).length,shares.length,'Every active share requires one public manifest entry');
 const unique=(arr,label)=>assert.equal(new Set(arr).size,arr.length,'Duplicate '+label);
 unique(shares.map(x=>x.isin),'catalog ISIN');
 unique(shares.map(x=>x.symbol),'catalog symbol');
 unique(providers.map(x=>x.isin),'provider ISIN');
 unique(providers.map(x=>x.symbol),'provider symbol');
 const map=new Map(providers.map(x=>[x.isin,x]));
 for(const share of shares){
   assert.match(share.isin,/^[A-Z]{2}[A-Z0-9]{10}$/,'Invalid catalog ISIN');
   const p=map.get(share.isin);
   assert.ok(p,'Missing provider mapping for '+share.isin);
   assert.equal(p.symbol,share.symbol,'Provider ticker drift: '+share.isin);
   assert.equal(p.name,share.name,'Provider issuer-name drift: '+share.isin);
   assert.ok(p.provider&&p.providerSymbol&&p.currency&&p.identitySource,'Incomplete provider provenance: '+share.isin);
   const m=publicRows[share.isin];
   assert.ok(m,'Missing public manifest entry: '+share.isin);
   assert.equal(m.isin,share.isin);
   assert.equal(m.mic,'XAMS');
   assert.equal(m.symbol,share.symbol,'Public ticker drift: '+share.isin);
   assert.equal(m.name,share.name,'Public issuer-name drift: '+share.isin);
   assert.equal(m.currency,p.currency,'Public currency drift: '+share.isin);
 }
 assert.deepEqual(Object.keys(publicRows).sort(),shares.map(x=>x.isin).sort(),'Manifest contains inactive or missing identities');
 return {catalog:shares.length,mapped:providers.length,public:Object.keys(publicRows).length};
}
const [catalog,mapping,manifest]=await Promise.all(['data/euronext-amsterdam.json','data/history-instruments.json','data/amsterdam-history-manifest.json'].map(read));
console.log('AMSTERDAM_IDENTITY_CONTRACT',JSON.stringify(verifyAmsterdamIdentity(catalog,mapping,manifest)));
