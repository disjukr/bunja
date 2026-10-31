// @ts-ignore dev
const __DEV__ = process.env.NODE_ENV !== "production";

export interface BunjaFn {
  <T>(init: () => T): Bunja<T, undefined>;
  withSeed: BunjaWithSeedFn;
  use: BunjaUseFn;
  will: BunjaWillFn;
  effect: BunjaEffectFn;
}
export const bunja: BunjaFn = bunjaFn;
function bunjaFn<T>(init: () => T): Bunja<T, undefined> {
  return new Bunja(() => init(), undefined);
}

export type BunjaWithSeedFn = <Seed, T>(
  defaultSeed: Seed,
  init: (seed: Seed) => T,
) => Bunja<T, Seed>;
bunjaFn.withSeed = function withSeed<Seed, T>(
  defaultSeed: Seed,
  init: (seed: Seed) => T,
): Bunja<T, Seed> {
  return new Bunja(init, defaultSeed);
};
bunjaFn.use =
  ((dep: unknown, scopeValuePairs?: ScopeValuePairs) =>
    (getCurrentFrame("`bunja.use`").use as (
      dep: unknown,
      scopeValuePairs?: ScopeValuePairs,
    ) => unknown)(
      dep,
      scopeValuePairs,
    )) as BunjaUseFn;
bunjaFn.will =
  ((dep: unknown, scopeValuePairs?: ScopeValuePairs) =>
    (getCurrentFrame("`bunja.will`").will as (
      dep: unknown,
      scopeValuePairs?: ScopeValuePairs,
    ) => unknown)(
      dep,
      scopeValuePairs,
    )) as BunjaWillFn;
bunjaFn.effect =
  ((callback: BunjaEffectCallback) =>
    getCurrentFrame("`bunja.effect`").effect(callback)) as BunjaEffectFn;

export type ScopeValuePairs = ScopeValuePair<any>[];
export interface BunjaUseFn {
  <T>(dep: Scope<T>): T;
  <T, Seed>(dep: Bunja<T, Seed>): T;
  <T, Seed>(bunja: Bunja<T, Seed>, scopeValuePairs: ScopeValuePairs): T;
  <T, Seed>(ref: BunjaRef<T, Seed>): T;
}
export interface BunjaWillFn {
  <T, Seed>(dep: Bunja<T, Seed>): () => T;
  <T, Seed>(
    bunja: Bunja<T, Seed>,
    scopeValuePairs: ScopeValuePairs,
  ): () => T;
  <T, Seed>(ref: BunjaRef<T, Seed>): () => T;
}
export type BunjaEffectFn = (callback: BunjaEffectCallback) => void;
export type BunjaEffectCallback = () => (() => void) | void;

export interface BunjaRef<T, Seed = undefined> extends BunjaRefBase<T, Seed> {
  seed?: [Seed] extends [undefined] ? never : Seed;
}
export type BunjaGetRef<T, Seed = undefined> = BunjaRef<T, Seed>;
export interface BunjaPrebakeRef<T, Seed> extends BunjaRefBase<T, Seed> {
  seed?: never;
}
interface BunjaRefBase<T, Seed> {
  bunja: Bunja<T, Seed>;
  with?: ScopeValuePairs;
}

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

export type Dep<T> = Bunja<T, any> | Scope<T>;

type AnyBunja = Bunja<any, any>;
type ScopeInstanceMap = Map<Scope<unknown>, ScopeInstance>;

interface BunjaFrame {
  use: BunjaUseFn;
  will: BunjaWillFn;
  effect: BunjaEffectFn;
}

const frameStack: BunjaFrame[] = [];
function getCurrentFrame(api: string): BunjaFrame {
  const frame = frameStack[frameStack.length - 1];
  if (!frame) {
    throw new Error(`${api} can only be used inside a bunja init function.`);
  }
  return frame;
}

function runWithFrame<T>(frame: BunjaFrame, fn: () => T): T {
  frameStack.push(frame);
  try {
    return fn();
  } finally {
    frameStack.pop();
  }
}

interface InternalState {
  bunjas: Record<string, BunjaInstance>;
  scopes: Map<Scope<unknown>, Map<unknown, ScopeInstance>>;
  instantiating: boolean;
}

interface BunjaInitFrame extends BunjaFrame {
  currentBunja: AnyBunja;
  readScope: ReadScope;
  scopeInstanceMap: ScopeInstanceMap;
  inProgressBunjas: Set<AnyBunja>;
  effects: BunjaEffectCallback[];
  activeDependencyIds: Set<string>;
  activeDependencyRecipes: ActiveDependencyRecipe[];
  activeDependencyMounts: Map<string, () => () => void>;
  activeDependencyDeps: ScopeInstance[];
}

interface BunjaPrebakeFrame extends BunjaFrame {
  currentBunja: AnyBunja;
  readScope: ReadScope;
  prebakeContext: BunjaPrebakeContext;
}

interface BunjaPrebakeContext {
  inProgressBunjas: Set<AnyBunja>;
  values: Map<AnyBunja, unknown>;
}

type AnyNormalizedBunjaRef = NormalizedBunjaRef<any, any>;
interface NormalizedBunjaRef<T, Seed> {
  bunja: Bunja<T, Seed>;
  scopeValuePairs: ScopeValuePairs;
}

interface NormalizedBunjaRuntimeRef<T, Seed>
  extends NormalizedBunjaRef<T, Seed> {
  seed: Seed;
}

