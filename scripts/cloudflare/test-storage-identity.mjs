import assert from 'node:assert/strict';
import {storageIdentityResolver} from './storage-identity.mjs';
const resolve=storageIdentityResolver([
 {isin:'LEGACY-ALVO',mic:'XICE',ticker:'ALVO'},
 {isin:'WAR-ABC',mic:'XWAR',ticker:'ABC'},
 {isin:'ATH-ABC',mic:'XATH',ticker:'ABC'},
 {isin:'SEG-ABC',mic:'SEG1',ticker:'ABC'},
 {isin:'OFFICIAL',mic:'XICE',ticker:'RENAMED'}
],'XICE');
assert.equal(resolve({isin:'XICE:ALVO',symbol:' alvo '}),'LEGACY-ALVO');
assert.equal(resolve({isin:'LOCAL',symbol:'ABC',mic:'XWAR'}),'WAR-ABC');
assert.equal(resolve({isin:'LOCAL',symbol:'ABC',mic:'XATH'}),'ATH-ABC');
assert.equal(resolve({isin:'LOCAL',symbol:'ABC',mic:'SEG1'}),'SEG-ABC');
assert.equal(resolve({isin:'OFFICIAL',symbol:'OLD'}),'OFFICIAL');
assert.equal(resolve({isin:'OFFICIAL',symbol:'OLD',mic:'XWAR'}),null);
assert.equal(resolve({isin:'NEW',symbol:'NEW'}),null);
assert.throws(()=>storageIdentityResolver([{isin:'A',mic:'XICE',ticker:'A'},{isin:'B',mic:'XICE',ticker:'A'}]),/AMBIGUOUS/);
console.log('Storage identity: legacy keys, exchange isolation, segments, exact fallback and ambiguity OK');
