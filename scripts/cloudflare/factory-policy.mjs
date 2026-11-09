/**
 * Legacy factory provider symbols are Amsterdam-specific.
 * Non-Amsterdam jobs must use the market-aware universal runner.
 */
export function assertFactoryMarket(mic) {
  if (mic !== 'XAMS') throw new Error('Factory runner only supports XAMS; use universal-market-runner for ' + String(mic));
  return mic;
}

export function factoryCoverage(coverage, item) {
  return { firstDate: coverage?.first_date ?? item.first_date ?? null, lastDate: coverage?.last_date ?? item.last_date ?? null };
}
