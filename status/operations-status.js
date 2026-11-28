import {historyAvailabilityText} from '../daily-session-view.mjs';

const element = id => document.getElementById(id);
const number = new Intl.NumberFormat('nl-NL');
const percent = new Intl.NumberFormat('nl-NL', { style: 'percent', maximumFractionDigits: 2 });
const show = value => value == null ? '—' : typeof value === 'number' ? number.format(value) : value;
const returnPct = value => value == null ? '—' : percent.format(value);
const sessionCount = (market, status) => market.counts ? market.counts[status] ?? 0 : null;

function table(target, headings, rows) {
  const result = document.createElement('table');
  const header = result.createTHead().insertRow();
  for (const label of headings) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    header.append(cell);
  }
  const body = result.createTBody(), fragment = document.createDocumentFragment();
  for (const values of rows) {
    const row = document.createElement('tr');
    for (const value of values) {
      const cell = row.insertCell();
      if (value instanceof HTMLElement) cell.append(value);
      else cell.textContent = show(value);
    }
    fragment.append(row);
  }
  body.append(fragment);
  target.replaceChildren(result);
}

function expandable(summaryText, values) {
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = summaryText;
  const list = document.createElement('ul');
  for (const value of values) {
    const item = document.createElement('li');
    item.textContent = value;
    list.append(item);
  }
  details.append(summary, list);
  return details;
}

function showMarket(market) {
  const fallback = value => value == null ? 'onbekend' : show(value);
  element('market-info').replaceChildren(expandable('Bronnen en archiefcontrole', [
    'Geconfigureerde koersroutes · ' + market.sources.join(', '),
    'Gebruikt in opgeslagen sessie · ' + (market.observedSources?.join(', ') || 'onbekend'),
    'Geregistreerde bronfouten · ' + fallback(market.sourceErrors?.length),
    'Vastgelegde archiefconflicten · ' + fallback(market.archiveConflicts?.length),
    'Archief- en leesfouten in deze build · ' + show(market.readErrors.length),
    'Unieke complete OHLCV-dagen · ' + show(market.history.completeUniqueDays),
    'Door opgeslagen dagsessies bevestigd · ' + show(market.history.confirmedArchiveDays),
    'Afzonderlijk beoordeelde bronkeuzes · ' + show(market.history.reviewedSourceDays),
    'Nog ontbrekende sessies binnen beoordeelde periode · ' + show(market.history.missingSessions),
    'Noteringsstart niet bewezen · ' + show(market.history.unknownStartCompanies) + ' ondernemingen',
    ...(market.historyRecovery?.networkSources ?? []).map(row => 'Nieuwe historische aanvulling via ' + row.provider + ' · ' +
      (row.newPublicArchiveAllowed ? 'expliciete gratis archiefrechten vastgelegd' : 'gratis herpublicatierechten nog niet vastgelegd')),
    ...(market.recovery ? ['Gericht herstel voor opgeslagen sessie · ' + market.recovery.retried + ' opnieuw geprobeerd · ' +
      market.recovery.recovered + ' hersteld · ' + market.recovery.remainingUnverified + ' onbevestigd',
      ...market.recovery.results.map(row => row.isin + ' · ' + row.status + (row.finalError ? ' · ' + row.finalError : ''))]
      : ['Gericht dagelijks herstel · nog geen opgeslagen uitvoering']),
    ...(market.sourceErrors ?? []).map(row => row.isin + ' · ' + row.reason),
    ...(market.archiveConflicts ?? []).map(row => row.isin + ' · ' + row.date + ' · ' + row.code),
    ...market.readErrors.map(row => [row.date, row.reason].filter(Boolean).join(' · ')),
  ]));
  function dates(label, values) {
    return values.length ? expandable(label + ' · ' + values.length, values) : 0;
  }
  function evidence(row) {
    const values = [row.archive, row.legacy].filter(Boolean).map(source =>
      [source.source, source.priceBasis, source.completenessVerified ? 'Volledigheid bewezen' : 'Volledigheid onbevestigd',
       source.incompleteBars ? source.incompleteBars + ' onvolledige records' : null].filter(Boolean).join(' · '));
    const checked = historyAvailabilityText(row.availability);
    if (checked) values.push(checked);
    values.push(...row.issues.map(issue => issue.kind + ' · ' + issue.reason));
    if (row.coverage) values.push('Bronkwaliteit · ' + row.coverage.quality,
      'Bevestigd in dagarchief · ' + row.coverage.confirmedArchiveDays,
      'Getoetste kalenderperiode · ' + (row.coverage.calendarWindowStart ?? 'onbekend') + ' t/m ' +
        (row.coverage.calendarWindowEnd ?? 'onbekend'),
      'Complete dagen buiten getoetste kalenderperiode · ' + row.coverage.beforeCalendarDays,
      'Bronbeoordeling niet volledig naspeelbaar in deze build · ' + row.coverage.sourceReviewUnavailable.length,
      ...row.coverage.sourceConflicts.map(item => item.date + ' · ' + item.reason),
      ...row.coverage.statusConflicts.map(item => item.date + ' · ' + item.reason));
    return values.length ? expandable('Herkomst', values) : '—';
  }
  table(element('companies'), [
    'Onderneming', 'ISIN', 'Eerste koers', 'Laatste koers', 'Unieke complete dagen', 'Bevestigde dagarchiefdagen', 'Conflictdagen',
    'Periode vanaf', 'Geen handel', 'Onbevestigd', 'Ontbrekend', 'Bronkwaliteit',
  ], market.companies.map(row => [
    row.name + ' · ' + row.symbol, row.isin, row.coverage?.firstCompleteDate, row.coverage?.lastCompleteDate,
    row.coverage?.completeUniqueDays, row.coverage?.confirmedArchiveDays,
    row.coverage ? row.coverage.sourceConflicts.length + row.coverage.statusConflicts.length : null, row.gapWindowStart,
    row.gapWindowStart ? dates('Geen handel', row.noTrades) : null,
    row.gapWindowStart ? dates('Onbevestigd', row.unverified) : null,
    row.gapWindowStart ? dates('Ontbrekend', row.missing) : null, evidence(row),
  ]));
}

