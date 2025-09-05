import type { Atom, WritableAtom } from "jotai";
import type { Store } from "jotai/vanilla/store";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { Bunja, ScopeValuePair } from "../bunja.ts";
import { createScopeFromContext, useBunja } from "../react.ts";

// No default value is provided since we will always inject a value when using it.
// Using `getDefaultStore()` causes the following error on the first SSR occurrence after Hot Module Replacement during development:
// Detected multiple Jotai instances. It may cause unexpected behavior with the default store. https://github.com/pmndrs/jotai/discussions/2044
export const JotaiStoreContext = createContext<Store>(null!);
export const JotaiStoreScope = createScopeFromContext(JotaiStoreContext);

export interface Ion<Value> {
  get: () => Value;
}
export interface WritableIon<Value, Args extends any[], Result>
  extends Ion<Value> {
  set: (...args: Args) => Result;
}

export type Ionized<T> =
  & T
  & {
    [K in keyof T as K extends `${infer P}Atom` ? `${P}Ion` : never]: K extends
      `${string}Atom`
      ? T[K] extends WritableAtom<infer U, infer Args, infer Result>
        ? WritableIon<U, Args, Result>
      : T[K] extends Atom<infer U> ? Ion<U>
      : never
      : never;
  };

export function useIonizedBunja<T>(
  bunja: Bunja<T>,
  scopeValuePairs?: ScopeValuePair<any>[],
): Ionized<T> {
  const store = useContext(JotaiStoreContext);
  const value = useBunja(bunja, scopeValuePairs);
  const [, rerender] = useReducer((prev) => prev + 1, 0);
  const unsubsRef = useRef<Record<string, () => void>>({});

  useEffect(() => {
    return () => {
      for (const unsub of Object.values(unsubsRef.current)) unsub();
      unsubsRef.current = {};
    };
  }, []);

  return useMemo(() => {
    const result: any = {};
    for (const key in value) {
      result[key] = value[key];
      if (!key.endsWith("Atom")) continue;
      const atom = value[key] as WritableAtom<any, any[], any>;
      const ionizedKey = key.slice(0, -4) + "Ion";
      result[ionizedKey] = {
        get: () => {
          if (!(key in unsubsRef.current)) {
            unsubsRef.current[key] = store.sub(atom, rerender);
          }
          return store.get(atom);
        },
        set: (...args) => store.set(atom, ...args),
      } satisfies WritableIon<any, any[], any>;
    }
    return result as Ionized<T>;
  }, [rerender, store, value]);
}
