import fs from 'node:fs/promises';
// ISO 6166: two letters, nine alphanumerics and a Luhn check digit.
function isValidIsin(value) {
  if (typeof value !== 'string' || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(value)) return false;
  const digits = [...value].map(char => /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char).join('');
  let sum = 0;
  let doubleDigit = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}
const mic=process.env.MARKET_MIC;
if(!mic)throw new Error('MARKET_MIC ontbreekt');
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const market=plan.markets.find(x=>x.mic===mic);
if(!market)throw new Error('Onbekende markt '+mic);
if(market.state!=='COMPLETE')throw new Error(`${mic} is ${market.state}; analyse start pas na COMPLETE eindvalidatie`);
const raw=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8'));
const shares=raw.shares||raw.instruments||[];
if(!shares.length)throw new Error('Catalogus leeg');
const isins=shares.map(x=>x.isin);
const missing=isins.filter(x=>typeof x!=='string'||!x.trim()).length;
if(missing)throw new Error('UNVERIFIED_ISIN_IDENTITIES_'+missing);
const invalid=isins.filter(x=>!isValidIsin(x));
if(invalid.length)throw new Error('INVALID_ISIN_IDENTITIES_'+invalid.length);
if(new Set(isins).size!==isins.length)throw new Error('Dubbele bekende ISIN in catalogus');
const listings=shares.map(x=>x.providerSymbol||x.symbol||x.ticker);
if(listings.some(x=>!x)||new Set(listings).size!==listings.length)throw new Error('Ontbrekende of dubbele beursnotering');
console.log(JSON.stringify({ok:true,mic,market:market.name,instruments:shares.length,state:market.state}));
