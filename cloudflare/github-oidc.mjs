// Trust only the existing daily production workflow, never PRs or forks.
export const OIDC_AUDIENCE = 'koersplein-factory:1369316270';
const ISSUER = 'https://token.actions.githubusercontent.com';
const WORKFLOW = 'maartendubois1975/Koersplein/.github/workflows/daily-open-close.yml@refs/heads/main';
let keys = [], keysUntil = 0;
const bytes = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const decode = value => JSON.parse(new TextDecoder().decode(bytes(value)));

export async function verifyGithubIdentity(token, { fetchKeys = fetch, clock = Date.now } = {}) {
  try {
    if (typeof token !== 'string' || token.length > 16000) return false;
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return false;
    const header = decode(parts[0]), claims = decode(parts[1]), time = Math.floor(clock() / 1000);
    if (header.alg !== 'RS256' || header.typ !== 'JWT' || typeof header.kid !== 'string') return false;
    if (claims.iss !== ISSUER || claims.aud !== OIDC_AUDIENCE ||
        claims.repository !== 'maartendubois1975/Koersplein' || claims.repository_id !== '1369316270' ||
        claims.repository_owner_id !== '305800938' || claims.ref !== 'refs/heads/main' ||
        claims.workflow_ref !== WORKFLOW || (claims.job_workflow_ref !== undefined && claims.job_workflow_ref !== WORKFLOW) ||
        claims.runner_environment !== 'github-hosted' ||
        !['push', 'schedule', 'workflow_dispatch'].includes(claims.event_name)) return false;
    if (![claims.exp, claims.nbf, claims.iat].every(Number.isInteger) ||
        claims.exp <= time || claims.nbf > time + 30 || claims.iat > time + 30 ||
        claims.iat < time - 600 || claims.exp - claims.iat > 600 || claims.exp <= claims.iat) return false;
    if (keysUntil <= clock()) {
      const response = await fetchKeys(ISSUER + '/.well-known/jwks', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return false;
      const data = await response.json();
      if (!Array.isArray(data.keys)) return false;
      keys = data.keys; keysUntil = clock() + 300000;
    }
    const jwk = keys.find(k => k.kid === header.kid && k.kty === 'RSA' && k.use === 'sig' && k.alg === 'RS256');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  } catch { return false; }
}

export function allowsDailyRequest(request) {
  const path = new URL(request.url).pathname;
  return (request.method === 'GET' && path === '/api/factory/catalog') ||
    (request.method === 'PUT' && path === '/api/factory/catalog' && request.headers.get('x-koersplein-create-only')==='1') ||
    (request.method === 'GET' && /^\/api\/factory\/history\/[A-Z0-9][A-Z0-9:-]{2,31}\/(?:partitions|partition\/\d{4})$/.test(path)) ||
    (request.method === 'PUT' && /^\/api\/factory\/history\/[A-Z0-9][A-Z0-9:-]{2,31}\/\d{4}$/.test(path)) ||
    (request.method === 'POST' && /^\/api\/factory\/history\/[A-Z0-9][A-Z0-9:-]{2,31}\/complete$/.test(path));
}
