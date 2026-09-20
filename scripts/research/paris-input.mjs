import { FactoryApiClient } from '../cloudflare/client.mjs';

const PARIS_MIC = 'XPAR';

function assertIsoDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error(`${label} ontbreekt/ongeldig: ${value}`);
}
function assertBar(bar, previous) {
  assertIsoDate(bar.date, 'trading date');
  if (previous && bar.date <= previous) throw new Error(`Niet-oplopende/duplicaatdatum ${bar.date}`);
  if (!Number.isFinite(bar.close) || bar.close <= 0) throw new Error(`Ongeldige close ${bar.date}`);
}
export function normalizeHistoryDocument(document, { cutoff = null } = {}) {
  if (!document?.instrument?.isin) throw new Error('Instrumentidentiteit ontbreekt');
  if (document.instrument.mic !== PARIS_MIC) throw new Error(`Paris phase A accepteert alleen ${PARIS_MIC}, kreeg ${document.instrument.mic}`);
  const rows=[]; let previous=null;
  for (const bar of document.bars || []) {
    assertBar(bar, previous); previous=bar.date;
    if (cutoff && bar.date > cutoff) break;
    rows.push(Object.freeze({date:bar.date,open:bar.open??null,high:bar.high??null,low:bar.low??null,close:bar.close,adjustedClose:bar.adjustedClose??null,volume:bar.volume??null}));
  }
  if (!rows.length) throw new Error(`Geen historie beschikbaar voor ${document.instrument.isin}${cutoff?' t/m '+cutoff:''}`);
  return Object.freeze({instrument:Object.freeze({isin:document.instrument.isin,ticker:document.instrument.symbol,name:document.instrument.name,mic:document.instrument.mic,currency:document.instrument.currency}),provider:Object.freeze({id:document.provider?.id||null,retrievedAt:document.provider?.retrievedAt||null}),cutoff,firstDate:rows[0].date,lastDate:rows.at(-1).date,records:rows.length,bars:Object.freeze(rows)});
}
export class ParisResearchInput {
  constructor({ client = new FactoryApiClient() } = {}) { this.client=client; }
  async history(isin,{cutoff=null}={}) { return normalizeHistoryDocument(await this.client.history(isin),{cutoff}); }
}
export const parisResearchRules=Object.freeze({mic:PARIS_MIC,phase:'A',futureBarsForbidden:true,cutoffInclusive:true});
