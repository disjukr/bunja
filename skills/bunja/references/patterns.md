# Current consumer patterns

Use `bunja`, `createScope`, `createReadScopeFn`, `createBunjaStore`, and `override` from `bunja`. Resolve imports through the consumer app's dependency configuration; keep another existing signal/atom library when appropriate. Expose reactive primitives and actions to views through that library's framework binding, rather than turning plain mutable fields into a new snapshot/subscription protocol.

## Scope injection

Use one `BunjaStoreProvider` near the application root by default: Bunja provides DI as well as instance sharing. Scope context providers can vary by feature or subtree within that store. Add another store provider only for a concrete, justified requirement to isolate instances and their lifetimes; routine scope injection is not such a reason.

In React and Solid, prefer context/provider injection so descendants consume shared concerns without repeating bindings. Recommend direct bindings only when a molecule is used at a single call site, or when the value is created in that component and extracting a child solely to place a provider would be awkward. See the framework references for provider wiring. Outside a framework tree, explicit `createReadScopeFn`/store resolution remains appropriate; framework context is not available there.

## Static definitions, scoped instances

Treat a Bunja definition like a class: declare it statically, normally at module scope, and reuse it. Each `bunja()`/`bunja.withSeed()` call creates a new definition identity; varying scope values resolves instances of that definition, not new definitions. Pass per-consumer data and replaceable services through scopes, and creation-only data through seeds.

Avoid factories that repeatedly return new Bunja definitions during rendering, repeated calls, or request handling. This defeats sharing and risks unbounded retention: get-only instances remain until store disposal, store-local graph metadata survives final release, and the development devtools registry retains definitions even after instance cleanup. Normal final release removes store instances; do not assume it also releases every definition reference. A factory called once during module initialization to create a fixed definition is not inherently a leak. Prefer reusing static definitions and injecting different services/stores over introducing molecule-creation factories as the default isolation mechanism.

## Identity and initialization

`bunja.use(Scope)` makes the scope value part of instance resolution in a store. Default scope hashing uses identity; stabilize service objects rather than allocating them per render. A custom hash deliberately merges values: do not hash services by a label if replacing an implementation must create another instance. Unread scopes do not automatically isolate a bunja; scopes used by active dependencies also affect resolution.

`bunja.withSeed(defaultSeed, seed => ...)` supplies creation data. Pass `{ bunja: formBunja, seed: { title: "Draft" } }` to a consumer. Seed is not an identity key and later seeds do not update an existing matching instance. Use a scope for separate drafts and state actions for updates. Never use a seed to replace a live storage/RPC service.

Here is a complete seed/sharing probe. The later seed is ignored while the matching instance exists:

```ts
import { strictEqual, notStrictEqual } from "node:assert";
import { bunja, createBunjaStore, createReadScopeFn, createScope } from "bunja";

const DraftScope = createScope<string>();
const draft = bunja.withSeed({ title: "" }, seed => {
  const id = bunja.use(DraftScope);
  return { id, initialTitle: seed.title };
});
const store = createBunjaStore();
const read = (id: string) => createReadScopeFn(
  [DraftScope.bind(id)], () => { throw new Error("Missing scope"); },
);
try {
  const first = store.get({ bunja: draft, seed: { title: "First" } }, read("a"));
  const shared = store.get({ bunja: draft, seed: { title: "Ignored" } }, read("a"));
  const other = store.get(draft, read("b"));
  strictEqual(first.value, shared.value);
  strictEqual(shared.value.initialTitle, "First");
  notStrictEqual(first.value, other.value);
  strictEqual(other.value.initialTitle, "");
} finally {
  store.dispose();
}
```

## Static dependency graph

Graphs are learned per store, using that store's effective initializer (including overrides). This allows test and production stores to have different dependency graphs without mutating the definition. Within each effective initializer, call `bunja.use` and `bunja.will` unconditionally in stable order inside initialization. Targets and scope bindings must remain static across initializations; runtime selection belongs in scopes or an unconditional `will` declaration followed by a conditional thunk call. Dynamic seeds are allowed.

```ts
import { bunja, createScope } from "bunja";

const ModeScope = createScope<"a" | "b">();
const serviceA = bunja(() => "a");
const serviceB = bunja(() => "b");
const selected = bunja(() => {
  const mode = bunja.use(ModeScope);
  const useA = bunja.will(serviceA);
  const useB = bunja.will(serviceB);
  return mode === "a" ? useA() : useB();
});
```

Call a `will` thunk only during the same initialization that declared it. An uncalled thunk does not mount its dependency. Neither `use` nor `will` is an event-handler or async dependency lookup. External effects belong in `bunja.effect`, because init can run for graph discovery without mounting.

