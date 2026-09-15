const DAY = 86_400_000;
const PERIODS = { '1J': 1, '3J': 3, '5J': 5, '10J': 10, MAX: null };

const finite = (value) => Number.isFinite(Number(value));
const money = (value, currency = 'EUR') => new Intl.NumberFormat('nl-NL', {
  style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(Number(value));
const shortDate = (value) => new Intl.DateTimeFormat('nl-NL', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
}).format(new Date(`${value}T00:00:00Z`));

export function validateHistoryDocument(document, identity) {
  if (!document || document.schemaVersion !== 1 || !Array.isArray(document.bars)) throw new Error('Historieformaat wordt niet herkend');
  const instrument = document.instrument || {};
  if (instrument.isin !== identity.isin || instrument.symbol !== identity.symbol || instrument.mic !== 'XAMS') throw new Error('Historie-identiteit wijkt af');
  const seen = new Set();
  const bars = document.bars.map((bar) => ({
    date: String(bar.date || ''),
    open: finite(bar.open) ? Number(bar.open) : null,
    high: finite(bar.high) ? Number(bar.high) : null,
    low: finite(bar.low) ? Number(bar.low) : null,
    close: finite(bar.close) ? Number(bar.close) : null,
    adjustedClose: finite(bar.adjustedClose) ? Number(bar.adjustedClose) : null,
    volume: finite(bar.volume) ? Number(bar.volume) : null
  })).filter((bar) => /^\d{4}-\d{2}-\d{2}$/.test(bar.date) && bar.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const bar of bars) {
    if (seen.has(bar.date)) throw new Error('Dubbele handelsdag in historie');
    seen.add(bar.date);
  }
  if (!bars.length || bars.length !== document.coverage?.records) throw new Error('Historiedekking is niet consistent');
  if (bars[0].date !== document.coverage.firstDate || bars.at(-1).date !== document.coverage.lastDate) throw new Error('Historieperiode is niet consistent');
  return bars;
}

export function filterPeriod(bars, period) {
  if (!(period in PERIODS) || period === 'MAX') return bars;
  const latest = new Date(`${bars.at(-1).date}T00:00:00Z`);
  const threshold = new Date(latest);
  threshold.setUTCFullYear(threshold.getUTCFullYear() - PERIODS[period]);
  const result = bars.filter((bar) => bar.date >= threshold.toISOString().slice(0, 10));
  return result.length > 1 ? result : bars.slice(-2);
}

export function downsampleSeries(bars, maximum = 900) {
  if (bars.length <= maximum) return bars;
  const result = [bars[0]];
  const bucketCount = Math.max(1, Math.floor((maximum - 2) / 2));
  const width = (bars.length - 2) / bucketCount;
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = 1 + Math.floor(bucket * width);
    const end = Math.min(bars.length - 1, 1 + Math.floor((bucket + 1) * width));
    const slice = bars.slice(start, Math.max(start + 1, end));
    let low = slice[0];
    let high = slice[0];
    for (const bar of slice) {
      if (bar.close < low.close) low = bar;
      if (bar.close > high.close) high = bar;
    }
    if (low.date < high.date) result.push(low, high);
    else if (low.date > high.date) result.push(high, low);
    else result.push(low);
  }
  result.push(bars.at(-1));
  return result.filter((bar, index, items) => index === 0 || bar.date !== items[index - 1].date);
}

export function buildChartModel(bars, period = 'MAX', width = 900, height = 310) {
  const filtered = filterPeriod(bars, period);
  const plotted = downsampleSeries(filtered);
  const pad = { left: 64, right: 18, top: 18, bottom: 34 };
  const values = plotted.map((bar) => bar.close);
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  const margin = Math.max((maximum - minimum) * 0.09, maximum * 0.01, 0.01);
  minimum -= margin;
  maximum += margin;
  const firstTime = Date.parse(`${filtered[0].date}T00:00:00Z`);
  const lastTime = Date.parse(`${filtered.at(-1).date}T00:00:00Z`);
  const timeSpan = Math.max(lastTime - firstTime, DAY);
  const x = (date) => pad.left + ((Date.parse(`${date}T00:00:00Z`) - firstTime) / timeSpan) * (width - pad.left - pad.right);
  const y = (value) => pad.top + ((maximum - value) / Math.max(maximum - minimum, 0.01)) * (height - pad.top - pad.bottom);
  return {
    filtered, plotted, pad, width, height, minimum, maximum, firstTime, lastTime,
    path: plotted.map((bar, index) => `${index ? 'L' : 'M'}${x(bar.date).toFixed(2)} ${y(bar.close).toFixed(2)}`).join(' '),
    x, y
  };
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function nearestBar(bars, targetTime) {
  let low = 0;
  let high = bars.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (Date.parse(`${bars[middle].date}T00:00:00Z`) < targetTime) low = middle + 1;
    else high = middle;
  }
  if (low > 0) {
    const before = Date.parse(`${bars[low - 1].date}T00:00:00Z`);
    const after = Date.parse(`${bars[low].date}T00:00:00Z`);
    if (Math.abs(before - targetTime) < Math.abs(after - targetTime)) return bars[low - 1];
  }
  return bars[low];
}

