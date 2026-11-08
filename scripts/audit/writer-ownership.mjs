/**
 * Pure ownership validation. This module never starts jobs or writes data.
 * A dataset may have exactly one enabled writer in a given environment.
 */
export function validateWriterOwnership(routes) {
  if (!Array.isArray(routes)) throw new TypeError('routes must be an array');
  const seen = new Map();
  for (const route of routes) {
    if (!route || typeof route !== 'object') throw new TypeError('invalid route');
    const { environment, dataset, market, writer, enabled } = route;
    if (![environment, dataset, market, writer].every(v => typeof v === 'string' && v.trim())) {
      throw new Error('Every route requires environment, dataset, market and writer');
    }
    if (typeof enabled !== 'boolean') throw new Error('enabled must be boolean');
    if (!enabled) continue;
    const key = [environment, dataset, market].join('::');
    if (seen.has(key)) {
      throw new Error('Multiple enabled writers for ' + key + ': ' + seen.get(key) + ', ' + writer);
    }
    seen.set(key, writer);
  }
  return { valid: true, activeRoutes: seen.size };
}
