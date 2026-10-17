import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {selectVerifiedNYSEHistoryUniverse} from './usa-history-eligibility.mjs';
const script=fileURLToPath(new URL('./usa-nyse-history.mjs',import.meta.url));
const stock={symbol:'TEST',exchange:'XNYS',securityType:'COMMON_CANDIDATE',
 verifiedCommonStock:true,officialListingVerified:true,officialListingStatus:'ACTIVE',
 activeTradingVerified:true,officialTradingStatus:'ACTIVE',issuerIdentityVerified:true,
 shareClassVerified:true,shareClass:'COMMON',isinVerified:true,isin:'US0000000000',
 listingEvidenceUrl:'https://example.org/listing',tradingEvidenceUrl:'https://example.org/trading'};
assert.equal(selectVerifiedNYSEHistoryUniverse([{...stock,securityType:'FUND_REVIEW'}]).approved.length,0);
assert.equal(selectVerifiedNYSEHistoryUniverse([{...stock,exchange:'XNAS'}]).approved.length,0);
assert.equal(selectVerifiedNYSEHistoryUniverse([{...stock,activeTradingVerified:false}]).approved.length,0);
const bar={t:'2026-10-16T04:00:00Z',o:10,h:12,l:9,c:11,v:100,n:2};
const cases=[
 {name:'unverified',securities:[{...stock,verifiedCommonStock:false}],rights:true,creds:true,expected:'NO_VERIFIED_NYSE_HISTORY_UNIVERSE',approved:0},
 {name:'fund',securities:[{...stock,securityType:'FUND_REVIEW'}],rights:true,creds:true,expected:'NO_VERIFIED_NYSE_HISTORY_UNIVERSE',approved:0},
 {name:'rights',securities:[stock],rights:false,creds:true,expected:'USA_HISTORY_SIP_RIGHTS_NOT_APPROVED',approved:1},
 {name:'credentials',securities:[stock],rights:true,creds:false,expected:'ALPACA_CREDENTIALS_MISSING',approved:1},
 {name:'zero open',securities:[stock],rights:true,creds:true,bars:[{...bar,o:0}],expected:'INVALID_PRICE',approved:1},
 {name:'duplicate date',securities:[stock],rights:true,creds:true,bars:[bar,bar],expected:'NON_INCREASING_TRADING_DATES',approved:1}
];
for(const c of cases){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kp-usa-guards-'));
 try{
  const dir=path.join(tmp,'research/output/usa/XNYS');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'universe.json'),JSON.stringify({securities:c.securities}));
  const stub=path.join(tmp,'fetch-stub.mjs');
  fs.writeFileSync(stub,`globalThis.fetch=async()=>({ok:true,json:async()=>({bars:${JSON.stringify(c.bars||[])},next_page_token:null})});`);
  const env={...process.env,USA_HISTORY_SIP_RIGHTS_APPROVED:c.rights?'true':'false',
   ALPACA_API_KEY_ID:c.creds?'TEST_ONLY':'',ALPACA_API_SECRET_KEY:c.creds?'TEST_ONLY':'',
   NYSE_HISTORY_START:'2026-10-01',NYSE_HISTORY_END:'2026-10-16'};
  const r=spawnSync(process.execPath,['--import',stub,script],{cwd:tmp,env,encoding:'utf8',timeout:8000});
  assert.notEqual(r.status,0,c.name);
  const eligibility=JSON.parse(fs.readFileSync(path.join(dir,'history-eligibility.json')));
  assert.equal(eligibility.approved,c.approved,c.name);
  assert.equal(eligibility.publicationApproved,false,c.name);
  if(c.bars){
   const coverage=JSON.parse(fs.readFileSync(path.join(dir,'history-coverage.json')));
   assert.equal(coverage.results[0].status,'FAILED',c.name);
   assert.match(coverage.results[0].error,new RegExp(c.expected),c.name);
  }else assert.match(r.stderr,new RegExp(c.expected),c.name);
  assert.equal(fs.existsSync(path.join(dir,'history/TEST.json')),false,c.name);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
console.log('USA history import guards passed: '+cases.length);
