import {fetchConfiguredHistory} from './source-policy.mjs';
import os from 'node:os';import path from 'node:path';
import {archiveApprovedSessions} from '../cloudflare/archive-approved-session.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
import {parseEuronextQuoteHeader,corroboratedEuronextNoTrade} from './providers/euronext-live.mjs';
import {latestClosedSession,sessionCalendar} from './trading-calendar.mjs';
import {identityEventAt} from './company-register.mjs';
import {collectApprovedSession} from '../cloudflare/approved-daily-session.mjs';
import {dailyStateLabel} from '../../daily-session-view.mjs';
const raw=JSON.parse(gunzipSync(await fs.readFile('research/completion/2026-11-17/individual-session-evidence.json.gz')));
assert.equal(raw.records.length,152);
let verified=0;
for(const r of raw.records){
 const header=parseEuronextQuoteHeader(r.quoteHtml||'',r),bar=r.history?.find(b=>b.date===r.session),valid=corroboratedEuronextNoTrade(header,bar,r.session,r.checkedAt);
 if(valid){verified++;assert.equal(r.resolution,'OFFICIAL_NO_TRADES');assert(header.lastTradeDate<r.session);}
 assert.equal(corroboratedEuronextNoTrade({...header,identityMatch:false},bar,r.session,r.checkedAt),false);
 assert.equal(corroboratedEuronextNoTrade({...header,lastTradeDate:null},bar,r.session,r.checkedAt),false,'Reference-only candles never prove no trade by themselves');
 assert.equal(corroboratedEuronextNoTrade({...header,lastTradeDate:'2026-11-17'},bar,r.session,r.checkedAt),false,'A later trade cannot prove a prior-day absence');
 assert.equal(corroboratedEuronextNoTrade(header,bar,r.session,'2026-11-30T12:00:00Z'),false,'Do not infer an old session from an unbounded later snapshot');
}
assert(verified>0);
for(const market of ['XAMS','XBRU','XPAR']){
 assert.equal(latestClosedSession(market,new Date('2026-11-16T09:00:00Z')),'2026-11-13');
 assert.equal(latestClosedSession(market,new Date('2026-11-16T18:00:00Z')),'2026-11-16');
 assert.equal(latestClosedSession(market,new Date('2026-04-06T20:00:00Z')),'2026-04-02');
 assert.equal(latestClosedSession(market,new Date('2026-12-25T20:00:00Z')),'2026-12-24');
 assert.equal(latestClosedSession(market,new Date('2026-03-30T16:00:00Z')),'2026-03-27','CEST collection boundary');
 assert.equal(sessionCalendar(market,'2026-12-24').halfDay,true);
}
assert.throws(()=>sessionCalendar('XAMS','2028-01-03'),/YEAR_NOT_APPROVED/);
assert.equal(identityEventAt('FR00140062B9','2026-11-16'),null);
assert.equal(identityEventAt('FR00140062B9','2026-11-17').newIsin,'FR001401B9V8');
await assert.rejects(()=>fetchConfiguredHistory({}, {isin:'FR00140062B9',mic:'ALXP'},{startDate:'2026-11-16',endDate:'2026-11-17'}),/IDENTITY_CHANGED/);
const quarantined=await collectApprovedSession({market:'XPAR',session:'2026-11-17',now:new Date('2026-11-17T20:00:00Z'),catalog:{shares:[{name:'TOOSLA',symbol:'ALTOO',isin:'FR00140062B9',mic:'ALXP'}]},official:()=>{throw Error('Must not query a retired identity')},registry:{fetchDaily(){throw Error('Must not borrow successor prices')}}});
assert.equal(quarantined.results[0].reasonCode,'IDENTITY_CHANGED');assert.equal(quarantined.results[0].bar,null);
assert.equal(dailyStateLabel({status:'NO_TRADES'}),'Geen handel (officieel)');
console.log('152 actual session cases, corroborated no-trade proof, holiday/DST calendar and ISIN succession protection PASS');

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'real-session-replay-')),inputDir=path.join(temporary,'input'),dataDir=path.join(temporary,'data');await fs.mkdir(inputDir,{recursive:true});
try{
 const snapshots=[];
 for(const market of ['XAMS','XBRU','XPAR']){const snapshot=JSON.parse(gunzipSync(await fs.readFile('research/completion/2026-11-17/verified-session-'+market+'.json.gz')));snapshots.push(snapshot);await fs.writeFile(path.join(inputDir,'daily-session-'+market+'.json'),JSON.stringify(snapshot));}
 const first=await archiveApprovedSessions({inputDir,dataDir});assert.equal(first.errors.length,0);assert.equal(first.markets.length,snapshots.length);
 const files=await fs.readdir(path.join(dataDir,'history')),before=await Promise.all(files.map(async file=>[file,await fs.readFile(path.join(dataDir,'history',file),'utf8')]));
 await archiveApprovedSessions({inputDir,dataDir});for(const [file,raw]of before)assert.equal(await fs.readFile(path.join(dataDir,'history',file),'utf8'),raw);
 for(const s of snapshots)await fs.writeFile(path.join(inputDir,'daily-session-'+s.market+'.json'),JSON.stringify({...s,results:s.results.map(r=>({...r,status:'SESSION_UNVERIFIED',bar:null}))}));
 const replay=await archiveApprovedSessions({inputDir,dataDir});assert.equal(replay.errors.length,0);
 for(const s of snapshots){const saved=JSON.parse(await fs.readFile(path.join(dataDir,'daily-session-'+s.market+'.json')));assert.deepEqual(saved.counts,s.counts,'Weaker late evidence must preserve previously proven trades and no-trade sessions');}
 console.log('Full 849-company evidence archive, append-only histories and preservation of proved NO_TRADES PASS');
}finally{await fs.rm(temporary,{recursive:true,force:true});}
