// Executed against the installed tarball, not workspace source files.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as core from "bunja";
import * as react from "bunja/react";
import * as solid from "bunja/solid";

const adapterExports = [
  "BunjaStoreContext",
  "BunjaStoreProvider",
  "bindScope",
  "createScopeFromContext",
  "scopeContextMap",
  "useBunja",
];
for (const adapter of [react, solid]) {
  for (const name of adapterExports) {
    assert.ok(name in adapter, `Missing adapter export: ${name}`);
  }
  const scope = adapter.createScopeFromContext(adapter.BunjaStoreContext);
  assert.ok(scope instanceof core.Scope);
}

const store = core.createBunjaStore();
const state = core.bunja(() => ({ value: 42 }));
const first = store.get(state, () => null);
const dispose = first.mount();
assert.equal(store.get(state, () => null).value, first.value);
dispose();

const require = createRequire(import.meta.url);
const entries = { bunja: core, "bunja/react": react, "bunja/solid": solid };
for (const [name, esm] of Object.entries(entries)) {
  const required = require(name);
  for (const key of Object.keys(esm)) {
    assert.equal(required[key], esm[key]);
  }
}
console.log(`Packed runtime checks passed on ${process.version}`);
