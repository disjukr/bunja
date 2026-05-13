"use client";

import {
  type Context,
  createContext,
  createElement,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type Bunja,
  type BunjaGetRef,
  type BunjaStore,
  createBunjaStore,
  createReadScopeFn,
  createScope,
  delayUnmount,
  type HashFn,
  type ReadScope,
  type Scope,
  type ScopeValuePairs,
} from "./bunja.ts";
import * as React from "react";

// @ts-ignore dev
// deno-lint-ignore no-process-global
const __DEV__ = process.env.NODE_ENV !== "production";
const reactUse = (React as unknown as {
  use?: <T>(usable: Context<T>) => T;
}).use;

export const BunjaStoreContext: Context<BunjaStore> = createContext(
  createBunjaStore(),
);

export function BunjaStoreProvider(
  { children }: PropsWithChildren,
): React.JSX.Element {
  const [value] = useState(createBunjaStore);
  useEffect(() => () => value.dispose(), [value]);
  return createElement(BunjaStoreContext.Provider, { value, children });
}

export const scopeContextMap: Map<Scope<unknown>, Context<unknown>> = new Map();
let scopeContextMapLocked = false;
export function bindScope<T>(scope: Scope<T>, context: Context<T>): void {
  if (__DEV__ && !reactUse && scopeContextMapLocked) {
    throw new Error(
      "`bindScope` must be called before rendering when using React 18.",
    );
  }
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

function useScopeContextValues(): Map<Scope<unknown>, unknown> | undefined {
  if (reactUse) return undefined;
  scopeContextMapLocked = true;
  return new Map(
    Array.from(scopeContextMap, ([scope, context]) => [
      scope,
      useContext(context),
    ]),
  );
}

export function useBunja<T, Seed>(
  bunja: Bunja<T, Seed> | BunjaGetRef<T, Seed>,
  scopeValuePairs?: ScopeValuePairs,
): T {
  const store = useContext(BunjaStoreContext);
  const scopeContextValues = useScopeContextValues();
  const defaultReadScope: ReadScope = <T>(scope: Scope<T>) => {
    const context = scopeContextMap.get(scope as Scope<unknown>) as
      | Context<T>
      | undefined;
    if (!context) throw new Error("Scope is not bound to a React context.");
    if (reactUse) return reactUse(context);
    return scopeContextValues!.get(scope as Scope<unknown>) as T;
  };
  const readScope = scopeValuePairs
    ? createReadScopeFn(scopeValuePairs, defaultReadScope)
    : defaultReadScope;
  if (__DEV__) {
    if (store._internalState?.instantiating) {
      throw new Error(
        "`useBunja` cannot be called inside a bunja init function.",
      );
    }
    const { value, mount, deps, bunjaInstance } = store.get(bunja, readScope);
    useEffect(delayUnmount(mount), deps);
    useMemo(
      () => ({ bunja, scopeValuePairs, bunjaInstance }),
      [bunja, scopeValuePairs, bunjaInstance],
    );
    return value;
  } else {
    const { value, mount, deps } = store.get(bunja, readScope);
    useEffect(delayUnmount(mount), deps);
    return value;
  }
}
