import fs from 'node:fs/promises';
import {isValidIsin} from './isin-identity-core.mjs';

const mic = process.env.MARKET_MIC;
if (!mic) throw new Error('MARKET_MIC ontbreekt');
const plan = JSON.parse(await fs.readFile('data/world-fill-plan.json', 'utf8'));
const market = plan.markets.find(item => item.mic === mic);
if (!market) throw new Error('Onbekende markt ' + mic);
if (market.state !== 'COMPLETE') throw new Error(`${mic} is ${market.state}; analyse start pas na COMPLETE eindvalidatie`);

const raw = JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`, 'utf8'));
const shares = raw.shares || raw.instruments || [];
if (!shares.length) throw new Error('Catalogus leeg');
const isins = shares.map(item => item.isin).filter(item => typeof item === 'string' && item.trim());
if (isins.length !== shares.length) throw new Error('UNVERIFIED_ISIN_IDENTITIES_' + (shares.length - isins.length));
const invalid = isins.filter(isin => !isValidIsin(isin));
if (invalid.length) throw new Error('INVALID_ISIN_IDENTITIES_' + invalid.length);
if (new Set(isins).size !== isins.length) throw new Error('Dubbele bekende ISIN in catalogus');
const listings = shares.map(item => item.providerSymbol || item.symbol || item.ticker);
if (listings.some(item => !item) || new Set(listings).size !== listings.length) throw new Error('Ontbrekende of dubbele beursnotering');
console.log(JSON.stringify({ok: true, mic, market: market.name, instruments: shares.length, state: market.state}));
