import { bunja, createBunjaStore, createScope, type Bunja, type BunjaStore } from 'bunja';
import { BunjaStoreContext as ReactStoreContext, BunjaStoreProvider as ReactProvider, bindScope as bindReactScope, createScopeFromContext as reactScope, scopeContextMap as reactMap, useBunja as useReactBunja } from 'bunja/react';
import { BunjaStoreContext as SolidStoreContext, BunjaStoreProvider as SolidProvider, bindScope as bindSolidScope, createScopeFromContext as solidScope, scopeContextMap as solidMap, useBunja as useSolidBunja } from 'bunja/solid';
import { createContext as reactContext } from 'react';
import { createContext as solidContext } from 'solid-js';
const state: Bunja<number> = bunja(() => 42);
const store: BunjaStore = createBunjaStore();
const react = reactContext(0);
const solid = solidContext<number | (() => number)>(0);
bindReactScope(createScope<number>(), react);
bindSolidScope(createScope<number>(), solid);
const rs = reactScope(react);
const ss = solidScope(solid);
function Component() {
  const a: number = useReactBunja(state);
  const b: () => number = useSolidBunja(state);
  return a + b();
}
export { state, store, rs, ss, Component, ReactStoreContext, ReactProvider, SolidStoreContext, SolidProvider, reactMap, solidMap };