function showPredictions(scores, markets, records = []) {
  if (!scores) return;
  element('predictions').hidden = false;
  element('prediction-counts').textContent = show(scores.predictions) + ' vooraf vastgelegde voorspellingen · ' +
    show(scores.closed) + ' afgerond · ' + show(scores.unsealedRecords) + ' oudere of onbevestigde records';
  const names = new Map(markets.map(market => [market.mic, market.name]));
  const checked = markets.filter(market => market.forecastReadiness);
  if (checked.length) {
    table(element('forecast-readiness'), [
      'Beurs', 'Getoetste sessie', 'Direct bruikbaar', 'Herkomst onbevestigd',
      'Overige blokkades', 'Technisch bruikbaar vóór herkomstcontrole',
    ], checked.map(market => {
      const { session, counts, unverifiedWindows } = market.forecastReadiness;
      const ready = counts.READY ?? 0, provenance = counts.PROVENANCE_UNVERIFIED ?? 0;
      return [market.name, session, ready, provenance, market.approvedCompanies - ready - provenance,
        unverifiedWindows.READY ?? 0];
    }));
  }
  const groups = [['Totaal', scores],
    ...Object.entries(scores.byMarket).map(([key, data]) => [names.get(key) || key, data]),
    ...Object.entries(scores.bySignal).map(([key, data]) => ['Signaal · ' + key, data]),
    ...Object.entries(scores.byHorizon).map(([key, data]) => [key + ' maanden', data])];
  table(element('scores'), [
    'Groep', 'Voorspellingen', 'Afgerond', 'Doel gehaald', 'Gem. rendement', 'Gem. verlies',
    'Benchmarkmetingen', 'Gem. benchmark', 'Gem. verschil',
  ], groups.map(([label, score]) => [
    label, score.predictions, score.closed, returnPct(score.hitRate == null ? null : score.hitRate / 100),
    returnPct(score.averageReturn), returnPct(score.averageLoss), score.benchmarkComparisons,
    returnPct(score.averageBenchmarkReturn), returnPct(score.averageExcessReturn),
  ]));
  table(element('prediction-records'), [
    'Onderneming', 'Beurs', 'Vastgelegd op', 'Referentiedag', 'Referentiekoers',
    'Periode', 'Doel', 'Status', 'Laatste evaluatiedag', 'Prijsrendement', 'Benchmarkleden', 'Controle',
  ], records.map(row => [row.name || row.isin, names.get(row.market) || row.market,
    row.createdAt, row.referenceDate, row.referenceClose == null ? null : row.referenceClose + ' ' + row.currency,
    row.horizonMonths + ' maanden', row.targetPct == null ? null : row.targetPct + '%', row.status,
    row.latestDate, row.evaluationError ? null : returnPct(row.currentReturn), row.benchmarkMembers,
    expandable('Verzegeling', ['SHA-256 · ' + row.recordHash, ...(row.evaluationError ? [row.evaluationError] : [])]),
  ]));
}

