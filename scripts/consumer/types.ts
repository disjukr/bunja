// Type-checked with NodeNext and Bundler resolution against the installed tarball.
import { bunja, createBunjaStore, createScope, type Bunja, type BunjaStore } from "bunja";
import * as bunjaReact from "bunja/react";
import * as bunjaSolid from "bunja/solid";
import * as React from "react";
import * as Solid from "solid-js";

const state: Bunja<number> = bunja(() => 42);
const store: BunjaStore = createBunjaStore();
const reactContext = React.createContext(0);
const solidContext = Solid.createContext<number | (() => number)>(0);

bunjaReact.bindScope(createScope<number>(), reactContext);
bunjaSolid.bindScope(createScope<number>(), solidContext);
const reactScope = bunjaReact.createScopeFromContext(reactContext);
const solidScope = bunjaSolid.createScopeFromContext(solidContext);

function Consumer() {
  const reactValue: number = bunjaReact.useBunja(state);
  const solidValue: () => number = bunjaSolid.useBunja(state);
  return reactValue + solidValue();
}

const adapterExports = [
  bunjaReact.BunjaStoreContext,
  bunjaReact.BunjaStoreProvider,
  bunjaReact.scopeContextMap,
  bunjaSolid.BunjaStoreContext,
  bunjaSolid.BunjaStoreProvider,
  bunjaSolid.scopeContextMap,
];

// Exported so the browser bundler also retains the adapter entry points.
export { state, store, reactScope, solidScope, Consumer, adapterExports };
