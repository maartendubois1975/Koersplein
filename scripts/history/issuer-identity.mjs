// ISO 17442 checksum. A syntactically valid identifier is not itself issuer evidence.
export function validLei(lei) {
  if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(lei || '')) return false;
  let remainder = 0;
  for (const character of lei) for (const digit of /[A-Z]/.test(character) ? String(character.charCodeAt(0) - 55) : character) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

// Proposals only: never edits a catalog or decides primary exchange membership.
export function issuerIdentityProposals(catalog, relationships) {
  const byIsin = new Map();
  for (const row of relationships) {
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(row.isin || '') || !validLei(row.lei)) throw Error('INVALID_ISIN_LEI_RELATIONSHIP');
    if (!byIsin.has(row.isin)) byIsin.set(row.isin, new Set());
    byIsin.get(row.isin).add(row.lei);
  }
  const proposals = [], unresolved = [], issuers = new Map();
  for (const share of catalog.shares) {
    const leis = [...(byIsin.get(share.isin) || [])];
    if (leis.length !== 1) { unresolved.push({ isin: share.isin, reason: leis.length ? 'AMBIGUOUS_LEI' : 'LEI_NOT_OBSERVED' }); continue; }
    const issuerId = 'LEI:' + leis[0];
    proposals.push({ isin: share.isin, issuerId });
    if (!issuers.has(issuerId)) issuers.set(issuerId, []);
    issuers.get(issuerId).push(share.isin);
  }
  return { proposals, unresolved, multipleClasses: [...issuers].filter(([, isins]) => isins.length > 1)
    .map(([issuerId, isins]) => ({ issuerId, isins })) };
}
