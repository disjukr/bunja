export function bunja<T>(init: () => T): Bunja<T> {
  return new Bunja(init);
}
bunja.use = invalidUse as BunjaUseFn;
bunja.effect = invalidEffect as BunjaEffectFn;

export type BunjaUseFn = <T>(dep: Dep<T>) => T;
export type BunjaEffectFn = (callback: BunjaEffectCallback) => void;
export type BunjaEffectCallback = () => (() => void) | void;

export function createScope<T>(hash?: HashFn<T>): Scope<T> {
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
  bunjaInstanceMap: BunjaInstanceMap;
  scopeInstanceMap: ScopeInstanceMap;
}

type BunjaInstanceMap = Map<Bunja<unknown>, BunjaInstance>;
type ScopeInstanceMap = Map<Scope<unknown>, ScopeInstance>;

interface BunjaBakingContext {
  currentBunja: Bunja<unknown>;
}

export class BunjaStore {
  #bunjas: Record<string, BunjaInstance> = {};
  #scopes: Map<Scope<unknown>, Map<unknown, ScopeInstance>> = new Map();
  #bakingContext: BunjaBakingContext | undefined;
  dispose() {
    for (const instance of Object.values(this.#bunjas)) instance.dispose();
    for (const instanceMap of Object.values(this.#scopes)) {
      for (const instance of instanceMap.values()) instance.dispose();
    }
    this.#bunjas = {};
    this.#scopes = new Map();
  }
  get<T>(bunja: Bunja<T>, readScope: ReadScope): BunjaStoreGetResult<T> {
    const originalUse = bunjaFn.use;
    try {
      const { bunjaInstance, bunjaInstanceMap, scopeInstanceMap } = bunja.baked
        ? this.#getBaked(bunja, readScope)
        : this.#getUnbaked(bunja, readScope);
      return {
        value: bunjaInstance.value as T,
        mount: () => {
          bunjaInstanceMap.forEach((instance) => instance.add());
          bunjaInstance.add();
          scopeInstanceMap.forEach((instance) => instance.add());
          const unmount = () => {
            setTimeout(() => {
              bunjaInstanceMap.forEach((instance) => instance.sub());
              bunjaInstance.sub();
              scopeInstanceMap.forEach((instance) => instance.sub());
            });
          };
          return unmount;
        },
        deps: Array.from(scopeInstanceMap.values()).map(({ value }) => value),
      };
    } finally {
      bunjaFn.use = originalUse;
    }
  }
  #getBaked<T>(bunja: Bunja<T>, readScope: ReadScope): BunjaStoreGetContext {
    const scopeInstanceMap = new Map(
      bunja.relatedScopes.map((scope) => [
        scope,
        this.#getScopeInstance(scope, readScope(scope)),
      ]),
    );
    const bunjaInstanceMap = new Map(
      bunja.relatedBunjas.map((relatedBunja) => [
        relatedBunja,
        this.#getBunjaInstance(relatedBunja, scopeInstanceMap),
      ]),
    );
    bunjaFn.use = <T>(dep: Dep<T>) => {
      if (dep instanceof Bunja) {
        return bunjaInstanceMap.get(dep as Bunja<unknown>)!.value as T;
      }
      if (dep instanceof Scope) {
        return scopeInstanceMap.get(dep as Scope<unknown>)!.value as T;
      }
      throw new Error("`bunja.use` can only be used with Bunja or Scope.");
    };
    const bunjaInstance = this.#getBunjaInstance(bunja, scopeInstanceMap);
    return { bunjaInstance, bunjaInstanceMap, scopeInstanceMap };
  }
  #getUnbaked<T>(bunja: Bunja<T>, readScope: ReadScope): BunjaStoreGetContext {
    const bunjaInstanceMap: BunjaInstanceMap = new Map();
    const scopeInstanceMap: ScopeInstanceMap = new Map();
    function getUse<D extends Dep<unknown>, I extends { value: unknown }>(
      map: Map<D, I>,
      addDep: (D: D) => void,
      getInstance: (dep: D) => I,
    ) {
      return ((dep) => {
        const d = dep as D;
        addDep(d);
        if (map.has(d)) return map.get(d)!.value as T;
        const instance = getInstance(d);
        map.set(d, instance);
        return instance.value as T;
      }) as <T>(dep: Dep<T>) => T;
    }
    const useScope = getUse(
      scopeInstanceMap,
      (dep) => this.#bakingContext!.currentBunja.addScope(dep),
      (dep) => this.#getScopeInstance(dep, readScope(dep)),
    );
    const useBunja = getUse(
      bunjaInstanceMap,
      (dep) => this.#bakingContext!.currentBunja.addParent(dep),
      (dep) => {
        if (dep.baked) {
          for (const scope of dep.relatedScopes) useScope(scope);
        }
        return this.#getBunjaInstance(dep, scopeInstanceMap);
      },
    );
    bunjaFn.use = <T>(dep: Dep<T>) => {
      if (dep instanceof Bunja) return useBunja(dep) as T;
      if (dep instanceof Scope) return useScope(dep) as T;
      throw new Error("`bunja.use` can only be used with Bunja or Scope.");
    };
    try {
      this.#bakingContext = { currentBunja: bunja };
      const bunjaInstance = this.#getBunjaInstance(bunja, scopeInstanceMap);
      return { bunjaInstance, bunjaInstanceMap, scopeInstanceMap };
    } finally {
      this.#bakingContext = undefined;
    }
  }
  #getBunjaInstance<T>(
    bunja: Bunja<T>,
    scopeInstanceMap: ScopeInstanceMap,
  ): BunjaInstance {
    const originalEffect = bunjaFn.effect;
    const prevBunja = this.#bakingContext?.currentBunja;
    try {
      const effects: BunjaEffectCallback[] = [];
      bunjaFn.effect = (callback: BunjaEffectCallback) => {
        effects.push(callback);
      };
      if (this.#bakingContext) this.#bakingContext.currentBunja = bunja;
      if (bunja.baked) {
        const id = bunja.calcInstanceId(scopeInstanceMap);
        if (id in this.#bunjas) return this.#bunjas[id];
        const bunjaInstanceValue = bunja.init();
        return this.#createBunjaInstance(id, bunjaInstanceValue, effects);
      } else {
        const bunjaInstanceValue = bunja.init();
        bunja.bake();
        const id = bunja.calcInstanceId(scopeInstanceMap);
        return this.#createBunjaInstance(id, bunjaInstanceValue, effects);
      }
    } finally {
      bunjaFn.effect = originalEffect;
      if (this.#bakingContext) this.#bakingContext.currentBunja = prevBunja!;
    }
  }
  #getScopeInstance(scope: Scope<unknown>, value: unknown): ScopeInstance {
    const key = scope.hash(value);
    const instanceMap = this.#scopes.get(scope) ??
      this.#scopes.set(scope, new Map()).get(scope)!;
    return instanceMap.get(key) ??
      instanceMap.set(
        key,
        new ScopeInstance(value, () => instanceMap.delete(key)),
      ).get(key)!;
  }
  #createBunjaInstance(
    id: string,
    value: unknown,
    effects: BunjaEffectCallback[],
  ): BunjaInstance {
    const effect = () => {
      const cleanups = effects
        .map((effect) => effect())
        .filter(Boolean) as (() => void)[];
      return () => cleanups.forEach((cleanup) => cleanup());
    };
    const dispose = () => delete this.#bunjas[id];
    const bunjaInstance = new BunjaInstance(id, value, effect, dispose);
    this.#bunjas[id] = bunjaInstance;
    return bunjaInstance;
  }
}

export type ReadScope = <T>(scope: Scope<T>) => T;

export interface BunjaStoreGetResult<T> {
  value: T;
  mount: () => () => void;
  deps: unknown[];
}

export class Bunja<T> {
  private static counter = 0;
  readonly id = String(Bunja.counter++);
  debugLabel = "";
  #phase: BunjaPhase = { baked: false, parents: new Set(), scopes: new Set() };
  constructor(public init: () => T) {}
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
    if (this.#phase.baked) throw new Error("Bunja is already baked.");
    const scopes = this.#phase.scopes;
    const parents = this.parents;
    const relatedBunjas = toposort(parents);
    const relatedScopes = Array.from(
      new Set([
        ...relatedBunjas.flatMap((bunja) => bunja.relatedScopes),
        ...scopes,
      ]),
    );
    this.#phase = { baked: true, parents, relatedBunjas, relatedScopes };
  }
  calcInstanceId(scopeInstanceMap: Map<Scope<unknown>, ScopeInstance>): string {
    const localScopeInstanceMap = new Map(
      this.relatedScopes.map((scope) => [scope, scopeInstanceMap.get(scope)!]),
    );
    const scopeInstanceIds = Array.from(
      localScopeInstanceMap.values(),
    ).map(({ id }) => id);
    return `${this.id}:${scopeInstanceIds.join(",")}`;
  }
  toString(): string {
    const { id, debugLabel } = this;
    return `[Bunja:${id}${debugLabel && ` - ${debugLabel}`}]`;
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
  private static counter = 0;
  readonly id = String(Scope.counter++);
  debugLabel = "";
  constructor(public readonly hash: HashFn<T> = Scope.identity) {}
  private static identity<T>(x: T): T {
    return x;
  }
  toString(): string {
    const { id, debugLabel } = this;
    return `[Scope:${id}${debugLabel && ` - ${debugLabel}`}]`;
  }
}

export type HashFn<T> = (value: T) => unknown;

const noop = () => {};
abstract class RefCounter {
  #count = 0;
  abstract dispose(): void;
  add() {
    ++this.#count;
  }
  sub() {
    --this.#count;
    if (this.#count < 1) {
      this.dispose();
      this.dispose = noop;
    }
  }
}

class BunjaInstance extends RefCounter {
  #cleanup: (() => void) | undefined;
  constructor(
    public readonly id: string,
    public readonly value: unknown,
    public readonly effect: BunjaEffectCallback,
    private readonly _dispose: () => void,
  ) {
    super();
  }
  override dispose(): void {
    this.#cleanup?.();
    this._dispose();
  }
  override add(): void {
    this.#cleanup ??= this.effect() ?? noop;
    super.add();
  }
}

class ScopeInstance extends RefCounter {
  private static counter = 0;
  readonly id = String(ScopeInstance.counter++);
  constructor(
    public readonly value: unknown,
    public readonly dispose: () => void,
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
