import { assertWriterAuthorized } from './assert-writer-authorized.mjs';

/** Fail the entire shard before the first mutation if even one market is unauthorized. */
export function authorizeMarketShard(markets, { writer, dataset = 'historicalOhlc', environment, config, activation } = {}) {
  if (!Array.isArray(markets) || !markets.length) throw new Error('Empty market shard');
  const mics = [...new Set(markets.map(m => typeof m === 'string' ? m : m?.mic))];
  if (mics.some(mic => typeof mic !== 'string' || !mic.trim())) throw new Error('Invalid market MIC');
  for (const market of mics) assertWriterAuthorized({ writer, dataset, market, environment, config, activation });
  return mics;
}
