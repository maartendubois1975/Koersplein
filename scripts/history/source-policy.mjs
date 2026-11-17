import { readFile } from 'node:fs/promises';
import {identityEventAt} from './company-register.mjs';
import { validateBars } from './bars.mjs';
const sources = JSON.parse(await readFile(new URL('../../data/market-source-registry.json', import.meta.url), 'utf8'));
export const parentMic = mic => ({ ALXB: 'XBRU', MLXB: 'XBRU', ALXP: 'XPAR', XMLI: 'XPAR', MTAA: 'XMIL', EXGM: 'XMIL', MERK: 'XOSL', XOAS: 'XOSL', ALXL: 'XLIS', ENXL: 'XLIS', XMSM: 'XDUB', XESM: 'XDUB', XATL: 'XDUB', FNSE: 'XSTO', SSME: 'XSTO' }[mic] || mic);

// Registration order is not approval. Only explicit roles in the market source
// register authorize a provider; research/paid candidates cannot become fallbacks.
export function providerRoute(instrument, { mode = 'backfill', sourceRegistry = sources } = {}) {
  const listingMic = instrument.mic || instrument.market;
  const mic = sourceRegistry.markets?.[listingMic] ? listingMic : parentMic(listingMic);
  const source = sourceRegistry.markets?.[mic];
  if (source?.status !== 'APPROVED') throw Error(`No approved source route: ${mic}`);
  const entries = mode === 'update' && source.dailySources ? source.dailySources : source.historySources;
  const primary = entries?.filter(s => s.role === 'PRIMARY') || [];
  if (primary.length !== 1) throw Error(`Expected one primary source: ${mic}`);
  const allowedProviderIds = [...new Set([primary[0].provider, ...entries.filter(s => ['FALLBACK', 'DISCOVERY_FALLBACK'].includes(s.role)).map(s => s.provider)])];
  return { primary: primary[0].provider, allowedProviderIds, compareLatest: mode === 'update' && source.compareDailyLatest === true };
}

export async function fetchConfiguredHistory(registry, instrument, range, { mode = 'backfill', sourceRegistry = sources, ...options } = {}) {
  const event=identityEventAt(instrument.officialIsin||String(instrument.isin||'').split(':').at(-1),range.endDate);
  if(event)throw Error('SOURCE_IDENTITY_CHANGED_REQUIRES_REVIEW '+event.oldIsin+' -> '+event.newIsin);
  instrument = { ...instrument, mic: instrument.primaryMic || instrument.mic };
  const route = providerRoute(instrument, { mode, sourceRegistry });
  const acceptable = result => result?.providerMeta?.partialHistory !== true &&
    validateBars(result?.bars || []).some(b => b.date >= range.startDate && b.date <= range.endDate);
  const selected = await registry.fetchDaily(instrument, range, route.primary, {
    ...options, allowedProviderIds: route.allowedProviderIds, acceptResult: acceptable
  });
  // Amsterdam daily behavior is retained, now controlled by the same register
  // as every other importer. Compare only independently approved alternatives.
  if (route.compareLatest && selected.provider.id === route.primary) {
    const alternatives = route.allowedProviderIds.filter(id => id !== route.primary);
    if (alternatives.length) {
      try {
        const other = await registry.fetchDaily(instrument, range, alternatives[0], {
          ...options, allowedProviderIds: alternatives, acceptResult: acceptable
        });
        const latest = result => validateBars(result.bars).filter(b => b.date >= range.startDate && b.date <= range.endDate).at(-1)?.date;
        if (latest(other.result) > latest(selected.result)) {
          other.result.providerMeta = { ...other.result.providerMeta, officialLatestObserved: latest(selected.result), sourceSelectionReason: 'SECONDARY_HAS_NEWER_EXECUTED_SESSION' };
          other.result = { ...other.result, bars: validateBars(other.result.bars).filter(b => b.date >= range.startDate && b.date <= range.endDate) };
          return other;
        }
      } catch (error) {
        selected.result.providerMeta = { ...selected.result.providerMeta, secondaryComparisonError: error.message };
      }
    }
  }
  selected.result = { ...selected.result, bars: validateBars(selected.result.bars).filter(b => b.date >= range.startDate && b.date <= range.endDate) };
  return selected;
}
