"use client";

import {
  type Context,
  createContext,
  createElement,
  type PropsWithChildren,
  use,
  useEffect,
  useState,
} from "react";
import {
  type Bunja,
  type BunjaStore,
  createBunjaStore,
  createReadScopeFn,
  createScope,
  delayUnmount,
  type HashFn,
  type ReadScope,
  type Scope,
  type ScopeValuePair,
} from "./bunja.ts";

export const BunjaStoreContext: Context<BunjaStore> = createContext(
  createBunjaStore(),
);

export function BunjaStoreProvider(
  { children }: PropsWithChildren,
): React.JSX.Element {
  const [value] = useState(createBunjaStore);
  useEffect(() => () => value.dispose(), [value]);
  return createElement(BunjaStoreContext, { value, children });
}

export const scopeContextMap: Map<Scope<unknown>, Context<unknown>> = new Map();
export function bindScope<T>(scope: Scope<T>, context: Context<T>): void {
  scopeContextMap.set(scope as Scope<unknown>, context as Context<unknown>);
}

export function createScopeFromContext<T>(
  context: Context<T>,
  hash?: HashFn<T>,
): Scope<T> {
  const scope = createScope<T>(hash);
  bindScope(scope, context);
  return scope;
}

const defaultReadScope: ReadScope = <T>(scope: Scope<T>) => {
  const context = scopeContextMap.get(scope as Scope<unknown>)!;
  return use(context) as T;
};

export function useBunja<T>(
  bunja: Bunja<T>,
  scopeValuePairs?: ScopeValuePair<any>[],
): T {
  const store = use(BunjaStoreContext);
  const readScope = scopeValuePairs
    ? createReadScopeFn(scopeValuePairs, <T>(scope: Scope<T>) => {
      const context = scopeContextMap.get(scope as Scope<unknown>)!;
      return use(context) as T;
    })
    : defaultReadScope;
  const { value, mount, deps } = store.get(bunja, readScope);
  useEffect(delayUnmount(mount), deps);
  return value;
}

/**
 * @deprecated use `scopeValuePairs` parameter directly in `useBunja` instead.
 */
export function inject(
  scopeValuePairs: ScopeValuePair<any>[],
): ScopeValuePair<any>[] {
  return scopeValuePairs;
}
