import { type Context, createContext, useContext, useEffect } from "react";
import {
  type Bunja,
  type BunjaStore,
  createBunjaStore,
  createScope,
  type ReadScope,
  type Scope,
} from "./bunja.ts";

export const BunjaStoreContext: Context<BunjaStore> =
  createContext(createBunjaStore());

export const scopeContextMap: Map<Scope<any>, Context<any>> = new Map();
export function bindScope(scope: Scope<any>, context: Context<any>): void {
  scopeContextMap.set(scope, context);
}

export function createScopeFromContext<T>(context: Context<T>): Scope<T> {
  const scope = createScope();
  bindScope(scope, context);
  return scope;
}

const defaultReadScope: ReadScope = (scope) => {
  const context = scopeContextMap.get(scope)!;
  return useContext(context);
};

export function useBunja<T>(
  bunja: Bunja<T>,
  readScope: ReadScope = defaultReadScope,
): T {
  const store = useContext(BunjaStoreContext);
  const { value, mount, deps } = store.get(bunja, readScope);
  useEffect(mount, deps);
  return value;
}

export type ScopePair<T> = [Scope<T>, T];

export function inject<const T extends ScopePair<any>[]>(
  overrideTable: T,
): ReadScope {
  const map = new Map(overrideTable);
  return (scope) => {
    if (map.has(scope)) return map.get(scope);
    const context = scopeContextMap.get(scope);
    if (!context) {
      throw new Error(
        "Unable to read the scope. Please inject the value explicitly or bind scope to the React context.",
      );
    }
    return useContext(context);
  };
}
