import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
export const TEST_SERVICE='srv-dajuqaek1f9s739gu8kg',DEVELOPMENT_BRANCH='consolidation-20261116';
const TEST_URL='https://koersplein-test.onrender.com';
export async function deployApprovedTest({apiKey,commitSha,branch=DEVELOPMENT_BRANCH,fetchImpl=globalThis.fetch,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(branch!==DEVELOPMENT_BRANCH)throw Error('REFUSE_NON_DEVELOPMENT_DEPLOY');
 if(!apiKey)return {status:'BLOCKED_CREDENTIAL_ABSENT',serviceId:TEST_SERVICE,branch,productionChanged:false};
 if(!/^[a-f0-9]{40}$/.test(commitSha||''))throw Error('EXACT_TEST_COMMIT_REQUIRED');
 const base='https://api.render.com/v1/services/'+TEST_SERVICE;
 const request=async(suffix='',method='GET',body)=>{const r=await fetchImpl(base+suffix,{method,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('RENDER_TEST_HTTP_'+r.status);return r.json();};
 const service=await request();
 if(service.id!==TEST_SERVICE||service.name!=='koersplein-test'||service.type!=='static_site'||service.serviceDetails?.url!==TEST_URL||service.repo!=='https://github.com/maartendubois1975/Koersplein')throw Error('REFUSE_UNEXPECTED_RENDER_SERVICE');
 // Keep automatic deployments off: only this validated development workflow publishes the exact recorded commit.
 await request('','PATCH',{branch:DEVELOPMENT_BRANCH,autoDeployTrigger:'off'});
 const created=await request('/deploys','POST',{commitId:commitSha,clearCache:'do_not_clear'});
 const deploy=created.deploy||created;if(!/^dep-/.test(deploy.id||''))throw Error('RENDER_TEST_DEPLOY_ID_MISSING');
 for(let attempt=0;attempt<90;attempt++){
  const state=await request('/deploys/'+deploy.id),current=state.deploy||state;
  if(current.status==='live'){
   if(current.commit?.id!==commitSha)throw Error('RENDER_TEST_COMMIT_MISMATCH');
   return {status:'LIVE',serviceId:TEST_SERVICE,deployId:deploy.id,commit:commitSha,url:TEST_URL,productionChanged:false};
  }
  if(/failed|canceled|cancelled|deactivated/.test(current.status))throw Error('RENDER_TEST_DEPLOY_'+current.status);
  await wait(10000);
 }
 throw Error('RENDER_TEST_DEPLOY_TIMEOUT');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let report;try{report=await deployApprovedTest({apiKey:process.env.RENDER_API_KEY,commitSha:process.env.TEST_COMMIT_SHA,branch:process.env.TEST_BRANCH});}catch(error){report={status:'FAILED',error:error.message,productionChanged:false};process.exitCode=1;}
 await fs.mkdir('research/output',{recursive:true});await fs.writeFile('research/output/test-deployment.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,'\nTest deployment: '+report.status+'; production unchanged.\n');
}
