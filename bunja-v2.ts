export function bunja<T>(init: () => T): Bunja<T> {
  return new Bunja(init);
}
bunja.use = invalidUse as BunjaUseFn;
bunja.effect = invalidEffect as BunjaEffectFn;

export type BunjaUseFn = <T>(dep: Dep<T>) => T;
export type BunjaEffectFn = (callback: BunjaEffectCallback) => void;
export type BunjaEffectCallback = () => (() => void) | void;

export function createScope<T>(hash?: HashFn): Scope<T> {
  return new Scope(hash);
}

export function createBunjaStore(): BunjaStore {
  return new BunjaStore();
}

export type Dep<T> = Bunja<T> | Scope<T>;

function invalidUse() {
  throw new Error(
    "`bunja.use` can only be used inside a bunja init function.",
  );
}
function invalidEffect() {
  throw new Error(
    "`bunja.effect` can only be used inside a bunja init function.",
  );
}

const bunjaFn = bunja;

interface BunjaStoreGetContext {
  bunjaInstance: BunjaInstance;
  bunjaInstanceMap: Map<Bunja<unknown>, BunjaInstance>;
  scopeInstanceMap: Map<Scope<unknown>, ScopeInstance>;
}

interface BunjaBakingContext {
  currentBunja: Bunja<unknown>;
}

export class BunjaStore {
  #bunjas: Record<string, BunjaInstance> = {};
  #scopes: Record<string, ScopeInstance> = {};
  #scopeIds: Map<Scope<unknown>, Map<unknown, string>> = new Map();
  #bakingContext: BunjaBakingContext | undefined;
  get<T>(bunja: Bunja<T>, readScope: ReadScope): BunjaStoreGetResult<T> {
    const originalUse = bunjaFn.use;
    try {
      const { bunjaInstance } = bunja.baked
        ? this.#getBaked(bunja, readScope)
        : this.#getUnbaked(bunja, readScope);
      return {
        value: bunjaInstance.value as T,
        mount: () => () => {}, // TODO
        deps: [], // TODO
      };
    } finally {
      bunjaFn.use = originalUse;
    }
  }
  #getBaked<T>(bunja: Bunja<T>, readScope: ReadScope): BunjaStoreGetContext {
    const bunjaInstanceMap = new Map(
      bunja.relatedBunjas.map((relatedBunja) => [
        relatedBunja,
        this.#getBunjaInstance(relatedBunja, readScope),
      ]),
    );
    const scopeInstanceMap = this.#createScopeInstanceMap(bunja, readScope);
    bunjaFn.use = <T>(dep: Dep<T>) => {
      if (dep instanceof Bunja) return bunjaInstanceMap.get(dep)!.value as T;
      if (dep instanceof Scope) return scopeInstanceMap.get(dep)!.value as T;
      throw new Error("`bunja.use` can only be used with Bunja or Scope.");
    };
    const bunjaInstance = this.#getBunjaInstance(bunja, readScope);
    return { bunjaInstance, bunjaInstanceMap, scopeInstanceMap };
  }
  #getUnbaked<T>(bunja: Bunja<T>, readScope: ReadScope): BunjaStoreGetContext {
    const bunjaInstanceMap = new Map<Bunja<unknown>, BunjaInstance>();
    const scopeInstanceMap = new Map<Scope<unknown>, ScopeInstance>();
    function getUse<D extends Dep<unknown>, I extends { value: unknown }>(
      map: Map<D, I>,
      addDep: (D: D) => void,
      getInstance: (dep: D) => I,
    ) {
      return <T>(dep: D): T => {
        addDep(dep);
        if (map.has(dep)) return map.get(dep)!.value as T;
        const instance = getInstance(dep);
        map.set(dep, instance);
        return instance.value as T;
      };
    }
    const useBunja = getUse(
      bunjaInstanceMap,
      (dep) => this.#bakingContext!.currentBunja.addParent(dep),
      (dep) => this.#getBunjaInstance(dep, readScope),
    );
    const useScope = getUse(
      scopeInstanceMap,
      (dep) => this.#bakingContext!.currentBunja.addScope(dep),
      (dep) => this.#getScopeInstance(dep, readScope(dep)),
    );
    bunjaFn.use = <T>(dep: Dep<T>) => {
      if (dep instanceof Bunja) return useBunja(dep) as T;
      if (dep instanceof Scope) return useScope(dep) as T;
      throw new Error("`bunja.use` can only be used with Bunja or Scope.");
    };
    try {
      this.#bakingContext = { currentBunja: bunja };
      const bunjaInstance = this.#getBunjaInstance(bunja, readScope);
      return { bunjaInstance, bunjaInstanceMap, scopeInstanceMap };
    } finally {
      this.#bakingContext = undefined;
    }
  }
  #getBunjaInstance<T>(bunja: Bunja<T>, readScope: ReadScope): BunjaInstance {
    const originalEffect = bunjaFn.effect;
    const prevBunja = this.#bakingContext?.currentBunja;
    try {
      const effectCallbacks: BunjaEffectCallback[] = [];
      bunjaFn.effect = (callback: BunjaEffectCallback) => {
        effectCallbacks.push(callback);
      };
      if (this.#bakingContext) this.#bakingContext.currentBunja = bunja;
      if (bunja.baked) {
        const id = this.#calcBunjaInstanceId(bunja, readScope);
        if (id in this.#bunjas) return this.#bunjas[id];
        const bunjaInstanceValue = bunja.init();
        return this.#createBunjaInstance(id, bunjaInstanceValue);
      } else {
        const bunjaInstanceValue = bunja.init();
        bunja.bake();
        const id = this.#calcBunjaInstanceId(bunja, readScope);
        return this.#createBunjaInstance(id, bunjaInstanceValue);
      }
    } finally {
      bunjaFn.effect = originalEffect;
      if (this.#bakingContext) this.#bakingContext.currentBunja = prevBunja!;
    }
  }
  #getScopeInstance(scope: Scope<unknown>, value: unknown): ScopeInstance {
    const key = scope.hash(value);
    const scopeIdByKey = this.#scopeIds.get(scope) ??
      this.#scopeIds.set(scope, new Map()).get(scope)!;
    const scopeId = scopeIdByKey.get(key) ??
      scopeIdByKey.set(
        key,
        this.#createScopeInstance(scope, value).id,
      ).get(key)!;
    return this.#scopes[scopeId];
  }
  #createBunjaInstance(id: string, value: unknown): BunjaInstance {
    const bunjaInstance = new BunjaInstance(id, value);
    this.#bunjas[id] = bunjaInstance;
    return bunjaInstance;
  }
  #createScopeInstance(scope: Scope<unknown>, value: unknown): ScopeInstance {
    const scopeInstance = new ScopeInstance(value);
    this.#scopes[scope.id] = scopeInstance;
    return scopeInstance;
  }
  #calcBunjaInstanceId(bunja: Bunja<unknown>, readScope: ReadScope): string {
    const scopeInstanceMap = this.#createScopeInstanceMap(bunja, readScope);
    return Bunja.calcInstanceId(bunja, scopeInstanceMap);
  }
  #createScopeInstanceMap(
    bunja: Bunja<unknown>,
    readScope: ReadScope,
  ): Map<Scope<unknown>, ScopeInstance> {
    if (!bunja.baked) {
      throw new Error("Bunja must be baked to create scope instance map.");
    }
    return new Map(
      bunja.relatedScopes.map((scope) => [
        scope,
        this.#getScopeInstance(scope, readScope(scope)),
      ]),
    );
  }
}

