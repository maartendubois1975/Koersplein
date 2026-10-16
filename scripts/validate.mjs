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
const requiredPublishedMarkets = ['amsterdam','brussels','paris','milan'];
for (const id of requiredPublishedMarkets) if (!euronext?.markets.some((market) => market.id === id && market.status === 'available')) throw new Error(`Euronext ${id} ontbreekt in de actieve marktstructuur.`);
// Published markets are additive: once a market has passed its own end validation it may
// become available without making older market fill/repair workflows invalid.
// The canonical completion plan is authoritative for published European markets.
// Do not reject newly completed venues using a stale hard-coded allowlist.
const worldPlan = await readJson('../data/world-fill-plan.json');
const completeMarkets = worldPlan.markets.filter(market => market.state === 'COMPLETE');
const completeMics = new Set(completeMarkets.map(market => market.mic));
if (completeMics.size !== completeMarkets.length) throw new Error('Dubbele MIC in de complete Europese marktadministratie.');
const published = (euronext?.markets || []).filter(market => market.status === 'available');
for (const market of completeMarkets) {
  const match = published.find(item => item.mic === market.mic);
  if (!match || !match.sharesData) throw new Error(`Complete Europese markt ontbreekt in publicatie: ${market.mic}`);
}
for (const market of published) {
  if (!completeMics.has(market.mic)) throw new Error(`Gepubliceerde Europese markt ontbreekt in COMPLETE-administratie: ${market.mic}`);
}

// Validate every published share catalog, not only the first Euronext venues.
// Athens and Warsaw have source-proven symbols but unresolved ISINs: do not
// fabricate identifiers or silently treat these markets as fully identified.
let publishedShares = 0;
const marketsWithUnresolvedIsins = [];
for (const market of published) {
  const catalog = await readJson('../data/' + market.sharesData);
  if (catalog.mic !== market.mic || !Array.isArray(catalog.shares) || !catalog.shares.length) {
    throw new Error(`Ongeldige of lege Europese aandelenlijst: ${market.mic}`);
  }
  const identities = new Set();
  let missing = 0;
  for (const share of catalog.shares) {
    if (!share.name || !share.symbol || share.mic !== market.mic) {
      throw new Error(`Ontbrekende aandelenidentiteit in ${market.mic}`);
    }
    const key = share.isin || share.symbol;
    if (identities.has(key)) throw new Error(`Dubbele aandelenidentiteit in ${market.mic}: ${key}`);
    identities.add(key);
    if (!share.isin) missing++;
  }
  if (missing && !['XATH', 'XWAR'].includes(market.mic)) {
    throw new Error(`Onverwacht ontbrekende ISINs in ${market.mic}: ${missing}`);
  }
  if (missing) marketsWithUnresolvedIsins.push(`${market.mic}:${missing}`);
  if (market.mic === 'XWAR' && catalog.shares.some(share => ['WIG','WIG20','WIG30','NCINDEX'].includes(share.symbol))) {
    throw new Error('Warschau bevat opnieuw beursindices tussen de aandelen.');
  }
  publishedShares += catalog.shares.length;
}
console.log(`Europese cataloguscontrole: ${published.length} markten, ${publishedShares} aandelen; ISIN-achterstand ${marketsWithUnresolvedIsins.join(', ') || 'geen'}.`);
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

