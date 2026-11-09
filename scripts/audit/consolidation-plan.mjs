import { readFileSync } from 'node:fs';
import { assertWriterAuthorized } from './assert-writer-authorized.mjs';

export const WRITERS = Object.freeze({
  'local-history': './scripts/history.mjs',
  'cloudflare-factory': './scripts/cloudflare/factory-runner.mjs',
  'cloudflare-universal': './scripts/cloudflare/universal-market-runner.mjs',
  'cloudflare-daily': './scripts/cloudflare/daily-open-close-update.mjs',
  'cloudflare-golden-import': './scripts/cloudflare/import-golden.mjs',
  'cloudflare-paris-recovery': './scripts/cloudflare/paris-targeted-history-recovery.mjs',
  'cloudflare-catalog-sync': './scripts/cloudflare/sync-plan.mjs'
});

export function planConsolidatedRun({ writer, market, environment = 'staging', dataset, config } = {}) {
  if (!Object.hasOwn(WRITERS, writer)) throw new Error('Unknown consolidated writer: ' + writer);
  if (typeof market !== 'string' || !market.trim()) throw new Error('Market MIC required');
  const manifest = config || JSON.parse(readFileSync(new URL('../../config/writer-routes.json', import.meta.url), 'utf8'));
  const inferredDataset = dataset || (writer === 'cloudflare-catalog-sync' ? 'marketCatalog' : 'historicalOhlc');
  const authorized = manifest.routes.filter(r => r.enabled && r.environment === environment && r.dataset === inferredDataset && (r.market === market || r.market === '*'));
  return { writer, market, environment, dataset: inferredDataset, command: WRITERS[writer], authorized: manifest.activation === 'enabled' && authorized.length === 1 && authorized[0].writer === writer, activation: manifest.activation, status: 'dry-run' };
}

export function assertConsolidatedRun(plan, config) {
  assertWriterAuthorized({ writer: plan.writer, market: plan.market, environment: plan.environment, dataset: plan.dataset, config });
}