interface ActiveDependencyRecipe {
  ref: AnyNormalizedBunjaRef;
  seed: unknown;
}

interface BunjaInstanceRecipe {
  activeDependencyIds: string[];
  activeDependencies: ActiveDependencyRecipe[];
}

interface ResolvedBunja<T> {
  value: T;
  instance: BunjaInstance;
  mount: () => () => void;
  deps: ScopeInstance[];
}

interface ResolvedActiveDependencyRecipe {
  activeDependencyIds: Set<string>;
  deps: ScopeInstance[];
}

export type WrapInstanceFn = <T>(fn: (dispose: () => void) => T) => T;
const defaultWrapInstanceFn: WrapInstanceFn = (fn) => fn(noop);

function normalizeBunjaRuntimeRef<T, Seed>(
  bunjaOrRef: Bunja<T, Seed> | BunjaRef<T, Seed>,
  scopeValuePairs: ScopeValuePairs = [],
): NormalizedBunjaRuntimeRef<T, Seed> {
  if (bunjaOrRef instanceof Bunja) {
    return {
      bunja: bunjaOrRef,
      scopeValuePairs,
      seed: bunjaOrRef.defaultSeed,
    };
  }
  const { bunja, with: refScopeValuePairs = [] } = bunjaOrRef;
  return {
    bunja,
    scopeValuePairs: refScopeValuePairs,
    seed: "seed" in bunjaOrRef ? (bunjaOrRef.seed as Seed) : bunja.defaultSeed,
  };
}

function normalizeBunjaPrebakeRef<T, Seed>(
  bunjaOrRef: Bunja<T, Seed> | BunjaPrebakeRef<T, Seed>,
): NormalizedBunjaRef<T, Seed> {
  if (bunjaOrRef instanceof Bunja) {
    return {
      bunja: bunjaOrRef,
      scopeValuePairs: [],
    };
  }
  if ("seed" in bunjaOrRef) {
    throw new Error("A bunja seed cannot be provided to `store.prebake`.");
  }
  const { bunja, with: refScopeValuePairs = [] } = bunjaOrRef;
  return {
    bunja,
    scopeValuePairs: refScopeValuePairs,
  };
}

function toBunjaGraphRef<T, Seed>(
  bunjaRef: NormalizedBunjaRef<T, Seed>,
): NormalizedBunjaRef<T, Seed> {
  return {
    bunja: bunjaRef.bunja,
    scopeValuePairs: bunjaRef.scopeValuePairs.map(([scope, value]) => [scope, value]),
  };
}

function isBunjaRef(value: unknown): value is BunjaRef<any, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    "bunja" in value &&
    (value as { bunja: unknown }).bunja instanceof Bunja
  );
}

function getBoundScopeSet(
  scopeValuePairs: ScopeValuePairs,
): Set<Scope<unknown>> {
  return new Set(
    scopeValuePairs.map(([scope]) => scope as Scope<unknown>),
  );
}

function getScopeInstances(
  scopes: Scope<unknown>[],
  scopeInstanceMap: ScopeInstanceMap,
): ScopeInstance[] {
  return scopes.map((scope) => scopeInstanceMap.get(scope)!);
}

function dedupeScopeInstances(
  scopeInstances: ScopeInstance[],
): ScopeInstance[] {
  const seen = new Set<string>();
  const result: ScopeInstance[] = [];
  for (const scopeInstance of scopeInstances) {
    if (seen.has(scopeInstance.id)) continue;
    seen.add(scopeInstance.id);
    result.push(scopeInstance);
  }
  return result;
}

function dedupeBunjas(bunjas: AnyBunja[]): AnyBunja[] {
  return Array.from(new Set(bunjas));
}

function addUniqueBunjaRef(
  refs: AnyNormalizedBunjaRef[],
  ref: AnyNormalizedBunjaRef,
): void {
  if (!refs.includes(ref)) refs.push(ref);
}

function createBunjaPrebakeContext(): BunjaPrebakeContext {
  return {
    inProgressBunjas: new Set(),
    values: new Map(),
  };
}

