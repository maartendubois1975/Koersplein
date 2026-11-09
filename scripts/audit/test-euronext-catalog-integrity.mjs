import assert from 'node:assert/strict';
import { inspectCatalog, compareMarkets } from './euronext-catalog-integrity.mjs';
const make=(shares)=>({mic:'XAMS',shares});
const a={isin:'NL0000852564',symbol:'AALB',name:'Aalberts'};
assert.deepEqual(inspectCatalog(make([a])).errors,[]);
assert.equal(inspectCatalog(make([a,a])).errors[0].kind,'duplicate-listing');
assert.equal(inspectCatalog(make([a,{...a,symbol:'AALB2'}])).warnings[0].kind,'multiple-listings-same-isin');
assert.equal(inspectCatalog(make([{...a,isin:'bad'}])).errors[0].kind,'invalid-isin');
assert.equal(inspectCatalog(make([{...a,symbol:''}])).errors[0].kind,'missing-symbol');
assert.throws(()=>inspectCatalog({mic:'XAMS'}),/shares/);
const crossMarketA={isin:'NL0000852564',symbol:'AALB',name:'Aalberts'};
const b={isin:'BE0974293251',symbol:'ABI',name:'AB InBev'};
const d=(label,shares)=>({label,document:{shares}});
const result=compareMarkets([d('XAMS',[crossMarketA,b]),d('XBRU',[{...crossMarketA,symbol:'AALB2'},{...b,symbol:'AALB'}])]);
assert.equal(result.crossMarketSameIsin.length,2);
assert.equal(result.symbolCollisions.length,1);
assert.equal(result.symbolCollisions[0].symbol,'AALB');
assert.equal(result.automaticExclusions,0);
assert.equal(compareMarkets([d('XAMS',[crossMarketA]),d('XBRU',[b])]).crossMarketSameIsin.length,0);


console.log('Euronext catalog and cross-market integrity tests passed');
