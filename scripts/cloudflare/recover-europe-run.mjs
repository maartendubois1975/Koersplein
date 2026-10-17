import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function europeRecoveryDecision(policy,run,latest){
 if(run.id!==policy.runId||run.repository?.full_name!==policy.repository||run.head_branch!==policy.branch||run.path!==policy.workflowPath)return 'OUTSIDE_APPROVED_RUN';
 if(latest.id!==run.id)return 'NEWER_RUN_EXISTS';
 if(run.status!=='completed')return 'RUN_STILL_ACTIVE';
 if(run.conclusion!=='failure')return 'NO_FAILED_RUN_TO_RETRY';
 if(!Number.isInteger(run.run_attempt)||run.run_attempt>=policy.maxAttempts)return 'ATTEMPT_LIMIT_REACHED';
 return 'RETRY_FAILED_JOBS';
}
export async function recoverEuropeRun(policy,event,request){
 if(event.workflow_run?.id!==policy.runId||event.repository?.full_name!==policy.repository)return {decision:'OUTSIDE_APPROVED_EVENT'};
 const base='/repos/'+policy.repository;
 // Re-read current state; an old completion event must not restart an active,
 // cancelled or superseded import.
 const run=await request(base+'/actions/runs/'+policy.runId);
 const collection=await request(base+'/actions/workflows/'+encodeURIComponent(policy.workflowPath.split('/').at(-1))+'/runs?branch='+encodeURIComponent(policy.branch)+'&per_page=1');
 const decision=europeRecoveryDecision(policy,run,collection.workflow_runs?.[0]||{});
 if(decision!=='RETRY_FAILED_JOBS')return {decision,runId:run.id,attempt:run.run_attempt};
 const jobs=await request(base+'/actions/runs/'+policy.runId+'/jobs?filter=latest&per_page=100');
 if(jobs.jobs?.some(j=>j.status!=='completed'))return {decision:'JOBS_STILL_ACTIVE'};
 if(!jobs.jobs?.some(j=>j.conclusion==='failure'))return {decision:'NO_FAILED_JOBS'};
 await request(base+'/actions/runs/'+policy.runId+'/rerun-failed-jobs','POST');
 return {decision,runId:run.id,previousAttempt:run.run_attempt,requestedAttempt:run.run_attempt+1,failedJobs:jobs.jobs.filter(j=>j.conclusion==='failure').map(j=>({id:j.id,name:j.name}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const policy=JSON.parse(await fs.readFile('config/europe-recovery-request.json','utf8'));
 const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
 if(!process.env.GH_TOKEN)throw Error('GitHub Actions token missing');
 const request=async(path,method='GET')=>{
  const r=await fetch('https://api.github.com'+path,{method,headers:{authorization:'Bearer '+process.env.GH_TOKEN,accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('GitHub recovery '+method+' '+path+' HTTP '+r.status);
  return r.status===204||r.status===201?{}:r.json();
 };
 const result=await recoverEuropeRun(policy,event,request);
 console.log(JSON.stringify(result,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,'Europe same-run recovery\n\n```json\n'+JSON.stringify(result,null,2)+'\n```\n');
}
