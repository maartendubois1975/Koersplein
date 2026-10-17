import assert from 'node:assert/strict';
import {parseTXSESymbols,buildTXSECatalog} from './usa-txse-catalog.mjs';
const h='SymbolRoot|SymbolSuffix|SymbolID|StreamID|LotSize|IsTest|ETF|TXSEListed';
const lines=['TCBI||1|12|100|N|N|Y','TCBI|PRB|2|12|100|N|N|Y','DDS||3|12|40|N|N|Y',
 'DDT||4|12|100|N|N|Y','SCHW||5|12|100|N|N|N','ETF||6|12|100|N|Y|Y','TEST||7|12|100|Y|N|Y'];
const raw=h+'\n'+lines.join('\n')+'\n';
const rows=parseTXSESymbols(raw);
assert.equal(rows.length,7);
const other=[
 {'ACT Symbol':'TCBI','Security Name':'Texas Capital Bancshares, Inc. Common Stock',Exchange:'F',ETF:'N','Test Issue':'N'},
 {'ACT Symbol':'DDS','Security Name':"Dillard's, Inc. Common Stock",Exchange:'F',ETF:'N','Test Issue':'N'},
 {'ACT Symbol':'DDT','Security Name':"Dillard's Capital Trust I",Exchange:'F',ETF:'N','Test Issue':'N'},
 {'ACT Symbol':'SCHW','Security Name':'The Charles Schwab Corporation Common Stock',Exchange:'N',ETF:'N','Test Issue':'N'}
];
const {securities,summary}=buildTXSECatalog(rows,other,{source:'fixture',observedAt:'2026-10-16T00:00:00Z'});
const status=s=>securities.find(x=>x.symbolKey===s).status;
assert.equal(status('TCBI|'),'COMMON_CANDIDATE_NOT_VERIFIED');
assert.equal(status('DDS|'),'COMMON_CANDIDATE_NOT_VERIFIED');
assert.equal(status('DDT|'),'QUARANTINE_SECURITY_TYPE');
assert.equal(status('TCBI|PRB'),'QUARANTINE_SUFFIX_SHARE_CLASS');
assert.equal(status('ETF|'),'EXCLUDED_ETF');
assert.equal(status('TEST|'),'EXCLUDED_TEST');
assert.equal(securities.some(x=>x.symbol==='SCHW'),false);
assert.equal(summary.tradableSymbolCount,7);
assert.equal(summary.txseListedFlagCount,6);
assert.equal(summary.verifiedCommonStocks,0);
assert.ok(securities.every(x=>x.isin===null&&!x.eligibleForTraining));
assert.throws(()=>parseTXSESymbols(raw.replace('TXSEListed','Listed')),/UNEXPECTED_HEADER/);
assert.throws(()=>parseTXSESymbols(h+'\n'+lines[0]+'\n'+lines[0]),/DUPLICATE_SYMBOL/);
assert.throws(()=>parseTXSESymbols(h+'\n'+lines[0].replace('|N|N|Y','|N|?|Y')),/INVALID_FLAG/);
assert.throws(()=>parseTXSESymbols(h+'\nTCBI||1|12|100|N|N'),/MALFORMED_ROW/);
assert.throws(()=>parseTXSESymbols(h+'\n'),/NO_ROWS/);
console.log('TXSE official directory regressions passed: 16');
