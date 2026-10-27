import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [sharesData, mappings] = await Promise.all([
  readJson('../data/euronext-amsterdam.json'),
  readJson('../data/history-instruments.json')
]);

const required = ['name', 'symbol', 'isin', 'market'];
if (sharesData.exchange !== 'Euronext Amsterdam' || sharesData.mic !== 'XAMS') throw new Error('Onjuiste beursgegevens.');
if (!Array.isArray(sharesData.shares) || sharesData.shares.length !== 85) throw new Error(`Verwacht 85 geselecteerde Amsterdamse bedrijven, vond ${sharesData.shares?.length}.`);
if (sharesData.shares.some((share) => required.some((field) => !share[field]))) throw new Error('Een aandeel mist verplichte gegevens.');
const shareIsins = new Set(sharesData.shares.map((share) => share.isin));
if (shareIsins.size !== sharesData.shares.length) throw new Error('Dubbele ISIN in de Amsterdamse aandelenlijst.');
// Amsterdam-only rebuild: European market audits are deferred until Amsterdam is complete.
for (const mapping of mappings.providerMappings) {
  const share = sharesData.shares.find((item) => item.isin === mapping.isin);
  if (share && (share.symbol !== mapping.symbol || mappings.mic !== 'XAMS')) throw new Error(`Ongeldige historie-identiteit: ${mapping.isin}`);
  if (!mapping.identitySource.includes(`${mapping.isin}-XAMS`)) throw new Error(`Officiële identiteitsbron ontbreekt: ${mapping.isin}`);
}
for (const isin of ['NL0010273215', 'NL0012969182']) if (!mappings.providerMappings.some((item) => item.isin === isin)) throw new Error(`Testkoppeling ontbreekt: ${isin}`);

console.log(`Amsterdam geldig: ${sharesData.shares.length} geselecteerde bedrijven; ${mappings.providerMappings.length} historie-koppelingen.`);

