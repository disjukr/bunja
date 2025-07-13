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
  useContext,
} from "solid-js";
import {
  type Bunja,
  type BunjaStore,
  createBunjaStore,
  createScope,
  type HashFn,
  type ReadScope,
  type Scope,
} from "./bunja.ts";

type MaybeAccessor<T> = T | Accessor<T>;
type AccessedValue<T> = T extends Accessor<infer U> ? U : T;
const access = <T>(maybeAccessor: MaybeAccessor<T>) => {
  if (typeof maybeAccessor === "function") {
    return (maybeAccessor as Accessor<T>)();
  }
  return maybeAccessor;
};

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

const defaultReadScope: ReadScope = <T>(scope: Scope<T>) => {
  const context = scopeContextMap.get(scope as Scope<unknown>)!;
  return access(useContext(context)) as T;
};

export function useBunja<T>(
  bunja: MaybeAccessor<Bunja<T>>,
  readScope: ReadScope = defaultReadScope,
): Accessor<T> {
  const store = useContext(BunjaStoreContext);
  const entry = createMemo(() => store.get(access(bunja), readScope));
  createEffect(() => {
    const cleanup = entry().mount();
    onCleanup(cleanup);
  });
  return () => entry().value;
}

export type ScopePair<T> = [Scope<T>, T];

export function inject<const T extends ScopePair<any>[]>(
  overrideTable: T,
): ReadScope {
  const map = new Map(overrideTable);
  return <T>(scope: Scope<T>) => {
    if (map.has(scope as Scope<unknown>)) {
      return map.get(scope as Scope<unknown>) as T;
    }
    const context = scopeContextMap.get(scope as Scope<unknown>);
    if (!context) {
      throw new Error(
        "Unable to read the scope. Please inject the value explicitly or bind scope to the Solid context.",
      );
    }
    return access(useContext(context)) as T;
  };
}
