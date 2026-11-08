/**
 * Single Cloudflare history write path.
 * Source selection and market-specific validation stay with the caller.
 * All Cloudflare history writes now share the same partition/complete logic.
 */
import { partitionBars } from './history-format.mjs';

export async function writeCloudflareHistory(client, storageKey, bars, { provider, appendOnly = true, complete = true } = {}) {
  if (!storageKey || typeof storageKey !== 'string') throw new Error('History storage key required');
  if (!provider || typeof provider !== 'string') throw new Error('History provider required');
  if (!Array.isArray(bars)) throw new TypeError('History bars must be an array');
  if (!bars.length) return { recordsAdded: 0, coverage: null };
  let recordsAdded = 0;
  for (const [period, part] of partitionBars(bars)) {
    await client.putPartition(storageKey, period, { bars: part, provider, appendOnly });
    recordsAdded += part.length;
  }
  const coverage = complete ? await client.completeHistory(storageKey, { provider }) : null;
  return { recordsAdded, coverage };
}
