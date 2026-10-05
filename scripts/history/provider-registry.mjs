import { YahooChartProvider } from './providers/yahoo-chart.mjs';
import { EuronextLiveProvider } from './providers/euronext-live.mjs';
import { YahooIsinProvider } from './providers/yahoo-isin.mjs';
import { StockAnalysisBitProvider } from './providers/stockanalysis-bit.mjs';
import { NasdaqBalticProvider } from './providers/nasdaq-baltic.mjs';

export class ProviderRegistry {
  #providers = [];

  constructor(providers = []) {
    providers.forEach((provider) => this.register(provider));
  }

  register(provider) {
    if (!provider?.id || typeof provider.fetchDaily !== 'function') throw new Error('Ongeldige koersprovider');
    if (this.#providers.some((candidate) => candidate.id === provider.id)) throw new Error(`Provider bestaat al: ${provider.id}`);
    this.#providers.push(provider);
    return this;
  }

  get(id) {
    return this.#providers.find((provider) => provider.id === id) || null;
  }

  candidates(instrument) {
    return this.#providers.filter((provider) => provider.supports?.(instrument) !== false);
  }

  async fetchDaily(instrument, range, preferredProvider = null, { strictPreferred = false } = {}) {
    const preferred = preferredProvider ? this.get(preferredProvider) : null;
    if (preferredProvider && !preferred) throw new Error(`Onbekende voorkeursprovider: ${preferredProvider}`);
    const ordered = preferredProvider
      ? (strictPreferred ? [preferred] : [preferred, ...this.candidates(instrument).filter((provider) => provider.id !== preferredProvider)]).filter(Boolean)
      : this.candidates(instrument);
    if (!ordered.length) throw new Error(`Geen provider beschikbaar voor ${instrument.isin}`);
    const failures = [];
    for (const provider of ordered) {
      try {
        return { provider, result: await provider.fetchDaily(instrument, range) };
      } catch (error) {
        failures.push(`${provider.id}: ${error.message}`);
      }
    }
    throw new Error(`Alle providers faalden voor ${instrument.isin}: ${failures.join('; ')}`);
  }
}

export const createDefaultProviderRegistry = () => new ProviderRegistry([new NasdaqBalticProvider(), new YahooChartProvider(), new EuronextLiveProvider(), new YahooIsinProvider(), new StockAnalysisBitProvider()]);
