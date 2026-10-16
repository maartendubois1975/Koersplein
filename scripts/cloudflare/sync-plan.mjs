import { FactoryApiClient } from './client.mjs';
import { cloudflareCatalog } from './catalog.mjs';

export function planCatalogSync(expected, live, batchSize = 50) {
  if (!Array.isArray(live?.instruments)) throw new Error('Live catalogus niet beschikbaar');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('Batchgrootte moet tussen 1 en 100 liggen');
  const byIsin = new Map(live.instruments.map(x => [x.isin,x]));
  const existingMics = new Set(live.instruments.map(x => x.mic));
  const conflicts = expected.instruments.filter(x => {
    const prior = byIsin.get(x.isin);
    return prior && prior.mic !== x.mic;
  });
  const missing = expected.instruments.filter(x => !byIsin.has(x.isin));
  const batches = [];
  // Re-register all markets, even markets with no verified ISINs yet.
  batches.push({ markets:expected.markets, instruments:[] });
  for (let i=0;i<missing.length;i+=batchSize) {
    batches.push({ markets:[], instruments:missing.slice(i,i+batchSize) });
  }
  return { markets:expected.markets.length, existingMarketMicsObserved:existingMics.size,
    missing:missing.length, alreadyRegistered:expected.instruments.length-missing.length-conflicts.length,
    conflicts, unresolvedWithoutIsin:expected.unresolved.length, batches };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const apply = process.argv.includes('--apply');
  const client = new FactoryApiClient();
  const expected = await cloudflareCatalog();
  const live = await client.catalog();
  const plan = planCatalogSync(expected,live);
  console.log(JSON.stringify({ mode:apply?'APPLY':'DRY_RUN', markets:plan.markets,
    existingMarketMicsObserved:plan.existingMarketMicsObserved,
    missing:plan.missing, alreadyRegistered:plan.alreadyRegistered,
    conflicts:plan.conflicts, unresolvedWithoutIsin:plan.unresolvedWithoutIsin,
    batches:plan.batches.length },null,2));
  if (plan.conflicts.length) throw new Error('ISIN-marktconflicten: import afgebroken, handmatige reconciliatie vereist');
  if (!apply) {
    console.log('Alleen controle uitgevoerd. Gebruik --apply om ontbrekende aandelen in kleine batches te registreren.');
  } else {
    for (let i=0;i<plan.batches.length;i++) {
      await client.seedCatalog(plan.batches[i]);
      console.log(`Batch ${i+1}/${plan.batches.length} verwerkt`);
    }
    const verified = await client.catalog();
    const remaining = planCatalogSync(expected,verified);
    if (remaining.missing) throw new Error(`Na import ontbreken nog ${remaining.missing} instrumenten`);
    console.log('Import en hercontrole geslaagd; bestaande koershistorie niet aangepast.');
  }
}
