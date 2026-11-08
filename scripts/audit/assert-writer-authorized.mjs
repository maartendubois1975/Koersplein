import { readFileSync } from 'node:fs';
import { validateWriterOwnership } from './writer-ownership.mjs';

export function assertWriterAuthorized({ writer, dataset = 'historicalOhlc', market, environment = process.env.KOERSPLEIN_ENV || 'staging', config, activation = process.env.KOERSPLEIN_CONSOLIDATION_WRITE }) {
  const manifest = config || JSON.parse(readFileSync(new URL('../../config/writer-routes.json', import.meta.url), 'utf8'));
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported writer manifest');
  validateWriterOwnership(manifest.routes);
  if (manifest.activation !== 'enabled' || activation !== 'enabled') throw new Error('Consolidation writes disabled: explicit manifest and runtime activation required');
  const candidates = manifest.routes.filter(r => r.enabled && r.environment === environment && r.dataset === dataset && (r.market === market || r.market === '*'));
  if (candidates.length !== 1 || candidates[0].writer !== writer) throw new Error('Writer not authorized: ' + [environment, dataset, market, writer].join('/'));
  return true;
}
