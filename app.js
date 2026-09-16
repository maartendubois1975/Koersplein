const qs = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const state = { shares: [], groups: [], activeGroup: 'all', profile: { term: '12', potential: '20', count: '4' }, apiBaseUrl: '', prices: new Map() };
const formatPrice = (value, currency = 'EUR') => Number.isFinite(Number(value)) ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: currency || 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value)) : '—';

function wireFinder() {
  qs('#opportunity-form').addEventListener('click', (event) => {
    const button = event.target.closest('[data-value]');
    if (!button) return;
    const group = button.closest('[data-choice]');
    group.querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item === button));
    state.profile[group.dataset.choice] = button.dataset.value;
    qs('#profile-summary').textContent = `${state.profile.term} maanden · +${state.profile.potential}% doel · ${state.profile.count} ${state.profile.count === '1' ? 'aandeel' : 'aandelen'}`;
    qs('#finder-result').hidden = true;
  });
  qs('#opportunity-form').addEventListener('submit', (event) => {
    event.preventDefault();
    qs('#finder-result').hidden = false;
    qs('#finder-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function renderRegions(regions) {
  qs('#region-navigation').innerHTML = regions.map((region) => region.status === 'available'
    ? `<a class="region-card active" href="#euronext"><small>Actief</small><strong>${escapeHtml(region.name)}</strong><span>${escapeHtml(region.description)}</span></a>`
    : `<div class="region-card planned"><small>Later</small><strong>${escapeHtml(region.name)}</strong><span>${escapeHtml(region.description)}</span></div>`).join('');
}

function renderMarkets(markets) {
  const available = markets.filter((item) => item.status === 'available');
  qs('#venue-market-count').textContent = available.length;
  qs('#market-navigation').innerHTML = markets.map((item) => item.status === 'available'
    ? `<a class="market-card active" href="#${escapeHtml(item.slug)}"><small>${escapeHtml(item.country)} · ${escapeHtml(item.mic)}</small><strong>${escapeHtml(item.name)}</strong><span>${item.shareCount} aandelen <i>→</i></span></a>`
    : `<div class="market-card planned"><small>${escapeHtml(item.country)} · ${escapeHtml(item.mic)}</small><strong>${escapeHtml(item.name)}</strong><span>In voorbereiding</span></div>`).join('');
}

function sharesIn(groupId, items = state.shares) {
  return groupId === 'other' ? items.filter((share) => !share.index) : items.filter((share) => share.index === groupId);
}

function filteredShares() {
  const query = qs('#search').value.trim().toLocaleLowerCase('nl');
  return state.shares.filter((share) => !query || [share.name, share.symbol, share.isin].some((value) => value.toLocaleLowerCase('nl').includes(query)));
}

function renderIndexNavigation(filtered) {
  const cards = [{ id: 'all', label: 'Alle', description: 'Volledige markt' }, ...state.groups];
  qs('#index-navigation').innerHTML = cards.map((group) => {
    const total = group.id === 'all' ? filtered.length : sharesIn(group.id, filtered).length;
    return `<button class="index-card${state.activeGroup === group.id ? ' selected' : ''}" type="button" data-group="${escapeHtml(group.id)}"><span>${escapeHtml(group.label)}</span><strong>${total}</strong><small>${escapeHtml(group.description)}</small></button>`;
  }).join('');
}

function shareTable(items) {
  return `<div class="table-wrap"><table><thead><tr><th>Bedrijf</th><th>Ticker</th><th>ISIN</th><th class="price">Open</th><th class="price">Slot</th><th aria-label="Open aandeel"></th></tr></thead><tbody>${items.map((share) => {
    const price = state.prices.get(share.isin);
    const open = price ? formatPrice(price.open, price.currency) : '—';
    const close = price ? formatPrice(price.close, price.currency) : '—';
    const title = price?.date ? `Laatste handelsdag ${escapeHtml(price.date)}` : 'Koers wordt geladen';
    return `<tr><td><a class="share-link" href="share.html?isin=${encodeURIComponent(share.isin)}">${escapeHtml(share.name)}</a></td><td><span class="ticker">${escapeHtml(share.symbol)}</span></td><td>${escapeHtml(share.isin)}</td><td class="price" title="${title}">${open}</td><td class="price" title="${title}">${close}</td><td><a class="row-arrow" aria-label="Bekijk ${escapeHtml(share.name)}" href="share.html?isin=${encodeURIComponent(share.isin)}">→</a></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderShares() {
  const filtered = filteredShares();
  qs('#share-count').textContent = filtered.length;
  renderIndexNavigation(filtered);
  const visible = state.activeGroup === 'all' ? state.groups : state.groups.filter((group) => group.id === state.activeGroup);
  qs('#share-groups').innerHTML = visible.map((group) => {
    const items = sharesIn(group.id, filtered);
    return `<section class="share-group"><header><div><p>${escapeHtml(group.kicker)}</p><h3>${escapeHtml(group.label)}</h3></div><span>${items.length} ${items.length === 1 ? 'aandeel' : 'aandelen'}</span></header>${items.length ? shareTable(items) : '<p class="empty-state">Geen aandelen gevonden.</p>'}</section>`;
  }).join('') || '<p class="empty-state">Geen aandelen gevonden.</p>';
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} kon niet worden geladen`);
  return response.json();
}

async function loadOverviewPrices() {
  if (!state.apiBaseUrl) return;
  const manifest = await loadJson(`${state.apiBaseUrl}/api/history/manifest.json`);
  const available = new Set(Object.keys(manifest.instruments || {}));
  const shares = state.shares.filter((share) => available.has(share.isin));
  const concurrency = 8;
  let cursor = 0;
  async function worker() {
    while (cursor < shares.length) {
      const share = shares[cursor++];
      try {
        const history = await loadJson(`${state.apiBaseUrl}/api/history/${encodeURIComponent(share.isin)}`);
        const bars = Array.isArray(history.bars) ? history.bars : [];
        const latest = bars[bars.length - 1];
        if (latest) state.prices.set(share.isin, { date: latest.date, open: latest.open, close: latest.close, currency: history.instrument?.currency || share.currency || 'EUR' });
      } catch (_) {
        // Een ontbrekende koers mag de rest van het Amsterdam-overzicht niet blokkeren.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, shares.length) }, worker));
  renderShares();
}

wireFinder();
qs('#index-navigation').addEventListener('click', (event) => {
  const button = event.target.closest('[data-group]');
  if (!button) return;
  state.activeGroup = button.dataset.group;
  renderShares();
});
qs('#search').addEventListener('input', renderShares);

Promise.all([
  loadJson('data/markets.json'),
  loadJson('data/regions.json'),
  loadJson('data/euronext-amsterdam.json'),
  loadJson('data/euronext-amsterdam-indices.json'),
  loadJson('data/home-contracts.json'),
  loadJson('data/runtime-config.json')
]).then(([marketData, regionData, shareData, indexData, homeData, runtimeConfig]) => {
  const membership = new Map(indexData.indices.flatMap((index) => index.constituents.map((member) => [member.isin, index.id])));
  state.shares = shareData.shares.map((share) => ({ ...share, index: membership.get(share.isin) || null }));
  state.groups = [...indexData.indices.map((index) => ({ id: index.id, label: index.displayName, description: index.description, kicker: 'Officiële Euronext-index' })), { id: 'other', label: 'Overig', description: 'Buiten AEX, AMX en AScX', kicker: 'Overige Amsterdamse noteringen' }];
  state.apiBaseUrl = String(runtimeConfig.apiBaseUrl || '').replace(/\/$/, '');
  const venue = marketData.venues.find((item) => item.id === 'euronext');
  renderRegions(regionData.regions);
  renderMarkets(venue.markets.map((market) => ({ ...market, shareCount: market.id === 'amsterdam' ? state.shares.length : 0 })));
  qs('#source-date').textContent = `Aandelen ${new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' }).format(new Date(shareData.retrievedAt))} · indices ${new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' }).format(new Date(indexData.asOf))}`;
  renderShares();
  loadOverviewPrices().catch(() => {});
}).catch((error) => {
  qs('#share-groups').innerHTML = `<p class="empty-state">${escapeHtml(error.message)}.</p>`;
});