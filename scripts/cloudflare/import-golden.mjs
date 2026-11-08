import { readFile } from 'node:fs/promises';
import { assertWriterAuthorized } from '../audit/assert-writer-authorized.mjs';
import { FactoryApiClient } from './client.mjs';
import { cloudflareCatalog } from './catalog.mjs';
import { writeCloudflareHistory } from './history-writer.mjs';

assertWriterAuthorized({ writer: 'cloudflare-golden-import', market: 'XAMS' });
assertWriterAuthorized({ writer: 'cloudflare-golden-import', dataset: 'marketCatalog', market: 'XAMS' });
const client = new FactoryApiClient();
const catalog = await cloudflareCatalog();
await client.seedCatalog(catalog);
const golden = new Set(['NL0010273215', 'NL0012969182']);
for (const item of catalog.instruments.filter((instrument) => golden.has(instrument.isin))) {
  const document = JSON.parse(await readFile(new URL(`../../data/history/${item.isin}.json`, import.meta.url), 'utf8'));
  const { coverage: result } = await writeCloudflareHistory(client, item.isin, document.bars, { provider: document.provider.id, appendOnly: false });
  console.log(JSON.stringify({ isin: item.isin, result }));
}
