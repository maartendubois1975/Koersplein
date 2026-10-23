import {FactoryApiClient} from './client.mjs';

const REQUIRED_POLICY='preserve-existing-listing-v1';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/**
 * Read-only health check before any catalog mutation. A transient connection
 * failure must not crash a shard immediately, but no missing, malformed, or
 * incorrect preservation policy may ever pass this gate.
 */
export async function waitForProtectedWorker({baseUrl,fetchImpl=fetch,sleep=pause,attempts=12,delayMs=5000,timeoutMs=15000,logger=console}={}){
  if(typeof baseUrl!=='string'||!/^https:\/\//i.test(baseUrl)) throw Error('Protected Worker requires HTTPS base URL');
  if(!Number.isInteger(attempts)||attempts<1||attempts>12) throw Error('Invalid preflight attempt count');
  for(let attempt=1;attempt<=attempts;attempt++){
    try {
      const response=await fetchImpl(`${baseUrl.replace(/\/$/,'')}/health`,{signal:AbortSignal.timeout(timeoutMs)});
      if(response.status===401||response.status===403) throw Object.assign(Error('Worker health access denied'),{fatal:true});
      if(response.ok){
        const health=await response.json();
        if(health?.historyWritePolicy===REQUIRED_POLICY){
          logger.log(`WORKER_APPEND_ONLY_POLICY_VERIFIED attempt=${attempt}`);
          return true;
        }
        logger.warn(`Worker policy not yet verified attempt=${attempt}`);
      } else {
        if(response.status>=400&&response.status<500&&response.status!==408&&response.status!==429)
          throw Object.assign(Error(`Worker health HTTP ${response.status}`),{fatal:true});
        logger.warn(`Worker health HTTP ${response.status} attempt=${attempt}`);
      }
    } catch(error){
      if(error?.fatal) throw error;
      logger.warn(`Worker health transient failure attempt=${attempt} type=${error?.name||'Error'}`);
    }
    if(attempt<attempts) await sleep(delayMs);
  }
  throw Error('Worker append-only listing protection not verified; no production writes attempted');
}

export async function verifyProductionWorker({client=new FactoryApiClient(),healthCheck=waitForProtectedWorker}={}){
  await healthCheck({baseUrl:client.baseUrl});
  await client.catalog();
  // Retain the existing empty create-only authorization test; it must never
  // execute until the exact preservation policy is confirmed.
  await client.seedCatalog({markets:[],instruments:[],createOnly:true});
  console.log('FACTORY_CATALOG_WRITE_AUTH_AND_PRESERVATION_POLICY_OK');
}

if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
  await verifyProductionWorker();
}
