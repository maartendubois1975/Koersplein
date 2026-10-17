const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

export class FactoryApiClient {
  constructor({ baseUrl = process.env.KOERSPLEIN_API_URL, token = process.env.KOERSPLEIN_FACTORY_TOKEN } = {}) {
    if (!baseUrl || (!token && process.env.KOERSPLEIN_AUTH_MODE !== 'github-oidc')) throw new Error('KOERSPLEIN_API_URL en KOERSPLEIN_FACTORY_TOKEN zijn vereist');
    this.baseUrl = baseUrl.replace(/\/$/, ''); this.token = token;
  }
  async credentials() {
    if (process.env.KOERSPLEIN_AUTH_MODE !== 'github-oidc') return this.token;
    if (this.identityToken && this.identityUntil > Date.now()) return this.identityToken;
    const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    if (!requestUrl || !requestToken) throw new Error('GitHub Actions OIDC identity is unavailable');
    const url = new URL(requestUrl);
    // The request URL and credential come only from the GitHub-hosted runner.
    if (url.protocol !== 'https:') throw new Error('Invalid OIDC request URL');
    url.searchParams.set('audience', 'koersplein-factory:1369316270');
    const response = await fetch(url, { headers: { authorization: `Bearer ${requestToken}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`GitHub OIDC request HTTP ${response.status}`);
    const data = await response.json();
    if (typeof data.value !== 'string' || data.value.split('.').length !== 3) throw new Error('Invalid GitHub OIDC response');
    console.log(`::add-mask::${data.value}`);
    const claims = JSON.parse(Buffer.from(data.value.split('.')[1], 'base64url').toString('utf8'));
    if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() + 30000) throw new Error('GitHub OIDC identity already expired');
    this.identityToken = data.value;
    this.identityUntil = Math.min(claims.exp * 1000 - 30000, Date.now() + 240000);
    return this.identityToken;
  }
  async request(path, options = {}) {
    const method=options.method||'GET';
    const maxAttempts=Math.max(1,Math.min(3,Number(process.env.FACTORY_API_MAX_ATTEMPTS||3)));
    let lastError;
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      try{
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          signal: options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
          headers: { authorization: `Bearer ${await this.credentials()}`, 'content-type': 'application/json', ...(options.headers || {}) }
        });
        if(response.ok) return response.status === 204 ? null : await response.json();
        const body=await response.text();
        const cpuLimit=/Worker exceeded resource limits|error 1102/i.test(body);
        const transientD1=response.status===500&&/D1_ERROR:\s*Network connection lost/i.test(body);
        const retryable=!cpuLimit&&(transientD1||response.status===429||response.status===502||response.status===503||response.status===504);
        lastError=new Error(`${method} ${path}: HTTP ${response.status} ${body}`);
        lastError.retryable=retryable;
        if(!retryable||attempt===maxAttempts) throw lastError;
      }catch(error){
        lastError=error;
        if(error.retryable===false||options.signal?.aborted||attempt===maxAttempts) throw error;
      }
      const delay=Math.min(30000,1000*(2**(attempt-1)));
      await sleep(delay);
    }
    throw lastError;
  }
  catalog() { return this.request('/api/factory/catalog'); }
  historyManifest() { return this.request('/api/history/manifest.json'); }
  seedCatalog(payload) { return this.request('/api/factory/catalog', { method: 'PUT', headers:payload.createOnly?{'x-koersplein-create-only':'1'}:{}, body: JSON.stringify(payload) }); }
  job(id) { return this.request(`/api/factory/jobs/${encodeURIComponent(id)}`); }
  claim(id, limit) { return this.request(`/api/factory/jobs/${encodeURIComponent(id)}/claim`, { method: 'POST', body: JSON.stringify({ limit }) }); }
  finishItem(jobId, isin, body) { return this.request(`/api/factory/jobs/${encodeURIComponent(jobId)}/items/${isin}`, { method: 'PATCH', body: JSON.stringify(body) }); }
  history(isin) { return this.request(`/api/history/${isin}`); }
  historyCoverage(isin) { return this.request(`/api/history/${isin}/coverage`); }
  historyPartitions(isin) { return this.request(`/api/factory/history/${isin}/partitions`); }
  historyPartition(isin, period) { return this.request(`/api/factory/history/${isin}/partition/${period}`); }
  putPartition(isin, period, payload) { return this.request(`/api/factory/history/${isin}/${period}`, { method: 'PUT', body: JSON.stringify(payload) }); }
  completeHistory(isin, payload) { return this.request(`/api/factory/history/${isin}/complete`, { method: 'POST', body: JSON.stringify(payload) }); }
}
