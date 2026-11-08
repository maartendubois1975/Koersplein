import { readFile } from 'node:fs/promises';
import { assertWriterAuthorized } from '../audit/assert-writer-authorized.mjs';
import { FactoryApiClient } from './client.mjs';
import { cloudflareCatalog } from './catalog.mjs';
import { partitionBars } from './history-format.mjs';

assertWriterAuthorized({ writer: 'cloudflare-golden-import', market: 'XAMS' });
const client = new FactoryApiClient();
const catalog = await cloudflareCatalog();
await client.seedCatalog(catalog);
const golden = new Set(['NL0010273215', 'NL0012969182']);
for (const item of catalog.instruments.filter((instrument) => golden.has(instrument.isin))) {
  const document = JSON.parse(await readFile(new URL(`../../data/history/${item.isin}.json`, import.meta.url), 'utf8'));
  for (const [period, bars] of partitionBars(document.bars)) await client.putPartition(item.isin, period, { bars, provider: document.provider.id });
  const result = await client.completeHistory(item.isin, { provider: document.provider.id });
  console.log(JSON.stringify({ isin: item.isin, result }));
}
