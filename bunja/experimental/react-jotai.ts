import { type Atom, type SetStateAction, useAtom } from "jotai";
import type { Bunja, ScopeValuePair } from "../bunja.ts";
import { useBunja } from "../react.ts";

export function useIonizedBunja<T>(
  bunja: Bunja<T>,
  scopeValuePairs?: ScopeValuePair<any>[],
): Ionized<T> {
  return ionize(useBunja(bunja, scopeValuePairs));
}

export interface Ion<T> {
  value: T;
}
export type Ionized<T> =
  & T
  & {
    [K in keyof T as K extends `${infer P}Atom` ? `${P}Ion` : never]: K extends
      `${string}Atom` ? T[K] extends Atom<infer U> ? Ion<U>
      : never
      : never;
  };
function ionize<T>(value: T): Ionized<T> {
  const result: any = {};
  type SetAtom<Args extends unknown[], Result> = (...args: Args) => Result;
  type UseAtomResult<T> = [Awaited<T>, SetAtom<[SetStateAction<T>], void>];
  const usedAtoms: Map<string, UseAtomResult<unknown>> = new Map();
  function use(atomKey: string): UseAtomResult<unknown> {
    if (usedAtoms.has(atomKey)) {
      return usedAtoms.get(atomKey)!;
    } else {
      const atomValue = useAtom((value as any)[atomKey]);
      usedAtoms.set(atomKey, atomValue);
      return atomValue;
    }
  }
  for (const key in value) {
    result[key] = value[key];
    if (key.endsWith("Atom")) {
      const ionizedKey = key.slice(0, -4) + "Ion";
      result[ionizedKey] = {
        get value() {
          return use(key)[0];
        },
        set value(newValue) {
          use(key)[1](newValue);
        },
      } satisfies Ion<unknown>;
    }
  }
  return result as Ionized<T>;
}
