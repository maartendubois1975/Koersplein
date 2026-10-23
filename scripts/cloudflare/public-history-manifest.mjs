// Shared read-only public manifest fetch for the eight European production shards.
// Fail closed: an empty or malformed manifest must never be mistaken for a new catalog.
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const retryableStatus=new Set([408,425,429,500,502,503,504]);
const retryableError=error=>error?.retryable===true||['AbortError','TimeoutError','TypeError','SyntaxError'].includes(error?.name);

export async function fetchPublicHistoryManifest(baseUrl,{
  fetchImpl=globalThis.fetch,
  sleep=wait,
  timeoutMs=30000,
  attempts=4,
  shardIndex=0,
  onRetry=({attempt,reason})=>console.warn('EUROPE_PUBLIC_MANIFEST_RETRY',JSON.stringify({attempt,reason}))
}={}){
  if(typeof baseUrl!=='string'||!/^https:\/\//i.test(baseUrl))throw Error('EUROPE_MANIFEST_INVALID_BASE_URL');
  if(!Number.isInteger(attempts)||attempts<1||attempts>5)throw Error('EUROPE_MANIFEST_INVALID_ATTEMPTS');
  if(!Number.isInteger(shardIndex)||shardIndex<0||shardIndex>64)throw Error('EUROPE_MANIFEST_INVALID_SHARD');
  const url=baseUrl.replace(/\/$/,'')+'/api/history/manifest.json';
  if(shardIndex)await sleep(shardIndex*150);
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetchImpl(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
      if(!response.ok){
        const error=Error('EUROPE_MANIFEST_HTTP_'+response.status);
        error.retryable=retryableStatus.has(response.status);
        throw error;
      }
      const payload=await response.json();
      const instruments=payload?.instruments;
      if(!instruments||typeof instruments!=='object'||Array.isArray(instruments)||Object.keys(instruments).length===0)
        throw Error('EUROPE_MANIFEST_INVALID_OR_EMPTY');
      return instruments;
    }catch(error){
      lastError=error;
      if(attempt===attempts||!retryableError(error))break;
      onRetry({attempt,reason:error.message||error.name});
      await sleep(Math.min(8000,500*2**(attempt-1))+shardIndex*100);
    }
  }
  throw Error(`EUROPE_MANIFEST_UNAVAILABLE_AFTER_${attempts}_ATTEMPTS: ${lastError?.message||'unknown'}`);
}