export class BunjaStore {
  private static counter: number = 0;
  readonly id: string = String(BunjaStore.counter++);
  #bunjas: Record<string, BunjaInstance> = {};
  #bunjaBuckets: Map<string, Set<string>> = new Map();
  #scopes: Map<Scope<unknown>, Map<unknown, ScopeInstance>> = new Map();
  #graphs = new Map<AnyBunja, BunjaGraph>();
  #graph = (bunja: AnyBunja): BunjaGraph => {
    let graph = this.#graphs.get(bunja);
    if (!graph) {
      graph = new BunjaGraph(bunja, dependency => this.#graphs.get(dependency));
      this.#graphs.set(bunja, graph);
    }
    return graph;
  };
  #initializer<T, Seed>(bunja: Bunja<T, Seed>): (seed: Seed) => T {
    return bunja.init;
  }
  inspect(bunja: AnyBunja): BunjaGraphSnapshot {
    const graph = this.#graphs.get(bunja);
    const refs = (items: AnyNormalizedBunjaRef[]) => Object.freeze(
      items.map(ref => Object.freeze({
        bunja: ref.bunja,
        scopeValuePairs: Object.freeze(ref.scopeValuePairs.map(pair =>
          Object.freeze([...pair] as ScopeValuePair<any>)
        )),
      })),
    );
    return Object.freeze({
      storeId: this.id,
      bunjaId: bunja.id,
      baked: graph?.baked ?? false,
      scopes: Object.freeze(graph?.scopes ?? []),
      requiredBunjaRefs: refs(graph?.requiredBunjaRefs ?? []),
      optionalBunjaRefs: refs(graph?.optionalBunjaRefs ?? []),
      expandedRequiredBunjas: Object.freeze(graph?.baked ? [...graph.expandedRequiredBunjas] : []),
      relatedBunjas: Object.freeze(graph?.baked ? graph.relatedBunjas : []),
      requiredScopes: Object.freeze(graph?.baked ? [...graph.requiredScopes] : []),
    });
  }
  snapshot(): BunjaStoreSnapshot {
    return Object.freeze({
      storeId: this.id,
      graphs: Object.freeze(Array.from(this.#graphs.keys(), bunja => this.inspect(bunja))),
      instances: Object.freeze(Object.values(this.#bunjas).map(instance =>
        Object.freeze({
          id: instance.id,
          bunjaId: instance.baseId.split(":")[0],
          activeDependencyIds: Object.freeze([...instance.recipe.activeDependencyIds]),
        })
      )),
    });
  }
  #register(): void {
    if (!__DEV__ || devtoolsGlobalHook.stores.has(this.id)) return;
    devtoolsGlobalHook.stores.set(this.id, new WeakRef(this));
    storeFinalizer?.register(this, this.id, this);
    devtoolsGlobalHook.emit("storeCreated", { storeId: this.id });
  }
  wrapInstance: WrapInstanceFn = defaultWrapInstanceFn;
  constructor() {
    this.#register();
  }
  get _internalState(): InternalState | undefined {
    if (__DEV__) {
      return {
        bunjas: this.#bunjas,
        scopes: this.#scopes,
        get instantiating() {
          return frameStack.length > 0;
        },
      };
    }
    return undefined;
  }
  dispose(): void {
    for (const instance of Object.values(this.#bunjas)) instance.dispose();
    for (const instanceMap of this.#scopes.values()) {
      for (const instance of instanceMap.values()) instance.dispose();
    }
    this.#bunjas = {};
    this.#bunjaBuckets = new Map();
    this.#scopes = new Map();
    this.#graphs.clear();
    storeFinalizer?.unregister(this);
    if (__DEV__) {
      devtoolsGlobalHook.stores.delete(this.id);
      devtoolsGlobalHook.emit("storeDisposed", { storeId: this.id });
    }
  }
  get<T, Seed>(
    bunjaOrRef: Bunja<T, Seed> | BunjaGetRef<T, Seed>,
    readScope: ReadScope,
  ): BunjaStoreGetResult<T> {
    this.#register();
    const bunjaRef = normalizeBunjaRuntimeRef(bunjaOrRef);
    const resolved = this.#resolveBunjaRef(
      toBunjaGraphRef(bunjaRef),
      readScope,
      new Set(),
      bunjaRef.seed,
      true,
    );
    const result: BunjaStoreGetResult<T> = {
      value: resolved.value,
      mount: resolved.mount,
      deps: resolved.deps.map(({ value }) => value),
    };
    if (__DEV__) {
      result.bunjaInstance = resolved.instance;
      devtoolsGlobalHook.emit("getCalled", {
        storeId: this.id,
        bunjaInstanceId: resolved.instance.id,
      });
    }
    return result;
  }
  prebake<T, Seed>(
    bunjaOrRef: Bunja<T, Seed> | BunjaPrebakeRef<T, Seed>,
    readScope: ReadScope,
  ): BunjaStorePrebakeResult {
    this.#register();
    const bunjaRef = normalizeBunjaPrebakeRef(bunjaOrRef);
    this.#prebakeBunjaRef(
      bunjaRef,
      readScope,
      createBunjaPrebakeContext(),
    );
    const graph = this.#graph(bunjaRef.bunja);
    return {
      relatedBunjas: graph.relatedBunjas,
      requiredScopes: [...graph.requiredScopes],
    };
  }
  #resolveBunjaRef<T, Seed>(
    bunjaRef: NormalizedBunjaRef<T, Seed>,
    readScope: ReadScope,
    inProgressBunjas: Set<AnyBunja>,
    seed: Seed = bunjaRef.bunja.defaultSeed,
    includeBoundScopeDeps: boolean = false,
  ): ResolvedBunja<T> {
    const { bunja } = bunjaRef;
    if (inProgressBunjas.has(bunja)) {
      throw new Error("Circular bunja dependency detected.");
    }
    const resolvedReadScope = bunjaRef.scopeValuePairs.length > 0
      ? createReadScopeFn(bunjaRef.scopeValuePairs, readScope)
      : readScope;
    const wasBaked = this.#graph(bunja).baked;
    inProgressBunjas.add(bunja);
    try {
      if (!wasBaked) {
        return this.#createResolvedBunja(
          bunjaRef,
          resolvedReadScope,
          inProgressBunjas,
          seed,
          includeBoundScopeDeps,
        );
      }
      const scopeInstanceMap = this.#resolveScopeInstanceMap(
        bunja,
        resolvedReadScope,
      );
      const graph = this.#graph(bunja);
      const boundScopes = getBoundScopeSet(bunjaRef.scopeValuePairs);
      const scopeInstances = getScopeInstances(
        graph.requiredScopes,
        scopeInstanceMap,
      );
      const directDeps = getScopeInstances(
        includeBoundScopeDeps
          ? graph.requiredScopes
          : graph.requiredScopes.filter((scope) => !boundScopes.has(scope)),
        scopeInstanceMap,
      );
      const baseId = graph.calcBaseInstanceId(scopeInstanceMap);
      const bucket = this.#bunjaBuckets.get(baseId);
      if (bucket) {
        for (const candidateId of Array.from(bucket)) {
          const candidate = this.#bunjas[candidateId];
          if (!candidate) {
            bucket.delete(candidateId);
            continue;
          }
          const activeDeps = this.#resolveActiveDependencyRecipe(
            candidate.recipe,
            resolvedReadScope,
            inProgressBunjas,
          );
          const currentId = this.#graph(bunja).calcInstanceId(
            scopeInstanceMap,
            activeDeps.activeDependencyIds,
          );
          const instance = currentId === candidate.id
            ? candidate
            : this.#bunjas[currentId];
          if (!instance) continue;
          return this.#toResolvedBunja(
            instance,
            scopeInstances,
            directDeps,
            activeDeps.deps,
          );
        }
      }
      return this.#createResolvedBunja(
        bunjaRef,
        resolvedReadScope,
        inProgressBunjas,
        seed,
        includeBoundScopeDeps,
        scopeInstanceMap,
      );
    } catch (error) {
      if (!wasBaked && !this.#graphs.get(bunja)?.baked) {
        this.#graphs.delete(bunja);
        if (__DEV__) {
          devtoolsGlobalHook.emit("graphChanged", { storeId: this.id, bunjaId: bunja.id });
        }
      }
      throw error;
    } finally {
      inProgressBunjas.delete(bunja);
      if (__DEV__ && !wasBaked && this.#graphs.get(bunja)?.baked) {
        devtoolsGlobalHook.emit("graphChanged", { storeId: this.id, bunjaId: bunja.id });
      }
    }
  }
  #createResolvedBunja<T, Seed>(
    bunjaRef: NormalizedBunjaRef<T, Seed>,
    readScope: ReadScope,
    inProgressBunjas: Set<AnyBunja>,
    seed: Seed,
    includeBoundScopeDeps: boolean,
    initialScopeInstanceMap: ScopeInstanceMap = new Map(),
  ): ResolvedBunja<T> {
    const { bunja } = bunjaRef;
    return this.wrapInstance((dispose) => {
      let instanceCreated = false;
      let disposed = false;
      const disposeOnce = () => {
        if (disposed) return;
        disposed = true;
        dispose();
      };
      try {
        const frame = this.#createInitFrame(
          bunja,
          readScope,
          initialScopeInstanceMap,
          inProgressBunjas,
        );
        const value = runWithFrame(frame, () => this.#initializer(bunja)(seed));
        let graph = this.#graph(bunja);
        if (!graph.baked) graph.bake();
        this.#ensureRequiredScopeInstances(
          bunja,
          frame.scopeInstanceMap,
          readScope,
        );
        // Scope readers can reenter the store and replace its graph.
        graph = this.#graph(bunja);
        const boundScopes = getBoundScopeSet(bunjaRef.scopeValuePairs);
        const scopeInstances = getScopeInstances(
          graph.requiredScopes,
          frame.scopeInstanceMap,
        );
        const directDeps = getScopeInstances(
          includeBoundScopeDeps
            ? graph.requiredScopes
            : graph.requiredScopes.filter((scope) => !boundScopes.has(scope)),
          frame.scopeInstanceMap,
        );
        const baseId = graph.calcBaseInstanceId(frame.scopeInstanceMap);
        const id = graph.calcInstanceId(
          frame.scopeInstanceMap,
          frame.activeDependencyIds,
        );
        const existing = this.#bunjas[id];
        if (existing) {
          disposeOnce();
          return this.#toResolvedBunja(
            existing,
            scopeInstances,
            directDeps,
            frame.activeDependencyDeps,
          );
        }
        const instance = this.#createBunjaInstance(
          id,
          baseId,
          value,
          Array.from(frame.activeDependencyMounts.values()),
          frame.effects,
          {
            activeDependencies: frame.activeDependencyRecipes,
            activeDependencyIds: [...frame.activeDependencyIds],
          },
          dispose,
        );
        instanceCreated = true;
        return this.#toResolvedBunja(
          instance,
          scopeInstances,
          directDeps,
          frame.activeDependencyDeps,
        );
      } finally {
        if (!instanceCreated) disposeOnce();
      }
    });
  }
  #toResolvedBunja<T>(
    instance: BunjaInstance,
    scopeInstances: ScopeInstance[],
    directDeps: ScopeInstance[],
    activeDependencyDeps: ScopeInstance[],
  ): ResolvedBunja<T> {
    const deps = dedupeScopeInstances([
      ...directDeps,
      ...activeDependencyDeps,
    ]);
    return {
      value: instance.value as T,
      instance,
      deps,
      mount: () => {
        for (const scopeInstance of scopeInstances) scopeInstance.add();
        instance.add();
        return () => {
          instance.sub();
          for (const scopeInstance of scopeInstances) scopeInstance.sub();
        };
      },
    };
  }
  #createInitFrame(
    currentBunja: AnyBunja,
    readScope: ReadScope,
    scopeInstanceMap: ScopeInstanceMap,
    inProgressBunjas: Set<AnyBunja>,
  ): BunjaInitFrame {
    const frame = {
      currentBunja,
      readScope,
      scopeInstanceMap,
      inProgressBunjas,
      effects: [] as BunjaEffectCallback[],
      activeDependencyIds: new Set<string>(),
      activeDependencyRecipes: [] as ActiveDependencyRecipe[],
      activeDependencyMounts: new Map<string, () => () => void>(),
      activeDependencyDeps: [] as ScopeInstance[],
      use: ((dep: unknown, scopeValuePairs?: ScopeValuePairs) => {
        if (dep instanceof Scope) {
          return this.#useScopeInFrame(frame, dep as Scope<unknown>);
        }
        if (dep instanceof Bunja || isBunjaRef(dep)) {
          const bunjaRef = normalizeBunjaRuntimeRef(dep, scopeValuePairs);
          const graphRef = toBunjaGraphRef(bunjaRef);
          this.#graph(currentBunja).addRequiredBunjaRef(graphRef);
          return this.#useBunjaDependencyInFrame(frame, bunjaRef);
        }
        throw new Error("`bunja.use` can only be used with Bunja or Scope.");
      }) as BunjaUseFn,
      will: ((dep: unknown, scopeValuePairs?: ScopeValuePairs) => {
        if (!(dep instanceof Bunja || isBunjaRef(dep))) {
          throw new Error("`bunja.will` can only be used with Bunja.");
        }
        const bunjaRef = normalizeBunjaRuntimeRef(dep, scopeValuePairs);
        const graphRef = toBunjaGraphRef(bunjaRef);
        this.#graph(currentBunja).addOptionalBunjaRef(graphRef);
        return () => {
          if (frameStack[frameStack.length - 1] !== frame) {
            throw new Error(
              "A thunk returned by `bunja.will` can only be called inside the same bunja init function.",
            );
          }
          return this.#useBunjaDependencyInFrame(frame, bunjaRef);
        };
      }) as BunjaWillFn,
      effect: ((callback: BunjaEffectCallback) => {
        frame.effects.push(callback);
      }) as BunjaEffectFn,
    } satisfies BunjaInitFrame;
    return frame;
  }
  #useScopeInFrame<T>(frame: BunjaInitFrame, scope: Scope<T>): T {
    const graph = this.#graph(frame.currentBunja);
    graph.addScope(scope as Scope<unknown>);
    let scopeInstance = frame.scopeInstanceMap.get(scope as Scope<unknown>);
    if (!scopeInstance) {
      if (graph.baked) {
        throw new Error(
          "`bunja.use(scope)` cannot introduce a new scope after the bunja is baked.",
        );
      }
      scopeInstance = this.#getScopeInstance(
        scope as Scope<unknown>,
        frame.readScope(scope),
      );
      frame.scopeInstanceMap.set(scope as Scope<unknown>, scopeInstance);
    }
    return scopeInstance.value as T;
  }
  #useBunjaDependencyInFrame<T, Seed>(
    frame: BunjaInitFrame,
    bunjaRef: NormalizedBunjaRuntimeRef<T, Seed>,
  ): T {
    const graphRef = toBunjaGraphRef(bunjaRef);
    const resolved = this.#resolveBunjaRef(
      graphRef,
      frame.readScope,
      frame.inProgressBunjas,
      bunjaRef.seed,
    );
    frame.activeDependencyIds.add(resolved.instance.id);
    frame.activeDependencyRecipes.push({
      ref: graphRef,
      seed: bunjaRef.seed,
    });
    if (!frame.activeDependencyMounts.has(resolved.instance.id)) {
      frame.activeDependencyMounts.set(resolved.instance.id, resolved.mount);
    }
    frame.activeDependencyDeps.push(...resolved.deps);
    return resolved.value;
  }
  #resolveActiveDependencyRecipe(
    recipe: BunjaInstanceRecipe,
    readScope: ReadScope,
    inProgressBunjas: Set<AnyBunja>,
  ): ResolvedActiveDependencyRecipe {
    const activeDependencyIds = new Set<string>();
    const deps: ScopeInstance[] = [];
    for (const { ref, seed } of recipe.activeDependencies) {
      const resolved = this.#resolveBunjaRef(
        ref,
        readScope,
        inProgressBunjas,
        seed,
      );
      activeDependencyIds.add(resolved.instance.id);
      deps.push(...resolved.deps);
    }
    return {
      activeDependencyIds,
      deps: dedupeScopeInstances(deps),
    };
  }
  #prebakeBunjaRef<T, Seed>(
    bunjaRef: NormalizedBunjaRef<T, Seed>,
    readScope: ReadScope,
    prebakeContext: BunjaPrebakeContext,
  ): T {
    const { bunja } = bunjaRef;
    if (prebakeContext.values.has(bunja)) {
      return prebakeContext.values.get(bunja) as T;
    }
    const { inProgressBunjas } = prebakeContext;
    if (inProgressBunjas.has(bunja)) {
      throw new Error("Circular bunja dependency detected.");
    }
    const resolvedReadScope = bunjaRef.scopeValuePairs.length > 0
      ? createReadScopeFn(bunjaRef.scopeValuePairs, readScope)
      : readScope;
    const wasBaked = this.#graph(bunja).baked;
    inProgressBunjas.add(bunja);
    try {
      return this.wrapInstance((dispose) => {
        try {
          const frame = this.#createPrebakeFrame(
            bunja,
            resolvedReadScope,
            prebakeContext,
          );
          const value = runWithFrame(
            frame,
            () => this.#initializer(bunja)(bunja.defaultSeed),
          );
          const graph = this.#graph(bunja);
          if (!graph.baked) graph.bake();
          for (
            const ref of [
              ...graph.requiredBunjaRefs,
              ...graph.optionalBunjaRefs,
            ]
          ) this.#prebakeBunjaRef(ref, resolvedReadScope, prebakeContext);
          prebakeContext.values.set(bunja, value);
          return value;
        } finally {
          dispose();
        }
      });
    } catch (error) {
      if (!wasBaked && !this.#graphs.get(bunja)?.baked) {
        this.#graphs.delete(bunja);
        if (__DEV__) {
          devtoolsGlobalHook.emit("graphChanged", { storeId: this.id, bunjaId: bunja.id });
        }
      }
      throw error;
    } finally {
      inProgressBunjas.delete(bunja);
      if (__DEV__ && !wasBaked && this.#graphs.get(bunja)?.baked) {
        devtoolsGlobalHook.emit("graphChanged", { storeId: this.id, bunjaId: bunja.id });
      }
    }
  }
  #createPrebakeFrame(
    currentBunja: AnyBunja,
    readScope: ReadScope,
    prebakeContext: BunjaPrebakeContext,
  ): BunjaPrebakeFrame {
    const frame = {
      currentBunja,
      readScope,
      prebakeContext,
      use: ((dep: unknown, scopeValuePairs?: ScopeValuePairs) => {
        if (dep instanceof Scope) {
          this.#graph(currentBunja).addScope(dep as Scope<unknown>);
          return readScope(dep as Scope<unknown>);
        }
        if (dep instanceof Bunja || isBunjaRef(dep)) {
          const bunjaRef = toBunjaGraphRef(
            normalizeBunjaRuntimeRef(dep, scopeValuePairs),
          );
          this.#graph(currentBunja).addRequiredBunjaRef(bunjaRef);
          return this.#prebakeBunjaRef(
            bunjaRef,
            readScope,
            prebakeContext,
          );
        }
        throw new Error("`bunja.use` can only be used with Bunja or Scope.");
      }) as BunjaUseFn,
      will: ((dep: unknown, scopeValuePairs?: ScopeValuePairs) => {
        if (!(dep instanceof Bunja || isBunjaRef(dep))) {
          throw new Error("`bunja.will` can only be used with Bunja.");
        }
        const bunjaRef = toBunjaGraphRef(
          normalizeBunjaRuntimeRef(dep, scopeValuePairs),
        );
        this.#graph(currentBunja).addOptionalBunjaRef(bunjaRef);
        const value = this.#prebakeBunjaRef(
          bunjaRef,
          readScope,
          prebakeContext,
        );
        return () => {
          if (frameStack[frameStack.length - 1] !== frame) {
            throw new Error(
              "A thunk returned by `bunja.will` can only be called inside the same bunja init function.",
            );
          }
          return value;
        };
      }) as BunjaWillFn,
      effect: noop,
    } satisfies BunjaPrebakeFrame;
    return frame;
  }
  #resolveScopeInstanceMap(
    bunja: AnyBunja,
    readScope: ReadScope,
  ): ScopeInstanceMap {
    const scopeInstanceMap: ScopeInstanceMap = new Map();
    this.#ensureRequiredScopeInstances(bunja, scopeInstanceMap, readScope);
    return scopeInstanceMap;
  }
  #ensureRequiredScopeInstances(
    bunja: AnyBunja,
    scopeInstanceMap: ScopeInstanceMap,
    readScope: ReadScope,
  ): void {
    for (const scope of this.#graph(bunja).requiredScopes) {
      if (scopeInstanceMap.has(scope)) continue;
      scopeInstanceMap.set(
        scope,
        this.#getScopeInstance(scope, readScope(scope)),
      );
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
    baseId: string,
    value: unknown,
    dependencyMounts: (() => () => void)[],
    effects: BunjaEffectCallback[],
    recipe: BunjaInstanceRecipe,
    dispose: () => void,
  ): BunjaInstance {
    const bunjaInstance = new BunjaInstance(
      id,
      baseId,
      value,
      dependencyMounts,
      effects,
      recipe,
      () => {
        if (__DEV__) {
          devtoolsGlobalHook.emit("bunjaInstanceUnmounted", {
            storeId: this.id,
            bunjaInstanceId: id,
          });
        }
        dispose();
        delete this.#bunjas[id];
        const bucket = this.#bunjaBuckets.get(baseId);
        bucket?.delete(id);
        if (bucket?.size === 0) this.#bunjaBuckets.delete(baseId);
      },
    );
    this.#bunjas[id] = bunjaInstance;
    const bucket = this.#bunjaBuckets.get(baseId) ??
      this.#bunjaBuckets.set(baseId, new Set()).get(baseId)!;
    bucket.add(id);
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

export interface BunjaStorePrebakeResult {
  relatedBunjas: Bunja<any, any>[];
  requiredScopes: Scope<unknown>[];
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

export class Bunja<T, Seed = undefined> {
  private static counter: number = 0;
  readonly id: string = String(Bunja.counter++);
  debugLabel: string = "";
  constructor(
    public init: (seed: Seed) => T,
    public defaultSeed: Seed,
  ) {
    if (__DEV__) {
      devtoolsGlobalHook.bunjas[this.id] = this;
      devtoolsGlobalHook.emit("bunjaCreated", { bunjaId: this.id });
    }
  }
  toString(): string {
    const { id, debugLabel } = this;
    return `[Bunja:${id}${debugLabel && ` - ${debugLabel}`}]`;
  }
}

class BunjaGraph {
  #phase: BunjaPhase = {
    baked: false,
    requiredBunjaRefs: [],
    optionalBunjaRefs: [],
    scopes: new Set(),
  };
  constructor(
    readonly bunja: AnyBunja,
    private readonly graph: (bunja: AnyBunja) => BunjaGraph | undefined,
  ) {}
  get scopes(): Scope<unknown>[] {
    return Array.from(this.#phase.scopes);
  }
  get baked(): boolean {
    return this.#phase.baked;
  }
  get requiredBunjas(): AnyBunja[] {
    return dedupeBunjas(
      this.#phase.requiredBunjaRefs.map(({ bunja }) => bunja),
    );
  }
  get optionalBunjas(): AnyBunja[] {
    return dedupeBunjas(
      this.#phase.optionalBunjaRefs.map(({ bunja }) => bunja),
    );
  }
  get requiredBunjaRefs(): AnyNormalizedBunjaRef[] {
    return this.#phase.requiredBunjaRefs;
  }
  get optionalBunjaRefs(): AnyNormalizedBunjaRef[] {
    return this.#phase.optionalBunjaRefs;
  }
  get expandedRequiredBunjas(): AnyBunja[] {
    if (!this.#phase.baked) throw new Error("Bunja is not baked yet.");
    return this.#phase.expandedRequiredBunjas;
  }
  get relatedBunjas(): AnyBunja[] {
    if (!this.#phase.baked) throw new Error("Bunja is not baked yet.");
    return toposort([
      ...this.requiredBunjas,
      ...this.optionalBunjas,
    ], (bunja) => [
      ...(this.graph(bunja)?.requiredBunjas ?? []),
      ...(this.graph(bunja)?.optionalBunjas ?? []),
    ]);
  }
  get requiredScopes(): Scope<unknown>[] {
    if (!this.#phase.baked) throw new Error("Bunja is not baked yet.");
    return this.#phase.requiredScopes;
  }
  addRequiredBunjaRef(ref: AnyNormalizedBunjaRef): void {
    if (this.#phase.baked) {
      this.#checkRef(this.requiredBunjaRefs, ref);
      return;
    }
    addUniqueBunjaRef(this.#phase.requiredBunjaRefs, ref);
  }
  addOptionalBunjaRef(ref: AnyNormalizedBunjaRef): void {
    if (this.#phase.baked) {
      this.#checkRef(this.optionalBunjaRefs, ref);
      return;
    }
    addUniqueBunjaRef(this.#phase.optionalBunjaRefs, ref);
  }
  #checkRef(refs: AnyNormalizedBunjaRef[], ref: AnyNormalizedBunjaRef): void {
    if (!refs.some(known => known.bunja === ref.bunja &&
      known.scopeValuePairs.length === ref.scopeValuePairs.length &&
      known.scopeValuePairs.every(([scope], i) => scope === ref.scopeValuePairs[i][0]))) {
      throw new Error("Cannot introduce a new dependency after the bunja is baked.");
    }
  }
  addScope(scope: Scope<unknown>): void {
    if (this.#phase.baked) {
      if (!this.#phase.scopes.has(scope)) {
        throw new Error("Cannot introduce a new scope after the bunja is baked.");
      }
      return;
    }
    this.#phase.scopes.add(scope);
  }
  bake(): void {
    if (this.#phase.baked) throw new Error("Bunja is already baked.");
    const scopes = this.#phase.scopes;
    const requiredBunjaRefs = this.#phase.requiredBunjaRefs;
    const optionalBunjaRefs = this.#phase.optionalBunjaRefs;
    const requiredBunjas = this.requiredBunjas;
    const expandedRequiredBunjas = toposort(
      requiredBunjas,
      (bunja) => this.graph(bunja)?.requiredBunjas ?? [],
    );
    const requiredScopeSet = new Set<Scope<unknown>>();
    for (const ref of requiredBunjaRefs) {
      const boundScopes = getBoundScopeSet(ref.scopeValuePairs);
      for (const scope of this.graph(ref.bunja)!.requiredScopes) {
        if (!boundScopes.has(scope)) requiredScopeSet.add(scope);
      }
    }
    for (const scope of scopes) requiredScopeSet.add(scope);
    const requiredScopes = Array.from(requiredScopeSet);
    this.#phase = {
      baked: true,
      requiredBunjaRefs,
      optionalBunjaRefs,
      expandedRequiredBunjas,
      requiredScopes,
      scopes,
    };
  }
  calcBaseInstanceId(
    scopeInstanceMap: Map<Scope<unknown>, ScopeInstance>,
  ): string {
    const scopeInstanceIds = this.requiredScopes.map(
      (scope) => scopeInstanceMap.get(scope)!.id,
    );
    return `${this.bunja.id}:${scopeInstanceIds.join(",")}`;
  }
  calcInstanceId(
    scopeInstanceMap: Map<Scope<unknown>, ScopeInstance>,
    activeDependencyIds: Iterable<string> = [],
  ): string {
    return `${this.calcBaseInstanceId(scopeInstanceMap)}:${
      Array.from(activeDependencyIds).join(",")
    }`;
  }
}

type BunjaPhase = BunjaPhaseUnbaked | BunjaPhaseBaked;

interface BunjaPhaseUnbaked {
  readonly baked: false;
  readonly requiredBunjaRefs: AnyNormalizedBunjaRef[];
  readonly optionalBunjaRefs: AnyNormalizedBunjaRef[];
  readonly scopes: Set<Scope<unknown>>;
}

interface BunjaPhaseBaked {
  readonly scopes: Set<Scope<unknown>>;
  readonly baked: true;
  readonly requiredBunjaRefs: AnyNormalizedBunjaRef[];
  readonly optionalBunjaRefs: AnyNormalizedBunjaRef[];
  readonly expandedRequiredBunjas: AnyBunja[];
  readonly requiredScopes: Scope<unknown>[];
}

export class Scope<T> {
  private static counter: number = 0;
  readonly id: string = String(Scope.counter++);
  debugLabel: string = "";
  constructor(public readonly hash: HashFn<T> = Scope.identity) {
    if (__DEV__) {
      devtoolsGlobalHook.scopes[this.id] = this;
      devtoolsGlobalHook.emit("scopeCreated", { scopeId: this.id });
    }
  }
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
  #disposed = false;
  constructor(
    public readonly id: string,
    public readonly baseId: string,
    public readonly value: unknown,
    private readonly dependencyMounts: (() => () => void)[],
    private readonly effects: BunjaEffectCallback[],
    public readonly recipe: BunjaInstanceRecipe,
    private readonly _dispose: () => void,
  ) {
    super();
  }
  override dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#cleanup?.();
    this.#cleanup = undefined;
    this._dispose();
  }
  override add(): void {
    this.#cleanup ??= this.#mount();
    super.add();
  }
  #mount(): () => void {
    const dependencyCleanups = this.dependencyMounts.map((mount) => mount());
    const effectCleanups = this.effects
      .map((effect) => effect())
      .filter(Boolean) as (() => void)[];
    return () => {
      for (const cleanup of dependencyCleanups) cleanup();
      for (const cleanup of effectCleanups) cleanup();
    };
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

function toposort<T>(nodes: T[], getDependencies: (node: T) => T[]): T[] {
  const visited = new Set<T>();
  const result: T[] = [];
  function visit(current: T) {
    if (visited.has(current)) return;
    visited.add(current);
    for (const dependency of getDependencies(current)) visit(dependency);
    result.push(current);
  }
  for (const node of nodes) visit(node);
  return result;
}
const noop = () => {};

export interface BunjaGraphSnapshot {
  readonly storeId: string;
  readonly bunjaId: string;
  readonly baked: boolean;
  readonly scopes: readonly Scope<unknown>[];
  readonly requiredScopes: readonly Scope<unknown>[];
  readonly expandedRequiredBunjas: readonly AnyBunja[];
  readonly relatedBunjas: readonly AnyBunja[];
  readonly requiredBunjaRefs: readonly BunjaGraphRefSnapshot[];
  readonly optionalBunjaRefs: readonly BunjaGraphRefSnapshot[];
}
export interface BunjaGraphRefSnapshot {
  readonly bunja: AnyBunja;
  readonly scopeValuePairs: readonly (readonly [Scope<any>, any])[];
}
export interface BunjaStoreSnapshot {
  readonly storeId: string;
  readonly graphs: readonly BunjaGraphSnapshot[];
  readonly instances: readonly {
    readonly id: string;
    readonly bunjaId: string;
    readonly activeDependencyIds: readonly string[];
  }[];
}

export interface BunjaDevtoolsGlobalHook {
  stores: Map<string, WeakRef<BunjaStore>>;
  snapshot(): readonly BunjaStoreSnapshot[];
  bunjas: Record<string, Bunja<any, any>>;
  scopes: Record<string, Scope<any>>;
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
  graphChanged: { storeId: string; bunjaId: string };
  bunjaCreated: { bunjaId: string };
  scopeCreated: { scopeId: string };
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
const storeFinalizer = __DEV__ ? new FinalizationRegistry<string>((id) => {
  devtoolsGlobalHook.stores.delete(id);
}) : undefined;
if (__DEV__) {
  if ((globalThis as any).__BUNJA_DEVTOOLS_GLOBAL_HOOK__) {
    devtoolsGlobalHook = (globalThis as any).__BUNJA_DEVTOOLS_GLOBAL_HOOK__;
  } else {
    devtoolsGlobalHook = {
      stores: new Map(),
      snapshot: () => [],
      bunjas: {},
      scopes: {},
      listeners: {
        graphChanged: new Set(),
        bunjaCreated: new Set(),
        scopeCreated: new Set(),
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
  // Extend existing hooks without replacing listeners installed by older clients.
  devtoolsGlobalHook.stores ??= new Map();
  devtoolsGlobalHook.listeners.graphChanged ??= new Set();
  devtoolsGlobalHook.snapshot = () => Object.freeze(
    Array.from(devtoolsGlobalHook.stores, ([id, ref]) => {
      const store = ref.deref();
      if (!store) devtoolsGlobalHook.stores.delete(id);
      return store?.snapshot();
    }).filter((snapshot): snapshot is BunjaStoreSnapshot => snapshot !== undefined),
  );
}
