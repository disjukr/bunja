import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as core from 'bunja';
import * as react from 'bunja/react';
import * as solid from 'bunja/solid';

for (const adapter of [react, solid]) {
  for (const name of ['BunjaStoreContext', 'BunjaStoreProvider', 'bindScope', 'createScopeFromContext', 'scopeContextMap', 'useBunja']) {
    assert.ok(name in adapter, `Missing adapter export: ${name}`);
  }
  // Context-created scopes must use the public core's class.
  assert.ok(adapter.createScopeFromContext(adapter.BunjaStoreContext) instanceof core.Scope);
}
const store = core.createBunjaStore();
const state = core.bunja(() => ({ value: 42 }));
const first = store.get(state, () => null);
const dispose = first.mount();
assert.equal(store.get(state, () => null).value, first.value);
dispose();

const require = createRequire(import.meta.url);
for (const [name, esm] of [['bunja', core], ['bunja/react', react], ['bunja/solid', solid]]) {
  const required = require(name);
  for (const key of Object.keys(esm)) assert.equal(required[key], esm[key]);
}
console.log(`Packed ESM imports, adapter exports, sharing and require(ESM) passed on ${process.version}`);
