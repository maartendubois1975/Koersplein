const list = document.querySelector('#share-list');
const count = document.querySelector('#share-count');
const search = document.querySelector('#search');
const sourceDate = document.querySelector('#source-date');

let shares = [];

function render(items) {
  count.textContent = items.length;

  if (!items.length) {
    list.innerHTML = '<tr><td colspan="5" class="no-results">Geen aandelen gevonden.</td></tr>';
    return;
  }

  list.innerHTML = items.map((share) => `
    <tr>
      <td>${share.name}</td>
      <td>${share.symbol}</td>
      <td>${share.isin}</td>
      <td class="empty-price">—</td>
      <td class="empty-price">—</td>
    </tr>
  `).join('');
}

fetch('data/euronext-amsterdam.json')
  .then((response) => {
    if (!response.ok) throw new Error('Bedrijvenlijst kon niet worden geladen.');
    return response.json();
  })
  .then((data) => {
    shares = data.shares;
    sourceDate.textContent = `Lijst opgehaald: ${new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long' }).format(new Date(data.retrievedAt))}`;
    render(shares);
  })
  .catch((error) => {
    list.innerHTML = `<tr><td colspan="5" class="no-results">${error.message}</td></tr>`;
  });

search.addEventListener('input', () => {
  const query = search.value.trim().toLocaleLowerCase('nl');
  const filtered = shares.filter((share) =>
    share.name.toLocaleLowerCase('nl').includes(query) ||
    share.symbol.toLocaleLowerCase('nl').includes(query) ||
    share.isin.toLocaleLowerCase('nl').includes(query)
  );
  render(filtered);
});
