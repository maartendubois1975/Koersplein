import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [sharesData, indicesData, brusselsData, parisData, marketsData, regionsData, mappings, contracts] = await Promise.all([
  readJson('../data/euronext-amsterdam.json'),
  readJson('../data/euronext-amsterdam-indices.json'),
  readJson('../data/euronext-brussels.json'),
  readJson('../data/euronext-paris.json'),
  readJson('../data/markets.json'),
  readJson('../data/regions.json'),
  readJson('../data/history-instruments.json'),
  readJson('../data/home-contracts.json')
]);

const required = ['name', 'symbol', 'isin', 'market'];
if (sharesData.exchange !== 'Euronext Amsterdam' || sharesData.mic !== 'XAMS') throw new Error('Onjuiste beursgegevens.');
if (!Array.isArray(sharesData.shares) || sharesData.shares.length !== 124) throw new Error(`Verwacht 124 Amsterdamse aandelen, vond ${sharesData.shares?.length}.`);
if (sharesData.shares.some((share) => required.some((field) => !share[field]))) throw new Error('Een aandeel mist verplichte gegevens.');
const shareIsins = new Set(sharesData.shares.map((share) => share.isin));
if (shareIsins.size !== sharesData.shares.length) throw new Error('Dubbele ISIN in de Amsterdamse aandelenlijst.');
if (brusselsData.exchange !== 'Euronext Brussels' || brusselsData.mic !== 'XBRU') throw new Error('Onjuiste Brusselse beursgegevens.');
if (!Array.isArray(brusselsData.shares) || brusselsData.shares.length !== 133) throw new Error(`Verwacht 133 Brusselse aandelen, vond ${brusselsData.shares?.length}.`);
if (brusselsData.shares.some((share) => required.some((field) => !share[field]))) throw new Error('Een Brussels aandeel mist verplichte gegevens.');
if (new Set(brusselsData.shares.map((share) => share.isin)).size !== brusselsData.shares.length) throw new Error('Dubbele ISIN in de Brusselse aandelenlijst.');
if (parisData.exchange !== 'Euronext Paris' || parisData.mic !== 'XPAR') throw new Error('Onjuiste Parijse beursgegevens.');
if (!Array.isArray(parisData.shares) || !parisData.shares.length) throw new Error('Parijse aandelenlijst is leeg.');
if (parisData.shares.some((share) => required.some((field) => !share[field]))) throw new Error('Een Parijs aandeel mist verplichte gegevens.');
if (new Set(parisData.shares.map((share) => share.isin)).size !== parisData.shares.length) throw new Error('Dubbele ISIN in de Parijse aandelenlijst.');

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
const other = sharesData.shares.length - allMembers.length;
if (other !== 49) throw new Error(`Verwacht 49 overige aandelen, vond ${other}.`);

const euronext = marketsData.venues.find((venue) => venue.id === 'euronext');
for (const id of ['amsterdam','brussels','paris']) if (!euronext?.markets.some((market) => market.id === id && market.status === 'available')) throw new Error(`Euronext ${id} ontbreekt in de actieve marktstructuur.`);
if (euronext.markets.filter((market) => market.status === 'available').length !== 3) throw new Error('Alleen Amsterdam, Brussel en Parijs mogen nu actief zijn.');
if (!regionsData.regions.some((region) => region.id === 'europe' && region.status === 'available')) throw new Error('Europa ontbreekt.');
if (regionsData.regions.filter((region) => region.status === 'available').length !== 1) throw new Error('Alleen Europa mag nu actief zijn.');

for (const mapping of mappings.providerMappings) {
  const share = sharesData.shares.find((item) => item.isin === mapping.isin);
  if (!share || share.symbol !== mapping.symbol || mappings.mic !== 'XAMS') throw new Error(`Ongeldige historie-identiteit: ${mapping.isin}`);
  if (!mapping.identitySource.includes(`${mapping.isin}-XAMS`)) throw new Error(`Officiële identiteitsbron ontbreekt: ${mapping.isin}`);
}
for (const isin of ['NL0010273215', 'NL0012969182']) if (!mappings.providerMappings.some((item) => item.isin === isin)) throw new Error(`Testkoppeling ontbreekt: ${isin}`);
if (contracts.opportunitySelection.status !== 'engine_unavailable' || contracts.dailyMovers.status !== 'dataset_unavailable') throw new Error('Lege homepage-statussen zijn niet veilig ingesteld.');

console.log(`Koersplein geldig: Amsterdam ${sharesData.shares.length}; Brussel ${brusselsData.shares.length}; Parijs ${parisData.shares.length}; AEX ${expected.aex}; AMX ${expected.amx}; AScX ${expected.ascx}; Overig ${other}; historie-testkoppelingen ${mappings.providerMappings.length}.`);
