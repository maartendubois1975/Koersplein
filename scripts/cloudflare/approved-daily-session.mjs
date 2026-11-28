import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {loadCompanyCatalog,identityEventAt} from '../history/company-register.mjs';
import {marketSources,establishedMarkets} from '../history/market-definitions.mjs';
import {validateSnapshot} from './archive-approved-session.mjs';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {providerRoute} from '../history/source-policy.mjs';
import {officialDailyStatus} from '../history/official-daily-status.mjs';
import {inspectDailyBarIntegrity,mapConcurrent} from './europe-run-policy.mjs';
import {latestClosedSession,sessionCalendar} from '../history/trading-calendar.mjs';
import {listingIdentity,validSessionDate} from '../../daily-session-view.mjs';

export async function collectApprovedSession({market,session,now=new Date(),catalog,registry=createDefaultProviderRegistry(),official=officialDailyStatus,concurrency=4,priorSnapshot,sourceRegistry=marketSources,retryIsins}={}){
 session??=latestClosedSession(market,now);
 if(!validSessionDate(session)||session>now.toISOString().slice(0,10)||[0,6].includes(new Date(session+'T12:00:00Z').getUTCDay()))throw Error('Invalid or unclosed target session '+session);
 const calendar=sessionCalendar(market,session);
 if(calendar.open&&session>latestClosedSession(market,now))throw Error('Invalid or unclosed target session '+session);
 catalog??=await loadCompanyCatalog(market);
 const confirmed=new Map();
 const selected=retryIsins&&new Set(retryIsins);
 if(selected&&(!priorSnapshot||selected.size!==retryIsins.length))throw Error('INVALID_TARGETED_SESSION_RETRY');
 if(priorSnapshot){
  if(priorSnapshot.session!==session)throw Error('PRIOR_SESSION_MISMATCH');
  for(const row of validateSnapshot(priorSnapshot,catalog,market).results){
   if(row.status!=='SESSION_UNVERIFIED'||selected&&!selected.has(row.isin))confirmed.set(row.isin,row);
  }
  if(selected&&[...selected].some(isin=>!priorSnapshot.results.some(row=>row.isin===isin&&row.status==='SESSION_UNVERIFIED')))throw Error('INVALID_TARGETED_SESSION_RETRY');
 }
 const range={startDate:session,endDate:session};
 const exact=result=>{const check=inspectDailyBarIntegrity(result,range);return !check.conflicts.length&&check.bars.length===1?check.bars[0]:null;};
 const results=[];
 await mapConcurrent(catalog.shares,concurrency,async share=>{
  const {storageKey,...identity}=listingIdentity(share,market,session);
  if(confirmed.has(identity.isin)){results.push(confirmed.get(identity.isin));return;}
  const instrument={...share,...identity,officialIsin:identity.isin,ticker:identity.symbol,currency:share.currency||catalog.currency||'EUR'};
  const event=identityEventAt(share.isin,session);
  if(event&&identity.isin!==event.newIsin){results.push({...identity,status:'SESSION_UNVERIFIED',bar:null,reasonCode:'IDENTITY_CHANGED',successorIsin:event.newIsin,effectiveDate:event.effectiveDate,error:'Successor series requires separate admission/price verification'});return;}
  if(!calendar.open){results.push({...identity,status:'MARKET_CLOSED',bar:null,evidence:{sourceUrl:calendar.sourceUrl,date:session,verification:'OFFICIAL_TRADING_CALENDAR'}});return;}
  let officialError=null,officialEvidence=null;
  try{
   const officialProvider=sourceRegistry.markets[market]?.officialDailyProvider;
   const status=establishedMarkets.has(market)||officialProvider?await official(instrument,session):null;
   if(officialProvider&&status&&status.provider!==officialProvider)throw Error('OFFICIAL_DAILY_PROVIDER_MISMATCH');
   officialEvidence=status;
   if(status?.date===session&&['NO_TRADES','MARKET_CLOSED'].includes(status.status)){
    results.push({...identity,status:status.status,bar:null,provider:status.provider,sourceUrl:status.sourceUrl,evidence:status});return;
   }
   const bar=status?.status==='TRADED'&&exact({bars:[status.bar]});
   if(bar){results.push({...identity,status:'TRADED',bar,provider:status.provider,sourceUrl:status.sourceUrl});return;}
  }catch(error){officialError=error.message;}
  try{
   const route=providerRoute(instrument,{mode:'update',sourceRegistry});
   const {provider,result}=await registry.fetchDaily(instrument,range,route.primary,{allowedProviderIds:route.allowedProviderIds,timeoutMs:20000,acceptResult:r=>r.providerMeta?.partialHistory!==true&&Boolean(exact(r))});
   results.push({...identity,status:'TRADED',bar:exact(result),provider:provider.id,sourceUrl:result.requestUrl,officialError});
  }catch(error){results.push({...identity,status:'SESSION_UNVERIFIED',bar:null,reasonCode:officialEvidence?.reasonCode||(officialError?'OFFICIAL_SOURCE_ERROR':'PROVIDER_DATA_UNAVAILABLE'),evidence:officialEvidence,officialError,error:error.message});}
 });
 if(results.length!==catalog.shares.length||new Set(results.map(x=>x.isin)).size!==catalog.shares.length)throw Error('Incomplete session universe '+market);
 results.sort((a,b)=>a.isin.localeCompare(b.isin));
 const counts={};for(const row of results)counts[row.status]=(counts[row.status]||0)+1;
 return {market,session,calendar,counts,readOnly:true,generatedAt:now.toISOString(),results};
}

