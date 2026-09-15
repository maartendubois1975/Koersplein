import { FactoryApiClient } from './client.mjs';
import { cloudflareCatalog } from './catalog.mjs';

const result = await new FactoryApiClient().seedCatalog(await cloudflareCatalog());
console.log(JSON.stringify(result, null, 2));
