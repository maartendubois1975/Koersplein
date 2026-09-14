import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [sharesData, indicesData, marketsData] = await Promise.all([
  readJson('../data/euronext-amsterdam.json'), readJson('../data/euronext-amsterdam-indices.json'), readJson('../data/markets.json')
]);
const required = ['name', 'symbol', 'isin', 'market'];
if (sharesData.exchange !== 'Euronext Amsterdam' || sharesData.mic !== 'XAMS') throw new Error('Onjuiste beursgegevens.');
if (!Array.isArray(sharesData.shares) || sharesData.shares.length < 100) throw new Error('Bedrijvenlijst is onvolledig.');
if (sharesData.shares.some((share) => required.some((field) => !share[field]))) throw new Error('Een aandeel mist verplichte gegevens.');
const shareIsins = new Set(sharesData.shares.map((share) => share.isin));
if (shareIsins.size !== sharesData.shares.length) throw new Error('Dubbele ISIN in de Amsterdamse aandelenlijst.');

const expected = { aex: 30, amx: 25, ascx: 20 };
const allMembers = [];
for (const index of indicesData.indices) {
  if (index.constituents.length !== expected[index.id]) throw new Error(`${index.displayName} heeft ${index.constituents.length} in plaats van ${expected[index.id]} leden.`);
  if (!index.source.startsWith('https://live.euronext.com/')) throw new Error(`${index.displayName} mist een officiële Euronext-bron.`);
  allMembers.push(...index.constituents.map((member) => ({ ...member, index: index.id })));
}
if (new Set(allMembers.map((member) => member.isin)).size !== allMembers.length) throw new Error('Een ISIN staat in meerdere indices.');
const missing = allMembers.filter((member) => !shareIsins.has(member.isin));
if (missing.length) throw new Error(`Indexleden ontbreken in Amsterdam-data: ${missing.map((member) => `${member.index}:${member.isin}`).join(', ')}`);
const euronext = marketsData.venues.find((venue) => venue.id === 'euronext');
if (!euronext?.markets.some((market) => market.id === 'amsterdam' && market.status === 'available')) throw new Error('Euronext Amsterdam ontbreekt in de marktstructuur.');
const other = sharesData.shares.length - allMembers.length;
if (other < 0) throw new Error('De groepsaantallen sluiten niet aan.');
console.log(`Koersplein bevat ${sharesData.shares.length} geldige Amsterdamse aandelen: AEX ${expected.aex}, AMX ${expected.amx}, AScX ${expected.ascx}, Overig ${other}.`);
