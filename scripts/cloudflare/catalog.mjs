import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(`data/${name}`, root), 'utf8'));
const maybeJson = async (name) => { try { return await readJson(name); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };

export async function cloudflareCatalog() {
  const [marketData, amsShares, amsIndices, mappings, bruShares, bruIndices] = await Promise.all([
    readJson('markets.json'), readJson('euronext-amsterdam.json'), readJson('euronext-amsterdam-indices.json'), readJson('history-instruments.json'),
    maybeJson('euronext-brussels.json'), maybeJson('euronext-brussels-indices.json')
  ]);
  const mappingByIsin = new Map(mappings.providerMappings.map((item) => [item.isin, item]));
  const venue = marketData.venues.find((item) => item.id === 'euronext');
  const configs = [
    { shares: amsShares, indices: amsIndices, countryCode: 'NL', timezone: 'Europe/Amsterdam', suffix: '.AS' },
    ...(bruShares ? [{ shares: bruShares, indices: bruIndices, countryCode: 'BE', timezone: 'Europe/Brussels', suffix: '.BR' }] : [])
  ];
  const markets = [];
  const instruments = [];
  for (const config of configs) {
    const market = venue.markets.find((item) => item.mic === config.shares.mic);
    const groupByIsin = new Map((config.indices?.indices || []).flatMap((index) => index.constituents.map((member) => [member.isin, index.id])));
    markets.push({ mic: market.mic, code: market.id, name: `Euronext ${market.name}`, exchangeGroup: venue.name, countryCode: config.countryCode, currency: market.currency, timezone: config.timezone });
    for (const share of config.shares.shares) {
      const mapped = mappingByIsin.get(share.isin);
      instruments.push({ isin: share.isin, mic: config.shares.mic, ticker: share.symbol, company: share.name, countryCode: share.isin.slice(0, 2), sector: null, indexGroup: groupByIsin.get(share.isin) || 'overig', currency: market.currency, provider: mapped?.provider || 'yahoo-chart', providerSymbol: mapped?.providerSymbol || `${share.symbol}${config.suffix}` });
    }
  }
  return { markets, instruments };
}
