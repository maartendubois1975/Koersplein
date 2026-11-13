import { readFile, writeFile } from 'node:fs/promises';
import { YahooChartProvider } from './providers/yahoo-chart.mjs';

const root = new URL('../../', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const shares = await read('data/euronext-amsterdam.json');
const registry = await read('data/history-instruments.json');
const provider = new YahooChartProvider();
const batchSize = Number(process.env.AMSTERDAM_DISCOVERY_BATCH || 15);
const offset = Number(process.env.AMSTERDAM_DISCOVERY_OFFSET || 0);
if (!Number.isInteger(offset) || offset < 0 || offset > 85) throw Error('Offset must be 0..85');
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 85) throw Error('Batch size must be 1..85');
const existing = new Set(registry.providerMappings.map(item => item.isin));
const pending = shares.shares.filter(share => !existing.has(share.isin)).slice(offset, offset + batchSize);
const today = new Date().toISOString().slice(0, 10);
const since = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
const accepted = [];
const rejected = [];
for (const share of pending) {
  const candidate = {
    ...share, mic: 'XAMS', currency: 'EUR',
    providerSymbol: share.symbol + '.AS'
  };
  try {
    const response = await provider.fetchDaily(candidate, { startDate: since, endDate: today });
    if (!response.bars.length) throw Error('No complete daily OHLC bars in recent period');
    const last = response.bars.at(-1);
    if (![last.open, last.high, last.low, last.close].every(x => Number.isFinite(x) && x > 0)) throw Error('Incomplete latest OHLC');
    accepted.push({
      isin: share.isin, name: share.name, symbol: share.symbol,
      provider: 'yahoo-chart', providerSymbol: candidate.providerSymbol,
      currency: 'EUR',
      identitySource: 'https://live.euronext.com/en/product/equities/' + share.isin + '-XAMS'
    });
    console.log('VERIFIED', share.symbol, last.date, last.open, last.close);
  } catch (error) {
    rejected.push({ isin: share.isin, symbol: share.symbol, reason: String(error.message) });
    console.log('REJECTED', share.symbol, String(error.message));
  }
}
const output = {
  checkedAt: new Date().toISOString(), offset, checked: pending.length,
  verified: accepted.length, rejected: rejected.length,
  providerMappings: accepted, failures: rejected
};
await writeFile(new URL('data/amsterdam-discovery-result-' + offset + '.json', root), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ checked: output.checked, verified: output.verified, rejected: output.rejected }));
// A reviewable discovery report is intentionally separate from the live registry.
// Never publish candidate mappings without checking the recorded evidence.