export function temporarySessionFailure(row) {
 if(row.status!=='SESSION_UNVERIFIED'||row.reasonCode==='IDENTITY_CHANGED')return false;
 const messages=[row.error,row.officialError].filter(Boolean).join(' ');
 // Rate limits need an authoritative Retry-After, not a blind immediate retry.
 if(/identity|currency|conflict|symbol.not.found|isin.mismatch|\b429\b|rate.limit/i.test(messages))return false;
 return /\b(?:408|500|502|503|504)\b|timeout|timed.out|fetch failed|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket|aborted/i.test(messages);
}

// One bounded recovery in the existing run, never a second importer/workflow.
export async function collectApprovedSessionWithRecovery(options, {
 wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)), delayMs=2000,
}={}) {
 if(!Number.isInteger(delayMs)||delayMs<0||delayMs>30000)throw Error('INVALID_SESSION_RETRY_DELAY');
 const first=await collectApprovedSession(options);
 const retryIsins=first.results.filter(temporarySessionFailure).map(row=>row.isin);
 let snapshot=first;
 if(retryIsins.length){
  await wait(delayMs);
  snapshot=await collectApprovedSession({...options,session:first.session,priorSnapshot:first,retryIsins});
 }
 const after=new Map(snapshot.results.map(row=>[row.isin,row]));
 return {...snapshot,recovery:{schemaVersion:1,policy:'ONE_TARGETED_TRANSIENT_RETRY',
  performedAt:(options.now??new Date()).toISOString(),
  reusedConfirmed:options.priorSnapshot?.results.filter(row=>row.status!=='SESSION_UNVERIFIED').length??0,
  initialUnverified:first.results.filter(row=>row.status==='SESSION_UNVERIFIED').length,
  retried:retryIsins.length,
  recovered:retryIsins.filter(isin=>after.get(isin).status!=='SESSION_UNVERIFIED').length,
  remainingUnverified:snapshot.results.filter(row=>row.status==='SESSION_UNVERIFIED').length,
  results:retryIsins.map(isin=>({isin,status:after.get(isin).status,
   firstError:first.results.find(row=>row.isin===isin).error??null,
   finalError:after.get(isin).error??null})),
 }};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const market=process.env.MARKET_MIC,now=new Date(),session=process.env.TARGET_SESSION||latestClosedSession(market,now);
 if(!/^[A-Z0-9]{4}$/.test(market||'')||!validSessionDate(session))throw Error('INVALID_SESSION_ARCHIVE_IDENTITY');
 let priorSnapshot;
 try{priorSnapshot=JSON.parse(await fs.readFile('data/daily-sessions/'+market+'/'+session+'.json','utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;}
 const snapshot=await collectApprovedSessionWithRecovery({market,session,now,priorSnapshot});
 await fs.mkdir('research/output',{recursive:true});
 await fs.writeFile('research/output/daily-session-'+snapshot.market+'.json',JSON.stringify(snapshot,null,2)+'\n');
 console.log('DAILY_SESSION '+JSON.stringify({market:snapshot.market,session:snapshot.session,counts:snapshot.counts}));
 if(snapshot.counts.SESSION_UNVERIFIED===snapshot.results.length)process.exitCode=1;
}
