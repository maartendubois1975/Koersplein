import assert from 'node:assert/strict';
import {classifyUSListing, classifySummary} from './usa-security-type.mjs';
import {parseUSDirectory} from './usa-directory-parse.mjs';

const cases = [
  ['AAC.U', 'Ares Acquisition Corporation III Units, each consisting of one Class A ordinary share and one-tenth of one redeemable warrant', 'UNIT'],
  ['AIIA.U', 'AI Infrastructure Acquisition Corp. Units, each consisting of one Class A Ordinary Share and one Right', 'UNIT'],
  ['AAC.W', 'Ares Acquisition Corporation III Redeemable warrants', 'WARRANT'],
  ['AIIA.R', 'AI Infrastructure Acquisition Corp. Rights', 'RIGHT'],
  ['ABR$D', 'Arbor Realty Trust 6.375% Series D Cumulative Redeemable Preferred Stock', 'PREFERRED'],
  ['ABEV', 'Ambev S.A. American Depositary Shares (Each representing 1 Common Share)', 'ADR'],
  ['ABXL', 'Abacus Global Management, Inc. 9.875% Fixed Rate Senior Notes due 2028', 'DEBT'],
  ['A', 'Agilent Technologies, Inc. Common Stock', 'COMMON_CANDIDATE'],
  ['AAP', 'Advance Auto Parts Inc.', 'REVIEW'],
  ['AB', 'AllianceBernstein Holding L.P. Units', 'UNIT'],
  ['ACP', 'abrdn Income Credit Strategies Fund Common Shares', 'COMMON_CANDIDATE'],
];
for (const [symbol, name, type] of cases)
  assert.equal(classifyUSListing({symbol, name}).type, type, symbol);
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
console.log('US directory/classification regressions passed: 21');
