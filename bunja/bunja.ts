// @ts-ignore dev
// deno-lint-ignore no-process-global
const __DEV__ = process.env.NODE_ENV !== "production";

export interface BunjaFn {
  <T>(init: () => T): Bunja<T, NoSeed>;
  withSeed: BunjaWithSeedFn;
  use: BunjaUseFn;
  will: BunjaWillFn;
  effect: BunjaEffectFn;
}
export const bunja: BunjaFn = bunjaFn;
function bunjaFn<T>(init: () => T): Bunja<T, NoSeed> {
  return new Bunja(() => init(), NO_SEED);
}
const NO_SEED = Symbol("bunja.noSeed");
export type NoSeed = typeof NO_SEED;
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

export type BunjaWithSeedFn = <Seed, T>(
  defaultSeed: Seed,
  init: (seed: Seed) => T,
) => Bunja<T, Seed>;
export type ScopeValuePairs = ScopeValuePair<any>[];
type BunjaRefBase<T, Seed> = {
  bunja: Bunja<T, Seed>;
  with?: ScopeValuePairs;
};
export type BunjaGetRef<T, Seed = NoSeed> =
  & BunjaRefBase<T, Seed>
  & ([Seed] extends [NoSeed] ? { seed?: never } : { seed?: Seed });
export type BunjaRef<T, Seed = NoSeed> = BunjaGetRef<T, Seed>;
type BunjaPrebakeRef<T, Seed = NoSeed> = BunjaRefBase<T, Seed> & {
  seed?: never;
};
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
type BunjaDependencyEdge = "required" | "optional";

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
  inProgressBunjas: Set<AnyBunja>;
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
    scopeValuePairs: bunjaRef.scopeValuePairs,
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
  excludeScopes: Set<Scope<unknown>> = new Set(),
): ScopeInstance[] {
  return scopes
    .filter((scope) => !excludeScopes.has(scope))
    .map((scope) => scopeInstanceMap.get(scope)!);
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

export class BunjaStore {
  private static counter: number = 0;
  readonly id: string = String(BunjaStore.counter++);
  #bunjas: Record<string, BunjaInstance> = {};
  #bunjaBuckets: Map<string, Set<string>> = new Map();
  #scopes: Map<Scope<unknown>, Map<unknown, ScopeInstance>> = new Map();
  wrapInstance: WrapInstanceFn = defaultWrapInstanceFn;
  constructor() {
    if (__DEV__) devtoolsGlobalHook.emit("storeCreated", { storeId: this.id });
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
    if (__DEV__) devtoolsGlobalHook.emit("storeDisposed", { storeId: this.id });
  }
  get<T, Seed>(
    bunjaOrRef: Bunja<T, Seed> | BunjaGetRef<T, Seed>,
    readScope: ReadScope,
  ): BunjaStoreGetResult<T> {
    const bunjaRef = normalizeBunjaRuntimeRef(bunjaOrRef);
    const resolved = this.#resolveBunjaRef(
      toBunjaGraphRef(bunjaRef),
      readScope,
      new Set(),
      bunjaRef.seed,
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
  ): BunjaStorePrebakeResult<T> {
    const bunjaRef = normalizeBunjaPrebakeRef(bunjaOrRef);
    const value = this.#prebakeBunjaRef(
      bunjaRef,
      readScope,
      new Set(),
    );
    return {
      value,
      relatedBunjas: bunjaRef.bunja.relatedBunjas,
      requiredScopes: bunjaRef.bunja.requiredScopes,
    };
  }
  #resolveBunjaRef<T, Seed>(
    bunjaRef: NormalizedBunjaRef<T, Seed>,
    readScope: ReadScope,
    inProgressBunjas: Set<AnyBunja>,
    seed: Seed = bunjaRef.bunja.defaultSeed,
  ): ResolvedBunja<T> {
    const { bunja } = bunjaRef;
    if (inProgressBunjas.has(bunja)) {
      throw new Error("Circular bunja dependency detected.");
    }
    const resolvedReadScope = bunjaRef.scopeValuePairs.length > 0
      ? createReadScopeFn(bunjaRef.scopeValuePairs, readScope)
      : readScope;
    inProgressBunjas.add(bunja);
    try {
      if (!bunja.baked) {
        return this.#createResolvedBunja(
          bunjaRef,
          resolvedReadScope,
          inProgressBunjas,
          seed,
        );
      }
      const scopeInstanceMap = this.#resolveScopeInstanceMap(
        bunja,
        resolvedReadScope,
      );
      const boundScopes = getBoundScopeSet(bunjaRef.scopeValuePairs);
      const scopeInstances = getScopeInstances(
        bunja.requiredScopes,
        scopeInstanceMap,
      );
      const directDeps = getScopeInstances(
        bunja.requiredScopes,
        scopeInstanceMap,
        boundScopes,
      );
      const baseId = bunja.calcBaseInstanceId(scopeInstanceMap);
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
          const currentId = bunja.calcInstanceId(
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
        scopeInstanceMap,
      );
    } finally {
      inProgressBunjas.delete(bunja);
    }
  }
  #createResolvedBunja<T, Seed>(
    bunjaRef: NormalizedBunjaRef<T, Seed>,
    readScope: ReadScope,
    inProgressBunjas: Set<AnyBunja>,
    seed: Seed,
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
        const value = runWithFrame(frame, () => bunja.init(seed));
        if (!bunja.baked) bunja.bake();
        this.#ensureRequiredScopeInstances(
          bunja,
          frame.scopeInstanceMap,
          readScope,
        );
        const boundScopes = getBoundScopeSet(bunjaRef.scopeValuePairs);
        const scopeInstances = getScopeInstances(
          bunja.requiredScopes,
          frame.scopeInstanceMap,
        );
        const directDeps = getScopeInstances(
          bunja.requiredScopes,
          frame.scopeInstanceMap,
          boundScopes,
        );
        const baseId = bunja.calcBaseInstanceId(frame.scopeInstanceMap);
        const id = bunja.calcInstanceId(
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
          { activeDependencies: frame.activeDependencyRecipes },
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
          return this.#useBunjaDependencyInFrame(
            frame,
            normalizeBunjaRuntimeRef(dep, scopeValuePairs),
            "required",
          );
        }
        throw new Error("`bunja.use` can only be used with Bunja or Scope.");
      }) as BunjaUseFn,
      will: ((dep: unknown, scopeValuePairs?: ScopeValuePairs) => {
        if (!(dep instanceof Bunja || isBunjaRef(dep))) {
          throw new Error("`bunja.will` can only be used with Bunja.");
        }
        const bunjaRef = normalizeBunjaRuntimeRef(dep, scopeValuePairs);
        currentBunja.addOptionalBunjaRef(toBunjaGraphRef(bunjaRef));
        return () => {
          if (frameStack[frameStack.length - 1] !== frame) {
            throw new Error(
              "A thunk returned by `bunja.will` can only be called inside the same bunja init function.",
            );
          }
          return this.#useBunjaDependencyInFrame(
            frame,
            bunjaRef,
            "optional",
          );
        };
      }) as BunjaWillFn,
      effect: ((callback: BunjaEffectCallback) => {
        frame.effects.push(callback);
      }) as BunjaEffectFn,
    } satisfies BunjaInitFrame;
    return frame;
  }
  #useScopeInFrame<T>(frame: BunjaInitFrame, scope: Scope<T>): T {
    if (!frame.currentBunja.baked) {
      frame.currentBunja.addScope(scope as Scope<unknown>);
    }
    let scopeInstance = frame.scopeInstanceMap.get(scope as Scope<unknown>);
    if (!scopeInstance) {
      if (frame.currentBunja.baked) {
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
    edge: BunjaDependencyEdge,
  ): T {
    const graphRef = toBunjaGraphRef(bunjaRef);
    if (edge === "optional" || graphRef.scopeValuePairs.length > 0) {
      frame.currentBunja.addOptionalBunjaRef(graphRef);
    } else if (edge === "required") {
      frame.currentBunja.addRequiredBunjaRef(graphRef);
    }
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
    inProgressBunjas: Set<AnyBunja>,
  ): T {
    const { bunja } = bunjaRef;
    if (inProgressBunjas.has(bunja)) {
      throw new Error("Circular bunja dependency detected.");
    }
    const resolvedReadScope = bunjaRef.scopeValuePairs.length > 0
      ? createReadScopeFn(bunjaRef.scopeValuePairs, readScope)
      : readScope;
    inProgressBunjas.add(bunja);
    try {
      return this.wrapInstance((dispose) => {
        try {
          const frame = this.#createPrebakeFrame(
            bunja,
            resolvedReadScope,
            inProgressBunjas,
          );
          const value = runWithFrame(
            frame,
            () => bunja.init(bunja.defaultSeed),
          );
          if (!bunja.baked) bunja.bake();
          for (
            const ref of [
              ...bunja.requiredBunjaRefs,
              ...bunja.optionalBunjaRefs,
            ]
          ) this.#prebakeBunjaRef(ref, resolvedReadScope, inProgressBunjas);
          return value;
        } finally {
          dispose();
        }
      });
    } finally {
      inProgressBunjas.delete(bunja);
    }
  }
  #createPrebakeFrame(
    currentBunja: AnyBunja,
    readScope: ReadScope,
    inProgressBunjas: Set<AnyBunja>,
  ): BunjaPrebakeFrame {
    const frame = {
      currentBunja,
      readScope,
      inProgressBunjas,
      use: ((dep: unknown, scopeValuePairs?: ScopeValuePairs) => {
        if (dep instanceof Scope) {
          if (!currentBunja.baked) {
            currentBunja.addScope(dep as Scope<unknown>);
          }
          return readScope(dep as Scope<unknown>);
        }
        if (dep instanceof Bunja || isBunjaRef(dep)) {
          const bunjaRef = normalizeBunjaRuntimeRef(dep, scopeValuePairs);
          return this.#prebakeBunjaDependencyInFrame(
            frame,
            toBunjaGraphRef(bunjaRef),
            "required",
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
        currentBunja.addOptionalBunjaRef(bunjaRef);
        const value = this.#prebakeBunjaRef(
          bunjaRef,
          readScope,
          inProgressBunjas,
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
  #prebakeBunjaDependencyInFrame<T, Seed>(
    frame: BunjaPrebakeFrame,
    bunjaRef: NormalizedBunjaRef<T, Seed>,
    edge: BunjaDependencyEdge,
  ): T {
    if (edge === "optional" || bunjaRef.scopeValuePairs.length > 0) {
      frame.currentBunja.addOptionalBunjaRef(bunjaRef);
    } else if (edge === "required") {
      frame.currentBunja.addRequiredBunjaRef(bunjaRef);
    }
    return this.#prebakeBunjaRef(
      bunjaRef,
      frame.readScope,
      frame.inProgressBunjas,
    );
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
    for (const scope of bunja.requiredScopes) {
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

export interface BunjaStorePrebakeResult<T> {
  value: T;
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

export class Bunja<T, Seed = NoSeed> {
  private static counter: number = 0;
  readonly id: string = String(Bunja.counter++);
  debugLabel: string = "";
  #phase: BunjaPhase = {
    baked: false,
    requiredBunjaRefs: [],
    optionalBunjaRefs: [],
    scopes: new Set(),
  };
  constructor(
    public init: (seed: Seed) => T,
    public defaultSeed: Seed,
  ) {
    if (__DEV__) {
      devtoolsGlobalHook.bunjas[this.id] = this;
      devtoolsGlobalHook.emit("bunjaCreated", { bunjaId: this.id });
    }
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
    return toposortRelatedBunjas([
      ...this.requiredBunjas,
      ...this.optionalBunjas,
    ]);
  }
  get requiredScopes(): Scope<unknown>[] {
    if (!this.#phase.baked) throw new Error("Bunja is not baked yet.");
    return this.#phase.requiredScopes;
  }
  addRequiredBunjaRef(ref: AnyNormalizedBunjaRef): void {
    if (this.#phase.baked) return;
    addUniqueBunjaRef(this.#phase.requiredBunjaRefs, ref);
  }
  addOptionalBunjaRef(ref: AnyNormalizedBunjaRef): void {
    if (this.#phase.baked) return;
    addUniqueBunjaRef(this.#phase.optionalBunjaRefs, ref);
  }
  addScope(scope: Scope<unknown>): void {
    if (this.#phase.baked) return;
    this.#phase.scopes.add(scope);
  }
  bake(): void {
    if (this.#phase.baked) throw new Error("Bunja is already baked.");
    const scopes = this.#phase.scopes;
    const requiredBunjaRefs = this.#phase.requiredBunjaRefs;
    const optionalBunjaRefs = this.#phase.optionalBunjaRefs;
    const requiredBunjas = this.requiredBunjas;
    const expandedRequiredBunjas = toposortRequiredBunjas(requiredBunjas);
    const requiredScopeSet = new Set<Scope<unknown>>();
    for (const bunja of expandedRequiredBunjas) {
      for (const scope of bunja.requiredScopes) requiredScopeSet.add(scope);
    }
    for (const scope of scopes) requiredScopeSet.add(scope);
    const requiredScopes = Array.from(requiredScopeSet);
    this.#phase = {
      baked: true,
      requiredBunjaRefs,
      optionalBunjaRefs,
      expandedRequiredBunjas,
      requiredScopes,
    };
  }
  calcBaseInstanceId(
    scopeInstanceMap: Map<Scope<unknown>, ScopeInstance>,
  ): string {
    const scopeInstanceIds = this.requiredScopes.map(
      (scope) => scopeInstanceMap.get(scope)!.id,
    );
    return `${this.id}:${scopeInstanceIds.join(",")}`;
  }
  calcInstanceId(
    scopeInstanceMap: Map<Scope<unknown>, ScopeInstance>,
    activeDependencyIds: Iterable<string> = [],
  ): string {
    return `${this.calcBaseInstanceId(scopeInstanceMap)}:${
      Array.from(activeDependencyIds).join(",")
    }`;
  }
  toString(): string {
    const { id, debugLabel } = this;
    return `[Bunja:${id}${debugLabel && ` - ${debugLabel}`}]`;
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
function toposortRequiredBunjas(bunjas: AnyBunja[]): AnyBunja[] {
  return toposort(bunjas, (bunja) => bunja.requiredBunjas);
}
function toposortRelatedBunjas(bunjas: AnyBunja[]): AnyBunja[] {
  return toposort(bunjas, (bunja) => [
    ...bunja.requiredBunjas,
    ...bunja.optionalBunjas,
  ]);
}

const noop = () => {};

export interface BunjaDevtoolsGlobalHook {
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
if (__DEV__) {
  if ((globalThis as any).__BUNJA_DEVTOOLS_GLOBAL_HOOK__) {
    devtoolsGlobalHook = (globalThis as any).__BUNJA_DEVTOOLS_GLOBAL_HOOK__;
  } else {
    devtoolsGlobalHook = {
      bunjas: {},
      scopes: {},
      listeners: {
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
}
