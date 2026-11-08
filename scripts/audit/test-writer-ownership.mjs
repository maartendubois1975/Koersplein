import assert from 'node:assert/strict';
import { validateWriterOwnership } from './writer-ownership.mjs';

const a = { environment: 'staging', dataset: 'dailyOhlc', market: 'XAMS', writer: 'single-engine', enabled: true };
assert.deepEqual(validateWriterOwnership([a]), { valid: true, activeRoutes: 1 });
assert.deepEqual(validateWriterOwnership([a, { ...a, writer: 'legacy', enabled: false }]), { valid: true, activeRoutes: 1 });
assert.throws(() => validateWriterOwnership([a, { ...a, writer: 'legacy' }]), /Multiple enabled writers/);
assert.deepEqual(validateWriterOwnership([a, { ...a, market: 'XBRU' }]), { valid: true, activeRoutes: 2 });
assert.deepEqual(validateWriterOwnership([{ ...a, environment: 'production' }, a]), { valid: true, activeRoutes: 2 });
assert.throws(() => validateWriterOwnership([{ ...a, market: '' }]), /requires/);
assert.throws(() => validateWriterOwnership([a, { ...a, market: '*', writer: 'all-markets' }]), /Multiple enabled writers/);
assert.throws(() => validateWriterOwnership([{ ...a, market: '*', writer: 'all-markets' }, a]), /Multiple enabled writers/);
console.log('Writer ownership tests passed');
