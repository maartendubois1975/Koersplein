import assert from 'node:assert/strict';
import {parseUSDirectory} from './usa-directory-parse.mjs';
import {buildNasdaqCatalog,pltrMICAt} from './usa-nasdaq-catalog.mjs';
const fields=['Symbol','Security Name','Market Category','Test Issue','Financial Status','Round Lot Size','ETF','NextShares'];
const samples=[
 ['AAPL','Apple Inc. - Common Stock','Q','N','N','40','N','N'],
 ['AACIU','Acquisition Corp. - Units','G','N','N','100','N','N'],
 ['AACIW','Acquisition Corp. - Warrant','G','N','N','100','N','N'],
 ['AACG','Issuer - American Depositary Shares','S','N','D','100','N','N'],
 ['AGNCP','Issuer - Depositary Shares representing Preferred Stock','Q','N','N','100','N','N'],
 ['AAAP','Pacer ETF','G','N','N','100','Y','N'],
 ['TEST','Test Common Stock','G','Y','N','100','N','N'],
 ['NEXT','NextShares fund','G','N','N','100','N','Y']
];
const raw=[fields.join('|'),...samples.map(x=>x.join('|')),'File Creation Time: 1016202603:03|||||||'].join('\n');
const parsed=parseUSDirectory(raw,fields);
assert.equal(parsed.rows.length,8);
assert.equal(parsed.sourceTimestamp,'1016202603:03');
const synthetic=Array.from({length:1000},(_,i)=>({
 Symbol:'ZZ'+String(i).padStart(4,'0'),'Security Name':'Synthetic Common Stock',
 'Market Category':'S','Test Issue':'N','Financial Status':'N','Round Lot Size':'100',ETF:'N',NextShares:'N'}));
const input=[...parsed.rows,...synthetic];
const meta={source:'test',sourceTimestamp:parsed.sourceTimestamp,sourceSha256:parsed.sha256,generatedAt:'2026-10-16T00:00:00Z'};
const {securities,summary}=buildNasdaqCatalog(input,meta);
assert.equal(summary.totalNasdaqListings,1008);
assert.equal(summary.excludedTestIssues,1);
assert.equal(summary.excludedETFs,1);
assert.equal(summary.excludedNextShares,1);
assert.equal(summary.nonETFCandidates,1005);
assert.equal(summary.flaggedFinancialStatus,1);
for(const [symbol,type] of [['AAPL','COMMON_CANDIDATE'],['AACIU','UNIT'],['AACIW','WARRANT'],['AACG','ADR'],['AGNCP','PREFERRED']])
 assert.equal(securities.find(r=>r.symbol===symbol).securityType,type);
assert.equal(securities.find(r=>r.symbol==='AAPL').isin,null);
assert.equal(securities.find(r=>r.symbol==='AAPL').eligibleForTraining,false);
assert.equal(summary.usableForTraining,0);
assert.equal(summary.historicalDelistedCoverageVerified,false);
assert.throws(()=>buildNasdaqCatalog([...input,input[0]],meta),/DUPLICATE_NASDAQ_SYMBOL/);
assert.throws(()=>buildNasdaqCatalog(input.map((r,i)=>i?r:{...r,'Market Category':'N'}),meta),/INVALID_NASDAQ_MARKET_CATEGORY/);
assert.throws(()=>buildNasdaqCatalog(input.map((r,i)=>i?r:{...r,NextShares:'?'}),meta),/INVALID_NASDAQ_NEXTSHARES_FLAG/);
assert.throws(()=>buildNasdaqCatalog(input.map((r,i)=>i?r:{...r,'Round Lot Size':'0'}),meta),/INVALID_NASDAQ_ROUND_LOT/);

const pltr={...synthetic[0],Symbol:'PLTR','Security Name':'Palantir Technologies Inc. - Class A Common Stock'};
const pltrRecord=buildNasdaqCatalog([...input,pltr],meta).securities.find(r=>r.symbol==='PLTR');
assert.equal(pltrRecord.issuerCIK,'0001321655');
assert.equal(pltrRecord.shareClass,'Class A Common Stock');
assert.equal(pltrRecord.historicalListingEvidence.evidenceAvailableAt,'2025-02-18');
assert.equal(pltrRecord.historicalListingEvidence.status,'SEC_REPORTED_NOT_PIT_CERTIFIED');
assert.equal(pltrRecord.verifiedCommonStock,false);
assert.equal(pltrRecord.eligibleForTraining,false);
assert.equal(pltrRecord.isin,null);
assert.equal(pltrRecord.activeTradingStatus,'UNVERIFIED');
for(const [d,mic] of [['2020-09-29',null],['2020-09-30','XNYS'],['2024-11-25','XNYS'],['2024-11-26','XNAS'],['2026-10-16','XNAS'],['2024-02-31',null],['invalid',null]])
  assert.equal(pltrMICAt(d),mic);
assert.throws(()=>buildNasdaqCatalog([...input,{...pltr,'Security Name':'Palantir Technologies Inc. - Class B Common Stock'}],meta),/PLTR_SEC_ISSUER_OR_SHARE_CLASS_CONFLICT/);
assert.throws(()=>buildNasdaqCatalog([...input,pltr],{...meta,sourceTimestamp:'1125202421:31'}),/PLTR_NASDAQ_DIRECTORY_PREDATES_TRANSFER/);
console.log('Nasdaq official directory and PLTR effective-date regressions passed');
