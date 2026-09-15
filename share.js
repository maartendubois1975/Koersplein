import { renderHistoryChart, validateHistoryDocument } from './chart.js';

const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const isin = new URLSearchParams(location.search).get('isin');
const detail = document.querySelector('#share-detail');
const historyState = document.querySelector('#history-state');
const loadJson = async (url) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} voor ${new URL(url, document.baseURI).pathname}`);
  return response.json();
};

function showHistoryError(message) {
  historyState.className = 'history-empty';
  historyState.innerHTML = `<strong>Historie tijdelijk niet beschikbaar</strong><p>${escapeHtml(message)}.</p>`;
  document.querySelector('#history-range').textContent = '—';
}

Promise.all([
  loadJson(new URL('data/euronext-amsterdam.json', document.baseURI)),
  loadJson(new URL('data/euronext-amsterdam-indices.json', document.baseURI)),
  loadJson(new URL('data/runtime-config.json', document.baseURI)).catch(() => ({ apiBaseUrl: '' }))
]).then(async ([shareData, indexData, runtime]) => {
  const share = shareData.shares.find((item) => item.isin === isin);
  if (!share) throw new Error('Aandeel niet gevonden');
  const index = indexData.indices.find((item) => item.constituents.some((member) => member.isin === share.isin));
  const indexName = index?.displayName || 'Overig';
  document.title = `${share.name} — Koersplein`;
  document.querySelector('#crumb-share').textContent = share.name;
  detail.innerHTML = `<div><p class="eyebrow">Euronext Amsterdam · ${escapeHtml(indexName)}</p><h1>${escapeHtml(share.name)}</h1><div class="identity-line"><span class="ticker">${escapeHtml(share.symbol)}</span><span>${escapeHtml(share.isin)}</span><span>XAMS</span></div></div><div class="latest-price"><span>Laatste koers</span><strong>—</strong><small>Historie wordt geladen</small></div>`;

  try {
    const apiBaseUrl = String(runtime.apiBaseUrl || '').replace(/\/$/, '');
    const manifestUrl = apiBaseUrl
      ? new URL(`${apiBaseUrl}/api/history/manifest.json`)
      : new URL('data/history/manifest.json', document.baseURI);
    const manifest = await loadJson(manifestUrl);
    const entry = manifest.instruments?.[share.isin];
    if (!entry?.file) throw new Error(`Geen gepubliceerde historiekoppeling voor ${share.isin}`);
    if (entry.symbol !== share.symbol || entry.mic !== 'XAMS') throw new Error('Historie-manifest heeft een onjuiste identiteit');
    const history = await loadJson(new URL(entry.file, manifestUrl));
    const bars = validateHistoryDocument(history, share);
    const coverage = history.coverage;
    document.querySelector('#history-range').textContent = `${coverage.firstDate} — ${coverage.lastDate}`;
    renderHistoryChart(historyState, bars, { currency: history.instrument.currency });
    const source = document.createElement('p');
    source.className = 'history-source';
    source.textContent = `${bars.length.toLocaleString('nl-NL')} echte dagrecords · technische testbron: ${history.provider.name} · opgehaald ${new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' }).format(new Date(history.provider.retrievedAt))}`;
    historyState.append(source);
    const last = bars.at(-1);
    detail.querySelector('.latest-price').innerHTML = `<span>Laatste slotkoers</span><strong>${Number(last.close).toLocaleString('nl-NL', { style: 'currency', currency: history.instrument.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>${escapeHtml(last.date)} · technische testbron</small>`;
  } catch (error) {
    showHistoryError(error.message);
  }
}).catch((error) => {
  detail.innerHTML = `<div><p class="eyebrow">Niet beschikbaar</p><h1>${escapeHtml(error.message)}</h1><p><a class="button ghost" href="index.html#amsterdam">Terug naar Amsterdam</a></p></div>`;
  showHistoryError('Aandeelgegevens konden niet worden geladen');
});
