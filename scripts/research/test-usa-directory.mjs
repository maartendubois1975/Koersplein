import assert from 'node:assert/strict';
import {classifyUSListing, classifySummary, triageUSCatalogCandidate} from './usa-security-type.mjs';
import {parseUSDirectory} from './usa-directory-parse.mjs';

const cases = [
  ['AAC.U', 'Ares Acquisition Corporation III Units, each consisting of one Class A ordinary share and one-tenth of one redeemable warrant', 'UNIT'],
  ['AIIA.U', 'AI Infrastructure Acquisition Corp. Units, each consisting of one Class A Ordinary Share and one Right', 'UNIT'],
  ['AAC.W', 'Ares Acquisition Corporation III Redeemable warrants', 'WARRANT'],
  ['AIIA.R', 'AI Infrastructure Acquisition Corp. Rights', 'RIGHT'],
  ['ABR$D', 'Arbor Realty Trust 6.375% Series D Cumulative Redeemable Preferred Stock', 'PREFERRED'],
  ['ABEV', 'Ambev S.A. American Depositary Shares (Each representing 1 Common Share)', 'ADR'],
  ['AGMB', 'AgomAb Therapeutics N.V. - ADRs', 'ADR'],
  ['ADSS', 'Issuer - ADSs', 'ADR'],
  ['ABXL', 'Abacus Global Management, Inc. 9.875% Fixed Rate Senior Notes due 2028', 'DEBT'],
  ['EVN', 'Eaton Vance Municipal Income Trust Common Stock', 'TRUST_COMMON_REVIEW'],
  ['IIM', 'Invesco Value Municipal Income Trust Common Stock', 'TRUST_COMMON_REVIEW'],
  ['CRT', 'Cross Timbers Royalty Trust Common Stock', 'TRUST_COMMON_REVIEW'],
  ['ABR', 'Arbor Realty Trust Common Stock', 'TRUST_COMMON_REVIEW'],
  ['GUT', 'Gabelli Utility Trust (The) Common Stock', 'TRUST_COMMON_REVIEW'],
  ['GAB', 'Gabelli Equity Trust, Inc. (The) Common Stock', 'FUND_REVIEW'],
  ['GGT', 'Gabelli Multi-Media Trust, Inc. (The) Common Stock', 'FUND_REVIEW'],
  ['IGI', 'Western Asset Investment Grade Opportunity Trust Inc. Common Stock', 'FUND_REVIEW'],
  ['NXP', 'Nuveen Select Tax Free Income Portfolio Common Stock', 'FUND_REVIEW'],
  ['RGT', 'Royce Global Trust, Inc. Common Stock', 'FUND_REVIEW'],
  ['RMT', 'Royce Micro-Cap Trust, Inc. Common Stock', 'FUND_REVIEW'],
  ['RVT', 'Royce Small-Cap Trust, Inc. Common Stock', 'FUND_REVIEW'],
  ['AAT', 'American Assets Trust, Inc. Common Stock', 'COMMON_CANDIDATE'],
  ['A', 'Agilent Technologies, Inc. Common Stock', 'COMMON_CANDIDATE'],
  ['AAP', 'Advance Auto Parts Inc.', 'REVIEW'],
  ['AB', 'AllianceBernstein Holding L.P. Units', 'UNIT'],
  ['ACP', 'abrdn Income Credit Strategies Fund Common Shares', 'FUND_REVIEW'],
  ['AMH', 'American Homes 4 Rent Common Shares of Beneficial Interest', 'BENEFICIAL_INTEREST_REVIEW'],
  ['BCAT', 'BlackRock Capital Allocation Term Trust Common Shares of Beneficial Interest', 'BENEFICIAL_INTEREST_REVIEW'],
  ['BCX', 'BlackRock Resources Common Shares of Beneficial Interest', 'BENEFICIAL_INTEREST_REVIEW'],
  ['BIT', 'BlackRock Multi-Sector Income Trust Common Shares of Beneficial Interest', 'BENEFICIAL_INTEREST_REVIEW'],
  ['DHC', 'Diversified Healthcare Trust - Common Shares of Beneficial Interest', 'BENEFICIAL_INTEREST_REVIEW'],
  ['ILPT', 'Industrial Logistics Properties Trust - Common Shares of Beneficial Interest', 'BENEFICIAL_INTEREST_REVIEW'],
  ['OPI', 'Office Properties Income Trust - Common shares of beneficial interest', 'BENEFICIAL_INTEREST_REVIEW'],
  ['SVC', 'Service Properties Trust - Common Shares of Beneficial Interest', 'BENEFICIAL_INTEREST_REVIEW'],
];
for (const [symbol, name, type] of cases) {
  const classification=classifyUSListing({symbol,name});
  assert.equal(classification.type,type,symbol);
  const triage=triageUSCatalogCandidate(classification);
  assert.equal(triage.catalogStatus,type==='COMMON_CANDIDATE'?'COMMON_CANDIDATE_NOT_VERIFIED':'QUARANTINE_SECURITY_TYPE',symbol);
  assert.equal(triage.quarantineReason,type==='COMMON_CANDIDATE'?null:'SECURITY_TYPE_NOT_VERIFIED',symbol);
}
assert.equal(classifyUSListing({symbol:'GAB$A',name:'Gabelli Equity Trust Preferred Stock'}).type,'PREFERRED');
assert.equal(classifyUSListing({symbol:'NXP.U',name:'Nuveen Portfolio Common Stock Units'}).type,'UNIT');
assert.equal(classifyUSListing({symbol:'NXP',name:'Nuveen Portfolio Common Stock',etf:'Y'}).type,'ETF');
assert.equal(triageUSCatalogCandidate(null).catalogStatus,'QUARANTINE_SECURITY_TYPE');
assert.equal(classifyUSListing({symbol:'A',name:'Common Stock',etf:'Y'}).type,'ETF');
assert.equal(classifyUSListing({symbol:'A',name:'Common Stock',testIssue:'Y'}).type,'TEST');
assert.equal(classifyUSListing({symbol:'A',name:'Common Stock',etf:'?'}).type,'REVIEW');
assert.equal(classifyUSListing({symbol:'',name:'Common Stock'}).type,'REVIEW');
assert.deepEqual(classifySummary([{securityType:'UNIT'},{securityType:'UNIT'},{securityType:'ADR'}]),{ADR:1,UNIT:2});
const fields=['ACT Symbol','Security Name','Exchange','ETF','Test Issue'];
const valid='ACT Symbol|Security Name|Exchange|ETF|Test Issue\nAAC.U|Acquisition Units, with warrants|N|N|N\nFile Creation Time: 101620260900||||||';
const parsed=parseUSDirectory(valid,fields);
assert.equal(parsed.rows.length,1);
assert.equal(parsed.sourceTimestamp,'101620260900');
assert.equal(parsed.sha256.length,64);
assert.throws(()=>parseUSDirectory(valid.replace('File Creation Time:','Wrong Footer:'),fields),/MISSING_DIRECTORY_FOOTER/);
assert.throws(()=>parseUSDirectory(valid.replace('N|N|N','N|?|N'),fields),/INVALID_DIRECTORY_FLAG/);
assert.throws(()=>parseUSDirectory(valid.replace('N|N|N','N|N'),fields),/MALFORMED_DIRECTORY_ROW/);
assert.throws(()=>parseUSDirectory(valid.replace('ETF|Test Issue','ETF|ETF'),fields),/DUPLICATE_DIRECTORY_HEADER/);
console.log('US directory/classification regressions passed: 54');
