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
  createScope,
  type HashFn,
  type ReadScope,
  type Scope,
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
  readScope: ReadScope = defaultReadScope,
): T {
  const store = use(BunjaStoreContext);
  const { value, mount, deps } = store.get(bunja, readScope);
  useEffect(mount, deps);
  return value;
}

export type ScopePair<T> = [Scope<T>, T];

export function inject<const T extends ScopePair<any>[]>(
  overrideTable: T,
): ReadScope {
  const map = new Map(overrideTable);
  return <T>(scope: Scope<T>) => {
    if (map.has(scope as Scope<unknown>)) {
      return map.get(scope as Scope<unknown>) as T;
    }
    const context = scopeContextMap.get(scope as Scope<unknown>);
    if (!context) {
      throw new Error(
        "Unable to read the scope. Please inject the value explicitly or bind scope to the React context.",
      );
    }
    return use(context) as T;
  };
}
