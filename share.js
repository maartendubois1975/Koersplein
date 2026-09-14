const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const isin = new URLSearchParams(location.search).get('isin');
const detail = document.querySelector('#share-detail');
const loadJson = async (path) => { const response = await fetch(path); if (!response.ok) throw new Error(String(response.status)); return response.json(); };

Promise.all([loadJson('data/euronext-amsterdam.json'), loadJson('data/euronext-amsterdam-indices.json')]).then(async ([shareData, indexData]) => {
  const share = shareData.shares.find((item) => item.isin === isin);
  if (!share) throw new Error('Aandeel niet gevonden');
  const index = indexData.indices.find((item) => item.constituents.some((member) => member.isin === share.isin));
  const indexName = index?.displayName || 'Overig';
  document.title = `${share.name} — Koersplein`;
  document.querySelector('#crumb-share').textContent = share.name;
  detail.innerHTML = `<div><p class="eyebrow">Euronext Amsterdam · ${escapeHtml(indexName)}</p><h1>${escapeHtml(share.name)}</h1><div class="identity-line"><span class="ticker">${escapeHtml(share.symbol)}</span><span>${escapeHtml(share.isin)}</span><span>XAMS</span></div></div><div class="latest-price"><span>Laatste koers</span><strong>—</strong><small>Nog niet beschikbaar</small></div>`;
  try {
    const history = await loadJson(`data/history/${encodeURIComponent(share.isin)}.json`);
    const coverage = history.coverage;
    document.querySelector('#history-range').textContent = `${coverage.firstDate} — ${coverage.lastDate}`;
    document.querySelector('#history-state').innerHTML = `<strong>${coverage.records.toLocaleString('nl-NL')} handelsdagen beschikbaar</strong><p>OHLC${history.coverage.volumeRecords ? 'V' : ''} · bron ${escapeHtml(history.provider.name)} · laatst opgehaald ${new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' }).format(new Date(history.provider.retrievedAt))}</p>`;
    const last = history.bars.at(-1);
    detail.querySelector('.latest-price').innerHTML = `<span>Laatste slotkoers</span><strong>€ ${Number(last.close).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>${escapeHtml(last.date)} · ${escapeHtml(history.provider.name)}</small>`;
  } catch { /* een ontbrekend historiebestand is een geldige lege status */ }
}).catch((error) => {
  detail.innerHTML = `<div><p class="eyebrow">Niet beschikbaar</p><h1>${escapeHtml(error.message)}</h1><p><a class="button ghost" href="index.html#amsterdam">Terug naar Amsterdam</a></p></div>`;
});