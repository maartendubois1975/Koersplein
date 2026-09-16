const PROVIDER_ID = 'yahoo-chart';
const API_ROOT = 'https://query1.finance.yahoo.com/v8/finance/chart';

const isoDate = (unixSeconds) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);
const finiteOrNull = (value) => Number.isFinite(value) ? value : null;

export class YahooChartProvider {
  id = PROVIDER_ID;
  name = 'Yahoo Finance chart feed';
  requiresApiKey = false;

  supports(instrument) {
    return instrument.mic === 'XAMS' && Boolean(instrument.providerSymbol || instrument.provider_symbol || instrument.ticker || instrument.symbol);
  }

  providerSymbolFor(instrument) {
    return instrument.providerSymbol || instrument.provider_symbol || `${instrument.ticker || instrument.symbol}.AS`;
  }

  async fetchDaily(instrument, { startDate, endDate, signal } = {}) {
    const providerSymbol = this.providerSymbolFor(instrument);
    if (!providerSymbol) throw new Error(`Geen gecontroleerde Yahoo-koppeling voor ${instrument.isin}`);
    const period1 = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
    const period2 = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
    const url = new URL(`${API_ROOT}/${encodeURIComponent(providerSymbol)}`);
    url.searchParams.set('period1', String(period1));
    url.searchParams.set('period2', String(period2));
    url.searchParams.set('interval', '1d');
    url.searchParams.set('events', 'div,splits');
    const response = await fetch(url, { signal, headers: { Accept: 'application/json', 'User-Agent': 'Koersplein-history/1.0' } });
    if (!response.ok) throw new Error(`Yahoo HTTP ${response.status} voor ${providerSymbol}`);
    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    if (!result || payload?.chart?.error) throw new Error(payload?.chart?.error?.description || 'Yahoo-resultaat ontbreekt');
    this.validateIdentity({ ...instrument, providerSymbol }, result.meta);
    const quote = result.indicators?.quote?.[0] || {};
    const adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
    const bars = (result.timestamp || []).map((timestamp, index) => {
      let high = finiteOrNull(quote.high?.[index]);
      let low = finiteOrNull(quote.low?.[index]);
      // Een incidenteel corrupte Yahoo OHLC-regel mag niet duizenden geldige slotkoersen blokkeren.
      // Bewaar de dag en laat alleen de onbetrouwbare high/low weg; reparatie kan die later aanvullen.
      if (high !== null && low !== null && high < low) { high = null; low = null; }
      return {
        date: isoDate(timestamp),
        open: finiteOrNull(quote.open?.[index]),
        high,
        low,
        close: finiteOrNull(quote.close?.[index]),
        adjustedClose: finiteOrNull(adjusted[index]),
        volume: Number.isSafeInteger(quote.volume?.[index]) ? quote.volume[index] : null
      };
    }).filter((bar) => bar.close !== null);
    return { bars, requestUrl: url.toString(), providerMeta: { exchangeName: result.meta.exchangeName, currency: result.meta.currency, symbol: result.meta.symbol, timezone: result.meta.exchangeTimezoneName } };
  }

  validateIdentity(instrument, meta = {}) {
    if (meta.symbol?.toUpperCase() !== instrument.providerSymbol.toUpperCase()) throw new Error(`Providersymbool wijkt af voor ${instrument.isin}`);
    // Handelsvaluta is provider/listing-specifiek en mag een geldige Amsterdamse/cross-listing historie niet blokkeren.
    // De bronvaluta blijft beschikbaar in providerMeta voor latere normalisatie en controle.
    const explicitCrossListing = Boolean(instrument.allowProviderExchangeMismatch);
    const exchange = String(meta.fullExchangeName || meta.exchangeName || '').toLowerCase();
    if (!explicitCrossListing && exchange && !exchange.includes('amsterdam') && !['ams','aex'].includes(String(meta.exchangeName || '').toLowerCase())) throw new Error(`Providerbeurs is niet Amsterdam voor ${instrument.isin}: ${meta.exchangeName}`);
  }
}
