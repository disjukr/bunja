import { Context, createContext, useContext, useEffect } from "react";
import {
  Bunja,
  createBunjaStore,
  createScope,
  ReadScope,
  Scope,
} from "./bunja";

export const BunjaStoreContext = createContext(createBunjaStore());

export const scopeContextMap = new Map<Scope<any>, Context<any>>();
export function bindScope(scope: Scope<any>, context: Context<any>) {
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

export function useBunja<T>(bunja: Bunja<T>, readScope = defaultReadScope): T {
  const store = useContext(BunjaStoreContext);
  const { value, mount } = store.get(bunja, readScope);
  useEffect(mount, []);
  return value;
}