async function start() {
  const response = await fetch('../data/operations-status.json', { cache: 'no-cache' });
  if (!response.ok) throw Error('Statusbestand ontbreekt');
  const report = await response.json();
  const generatedAt = new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam',
  }).format(new Date(report.generatedAt));
  element('build').textContent = 'Gebouwd op ' + generatedAt +
    ' · Commit ' + (report.commit?.slice(0, 12) ?? 'onbekend') +
    ' · Historietests ' + (report.buildCheck === 'HISTORY_TEST_PASSED' ? 'geslaagd' : 'onbekend');
  const recovery = report.historyRecovery;
  if (recovery) element('history-recovery').replaceChildren(expandable('Uitgevoerd historieherstel · ' +
    show(recovery.confirmedRestoredBars) + ' echte koersdagen · ' + recovery.status,
    ['Uitgevoerd op · ' + recovery.performedAt, 'Controleplan SHA-256 · ' + recovery.planHash,
      ...Object.entries(recovery.byMarket ?? {}).map(([mic, count]) => mic + ' · ' + show(count) + ' aangevulde dagen'),
      'Nieuwe bronverzoeken · ' + show(recovery.networkRequests),
      'Bestaande koersregels en sessiebestanden behouden · ' + (recovery.existingEvidencePreserved ? 'ja' : 'onbevestigd')]));
  if (report.archiveWriter) element('archive-writer').textContent = 'Archiefschrijflock waargenomen bij build · gestart op ' + report.archiveWriter.startedAt;
  if (report.previews.length) {
    const previews = element('previews');
    previews.hidden = false;
    const labels = {
      INCOMPLETE_MARKET_DEFINITION: 'Operationele beursconfiguratie ontbreekt',
      INCOMPLETE_OPERATIONAL_SOURCE_ROUTES: 'Dag- of historische bronroute nog niet toegelaten',
      UNVERIFIED_PUBLICATION_RIGHTS: 'Herpublicatierechten niet bewezen',
      INVALID_ADMITTED_LISTING: 'Uitgeveridentiteit of noteringsvelden nog niet operationeel toegelaten',
      CATALOG_UNAVAILABLE: 'Catalogus niet beschikbaar',
      CATALOG_IDENTITY_MISMATCH: 'Catalogus wijkt af van de vastgelegde selectie',
    };
    previews.replaceChildren(...report.previews.map(row => expandable(
      row.mic + ' · ' + show(row.companies) + ' bedrijven in catalogus · ' +
      (row.operational ? 'Technische toelatingscontrole geslaagd' : 'Koerspublicatie in voorbereiding'),
      [...Object.entries(row.admissionBlockers || {}).map(([code, count]) => (labels[code] || code) + ' · ' + show(count)),
        ...(row.sourceReview ? ['Bronproef ' + row.sourceReview.session + ' · ' + show(row.sourceReview.observed) +
          ' verhandelde ondernemingen · ' + show(row.sourceReview.lastTradeMatches) + ' laatste prijzen bevestigd · ' +
          show(row.sourceReview.volumeMatches) + ' volumes bevestigd · ' + show(row.sourceReview.referenceCloseDifferences) +
          ' expliciete slotreferenties verschillend van laatste transactie',
          ...(Number.isFinite(row.sourceReview.noTradeConfirmed) ? [show(row.sourceReview.noTradeConfirmed) +
            ' bevestigde dagen zonder handel · ' + show(row.sourceReview.unconfirmed) + ' onbevestigd · ' +
            show(row.sourceReview.issuerIdentities) + ' bevestigde uitgeveridentiteiten'] : [])] : []),
        ...(row.sourceReviewError ? ['Bronproef niet bruikbaar · ' + row.sourceReviewError] : []),
      ],
    )));
  }
  table(element('markets'), [
    'Beurs', 'Bedrijven', 'Afgesloten sessie bij build', 'Gearchiveerd', 'Getoond in build', 'Gegevensstatus',
    'Verhandeld', 'Geen handel', 'Onbevestigd', 'Bedrijven met historie', 'Unieke OHLCV-dagen',
    'Bevestigd in dagarchief', 'Ontbrekende sessies', 'Bronconflictdagen', 'Bronfouten', 'Archiefconflicten',
  ], report.markets.map(market => [
    market.name, market.approvedCompanies, market.latestClosed, market.latestArchived, market.latestPublished,
    market.readErrors.length ? 'Archiefcontrole nodig' : market.latestPublished === market.latestClosed ? 'Actueel in deze build' : 'Verwerking loopt achter',
    sessionCount(market, 'TRADED'), sessionCount(market, 'NO_TRADES'), sessionCount(market, 'SESSION_UNVERIFIED'),
    market.history.any + ' / ' + market.approvedCompanies, market.history.completeUniqueDays,
    market.history.confirmedArchiveDays, market.history.missingSessions,
    market.history.sourceConflictDays + market.history.statusConflictDays,
    market.sourceErrors?.length, market.archiveConflicts?.length,
  ]));
  const exchange = element('exchange');
  for (const market of report.markets) exchange.add(new Option(market.name, market.mic));
  exchange.value = report.markets.some(market => market.mic === 'XAMS') ? 'XAMS' : report.markets[0]?.mic;
  if (report.markets.length) {
    const update = () => showMarket(report.markets.find(market => market.mic === exchange.value));
    exchange.addEventListener('change', update);
    element('history').hidden = false;
    update();
  }
  const refresh = report.forecastSourceRefresh;
  if (refresh) {
    const node = element('forecast-source-refresh');
    const count = status => refresh.results.filter(row => row.status === status).length;
    node.hidden = false;
    node.replaceChildren(expandable('Bronvensters ' + refresh.cutoff + ' · ' + count('ALREADY_REVIEWED') +
      ' eerder bevestigd · ' + count('VERIFIED_ROLLFORWARD') + ' voortgezet · ' + count('REVIEW_UNCONFIRMED') + ' onbevestigd',
      ['Werkelijk uitgevoerd op ' + refresh.finishedAt,
        ...refresh.results.filter(row => row.status === 'REVIEW_UNCONFIRMED').map(row => row.key + ' · ' + row.reason)]));
  }
  showPredictions(report.predictions, report.markets, report.predictionRecords);
}

start().catch(() => {
  element('build').textContent = 'Voor deze versie is geen leesbaar statusbestand beschikbaar.';
});
