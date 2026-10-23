import assert from 'node:assert/strict';
import {parseSixIpoPairs} from './six-ipo-symbol-evidence.mjs';
const html='<section><h2>Matador</h2>ISIN : CH0042797206 <span>Symbol : SQL</span></section>'+
 '<div>ISIN : CH1216478797 Symbol : DSFIR</div>'+
 '<div>ISIN : AT0000KTMI02 Symbol : KTMI</div>'+
 '<div>ISIN : AT0000KTMI02 Symbol : BMAG</div>'+
 '<script>ISIN : CH0000000000 Symbol : FAKE</script>';
const map=parseSixIpoPairs(html);
assert.deepEqual([...map.get('CH0042797206')],['SQL']);
assert.deepEqual([...map.get('CH1216478797')],['DSFIR']);
assert.deepEqual([...map.get('AT0000KTMI02')].sort(),['BMAG','KTMI']);
assert.equal(map.has('CH0000000000'),false);
assert.equal(map.size,3);
console.log('SIX IPO reference parser and ambiguous historical symbols: PASS');
