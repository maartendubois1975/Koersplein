const marketNavigation = document.querySelector('#market-navigation');
const indexNavigation = document.querySelector('#index-navigation');
const groupContainer = document.querySelector('#share-groups');
const count = document.querySelector('#share-count');
const search = document.querySelector('#search');
const sourceDate = document.querySelector('#source-date');

let shares = [];
let groups = [];
let activeGroup = 'all';

const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function renderMarketNavigation(markets) {
  const available = markets.filter((item) => item.status === 'available');
  document.querySelector('#venue-market-count').textContent = available.length;
  marketNavigation.innerHTML = markets.map((item) => item.status === 'available'
    ? `<a class="market-card active" href="#${escapeHtml(item.slug)}"><small>${escapeHtml(item.country)}</small><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.mic)} · ${item.shareCount} aandelen</span></a>`
    : `<div class="market-card soon"><small>${escapeHtml(item.country)}</small><strong>${escapeHtml(item.name)}</strong><span>Volgt later</span></div>`).join('');
}

function sharesIn(groupId, items = shares) {
  return groupId === 'other' ? items.filter((share) => !share.index) : items.filter((share) => share.index === groupId);
}

function filteredShares() {
  const query = search.value.trim().toLocaleLowerCase('nl');
  return shares.filter((share) => !query || share.name.toLocaleLowerCase('nl').includes(query) || share.symbol.toLocaleLowerCase('nl').includes(query) || share.isin.toLocaleLowerCase('nl').includes(query));
}

function renderIndexNavigation(items, filtered) {
  const cards = [{ id: 'all', label: 'Alle aandelen', description: 'Volledige Amsterdamse markt' }, ...items];
  indexNavigation.innerHTML = cards.map((group) => {
    const total = group.id === 'all' ? filtered.length : sharesIn(group.id, filtered).length;
    return `<button class="index-card${activeGroup === group.id ? ' selected' : ''}" type="button" data-group="${escapeHtml(group.id)}"><span>${escapeHtml(group.label)}</span><strong>${total}</strong><small>${escapeHtml(group.description)}</small></button>`;
  }).join('');
}

function shareTable(items) {
  return `<div class="table-wrap"><table><thead><tr><th>Bedrijf</th><th>Ticker</th><th>ISIN</th><th class="price">Open</th><th class="price">Slot</th></tr></thead><tbody>${items.map((share) => `<tr><td>${escapeHtml(share.name)}</td><td>${escapeHtml(share.symbol)}</td><td>${escapeHtml(share.isin)}</td><td class="empty-price">—</td><td class="empty-price">—</td></tr>`).join('')}</tbody></table></div>`;
}

function render() {
  const filtered = filteredShares();
  count.textContent = filtered.length;
  renderIndexNavigation(groups, filtered);
  const visibleGroups = activeGroup === 'all' ? groups : groups.filter((group) => group.id === activeGroup);
  groupContainer.innerHTML = visibleGroups.map((group) => {
    const items = sharesIn(group.id, filtered);
    return `<section class="share-group" id="groep-${escapeHtml(group.id)}"><header><div><p>${escapeHtml(group.kicker)}</p><h3>${escapeHtml(group.label)}</h3></div><span>${items.length} ${items.length === 1 ? 'aandeel' : 'aandelen'}</span></header>${items.length ? shareTable(items) : '<p class="no-results">Geen aandelen gevonden.</p>'}</section>`;
  }).join('') || '<p class="no-results">Geen aandelen gevonden.</p>';
}

indexNavigation.addEventListener('click', (event) => {
  const button = event.target.closest('[data-group]');
  if (!button) return;
  activeGroup = button.dataset.group;
  render();
  groupContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
search.addEventListener('input', render);

Promise.all([
  fetch('data/markets.json').then((response) => response.ok ? response.json() : Promise.reject(new Error('Marktstructuur kon niet worden geladen.'))),
  fetch('data/euronext-amsterdam.json').then((response) => response.ok ? response.json() : Promise.reject(new Error('Bedrijvenlijst kon niet worden geladen.'))),
  fetch('data/euronext-amsterdam-indices.json').then((response) => response.ok ? response.json() : Promise.reject(new Error('Indexindeling kon niet worden geladen.')))
]).then(([marketData, shareData, indexData]) => {
  const membership = new Map(indexData.indices.flatMap((index) => index.constituents.map((item) => [item.isin, index.id])));
  shares = shareData.shares.map((share) => ({ ...share, index: membership.get(share.isin) || null }));
  groups = [...indexData.indices.map((index) => ({ id: index.id, label: index.displayName, description: index.description, kicker: 'Officiële Euronext-index' })), { id: 'other', label: 'Overig', description: 'Buiten AEX, AMX en AScX', kicker: 'Overige Amsterdamse noteringen' }];
  const venue = marketData.venues.find((item) => item.id === 'euronext');
  renderMarketNavigation(venue.markets.map((item) => ({ ...item, shareCount: item.id === 'amsterdam' ? shares.length : 0 })));
  sourceDate.textContent = `Aandelenlijst ${new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long' }).format(new Date(shareData.retrievedAt))} · indices ${new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long' }).format(new Date(indexData.asOf))}`;
  render();
}).catch((error) => { groupContainer.innerHTML = `<p class="no-results">${escapeHtml(error.message)}</p>`; });
