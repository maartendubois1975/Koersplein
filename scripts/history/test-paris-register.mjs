import assert from 'node:assert/strict';
import {loadCompanyCatalog,validateCompanyCatalog} from './company-register.mjs';
import {providerRoute} from './source-policy.mjs';
const p=await loadCompanyCatalog('XPAR');
assert.equal(p.shares.length,664);
assert.deepEqual(p.shares.reduce((a,s)=>(a[s.primaryMic]=(a[s.primaryMic]||0)+1,a),{}),{ALXP:246,XPAR:295,XMLI:123});
for(const mic of ['XAMS','XBRU']){
 const other=await loadCompanyCatalog(mic);
 assert(!p.shares.some(s=>other.shares.some(x=>x.isin===s.isin)));
}
for(const s of p.shares)assert(providerRoute(s).allowedProviderIds.length);
assert.throws(()=>validateCompanyCatalog({...p,shares:p.shares.slice(1)}),/count mismatch/);
console.log('Paris approved register: PASS');
