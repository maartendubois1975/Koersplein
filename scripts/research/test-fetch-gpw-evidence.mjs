import assert from 'node:assert/strict';
import {parseGpwCompanyLinks} from './fetch-gpw-evidence.mjs';
const html='<a href="/spolka?isin=PL11BTS00015">11 BIT STUDIOS SPÓŁKA AKCYJNA (11B)</a>';
const rows=parseGpwCompanyLinks(html,'2026-10-16');
assert.equal(rows.length,1);
assert.equal(rows[0].symbol,'11B');
assert.equal(rows[0].isin,'PL11BTS00015');
assert.equal(parseGpwCompanyLinks('<a href="/spolka?isin=BAD">bad</a>','2026-10-16').length,0);
console.log('GPW extraction tests passed');
