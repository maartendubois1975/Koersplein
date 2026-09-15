import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(`data/${name}`, root), 'utf8'));

export async function cloudflareCatalog() {
  const [marketData, shares, indices, mappings] = await Promise.all([
    readJson('markets.json'), readJson('euronext-amsterdam.json'), readJson('euronext-amsterdam-indices.json'), readJson('history-instruments.json')
  ]);
  const mappingByIsin = new Map(mappings.providerMappings.map((item) => [item.isin, item]));
  const groupByIsin = new Map(indices.indices.flatMap((index) => index.constituents.map((member) => [member.isin, index.id])));
  const venue = marketData.venues.find((item) => item.id === 'euronext');
  const market = venue.markets.find((item) => item.mic === shares.mic);
  return {
    markets: [{ mic: market.mic, code: market.id, name: `Euronext ${market.name}`, exchangeGroup: venue.name, countryCode: 'NL', currency: market.currency, timezone: 'Europe/Amsterdam' }],
    instruments: shares.shares.map((share) => ({
      isin: share.isin, mic: shares.mic, ticker: share.symbol, company: share.name,
      countryCode: share.isin.slice(0, 2), sector: null, indexGroup: groupByIsin.get(share.isin) || 'overig', currency: market.currency,
      provider: mappingByIsin.get(share.isin)?.provider || 'yahoo-chart',
      providerSymbol: mappingByIsin.get(share.isin)?.providerSymbol || `${share.symbol}.AS`
    }))
  };
}
