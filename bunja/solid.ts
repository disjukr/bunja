import {
  type Accessor,
  type Context,
  createComponent,
  createContext,
  createEffect,
  createMemo,
  createRoot,
  getOwner,
  type Element,
  onCleanup,
  type ParentProps,
  runWithOwner,
  useContext,
} from "solid-js";
import {
  type Bunja,
  type BunjaGetRef,
  type BunjaStore,
  createBunjaStore,
  createReadScopeFn,
  createScope,
  type HashFn,
  type ReadScope,
  type Scope,
  type ScopeValuePairs,
} from "./bunja.ts";

// @ts-ignore dev
const __DEV__ = process.env.NODE_ENV !== "production";

type MaybeAccessor<T> = T | Accessor<T>;
type AccessedValue<T> = T extends Accessor<infer U> ? U : T;
function access<T>(maybeAccessor: MaybeAccessor<T>): T {
  if (typeof maybeAccessor !== "function") return maybeAccessor;
  return (maybeAccessor as Accessor<T>)();
}

export const BunjaStoreContext: Context<BunjaStore> = createContext(
  createBunjaStore({
    // The fallback store outlives individual consumers.
    wrapInstance: (impl) => runWithOwner(null, () => createRoot(impl)),
  }),
);

export function BunjaStoreProvider(
  props: ParentProps,
): Element {
  const owner = getOwner();
  const bunjaStore = createBunjaStore({
    wrapInstance: (impl) => runWithOwner(owner, () => createRoot(impl)),
  });
  onCleanup(() => bunjaStore.dispose());
  return createComponent(BunjaStoreContext, {
    get value() {
      return bunjaStore;
    },
    get children() {
      return props.children;
    },
  });
}

export const scopeContextMap: Map<
  Scope<unknown>,
  Context<MaybeAccessor<unknown>>
> = new Map();
export function bindScope<T>(
  scope: Scope<T>,
  context: Context<MaybeAccessor<T>>,
): void {
  scopeContextMap.set(
    scope as Scope<unknown>,
    context as Context<MaybeAccessor<unknown>>,
  );
}

export function createScopeFromContext<T>(
  context: Context<T>,
  hash?: HashFn<AccessedValue<T>>,
): Scope<AccessedValue<T>> {
  const scope = createScope<AccessedValue<T>>(hash);
  bindScope(scope, context as Context<MaybeAccessor<AccessedValue<T>>>);
  return scope;
}

export function useBunja<T, Seed = undefined>(
  bunja: MaybeAccessor<Bunja<T, Seed> | BunjaGetRef<T, Seed>>,
  scopeValuePairs?: MaybeAccessor<ScopeValuePairs>,
): Accessor<T> {
  const owner = getOwner();
  const store = useContext(BunjaStoreContext);
  const defaultReadScope: ReadScope = <T>(scope: Scope<T>) => {
    const context = scopeContextMap.get(scope as Scope<unknown>)!;
    // Restore the consumer context without untracking its accessor.
    return access(runWithOwner(owner, () => useContext(context))) as T;
  };
  const entry = createMemo(() => {
    const pairs = access(scopeValuePairs);
    const read = pairs
      ? createReadScopeFn(pairs, defaultReadScope)
      : defaultReadScope;
    const resolvedBunja = access(bunja);
    // A Solid 2 instance root can carry an older snapshot than its consumer.
    // Resolve each scope once per entry so transitive dependencies see the
    // same value, even when Bunja enters that root during construction.
    const resolutionOwner = getOwner();
    const scopes = new Map<Scope<unknown>, unknown>();
    const result = store.get(resolvedBunja, <S>(scope: Scope<S>): S => {
      const key = scope as Scope<unknown>;
      if (!scopes.has(key)) {
        scopes.set(key, runWithOwner(resolutionOwner, () => read(scope)));
      }
      return scopes.get(key) as S;
    });
    // Initial scope discovery can run inside the instance's untracked root.
    // Subscribe here as well, including scopes reached through dependencies.
    for (const scope of scopes.keys()) read(scope);
    if (__DEV__) {
      // Keep each call's current hint on its existing memo in the owner tree.
      Object.assign(getOwner()!, {
        storeId: store.id,
        bunja: resolvedBunja,
        scopeValuePairs: pairs,
        bunjaInstance: result.bunjaInstance,
      });
    }
    return result;
  });
  createEffect(entry, (resolved) => {
    const cleanup = resolved.mount();
    return () => { setTimeout(cleanup); };
  });
  return () => entry().value;
}
