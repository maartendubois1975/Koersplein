// Shared read-only, bounded Worker manifest fetch for both XAMS source diagnostics.
// Transient Worker timeouts must not prevent the independent public-page audit.
export async function fetchXamsManifest(base,fetchImpl=globalThis.fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 let lastError;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetchImpl(base+'/api/history/manifest.json',{signal:AbortSignal.timeout(30000)});
   if(response.ok)return await response.json();
   if(response.status!==429&&response.status<500)throw Error('XAMS_MANIFEST_PERMANENT_HTTP_'+response.status);
   lastError=Error('XAMS_MANIFEST_HTTP_'+response.status);
  }catch(error){
   if(String(error?.message||'').startsWith('XAMS_MANIFEST_PERMANENT_HTTP_'))throw error;
   lastError=error;
  }
  if(attempt<2)await wait(1000*(attempt+1));
 }
 throw lastError;
}
