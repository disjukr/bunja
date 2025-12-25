// @ts-ignore dev
// deno-lint-ignore no-process-global
const __DEV__ = process.env.NODE_ENV !== "production";

export interface BunjaFn {
  <T>(init: () => T): Bunja<T>;
  use: BunjaUseFn;
  fork: BunjaForkFn;
  effect: BunjaEffectFn;
}
export const bunja: BunjaFn = bunjaFn;
function bunjaFn<T>(init: () => T): Bunja<T> {
  return new Bunja(init);
}
bunjaFn.use = invalidUse as BunjaUseFn;
bunjaFn.fork = invalidFork as BunjaForkFn;
bunjaFn.effect = invalidEffect as BunjaEffectFn;

export type BunjaUseFn = <T>(dep: Dep<T>) => T;
export type BunjaForkFn = <T>(
  bunja: Bunja<T>,
  scopeValuePairs: ScopeValuePair<any>[],
) => T;
export type BunjaEffectFn = (callback: BunjaEffectCallback) => void;
export type BunjaEffectCallback = () => (() => void) | void;

export function createScope<T>(hash?: HashFn<T>): Scope<T> {
  return new Scope(hash);
}

export interface CreateBunjaStoreConfig {
  wrapInstance?: WrapInstanceFn;
}
export function createBunjaStore(config?: CreateBunjaStoreConfig): BunjaStore {
  const { wrapInstance = defaultWrapInstanceFn } = config ?? {};
  const store = new BunjaStore();
  store.wrapInstance = wrapInstance;
  return store;
}

export type Dep<T> = Bunja<T> | Scope<T>;

function invalidUse() {
  throw new Error(
    "`bunja.use` can only be used inside a bunja init function.",
  );
}
function invalidFork() {
  throw new Error(
    "`bunja.fork` can only be used inside a bunja init function.",
  );
}
function invalidEffect() {
  throw new Error(
    "`bunja.effect` can only be used inside a bunja init function.",
  );
}

interface BunjaStoreGetContext {
  bunjaInstance: BunjaInstance;
  bunjaInstanceMap: BunjaInstanceMap;
  scopeInstanceMap: ScopeInstanceMap;
}

type BunjaInstanceMap = Map<Bunja<unknown>, BunjaInstance>;
type ScopeInstanceMap = Map<Scope<unknown>, ScopeInstance>;

interface InternalState {
  bunjas: Record<string, BunjaInstance>;
  scopes: Map<Scope<unknown>, Map<unknown, ScopeInstance>>;
  instantiating: boolean;
}

interface BunjaBakingContext {
  currentBunja: Bunja<unknown>;
}

export type WrapInstanceFn = <T>(fn: (dispose: () => void) => T) => T;
const defaultWrapInstanceFn: WrapInstanceFn = (fn) => fn(noop);

