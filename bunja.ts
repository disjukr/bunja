export type Dep<T> = Bunja<T> | Scope<T>;

const bunjaEffectSymbol: unique symbol = Symbol("Bunja.effect");
type BunjaEffectSymbol = typeof bunjaEffectSymbol;

export class Bunja<T> {
  public static readonly bunjas: Bunja<any>[] = [];
  public readonly id: number;
  public debugLabel: string = "";
  constructor(
    public deps: Dep<any>[], // one depth dependencies
    public parents: Bunja<any>[], // one depth parents
    public relatedBunjas: Bunja<any>[], // toposorted parents without self
    public relatedScopes: Scope<any>[], // deduped
    public init: (...args: any[]) => T & BunjaValue,
  ) {
    this.id = Bunja.bunjas.length;
    Bunja.bunjas.push(this);
  }
  static readonly effect: BunjaEffectSymbol = bunjaEffectSymbol;
  toString() {
    const { id, debugLabel } = this;
    return `[Bunja:${id}${debugLabel && ` - ${debugLabel}`}]`;
  }
}

export class Scope<T> {
  public static readonly scopes: Scope<any>[] = [];
  public readonly id: number;
  public debugLabel: string = "";
  constructor() {
    this.id = Scope.scopes.length;
    Scope.scopes.push(this);
  }
  toString() {
    const { id, debugLabel } = this;
    return `[Scope:${id}${debugLabel && ` - ${debugLabel}`}]`;
  }
}

export type ReadScope = <T>(scope: Scope<T>) => T;

export class BunjaStore {
  #bunjas: Record<string, BunjaInstance> = {};
  #scopes: Map<Scope<any>, Map<any, ScopeInstance>> = new Map();
  get<T>(
    bunja: Bunja<T>,
    readScope: ReadScope,
  ): {
    value: T;
    mount: () => void;
    deps: any[];
  } {
    const scopeInstanceMap = new Map(
      bunja.relatedScopes.map((scope) => [
        scope,
        this.#getScopeInstance(scope, readScope(scope)),
      ]),
    );
    const bunjaInstance = this.#getBunjaInstance(bunja, scopeInstanceMap);
    const { relatedBunjaInstanceMap } = bunjaInstance; // toposorted
    return {
      value: bunjaInstance.value as T,
      mount() {
        relatedBunjaInstanceMap.forEach((related) => related.add());
        bunjaInstance.add();
        scopeInstanceMap.forEach((scope) => scope.add());
        return function unmount(): void {
          // concern: reverse order?
          relatedBunjaInstanceMap.forEach((related) => related.sub());
          bunjaInstance.sub();
          scopeInstanceMap.forEach((scope) => scope.sub());
        };
      },
      deps: Array.from(scopeInstanceMap.values()).map(({ value }) => value),
    };
  }
  #getBunjaInstance(
    bunja: Bunja<any>,
    scopeInstanceMap: Map<Scope<any>, ScopeInstance>,
  ): BunjaInstance {
    const localScopeInstanceMap = new Map(
      bunja.relatedScopes.map((scope) => [scope, scopeInstanceMap.get(scope)!]),
    );
    const scopeInstanceIds = Array.from(localScopeInstanceMap.values())
      .map(({ instanceId }) => instanceId)
      .sort((a, b) => a - b);
    const bunjaInstanceId = `${bunja.id}:${scopeInstanceIds.join(",")}`;
    if (this.#bunjas[bunjaInstanceId]) return this.#bunjas[bunjaInstanceId];
    const relatedBunjaInstanceMap = new Map(
      bunja.relatedBunjas.map((relatedBunja) => [
        relatedBunja,
        this.#getBunjaInstance(relatedBunja, scopeInstanceMap),
      ]),
    );
    const args = bunja.deps.map((dep) => {
      if (dep instanceof Bunja) return relatedBunjaInstanceMap.get(dep)!.value;
      if (dep instanceof Scope) return localScopeInstanceMap.get(dep)!.value;
      throw new Error("Invalid dependency");
    });
    const bunjaInstance = new BunjaInstance(
      () => delete this.#bunjas[bunjaInstanceId],
      bunjaInstanceId,
      relatedBunjaInstanceMap,
      bunja.init.apply(bunja, args),
    );
    this.#bunjas[bunjaInstanceId] = bunjaInstance;
    return bunjaInstance;
  }
  #getScopeInstance(scope: Scope<any>, value: any): ScopeInstance {
    const scopeInstanceMap = this.#scopes.get(scope) ??
      this.#scopes.set(scope, new Map()).get(scope)!;
    const init = () =>
      new ScopeInstance(
        () => scopeInstanceMap.delete(value),
        ScopeInstance.counter++,
        scope,
        value,
      );
    return (
      scopeInstanceMap.get(value) ??
        scopeInstanceMap.set(value, init()).get(value)!
    );
  }
}

