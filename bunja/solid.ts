import {
  type Accessor,
  type Context,
  createComponent,
  createContext,
  createEffect,
  createMemo,
  createRoot,
  getOwner,
  type JSX,
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

type MaybeAccessor<T> = T | Accessor<T>;
type AccessedValue<T> = T extends Accessor<infer U> ? U : T;
function access<T>(maybeAccessor: MaybeAccessor<T>): T {
  if (typeof maybeAccessor !== "function") return maybeAccessor;
  return (maybeAccessor as Accessor<T>)();
}

export const BunjaStoreContext: Context<BunjaStore> = createContext(
  createBunjaStore({ wrapInstance: createRoot }),
);

export function BunjaStoreProvider(
  props: ParentProps,
): JSX.Element {
  const owner = getOwner();
  const bunjaStore = createBunjaStore({
    wrapInstance: (impl) => createRoot(impl, owner),
  });
  onCleanup(() => bunjaStore.dispose());
  return createComponent(BunjaStoreContext.Provider, {
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

export function useBunja<T>(
  bunja: MaybeAccessor<Bunja<T, any> | BunjaGetRef<T, any>>,
  scopeValuePairs?: MaybeAccessor<ScopeValuePairs>,
): Accessor<T> {
  const owner = getOwner();
  const store = useContext(BunjaStoreContext);
  const defaultReadScope: ReadScope = <T>(scope: Scope<T>) => {
    const context = scopeContextMap.get(scope as Scope<unknown>)!;
    // Restore the consumer context without untracking its accessor.
    return access(runWithOwner(owner, () => useContext(context))) as T;
  };
  const readScope = createMemo(() => {
    const pairs = access(scopeValuePairs);
    return pairs
      ? createReadScopeFn(pairs, defaultReadScope)
      : defaultReadScope;
  });
  const entry = createMemo(() => {
    const read = readScope();
    const scopes = new Set<Scope<unknown>>();
    const result = store.get(access(bunja), (scope) => {
      scopes.add(scope as Scope<unknown>);
      return read(scope);
    });
    // Initial scope discovery can run inside the instance's untracked root.
    // Subscribe here as well, including scopes reached through dependencies.
    for (const scope of scopes) read(scope);
    return result;
  });
  createEffect(() => {
    const cleanup = entry().mount();
    onCleanup(() => setTimeout(cleanup));
  });
  return () => entry().value;
}