## Resources and replacement

Effects start when mounted, not on `store.get` alone. Return cleanup from each resource-owning effect. Dependencies mount before consumer effects and their final cleanup also runs **before** consumer cleanup. Consumer teardown must not send through an already-closed dependency; unsubscribe handles should be independently safe after service shutdown. Keep resources that require coordinated teardown in one owner when appropriate.

Inject storage/RPC implementations through scopes, and inject the state store too when it defines a separate instance boundary. Read persistence during instance initialization rather than at module import. Resolve a replacement scope value and release old consumers; changing a seed will not replace a service.

Cleanup alone does not cancel promises. Invalidate a lifetime token, abort where supported, and check both lifetime and request generation before success **and error** writes. A boolean alone can accept an old response after remount. Also invalidate on in-instance service/session replacement, and stop stream iterators/subscriptions. Do not reset a shared instance when only one of several consumers leaves.


For example, in an app already using Jotai, guard both result and error writes. Each effect lifetime has its own closure, so a response from an old lifetime cannot become current after a remount:

```ts
import { bunja, createScope } from "bunja";
import { atom, createStore } from "jotai/vanilla";

interface Service { load(signal: AbortSignal): Promise<string> }
const ServiceScope = createScope<Service>();
const StateStoreScope = createScope<ReturnType<typeof createStore>>();
const loader = bunja(() => {
  const service = bunja.use(ServiceScope);
  const stateStore = bunja.use(StateStoreScope);
  const resultAtom = atom("");
  const errorAtom = atom<unknown>(undefined);
  let refresh = async () => {};
  bunja.effect(() => {
    let alive = true;
    let request = 0;
    let controller: AbortController | undefined;
    refresh = async () => {
      if (!alive) return;
      const version = ++request;
      controller?.abort();
      controller = new AbortController();
      const current = () => alive && version === request;
      try {
        const result = await service.load(controller.signal);
        if (current()) {
          stateStore.set(resultAtom, result);
          stateStore.set(errorAtom, undefined);
        }
      } catch (error) {
        if (current()) stateStore.set(errorAtom, () => error);
      }
    };
    return () => { alive = false; controller?.abort(); };
  });
  return { stateStore, resultAtom, errorAtom, refresh: () => refresh() };
});
```

`refresh` is inert before mount and after cleanup. The closure guards even a service that ignores abort. Return a function from the Jotai setter when storing an arbitrary error, because an error value can itself be a function. Views must use this same `stateStore`. See [refactoring](refactoring.md#test-the-production-definition-replace-its-dependency) for subscription ownership.

## Inspect the effective store

Use store APIs, not definition-global dependency fields. `inspect` and `snapshot` observe existing metadata; `prebake` deliberately runs initializers (including inactive `will` branches) with default seeds to discover the graph without mounting effects. It rejects seeded refs. Avoid it as a routine render-time operation.

```ts
import { bunja, createBunjaStore, createScope } from "bunja";

const NameScope = createScope<string>();
const greeting = bunja(() => `Hello ${bunja.use(NameScope)}`);
greeting.debugLabel = "greeting";
const store = createBunjaStore();
try {
  const graph = store.prebake(
    { bunja: greeting, with: [NameScope.bind("Ada")] },
    () => { throw new Error("Missing scope"); },
  );
  console.log(graph.requiredScopes, store.inspect(greeting).baked);
  console.log(store.snapshot().storeId, store.snapshot().instances);
} finally {
  store.dispose();
}
```

Development tooling identifies graphs by store and definition. Solid owner hints are development metadata, not proof that a particular inspector understands those hints. Do not rely on private devtools globals in application logic.


## Scoped persistence

Keep persistence and view writes on the same state store. Capture the storage implementation and screen key during initialization so another consumer cannot redirect existing actions:

```ts
import { bunja, createScope } from "bunja";
import { atom, createStore } from "jotai/vanilla";

interface StorageService {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const ScreenScope = createScope<string>();
const StorageScope = createScope<StorageService>();
const StateStoreScope = createScope<ReturnType<typeof createStore>>();
const preferences = bunja(() => {
  const key = `filter:${bunja.use(ScreenScope)}`;
  const storage = bunja.use(StorageScope);
  const stateStore = bunja.use(StateStoreScope);
  const filterAtom = atom(storage.getItem(key) ?? "");
  return {
    stateStore,
    filterAtom,
    set(value: string) {
      storage.setItem(key, value);
      stateStore.set(filterAtom, value);
    },
  };
});
```

This contract reads storage during initialization and propagates storage failures. A failed write leaves the atom unchanged. Preserve a different existing persistence contract when the app requires one; do not silently swallow errors or add background synchronization during ownership refactoring.
