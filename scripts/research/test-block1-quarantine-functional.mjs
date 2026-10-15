import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('./block1-instrument-quarantine.mjs',import.meta.url));
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'koersplein-block1-'));
const markets=Array.from({length:31},(_,i)=>({code:'t'+String(i).padStart(2,'0'),mic:'X'+String(i).padStart(3,'0'),name:'Fixture '+i}));
const good={symbol:'TEST',isin:'US0378331005',instrumentType:'COMMON_STOCK',classificationSource:'official-registry',officialRegisterEvidence:{sourceUrl:'https://example.org/register',recordId:'record-1',verifiedAt:'2026-10-15T00:00:00Z',reviewer:'fixture-reviewer',isin:'US0378331005',mic:markets[0].mic,instrumentType:'COMMON_STOCK'}};
const run=()=>spawnSync(process.execPath,[script],{cwd:temp,encoding:'utf8'});
async function setup(){
 await fs.mkdir(path.join(temp,'data'),{recursive:true});
 await fs.writeFile(path.join(temp,'data/world-fill-plan.json'),JSON.stringify({markets}));
 for(const m of markets)await fs.writeFile(path.join(temp,'data','euronext-'+m.code+'.json'),JSON.stringify([]));
}
async function scenario(name,items,expected,exit=1){
 await fs.writeFile(path.join(temp,'data','euronext-'+markets[0].code+'.json'),JSON.stringify(items));
 const p=run();
 assert.equal(p.status,exit,name+' exit: '+p.stderr);
 const report=JSON.parse(await fs.readFile(path.join(temp,'research/output/machine-arena/block1-instrument-quarantine.json'),'utf8'));
 for(const issue of expected)assert.ok(report.markets[0].records.some(r=>r.issues.includes(issue)),name+': '+issue);
 console.log('PASS '+name);
}
try {
 await setup();
 await scenario('no source evidence',[{...good,officialRegisterEvidence:undefined}],['MISSING_INDEPENDENT_REGISTER_EVIDENCE']);
 await scenario('invalid ISIN',[{...good,isin:'US0000000000'}],['INVALID_ISIN']);
 await scenario('duplicate listing',[good,{...good}],['DUPLICATE_LISTING_SYMBOL']);
 await scenario('wrong venue',[{...good,mic:'X999'}],['MIC_REQUIRES_OFFICIAL_SEGMENT_REVIEW']);
 await scenario('missing listing',[{...good,symbol:''}],['MISSING_LISTING_SYMBOL']);
 await scenario('unverified classification',[{...good,classificationSource:undefined}],['UNVERIFIED_SECURITY_TYPE']);
 await scenario('valid fixture passes listing syntax gate',[good],[],0);
 const p=run();assert.equal(p.status,0);
 const report=JSON.parse(await fs.readFile(path.join(temp,'research/output/machine-arena/block1-instrument-quarantine.json'),'utf8'));
 assert.equal(report.totals.verifiedCommonShares,1);
 assert.equal(report.totals.quarantined,0);
 // Quarantine checks listing rows; separate readiness must still block official certification.
 console.log('PASS positive listing fixture stays structure-only, not production certification');
} finally {await fs.rm(temp,{recursive:true,force:true});}
