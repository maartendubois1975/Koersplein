import { FactoryApiClient } from './client.mjs';
import { cloudflareCatalog } from './catalog.mjs';
import { normalizeBar } from './history-format.mjs';

const client = new FactoryApiClient();
const catalog = await cloudflareCatalog();
const instruments = catalog.instruments.filter((item) => item.mic === 'XBRU');
const failures = [];
const results = [];

function fail(isin, message) {
  failures.push({ isin, error: message });
  console.error(JSON.stringify({ isin, status: 'INVALID', error: message }));
}

async function historyWithRetry(isin) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try { return await client.history(isin); }
    catch (error) {
      if (attempt === 5 || !/HTTP (429|500|502|503|504)/.test(error.message)) throw error;
      console.warn(JSON.stringify({ isin, status: 'RETRY', attempt, reason: error.message.split('\n')[0] }));
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
}

async function validateInstrument(item) {
  try {
    const document = await historyWithRetry(item.isin);
    const bars = document?.bars;
    const coverage = document?.coverage;
    if (!Array.isArray(bars) || bars.length === 0) throw new Error('Geen koersrecords opgeslagen');
    if (document.instrument?.isin !== item.isin) throw new Error(`ISIN-identiteit wijkt af: ${document.instrument?.isin || 'ontbreekt'}`);
    if (document.instrument?.mic !== 'XBRU') throw new Error(`MIC wijkt af: ${document.instrument?.mic || 'ontbreekt'}`);
    if (coverage?.recordCount !== bars.length) throw new Error(`Metadata telt ${coverage?.recordCount}; bestand bevat ${bars.length}`);
    if (coverage?.firstDate !== bars[0].date) throw new Error(`firstDate wijkt af: ${coverage?.firstDate} versus ${bars[0].date}`);
    if (coverage?.lastDate !== bars.at(-1).date) throw new Error(`lastDate wijkt af: ${coverage?.lastDate} versus ${bars.at(-1).date}`);

    let previous = '';
    const seen = new Set();
    for (const raw of bars) {
      const bar = normalizeBar(raw);
      if (seen.has(bar.date)) throw new Error(`Dubbele handelsdatum ${bar.date}`);
      if (previous && bar.date <= previous) throw new Error(`Datumvolgorde ongeldig bij ${bar.date}`);
      if (bar.high !== null && bar.close > bar.high) throw new Error(`Slot boven high op ${bar.date}`);
      if (bar.low !== null && bar.close < bar.low) throw new Error(`Slot onder low op ${bar.date}`);
      if (bar.open !== null && bar.high !== null && bar.open > bar.high) throw new Error(`Open boven high op ${bar.date}`);
      if (bar.open !== null && bar.low !== null && bar.open < bar.low) throw new Error(`Open onder low op ${bar.date}`);
      seen.add(bar.date);
      previous = bar.date;
    }
    const result = { isin: item.isin, records: bars.length, firstDate: bars[0].date, lastDate: bars.at(-1).date };
    results.push(result);
    console.log(JSON.stringify({ ...result, status: 'VALID' }));
  } catch (error) {
    fail(item.isin, error.message);
  }
}

// Beperkte paralleliteit houdt Worker, D1 en R2 ruim binnen veilige belasting.
for (let offset = 0; offset < instruments.length; offset += 5) {
  await Promise.all(instruments.slice(offset, offset + 5).map(validateInstrument));
}

const totalRecords = results.reduce((sum, item) => sum + item.records, 0);
const summary = {
  market: 'XBRU',
  catalogInstruments: instruments.length,
  valid: results.length,
  invalid: failures.length,
  totalRecords,
  earliestDate: results.map((item) => item.firstDate).sort()[0] || null,
  latestDate: results.map((item) => item.lastDate).sort().at(-1) || null,
  complete: failures.length === 0 && results.length === instruments.length
};
console.log(JSON.stringify(summary, null, 2));
if (!summary.complete) throw new Error(`Brussel-validatie mislukt: ${failures.length} ongeldig, ${results.length}/${instruments.length} gevalideerd`);
