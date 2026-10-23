import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseSixSponsoredAdmissions,compareSixSponsoredWithYahoo,SIX_SPONSORED_SOURCE} from './six-sponsored-reference.mjs';
const html='<html><body>Company Symbol ISIN Country Trading Currency First Trading Date '+
 'ALMONTY INDUSTRY O.N. ALM CA0203987072 Canada CHF 01.07.2026 '+
 'ALMONTY INDUSTRY O.N. ALM CA0203987072 Canada USD 01.07.2026 '+
 'ADYEN N.V. ADYEN NL0012969182 Netherlands CHF 28.01.2026 '+
 'AIR LIQUIDE AI1 FR0000120073 France CHF 17.04.2026 '+
 '<script> FAKE BAD CH0000000001 Switzerland CHF 01.01.2026 </script></body></html>';
const rows=parseSixSponsoredAdmissions(html);
assert.equal(rows.length,4);
assert.deepEqual(rows.filter(x=>x.isin==='CA0203987072').map(x=>x.currency),['CHF','USD']);
assert.equal(rows.find(x=>x.isin==='NL0012969182').ticker,'ADYEN');
assert.ok(!rows.some(x=>x.isin==='CH0000000001'));
const verified=(isin,symbol,currency='CHF')=>({mic:'XSWX',isin,providerSymbol:symbol+'.SW',currency,status:'YAHOO_VENUE_CURRENCY_OHLC_MATCH_OFFICIAL_ISIN_STILL_REQUIRED'});
const results=compareSixSponsoredWithYahoo([
 verified('CA0203987072','ALM'),
 verified('NL0012969182','WRONG'),
 verified('FR0000120073','AI1','EUR'),
 verified('CH0000000002','UNKNOWN'),
 {...verified('CA0203987072','ALM'),status:'YAHOO_SYMBOL_NOT_FOUND'},
 {...verified('CA0203987072','ALM'),mic:'XLON'}
],rows);
assert.equal(results.length,5);
assert.equal(results[0].status,'OFFICIAL_SIX_SPONSORED_ISIN_TICKER_CURRENCY_AND_YAHOO_MATCH');
assert.equal(results[0].officialFirstTradingDate,'01.07.2026');
assert.equal(results[0].requiresLicenceReview,true);
assert.equal(results[1].status,'SIX_OFFICIAL_SYMBOL_DIFFERS');
assert.deepEqual(results[1].officialSymbols,['ADYEN']);
assert.equal(results[2].status,'NOT_FOUND_IN_SIX_SPONSORED_SEGMENT');
assert.equal(results[3].status,'NOT_FOUND_IN_SIX_SPONSORED_SEGMENT');
assert.equal(results[4].status,'YAHOO_INDEPENDENT_EVIDENCE_NOT_READY');
assert.equal(SIX_SPONSORED_SOURCE,'https://www.six-group.com/en/market-data/shares/sponsored-foreign-shares.html');
const runner=await fs.readFile('scripts/cloudflare/six-sponsored-identity-probe.mjs','utf8');
for(const unsafe of ['FactoryApiClient','seedCatalog(','putPartition(','completeHistory('])assert.ok(!runner.includes(unsafe));
assert.match(runner,/officialRows.length<50/);
console.log('Official SIX sponsored admissions ISIN/symbol/currency, duplicate currency lines, source credibility and no-write safeguards PASS');

const sharedSymbolRows=[...rows,{isin:'CH0000000002',ticker:'ALM',currency:'CHF',country:'Switzerland',firstTradingDate:'02.07.2026'}];
const collision=compareSixSponsoredWithYahoo([verified('CA0203987072','ALM')],sharedSymbolRows);
assert.equal(collision[0].status,'SIX_OFFICIAL_TICKER_SHARED_BY_MULTIPLE_ISINS');
assert.equal(collision[0].ownerCount,2,'Same SIX symbol and currency assigned to two ISINs must never be accepted as unique');
const request=JSON.parse(await fs.readFile('config/openfigi-yahoo-verify-request.json','utf8'));
assert.equal(request.mode,'READ_ONLY_REFERENCE_VALIDATION');
assert.ok(Number.isSafeInteger(request.sourceRunId)&&request.sourceRunId>0);
assert.ok(Number.isSafeInteger(request.swissYahooRunId)&&request.swissYahooRunId>0,'Swiss source evidence run ID must be configured');
assert.ok(request.scope.includes('XSWX')&&request.scope.includes('XLON'));
assert.match(runner,/yahoo\.sourceRunId!==request\.sourceRunId/);
assert.match(runner,/yahoo\.offset!==0/);
const workflow=await fs.readFile('.github/workflows/europe-openfigi-yahoo-verification.yml','utf8');
assert.match(workflow,/swissYahooRunId/);
assert.match(workflow,/six-sponsored-identity-probe\.mjs/);
assert.match(workflow,/Optional official SIX admission check[^\n]*\n\s*continue-on-error: true/,'Unavailable dynamic SIX table must not invalidate independent Yahoo evidence');
console.log('SIX provenance, missing-source prevention, shared-ticker ISIN collisions and read-only workflow guards PASS');