export class BunjaStore {
  private static counter: number = 0;
  readonly id: string = String(BunjaStore.counter++);
  #bunjas: Record<string, BunjaInstance> = {};
  #scopes: Map<Scope<unknown>, Map<unknown, ScopeInstance>> = new Map();
  #bakingContext: BunjaBakingContext | undefined;
  #instantiating: boolean = false;
  wrapInstance: WrapInstanceFn = defaultWrapInstanceFn;
  constructor() {
    if (__DEV__) {
      devtoolsGlobalHook.stores[this.id] = this;
      devtoolsGlobalHook.emit("storeCreated", { storeId: this.id });
    }
  }
  get _internalState(): InternalState | undefined {
    if (__DEV__) return { bunjas: this.#bunjas, scopes: this.#scopes, instantiating: this.#instantiating };
    return undefined;
  }
  dispose(): void {
    for (const instance of Object.values(this.#bunjas)) instance.dispose();
    for (const instanceMap of Object.values(this.#scopes)) {
      for (const instance of instanceMap.values()) instance.dispose();
    }
    this.#bunjas = {};
    this.#scopes = new Map();
    if (__DEV__) {
      devtoolsGlobalHook.emit("storeDisposed", { storeId: this.id });
      delete devtoolsGlobalHook.stores[this.id];
    }
  }
  get<T>(bunja: Bunja<T>, readScope: ReadScope): BunjaStoreGetResult<T> {
    const originalUse = bunjaFn.use;
    try {
      const { bunjaInstance, bunjaInstanceMap, scopeInstanceMap } = bunja.baked
        ? this.#getBaked(bunja, readScope)
        : this.#getUnbaked(bunja, readScope);
      const result: BunjaStoreGetResult<T> = {
        value: bunjaInstance.value as T,
        mount: () => {
          bunjaInstanceMap.forEach((instance) => instance.add());
          bunjaInstance.add();
          scopeInstanceMap.forEach((instance) => instance.add());
          const unmount = () => {
            bunjaInstanceMap.forEach((instance) => instance.sub());
            bunjaInstance.sub();
            scopeInstanceMap.forEach((instance) => instance.sub());
          };
          return unmount;
        },
        deps: Array.from(scopeInstanceMap.values()).map(({ value }) => value),
      };
      if (__DEV__) {
        result.bunjaInstance = bunjaInstance;
        devtoolsGlobalHook.emit("getCalled", {
          storeId: this.id,
          bunjaInstanceId: bunjaInstance.id,
        });
      }
      return result;
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
    const bunjaInstanceMap = new Map();
    bunjaFn.use = <T>(dep: Dep<T>) => {
      if (dep instanceof Bunja) {
        return bunjaInstanceMap.get(dep as Bunja<unknown>)!.value as T;
      }
      if (dep instanceof Scope) {
        return scopeInstanceMap.get(dep as Scope<unknown>)!.value as T;
      }
      throw new Error("`bunja.use` can only be used with Bunja or Scope.");
    };
    for (const relatedBunja of bunja.relatedBunjas) {
      bunjaInstanceMap.set(
        relatedBunja,
        this.#getBunjaInstance(relatedBunja, scopeInstanceMap),
      );
    }
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
    const originalBakingContext = this.#bakingContext;
    try {
      this.#bakingContext = { currentBunja: bunja };
      const bunjaInstance = this.#getBunjaInstance(bunja, scopeInstanceMap);
      return { bunjaInstance, bunjaInstanceMap, scopeInstanceMap };
    } finally {
      this.#bakingContext = originalBakingContext;
    }
  }
  #getBunjaInstance<T>(
    bunja: Bunja<T>,
    scopeInstanceMap: ScopeInstanceMap,
  ): BunjaInstance {
    this.#instantiating = true;
    const originalEffect = bunjaFn.effect;
    const originalFork = bunjaFn.fork;
    const prevBunja = this.#bakingContext?.currentBunja;
    try {
      const effects: BunjaEffectCallback[] = [];
      bunjaFn.effect = (callback: BunjaEffectCallback) => {
        effects.push(callback);
      };
      bunjaFn.fork = (b, scopeValuePairs) => {
        const readScope = createReadScopeFn(scopeValuePairs, bunjaFn.use);
        const { value, mount } = this.get(b, readScope);
        bunjaFn.effect(mount);
        return value;
      };
      if (this.#bakingContext) this.#bakingContext.currentBunja = bunja;
      if (bunja.baked) {
        const id = bunja.calcInstanceId(scopeInstanceMap);
        if (id in this.#bunjas) return this.#bunjas[id];
        return this.wrapInstance((dispose) => {
          const value = bunja.init();
          return this.#createBunjaInstance(id, value, effects, dispose);
        });
      } else {
        return this.wrapInstance((dispose) => {
          const value = bunja.init();
          bunja.bake();
          const id = bunja.calcInstanceId(scopeInstanceMap);
          return this.#createBunjaInstance(id, value, effects, dispose);
        });
      }
    } finally {
      this.#instantiating = false;
      bunjaFn.effect = originalEffect;
      bunjaFn.fork = originalFork;
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
        this.#createScopeInstance(scope, key, value, () => {
          instanceMap.delete(key);
          if (__DEV__) {
            devtoolsGlobalHook.emit("scopeInstanceUnmounted", {
              storeId: this.id,
              scope,
              key,
            });
          }
        }),
      ).get(key)!;
  }
  #createBunjaInstance(
    id: string,
    value: unknown,
    effects: BunjaEffectCallback[],
    dispose: () => void,
  ): BunjaInstance {
    const effect = () => {
      const cleanups = effects
        .map((effect) => effect())
        .filter(Boolean) as (() => void)[];
      return () => cleanups.forEach((cleanup) => cleanup());
    };
    const bunjaInstance = new BunjaInstance(id, value, effect, () => {
      if (__DEV__) {
        devtoolsGlobalHook.emit("bunjaInstanceUnmounted", {
          storeId: this.id,
          bunjaInstanceId: id,
        });
      }
      dispose();
      delete this.#bunjas[id];
    });
    this.#bunjas[id] = bunjaInstance;
    if (__DEV__) {
      devtoolsGlobalHook.emit("bunjaInstanceMounted", {
        storeId: this.id,
        bunjaInstanceId: id,
      });
    }
    return bunjaInstance;
  }
  #createScopeInstance(
    scope: Scope<unknown>,
    key: unknown,
    value: unknown,
    dispose: () => void,
  ): ScopeInstance {
    if (__DEV__) {
      devtoolsGlobalHook.emit("scopeInstanceMounted", {
        storeId: this.id,
        scope,
        key,
      });
    }
    return new ScopeInstance(value, dispose);
  }
}

export type ReadScope = <T>(scope: Scope<T>) => T;
export function createReadScopeFn(
  scopeValuePairs: ScopeValuePair<any>[],
  readScope: ReadScope,
): ReadScope {
  const map = new Map(scopeValuePairs);
  return <T>(scope: Scope<T>) => {
    if (map.has(scope as Scope<unknown>)) {
      return map.get(scope as Scope<unknown>) as T;
    }
    return readScope(scope);
  };
}

export interface BunjaStoreGetResult<T> {
  value: T;
  mount: () => () => void;
  deps: unknown[];
  bunjaInstance?: BunjaInstance;
}

export function delayUnmount(
  mount: () => () => void,
  ms: number = 0,
): () => () => void {
  return () => {
    const unmount = mount();
    return () => setTimeout(unmount, ms);
  };
}

export class Bunja<T> {
  private static counter: number = 0;
  readonly id: string = String(Bunja.counter++);
  debugLabel: string = "";
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
    const scopeInstanceIds = this.relatedScopes.map(
      (scope) => scopeInstanceMap.get(scope)!.id,
    );
    return `${this.id}:${scopeInstanceIds.join(",")}`;
  }
  toString(): string {
    const { id, debugLabel } = this;
    return `[Bunja:${id}${debugLabel && ` - ${debugLabel}`}]`;
  }
}

type BunjaPhase = BunjaPhaseUnbaked | BunjaPhaseBaked;

interface BunjaPhaseUnbaked {
  readonly baked: false;
  readonly parents: Set<Bunja<unknown>>;
  readonly scopes: Set<Scope<unknown>>;
}

interface BunjaPhaseBaked {
  readonly baked: true;
  readonly parents: Bunja<unknown>[];
  readonly relatedBunjas: Bunja<unknown>[];
  readonly relatedScopes: Scope<unknown>[];
}

export class Scope<T> {
  private static counter: number = 0;
  readonly id: string = String(Scope.counter++);
  debugLabel: string = "";
  constructor(public readonly hash: HashFn<T> = Scope.identity) {}
  private static identity<T>(x: T): T {
    return x;
  }
  bind(value: T): ScopeValuePair<T> {
    return [this, value];
  }
  toString(): string {
    const { id, debugLabel } = this;
    return `[Scope:${id}${debugLabel && ` - ${debugLabel}`}]`;
  }
}

export type HashFn<T> = (value: T) => unknown;
export type ScopeValuePair<T> = [Scope<T>, T];

abstract class RefCounter {
  #count: number = 0;
  abstract dispose(): void;
  add(): void {
    ++this.#count;
  }
  sub(): void {
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
  private static counter: number = 0;
  readonly id: string = String(ScopeInstance.counter++);
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

const noop = () => {};

export interface BunjaDevtoolsGlobalHook {
  stores: Record<string, BunjaStore>;
  listeners: Record<
    BunjaDevtoolsEventType,
    Set<(event: any) => void>
  >;
  emit<T extends BunjaDevtoolsEventType>(
    type: T,
    event: BunjaDevtoolsEvent[T],
  ): void;
  on<T extends BunjaDevtoolsEventType>(
    type: T,
    listener: (event: BunjaDevtoolsEvent[T]) => void,
  ): () => void;
}
export interface BunjaDevtoolsEvent {
  storeCreated: { storeId: string };
  storeDisposed: { storeId: string };
  getCalled: { storeId: string; bunjaInstanceId: string };
  bunjaInstanceMounted: { storeId: string; bunjaInstanceId: string };
  bunjaInstanceUnmounted: { storeId: string; bunjaInstanceId: string };
  scopeInstanceMounted: {
    storeId: string;
    scope: Scope<unknown>;
    key: unknown;
  };
  scopeInstanceUnmounted: {
    storeId: string;
    scope: Scope<unknown>;
    key: unknown;
  };
}
export type BunjaDevtoolsEventType = keyof BunjaDevtoolsEvent;
let devtoolsGlobalHook: BunjaDevtoolsGlobalHook;
if (__DEV__) {
  if ((globalThis as any).__BUNJA_DEVTOOLS_GLOBAL_HOOK__) {
    devtoolsGlobalHook = (globalThis as any).__BUNJA_DEVTOOLS_GLOBAL_HOOK__;
  } else {
    devtoolsGlobalHook = {
      stores: {},
      listeners: {
        storeCreated: new Set(),
        storeDisposed: new Set(),
        getCalled: new Set(),
        bunjaInstanceMounted: new Set(),
        bunjaInstanceUnmounted: new Set(),
        scopeInstanceMounted: new Set(),
        scopeInstanceUnmounted: new Set(),
      },
      emit: (type, event) => {
        for (const fn of devtoolsGlobalHook.listeners[type]) fn(event);
      },
      on: (type, listener) => {
        devtoolsGlobalHook.listeners[type].add(listener);
        return () => devtoolsGlobalHook.listeners[type].delete(listener);
      },
    };
    (globalThis as any).__BUNJA_DEVTOOLS_GLOBAL_HOOK__ = devtoolsGlobalHook;
  }
}