export const createBunjaStore = (): BunjaStore => new BunjaStore();

export type BunjaEffectFn = () => () => void;
export interface BunjaValue {
  [Bunja.effect]?: BunjaEffectFn;
}

function bunjaImpl<T, const U extends any[]>(
  deps: { [K in keyof U]: Dep<U[K]> },
  init: (...args: U) => T & BunjaValue,
): Bunja<T> {
  const parents = deps.filter((dep) => dep instanceof Bunja) as Bunja<any>[];
  const scopes = deps.filter((dep) => dep instanceof Scope) as Scope<any>[];
  const relatedBunjas = toposort(parents);
  const relatedScopes = Array.from(
    new Set([...scopes, ...parents.flatMap((parent) => parent.relatedScopes)]),
  );
  return new Bunja(deps, parents, relatedBunjas, relatedScopes, init as any);
}
bunjaImpl.effect = Bunja.effect;

export const bunja: {
  <T>(deps: [], init: () => T & BunjaValue): Bunja<T>;
  <T, U>(deps: [Dep<U>], init: (u: U) => T & BunjaValue): Bunja<T>;
  <T, U, V>(
    deps: [Dep<U>, Dep<V>],
    init: (u: U, v: V) => T & BunjaValue,
  ): Bunja<T>;
  <T, U, V, W>(
    deps: [Dep<U>, Dep<V>, Dep<W>],
    init: (u: U, v: V, w: W) => T & BunjaValue,
  ): Bunja<T>;
  <T, U, V, W, X>(
    deps: [Dep<U>, Dep<V>, Dep<W>, Dep<X>],
    init: (u: U, v: V, w: W, x: X) => T & BunjaValue,
  ): Bunja<T>;
  <T, U, V, W, X, Y>(
    deps: [Dep<U>, Dep<V>, Dep<W>, Dep<X>, Dep<Y>],
    init: (u: U, v: V, w: W, x: X, y: Y) => T & BunjaValue,
  ): Bunja<T>;
  <T, U, V, W, X, Y, Z>(
    deps: [Dep<U>, Dep<V>, Dep<W>, Dep<X>, Dep<Y>, Dep<Z>],
    init: (u: U, v: V, w: W, x: X, y: Y, z: Z) => T & BunjaValue,
  ): Bunja<T>;
  readonly effect: BunjaEffectSymbol;
} = bunjaImpl;

export function createScope<T>(): Scope<T> {
  return new Scope();
}

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
  abstract dispose(): void;
}

const noop = () => {};
class BunjaInstance extends RefCounter {
  #cleanup: (() => void) | undefined;
  #dispose: () => void;
  constructor(
    dispose: () => void,
    public instanceId: string,
    public relatedBunjaInstanceMap: Map<Bunja<any>, BunjaInstance>,
    public value: BunjaValue,
  ) {
    super();
    this.#dispose = () => {
      this.#cleanup?.();
      dispose();
    };
  }
  add() {
    this.#cleanup ??= this.value[Bunja.effect]?.() ?? noop;
    super.add();
  }
  dispose() {
    this.#dispose();
  }
}

class ScopeInstance extends RefCounter {
  public static counter = 0;
  constructor(
    public dispose: () => void,
    public instanceId: number,
    public scope: Scope<any>,
    public value: any,
  ) {
    super();
  }
}

interface Toposortable {
  parents: Toposortable[];
}
function toposort<T extends Toposortable>(nodes: T[]): T[] {
  const visited = new Set<T>();
  const result: T[] = [];
  function visit(current: T) {
    if (visited.has(current)) return;
    visited.add(current);
    for (const parent of current.parents) visit(parent as T);
    result.push(current);
  }
  for (const node of nodes) visit(node);
  return result;
}
