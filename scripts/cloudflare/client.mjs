export class FactoryApiClient {
  constructor({ baseUrl = process.env.KOERSPLEIN_API_URL, token = process.env.KOERSPLEIN_FACTORY_TOKEN } = {}) {
    if (!baseUrl || !token) throw new Error('KOERSPLEIN_API_URL en KOERSPLEIN_FACTORY_TOKEN zijn vereist');
    this.baseUrl = baseUrl.replace(/\/$/, ''); this.token = token;
  }
  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json', ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: HTTP ${response.status} ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  }
  seedCatalog(payload) { return this.request('/api/factory/catalog', { method: 'PUT', body: JSON.stringify(payload) }); }
  job(id) { return this.request(`/api/factory/jobs/${encodeURIComponent(id)}`); }
  claim(id, limit) { return this.request(`/api/factory/jobs/${encodeURIComponent(id)}/claim`, { method: 'POST', body: JSON.stringify({ limit }) }); }
  finishItem(jobId, isin, body) { return this.request(`/api/factory/jobs/${encodeURIComponent(jobId)}/items/${isin}`, { method: 'PATCH', body: JSON.stringify(body) }); }
  history(isin) { return this.request(`/api/history/${isin}`); }
  putPartition(isin, period, payload) { return this.request(`/api/factory/history/${isin}/${period}`, { method: 'PUT', body: JSON.stringify(payload) }); }
  completeHistory(isin, payload) { return this.request(`/api/factory/history/${isin}/complete`, { method: 'POST', body: JSON.stringify(payload) }); }
}