export type ReadScope = <T>(scope: Scope<T>) => T;

export interface BunjaStoreGetResult<T> {
  value: T;
  mount: () => () => void;
  deps: unknown[];
}

export class Bunja<T> {
  static readonly bunjas: Bunja<unknown>[] = [];
  readonly id: string;
  #phase: BunjaPhase = { baked: false, parents: new Set(), scopes: new Set() };
  constructor(public init: () => T) {
    this.id = String(Bunja.bunjas.length);
    Bunja.bunjas.push(this);
  }
  get baked(): boolean {
    return this.#phase.baked;
  }
  get parents(): Bunja<unknown>[] {
    if (this.#phase.baked) return this.#phase.parents;
    return Array.from(this.#phase.parents);
  }
  get relatedBunjas(): Bunja<unknown>[] {
    if (!this.#phase.baked) throw new Error("Bunja is not baked yet.");
    return this.#phase.relatedBunjas;
  }
  get relatedScopes(): Scope<unknown>[] {
    if (!this.#phase.baked) throw new Error("Bunja is not baked yet.");
    return this.#phase.relatedScopes;
  }
  addParent(bunja: Bunja<unknown>): void {
    if (this.#phase.baked) return;
    this.#phase.parents.add(bunja);
  }
  addScope(scope: Scope<unknown>): void {
    if (this.#phase.baked) return;
    this.#phase.scopes.add(scope);
  }
  bake(): void {
    this.#phase = {
      baked: true,
      parents: this.parents,
      relatedBunjas: [], // TODO: toposort parents
      relatedScopes: [], // TODO
    };
  }
  static calcInstanceId(
    bunja: Bunja<unknown>,
    scopeInstanceMap: Map<Scope<unknown>, ScopeInstance>,
  ): string {
    const localScopeInstanceMap = new Map(
      bunja.relatedScopes.map((scope) => [scope, scopeInstanceMap.get(scope)!]),
    );
    const scopeInstanceIds = Array.from(
      localScopeInstanceMap.values(),
    ).map(({ id }) => id);
    const bunjaInstanceId = `${bunja.id}:${scopeInstanceIds.join(",")}`;
    return bunjaInstanceId;
  }
}

type BunjaPhase = BunjaPhaseUnknown | BunjaPhaseKnown;

interface BunjaPhaseUnknown {
  readonly baked: false;
  readonly parents: Set<Bunja<unknown>>;
  readonly scopes: Set<Scope<unknown>>;
}

interface BunjaPhaseKnown {
  readonly baked: true;
  readonly parents: Bunja<unknown>[];
  readonly relatedBunjas: Bunja<unknown>[];
  readonly relatedScopes: Scope<unknown>[];
}

export class Scope<T> {
  static readonly scopes: Scope<unknown>[] = [];
  readonly id: string;
  constructor(public readonly hash: HashFn = Scope.identity) {
    this.id = String(Scope.scopes.length);
    Scope.scopes.push(this);
  }
  private static identity<T>(x: T): T {
    return x;
  }
}

export type HashFn<T = unknown, U = unknown> = (value: T) => U;

class BunjaInstance {
  constructor(public readonly id: string, public readonly value: unknown) {}
}

class ScopeInstance {
  private static counter = 0;
  readonly id: string = String(ScopeInstance.counter++);
  constructor(public readonly value: unknown) {}
}
