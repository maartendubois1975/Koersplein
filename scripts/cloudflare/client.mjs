const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

export class FactoryApiClient {
  constructor({ baseUrl = process.env.KOERSPLEIN_API_URL, token = process.env.KOERSPLEIN_FACTORY_TOKEN } = {}) {
    if (!baseUrl || !token) throw new Error('KOERSPLEIN_API_URL en KOERSPLEIN_FACTORY_TOKEN zijn vereist');
    this.baseUrl = baseUrl.replace(/\/$/, ''); this.token = token;
  }
  async request(path, options = {}) {
    const method=options.method||'GET';
    const maxAttempts=Math.max(1,Number(process.env.FACTORY_API_MAX_ATTEMPTS||6));
    let lastError;
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      try{
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json', ...(options.headers || {}) }
        });
        if(response.ok) return response.status === 204 ? null : response.json();
        const body=await response.text();
        const retryable=response.status===429||response.status===502||response.status===503||response.status===504||/Worker exceeded resource limits|error 1102/i.test(body);
        lastError=new Error(`${method} ${path}: HTTP ${response.status} ${body}`);
        if(!retryable||attempt===maxAttempts) throw lastError;
      }catch(error){
        lastError=error;
        if(attempt===maxAttempts) throw error;
      }
      const delay=Math.min(30000,1000*(2**(attempt-1)));
      await sleep(delay);
    }
    throw lastError;
  }
  seedCatalog(payload) { return this.request('/api/factory/catalog', { method: 'PUT', body: JSON.stringify(payload) }); }
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
