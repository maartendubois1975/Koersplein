const PROVIDER_ID = 'yahoo-chart';
const API_ROOT = 'https://query1.finance.yahoo.com/v8/finance/chart';

const isoDate = (unixSeconds) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);
const finiteOrNull = (value) => Number.isFinite(value) ? value : null;

export class YahooChartProvider {
  id = PROVIDER_ID;
  name = 'Yahoo Finance chart feed';
  requiresApiKey = false;

  async fetchDaily(instrument, { startDate, endDate, signal } = {}) {
    if (instrument.provider !== PROVIDER_ID || !instrument.providerSymbol) throw new Error(`Geen gecontroleerde Yahoo-koppeling voor ${instrument.isin}`);
    const period1 = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
    const period2 = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
    const url = new URL(`${API_ROOT}/${encodeURIComponent(instrument.providerSymbol)}`);
    url.searchParams.set('period1', String(period1));
    url.searchParams.set('period2', String(period2));
    url.searchParams.set('interval', '1d');
    url.searchParams.set('events', 'div,splits');
    const response = await fetch(url, { signal, headers: { Accept: 'application/json', 'User-Agent': 'Koersplein-history/1.0' } });
    if (!response.ok) throw new Error(`Yahoo HTTP ${response.status} voor ${instrument.providerSymbol}`);
    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    if (!result || payload?.chart?.error) throw new Error(payload?.chart?.error?.description || 'Yahoo-resultaat ontbreekt');
    this.validateIdentity(instrument, result.meta);
    const quote = result.indicators?.quote?.[0] || {};
    const adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
    const bars = (result.timestamp || []).map((timestamp, index) => ({
      date: isoDate(timestamp),
      open: finiteOrNull(quote.open?.[index]),
      high: finiteOrNull(quote.high?.[index]),
      low: finiteOrNull(quote.low?.[index]),
      close: finiteOrNull(quote.close?.[index]),
      adjustedClose: finiteOrNull(adjusted[index]),
      volume: Number.isSafeInteger(quote.volume?.[index]) ? quote.volume[index] : null
    })).filter((bar) => bar.close !== null);
    return { bars, requestUrl: url.toString(), providerMeta: { exchangeName: result.meta.exchangeName, currency: result.meta.currency, symbol: result.meta.symbol, timezone: result.meta.exchangeTimezoneName } };
  }

  validateIdentity(instrument, meta = {}) {
    if (meta.symbol?.toUpperCase() !== instrument.providerSymbol.toUpperCase()) throw new Error(`Providersymbool wijkt af voor ${instrument.isin}`);
    if (meta.currency && meta.currency !== instrument.currency) throw new Error(`Valuta wijkt af voor ${instrument.isin}: ${meta.currency}`);
    const exchange = String(meta.fullExchangeName || meta.exchangeName || '').toLowerCase();
    if (exchange && !exchange.includes('amsterdam') && !['ams','aex'].includes(String(meta.exchangeName || '').toLowerCase())) throw new Error(`Providerbeurs is niet Amsterdam voor ${instrument.isin}: ${meta.exchangeName}`);
  }
}