export function renderHistoryChart(container, bars, options = {}) {
  const currency = options.currency || 'EUR';
  let period = 'MAX';
  container.replaceChildren();
  container.className = 'chart-content';

  const periods = document.createElement('div');
  periods.className = 'periods';
  periods.setAttribute('role', 'group');
  periods.setAttribute('aria-label', 'Grafiekperiode');
  Object.keys(PERIODS).forEach((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.period = label;
    button.className = label === period ? 'selected' : '';
    periods.append(button);
  });

  const shell = document.createElement('div');
  shell.className = 'chart-shell';
  const svg = svgElement('svg', { viewBox: '0 0 900 310', role: 'img', 'aria-label': 'Historisch koersverloop op basis van slotkoersen', preserveAspectRatio: 'none' });
  const info = document.createElement('div');
  info.className = 'chart-hover';
  const stats = document.createElement('div');
  stats.className = 'chart-stats';
  container.append(periods, shell, info, stats);
  shell.append(svg);

  const draw = () => {
    const model = buildChartModel(bars, period);
    svg.replaceChildren();
    for (let index = 0; index < 5; index += 1) {
      const value = model.minimum + ((model.maximum - model.minimum) * index / 4);
      const lineY = model.y(value);
      svg.append(svgElement('line', { x1: model.pad.left, y1: lineY, x2: model.width - model.pad.right, y2: lineY, class: 'chart-gridline' }));
      const label = svgElement('text', { x: model.pad.left - 9, y: lineY + 4, 'text-anchor': 'end', class: 'chart-axis-label' });
      label.textContent = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(value);
      svg.append(label);
    }
    const bottom = model.height - model.pad.bottom;
    const area = svgElement('path', { d: `${model.path} L ${model.x(model.filtered.at(-1).date).toFixed(2)} ${bottom} L ${model.x(model.filtered[0].date).toFixed(2)} ${bottom} Z`, class: 'chart-area' });
    svg.append(area, svgElement('path', { d: model.path, class: 'chart-line' }));
    [model.filtered[0], model.filtered[Math.floor((model.filtered.length - 1) / 2)], model.filtered.at(-1)].forEach((bar, index) => {
      const label = svgElement('text', { x: model.x(bar.date), y: model.height - 9, 'text-anchor': index === 0 ? 'start' : index === 2 ? 'end' : 'middle', class: 'chart-axis-label chart-date-label' });
      label.textContent = shortDate(bar.date);
      svg.append(label);
    });
    const crosshair = svgElement('line', { y1: model.pad.top, y2: bottom, class: 'chart-crosshair', hidden: 'true' });
    const point = svgElement('circle', { r: 5, class: 'chart-point', hidden: 'true' });
    const overlay = svgElement('rect', { x: model.pad.left, y: model.pad.top, width: model.width - model.pad.left - model.pad.right, height: model.height - model.pad.top - model.pad.bottom, class: 'chart-overlay', tabindex: '0' });
    svg.append(crosshair, point, overlay);
    const show = (bar) => {
      const pointX = model.x(bar.date);
      crosshair.removeAttribute('hidden');
      point.removeAttribute('hidden');
      crosshair.setAttribute('x1', pointX);
      crosshair.setAttribute('x2', pointX);
      point.setAttribute('cx', pointX);
      point.setAttribute('cy', model.y(bar.close));
      info.textContent = `${shortDate(bar.date)} · slot ${money(bar.close, currency)}${bar.open !== null ? ` · open ${money(bar.open, currency)}` : ''}${bar.high !== null && bar.low !== null ? ` · hoog/laag ${money(bar.high, currency)} / ${money(bar.low, currency)}` : ''}`;
    };
    const locate = (clientX) => {
      const rectangle = svg.getBoundingClientRect();
      const left = rectangle.left + (model.pad.left / model.width) * rectangle.width;
      const usable = ((model.width - model.pad.left - model.pad.right) / model.width) * rectangle.width;
      const ratio = Math.max(0, Math.min(1, (clientX - left) / usable));
      return nearestBar(model.filtered, model.firstTime + ratio * (model.lastTime - model.firstTime));
    };
    overlay.addEventListener('pointermove', (event) => show(locate(event.clientX)));
    overlay.addEventListener('pointerdown', (event) => show(locate(event.clientX)));
    overlay.addEventListener('focus', () => show(model.filtered.at(-1)));
    show(model.filtered.at(-1));
    stats.textContent = `${model.filtered.length.toLocaleString('nl-NL')} handelsdagen · ${shortDate(model.filtered[0].date)} t/m ${shortDate(model.filtered.at(-1).date)} · slotkoers`;
    container.dataset.period = period;
    container.dataset.points = String(model.filtered.length);
  };

  periods.addEventListener('click', (event) => {
    const button = event.target.closest('[data-period]');
    if (!button) return;
    period = button.dataset.period;
    periods.querySelectorAll('button').forEach((item) => item.classList.toggle('selected', item === button));
    draw();
  });
  draw();
}
