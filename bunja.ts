import * as React from "react";

export type Dep<T> = React.Context<T> | Bunja<T>;

export class Bunja<T> {
  constructor(
    public id: number,
    public deps: Dep<any>[],
    public contexts: React.Context<any>[],
    public init: (...args: any[]) => T & BunjaValue
  ) {}
  static readonly effect = Symbol("Bunja.effect");
}

export class BunjaStore {
  #bunjas: Record<string, BunjaInstance> = {};
  get(bunja: Bunja<any>, biid: string, args: any[]) {
    return (this.#bunjas[biid] ??= new BunjaInstance(
      this,
      biid,
      bunja.init(...args)
    ));
  }
  delete(biid: string) {
    delete this.#bunjas[biid];
  }
}

export const createBunjaStore = () => new BunjaStore();
export const BunjaStoreContext = React.createContext(createBunjaStore());

export type BunjaEffectFn = () => () => void;
export interface BunjaValue {
  [Bunja.effect]?: BunjaEffectFn;
}

export function bunja<T>(deps: [], init: () => T & BunjaValue): Bunja<T>;
export function bunja<T, U>(
  deps: [Dep<U>],
  init: (u: U) => T & BunjaValue
): Bunja<T>;
export function bunja<T, U, V>(
  deps: [Dep<U>, Dep<V>],
  init: (u: U, v: V) => T & BunjaValue
): Bunja<T>;
export function bunja<T, U, V, W>(
  deps: [Dep<U>, Dep<V>, Dep<W>],
  init: (u: U, v: V, w: W) => T & BunjaValue
): Bunja<T>;
export function bunja<T, U, V, W, X>(
  deps: [Dep<U>, Dep<V>, Dep<W>, Dep<X>],
  init: (u: U, v: V, w: W, x: X) => T & BunjaValue
): Bunja<T>;
export function bunja<T, U, V, W, X, Y>(
  deps: [Dep<U>, Dep<V>, Dep<W>, Dep<X>, Dep<Y>],
  init: (u: U, v: V, w: W, x: X, y: Y) => T & BunjaValue
): Bunja<T>;
export function bunja<T, U, V, W, X, Y, Z>(
  deps: [Dep<U>, Dep<V>, Dep<W>, Dep<X>, Dep<Y>, Dep<Z>],
  init: (u: U, v: V, w: W, x: X, y: Y, z: Z) => T & BunjaValue
): Bunja<T>;
export function bunja<T, const U extends any[]>(
  deps: { [K in keyof U]: Dep<U[K]> },
  init: (...args: U) => T & BunjaValue
): Bunja<T> {
  const contexts = deps.filter(
    (dep) => !(dep instanceof Bunja)
  ) as React.Context<any>[];
  const bunjas = deps.filter((dep) => dep instanceof Bunja) as Bunja<any>[];
  const dedupedContexts = Array.from(
    new Set([...contexts, ...bunjas.flatMap((def) => def.contexts)])
  );
  return new Bunja(bunja.counter++, deps, dedupedContexts, init as any);
}
bunja.counter = 0;

export function useBunja<T>(bunja: Bunja<T>): T {
  const { id, deps, contexts } = bunja;
  const store = React.useContext(BunjaStoreContext);
  const tuples = contexts.map((c) => [c, React.useContext(c)] as const);
  const scopes = tuples.map(([context, value]) => getScope(context, value));
  const scopeMap = new Map(tuples);
  const args = deps.map((dep) => {
    if (dep instanceof Bunja) return useBunja(dep);
    return scopeMap.get(dep);
  });
  const biid = `${id}:${scopes
    .map(({ id }) => id)
    .sort()
    .join(",")}`;
  const instance = store.get(bunja, biid, args);
  React.useEffect(() => {
    instance.add();
    return () => instance.sub();
  }, [instance]);
  React.useEffect(() => {
    scopes.forEach((scope) => scope.add());
    return () => scopes.forEach((scope) => scope.sub());
  }, scopes);
  return instance.value as T;
}

const useRid = () => React.useState(() => useRid.counter++)[0];
useRid.counter = 0;

const scopes = new WeakMap<React.Context<any>, Map<any, Scope>>();
function getScope(context: React.Context<any>, value: any) {
  const m = scopes.get(context) ?? scopes.set(context, new Map()).get(context)!;
  const init = () =>
    new Scope(() => m.delete(value), context, value, getScope.counter++);
  return m.get(value) ?? m.set(value, init()).get(value)!;
}
getScope.counter = 0;

abstract class RefCounter {
  #disposed = false;
  #count = 0;
  add() {
    this.#count++;
  }
  sub() {
    this.#count--;
    setTimeout(() => {
      if (this.#disposed) return;
      if (this.#count < 1) {
        this.#disposed = true;
        this.dispose();
      }
    });
  }
  abstract dispose: () => void;
}

const noop = () => {};
class BunjaInstance extends RefCounter {
  #cleanup: (() => void) | undefined;
  constructor(
    public store: BunjaStore,
    public biid: string,
    public value: BunjaValue
  ) {
    super();
  }
  add() {
    this.#cleanup ??= this.value[Bunja.effect]?.() ?? noop;
    super.add();
  }
  dispose = () => {
    this.#cleanup?.();
    this.store.delete(this.biid);
  };
}

class Scope extends RefCounter {
  constructor(
    public dispose: () => void,
    public context: React.Context<any>,
    public value: any,
    public id: number
  ) {
    super();
  }
}
