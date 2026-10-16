import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const readJson = async name => JSON.parse(await readFile(new URL(`data/${name}`, root), 'utf8'));
const maybeJson = async name => {
  try { return await readJson(name); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

// Do not create invented ISINs. Athens and Warsaw retain their source-verified
// catalogs but are excluded from the ISIN-keyed Worker instrument import.
export async function cloudflareCatalog() {
  const [marketData, mappings] = await Promise.all([
    readJson('markets.json'), readJson('history-instruments.json')
  ]);
  const venue = marketData.venues.find(item => item.id === 'euronext');
  const mappingByIsin = new Map(mappings.providerMappings.map(item => [item.isin, item]));
  const markets = [], instruments = [], unresolved = [];
  const globalIdentity = new Set();
  for (const market of venue.markets.filter(item => item.status === 'available')) {
    const catalog = await readJson(market.sharesData);
    if (catalog.mic !== market.mic || !Array.isArray(catalog.shares)) {
      throw new Error(`Ongeldige beurscatalogus ${market.mic}`);
    }
    const indices = market.indicesData ? await maybeJson(market.indicesData) : null;
    const groupByIsin = new Map((indices?.indices || []).flatMap(index =>
      index.constituents.map(member => [member.isin, index.id])));
    markets.push({ mic:market.mic, code:market.id, name:market.name,
      exchangeGroup:venue.name, countryCode:null, currency:market.currency, timezone:null });
    for (const share of catalog.shares) {
      if (!share.isin) {
        unresolved.push({ mic:market.mic, symbol:share.symbol });
        continue;
      }
      // Worker schema keys instruments globally by ISIN. Never silently
      // replace a cross-listed instrument's original market association.
      if (globalIdentity.has(share.isin)) continue;
      globalIdentity.add(share.isin);
      const mapped = mappingByIsin.get(share.isin);
      instruments.push({ isin:share.isin, mic:market.mic, ticker:share.symbol,
        company:share.name, countryCode:share.isin.slice(0,2), sector:null,
        indexGroup:groupByIsin.get(share.isin) || 'overig', currency:share.currency || market.currency,
        provider:mapped?.provider || 'yahoo-chart',
        providerSymbol:mapped?.providerSymbol || share.providerSymbol || null });
    }
  }
  return { markets, instruments, unresolved };
}
