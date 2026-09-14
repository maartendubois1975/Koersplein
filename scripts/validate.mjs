import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../data/euronext-amsterdam.json', import.meta.url), 'utf8'));
const required = ['name', 'symbol', 'isin', 'market'];

if (data.exchange !== 'Euronext Amsterdam' || data.mic !== 'XAMS') throw new Error('Onjuiste beursgegevens.');
if (!Array.isArray(data.shares) || data.shares.length < 100) throw new Error('Bedrijvenlijst is onvolledig.');
if (data.shares.some((share) => required.some((field) => !share[field]))) throw new Error('Een aandeel mist verplichte gegevens.');
if (new Set(data.shares.map((share) => share.isin)).size !== data.shares.length) throw new Error('Dubbele ISIN gevonden.');

console.log(`Koersplein bevat ${data.shares.length} geldige Amsterdamse aandelen.`);
