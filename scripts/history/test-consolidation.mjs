import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadCompanyCatalog, validateCompanyCatalog } from './company-register.mjs';
import { providerRoute, fetchConfiguredHistory } from './source-policy.mjs';
import { ProviderRegistry } from './provider-registry.mjs';
import { openDatabase } from '../factory/db.mjs';
import { seedAmsterdam, getInstrument } from '../factory/catalog.mjs';
import { storeBars } from '../factory/history-store.mjs';
import { validateInstrumentHistory } from '../factory/jobs.mjs';
import { computeMovers } from './bars.mjs';
import { sessionReadiness } from './session-readiness.mjs';
const root = new URL('../../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path,root),'utf8'));
for (const [mic,count] of [['XAMS',80],['XBRU',105]]) {
  const catalog=await loadCompanyCatalog(mic);
  assert.equal(catalog.shares.length,count);
  const changed=structuredClone(catalog);changed.shares[0].symbol+='INVALID';
  assert.throws(()=>validateCompanyCatalog(changed),/identities changed/);
  const duplicate=structuredClone(catalog);duplicate.shares[1]=duplicate.shares[0];
  assert.throws(()=>validateCompanyCatalog(duplicate),/Duplicate/);
  assert.throws(()=>validateCompanyCatalog({...catalog,shares:catalog.shares.slice(1)}),/count mismatch/);
}
const brussels=await loadCompanyCatalog('XBRU');
assert.deepEqual(brussels.shares.reduce((acc,s)=>(acc[s.primaryMic]=(acc[s.primaryMic]||0)+1,acc),{}),{XBRU:94,ALXB:6,MLXB:5});
const history=await read('data/history/NL0010273215.json');
const bars=history.bars.slice(-2);
const range={startDate:bars[0].date,endDate:bars[1].date};
for (const mic of ['XAMS','XBRU','XPAR','XLON']) {
  const instrument={...history.instrument,mic,market:mic};
  assert.equal(computeMovers([{instrument,bars,provider:'test'}])[0]?.mic,mic);
  const report=sessionReadiness([{isin:instrument.isin,mic,latestDate:bars[1].date,open:bars[1].open,close:bars[1].close}],1);
  assert.equal(report.completeForObservedSession,true);
  assert.equal(report.scope,'OBSERVED_SESSION_NOT_OFFICIAL_CLOSE');
}
assert.throws(()=>sessionReadiness([]),/Invalid session universe/);
assert.deepEqual(providerRoute({mic:'XAMS'},{mode:'update'}).allowedProviderIds,['euronext-live','yahoo-chart']);
for (const mic of ['XBRU','ALXB','MLXB']) assert.deepEqual(providerRoute({mic}).allowedProviderIds,['yahoo-chart']);
for (const [segment,parent] of Object.entries({EXGM:'XMIL',MTAA:'XMIL',MERK:'XOSL',XOAS:'XOSL',ALXL:'XLIS',XESM:'XDUB',XMSM:'XDUB',ALXP:'XPAR',FNSE:'XSTO'})) assert.deepEqual(providerRoute({mic:segment}),providerRoute({mic:parent}));
assert.throws(()=>providerRoute({mic:'UNKNOWN'}),/No approved source route/);
const calls=[];
const make=(id,bars,extra={})=>({id,supports:()=>true,async fetchDaily(){calls.push(id);return {bars,...extra};}});
let registry=new ProviderRegistry([make('euronext-live',bars.slice(0,1)),make('yahoo-chart',bars),make('unapproved',bars)]);
const selected=await fetchConfiguredHistory(registry,history.instrument,range,{mode:'update'});
assert.equal(selected.provider.id,'yahoo-chart');
assert.equal(selected.result.providerMeta.sourceSelectionReason,'SECONDARY_HAS_NEWER_EXECUTED_SESSION');
assert.deepEqual(calls,['euronext-live','yahoo-chart']);
calls.length=0;
registry=new ProviderRegistry([make('euronext-live',bars,{providerMeta:{partialHistory:true}}),make('yahoo-chart',bars),make('unapproved',bars)]);
assert.equal((await fetchConfiguredHistory(registry,history.instrument,range,{mode:'update'})).provider.id,'yahoo-chart');
assert.deepEqual(calls,['euronext-live','yahoo-chart']);
// Both timeout modes must run the same acceptance logic and never touch an unapproved source.
for (const timeoutMs of [0,50]) {
  calls.length=0;
  const providers=new ProviderRegistry([make('empty',[]),make('bad',bars.slice(0,1)),make('good',bars),make('unapproved',bars)]);
  const result=await providers.fetchDaily(history.instrument,range,'empty',{timeoutMs,allowedProviderIds:['empty','bad','good'],acceptResult:r=>r.bars.length===2});
  assert.equal(result.provider.id,'good');assert.deepEqual(calls,['empty','bad','good']);
}
let aborted=false;
registry=new ProviderRegistry([{id:'slow',supports:()=>true,fetchDaily(i,{signal}){return new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'));}));}},make('good',bars)]);
assert.equal((await registry.fetchDaily(history.instrument,range,'slow',{timeoutMs:5})).provider.id,'good');
assert.equal(aborted,true);
const directory=await mkdtemp(join(tmpdir(),'koersplein-readonly-'));
try {
  const path=join(directory,'test.sqlite');
  const db=openDatabase(path);
  await seedAmsterdam(db);
  const instrument=getInstrument(db,history.instrument.isin);
  storeBars(db,instrument,bars,history.provider.id);
  const statusBefore=db.prepare('SELECT * FROM history_status').all();
  assert.equal(validateInstrumentHistory(db,instrument).errors.length,0);
  assert.deepEqual(db.prepare('SELECT * FROM history_status').all(),statusBefore);
  db.close();
  const hash=async()=>createHash('sha256').update(await readFile(path)).digest('hex');
  const before=await hash();
  const result=spawnSync(process.execPath,['scripts/factory/cli.mjs','status'],{cwd:root,encoding:'utf8',env:{...process.env,KOERSPLEIN_DATABASE_PATH:path}});
  assert.equal(result.status,0,result.stderr);
  assert.ok(JSON.parse(result.stdout).some(s=>s.isin===instrument.isin));
  assert.equal(await hash(),before,'Status must not migrate, seed, or change database bytes');
  const ro=openDatabase(path,{readOnly:true});
  assert.throws(()=>ro.exec('DELETE FROM instruments'),/readonly|read-only/i);ro.close();
  const entries=await readdir(directory);
  const missing=spawnSync(process.execPath,['scripts/factory/cli.mjs','status'],{cwd:root,encoding:'utf8',env:{...process.env,KOERSPLEIN_DATA_DIR:join(directory,'missing')}});
  assert.notEqual(missing.status,0);assert.deepEqual(await readdir(directory),entries,'Absent database must not create files/directories');
} finally { await rm(directory,{recursive:true,force:true}); }
console.log('Consolidation: exact 80/105 identities, multi-market history, approved-only routing, fallbacks, timeout validation, read-only status: PASS');
