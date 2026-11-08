/**
 * Pure ownership validation: one enabled writer per dataset and market.
 * A wildcard market overlaps every specific market in the same environment/dataset.
 */
export function validateWriterOwnership(routes) {
  if (!Array.isArray(routes)) throw new TypeError('routes must be an array');
  const active = [];
  for (const route of routes) {
    if (!route || typeof route !== 'object') throw new TypeError('invalid route');
    const { environment, dataset, market, writer, enabled } = route;
    if (![environment, dataset, market, writer].every(v => typeof v === 'string' && v.trim())) {
      throw new Error('Every route requires environment, dataset, market and writer');
    }
    if (typeof enabled !== 'boolean') throw new Error('enabled must be boolean');
    if (!enabled) continue;
    const collision = active.find(r => r.environment === environment && r.dataset === dataset && (r.market === market || r.market === '*' || market === '*'));
    if (collision) throw new Error('Multiple enabled writers for ' + [environment,dataset,market].join('::') + ': ' + collision.writer + ', ' + writer);
    active.push(route);
  }
  return { valid: true, activeRoutes: active.length };
}
