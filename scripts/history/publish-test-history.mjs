import fs from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateHistoryDocument } from '../../chart.js';
import { listingIdentity } from '../../daily-session-view.mjs';
import { manifestResolver } from '../../market-week-core.mjs';
import { mapConcurrent } from '../cloudflare/europe-run-policy.mjs';
import { DEVELOPMENT_BRANCH, TEST_SERVICE } from '../cloudflare/deploy-approved-test.mjs';
import { approvedCompanyUniverse, identityEventAt } from './company-register.mjs';

const publicWorker = 'https://koersplein.maarten-dubois1975.workers.dev/api/history/';
const dataDir = fileURLToPath(new URL('../../data/', import.meta.url));

export async function publishTestHistory({ markets, outputDir, fetchImpl = globalThis.fetch, now = new Date() }) {
  async function readPublic(path) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetchImpl(publicWorker + path, { signal: AbortSignal.timeout(25000) });
        if (response.ok) return await response.json();
        if (response.status === 404) return null;
        throw Error('HISTORY_HTTP_' + response.status);
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  const manifest = await readPublic('manifest.json');
  const resolvers = new Map();
  function getResolver(mic) {
    if (!resolvers.has(mic)) resolvers.set(mic, manifestResolver(manifest, mic));
    return resolvers.get(mic);
  }
  const requested = markets.filter(market => market.mic !== 'XAMS').flatMap(market =>
    market.shares.map(share => ({ share, market: market.mic, identity: listingIdentity(share, market.mic) }))
  );
  const stagedDir = await fs.mkdtemp(outputDir + '-');
  try {
    const results = [];
    await mapConcurrent(requested, 8, async ({ share, market, identity }) => {
      const { storageKey, isin, mic, symbol } = identity;
      const row = { market, storageKey, symbol };
      const storageId = getResolver(mic)({ ...share, mic });
      if (!storageId || !/^[A-Z0-9][A-Z0-9:-]{2,31}$/.test(storageId)) {
        results.push({ ...row, status: 'NO_VERIFIED_MANIFEST_IDENTITY' });
        return;
      }

      let document;
      try {
        document = await readPublic(encodeURIComponent(storageId).replace(/%3A/g, ':'));
      } catch (error) {
        results.push({ ...row, status: 'HISTORY_FETCH_FAILED', reason: error.message });
        return;
      }
      if (!document) {
        results.push({ ...row, status: 'HISTORY_NOT_FOUND' });
        return;
      }

      try {
        document.coverage.records ??= document.coverage.recordCount;
        // Validate the original Worker identity before publishing under the approved ISIN.
        validateHistoryDocument(document, { isin: storageId, mic, symbol });
        if (share.currency && document.instrument.currency !== share.currency) throw Error('HISTORY_CURRENCY_MISMATCH');
        const lastDate = document.coverage.lastDate;
        if (lastDate > now.toISOString().slice(0, 10) || identityEventAt(isin, lastDate)) {
          throw Error('HISTORY_DATE_OUTSIDE_APPROVED_IDENTITY');
        }
      } catch (error) {
        results.push({ ...row, status: 'HISTORY_REJECTED', reason: error.message });
        return;
      }

      document.instrument.isin = isin;
      await fs.writeFile(join(stagedDir, storageKey + '.json'), JSON.stringify(document));
      results.push({ ...row, status: 'PUBLISHED', storageId, records: document.coverage.records });
    });

    const fetchFailures = results.filter(row => row.status === 'HISTORY_FETCH_FAILED');
    if (fetchFailures.length) {
      throw Error('PUBLIC_HISTORY_FETCH_FAILED ' + JSON.stringify(fetchFailures));
    }
    const counts = Object.fromEntries(markets.filter(market => market.mic !== 'XAMS').map(({ mic }) => [
      mic, results.filter(row => row.market === mic && row.status === 'PUBLISHED').length,
    ]));
    if (Object.values(counts).some(count => count === 0)) throw Error('NO_VALID_PUBLIC_HISTORY_FOR_MARKET');
    await fs.writeFile(join(stagedDir, 'coverage.json'), JSON.stringify({
      workerManifestDate: manifest.generatedAt,
      counts,
      results: results.sort((a, b) => a.storageKey.localeCompare(b.storageKey)),
    }, null, 2));
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.rename(stagedDir, outputDir);
    return counts;
  } finally {
    await fs.rm(stagedDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href &&
    process.env.RENDER_SERVICE_ID === TEST_SERVICE) {
  if (process.env.RENDER_GIT_BRANCH !== DEVELOPMENT_BRANCH) throw Error('REFUSE_NON_DEVELOPMENT_TEST_HISTORY');
  const counts = await publishTestHistory({
    markets: await approvedCompanyUniverse(),
    outputDir: join(dataDir, 'test-history'),
  });
  console.log('TEST_HISTORY_PUBLISHED', JSON.stringify(counts));
}
