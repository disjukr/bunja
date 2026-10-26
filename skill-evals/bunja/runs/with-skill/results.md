# Consumer fixture results

> Historical evaluator output: commands below record the original isolated `eval-runs/with-skill` execution location and the skill snapshot at that time. Delivered artifacts are now under `skill-evals/bunja/runs/with-skill`; current reproduction commands and subsequent package-import corrections are documented in `../../report.md`. The evaluator's original statements are retained for provenance.

Applied the supplied Bunja consumer skill. These are isolated proposals, not edits to a running application. Only this directory and its supplied skill were inspected. There is no installed app dependency manifest/types in this fixture directory. Current public Bunja [core types/source](https://raw.githubusercontent.com/disjukr/bunja/main/bunja/bunja.ts) and [React adapter](https://raw.githubusercontent.com/disjukr/bunja/main/bunja/react.ts) were inspected; package compatibility still requires an actual app install and typecheck. The adapter uses delayed unmount, so framework acceptance checks below require flushing its scheduler.

## screens — minimal fix: an explicit screen owner

The module globals couple filters and redirect existing screens when selectedEndpoint changes. Module-time localStorage capture also prevents preview injection. No shared-resource lifetime is required, so an explicit factory is sufficient. Allocate once per inventory screen owner, retain the returned object across renders, and discard on owner removal. Each screen captures its endpoint, storage implementation, and namespaced persistence key together. The UI still receives only `setFilter(string)` and `load()`; `load` still returns the fetch promise. Keep query construction and thrown storage failures as in the fixture. Reading persistence on initialization would change the raw fixture's behavior, so this proposal does not add that feature.

Concrete implementation: `createScreenFactory` in [proposed.ts](./proposed.ts). Composition:

```ts
const fetcher = (url: string) => fetch(url);
// Create at screen-owner construction, not at module import or every render.
const screen = createScreenFactory({
  endpoint: 'a', storage: window.localStorage,
  storageKey: 'filter:inventory-one', fetcher,
});
const inventoryOne = screen();
const inventoryTwo = createScreenFactory({
  endpoint: 'b', storage: window.localStorage,
  storageKey: 'filter:inventory-two', fetcher,
})();
const memory = new Map<string, string>();
const preview = createScreenFactory({
  endpoint: 'preview', storage: { setItem: (k, v) => { memory.set(k, v); } },
  storageKey: 'filter:inventory-one', fetcher,
})();
```

Replacement means constructing a new owner with new dependencies and switching the screen to it, releasing the old reference. Do not mutate a global selected endpoint or expect seeds to replace services. Existing owners deliberately keep their captured services. Acceptance: one filter update changes only its screen's URL and persistence key; previews touch only memory; replacing storage/endpoint yields the replacement URL and writes, while an existing other screen remains unchanged. The executable screen test covers those observations. UI owner wiring remains unverified.

## hook — Bunja owns one shared quote subscription; Jotai remains

Two calls to the raw Hook allocate two states/effects. Define a stable model outside rendering. The model's Jotai store scope aligns writes with the store read by both consumers, including apps with separate Jotai Providers. Both consumers must be under the same Bunja store boundary and same Jotai store; do not wrap each one separately. Initial quote remains zero.

```tsx
import { bunja, createScope } from 'bunja';
import { BunjaStoreProvider, useBunja } from 'bunja/react';
import { atom, useAtomValue, useStore } from 'jotai';

// Existing transport API: returns an independently safe unsubscribe function.
declare function subscribePrice(callback: (quote: number) => void): () => void;
const QuoteStoreScope = createScope<ReturnType<typeof useStore>>();
const quoteBunja = bunja(() => {
  const store = bunja.use(QuoteStoreScope);
  const quoteAtom = atom(0);
  bunja.effect(() => {
    let active = true;
    const unsubscribe = subscribePrice(value => {
      if (active) store.set(quoteAtom, value);
    });
    return () => { active = false; unsubscribe(); };
  });
  return { quoteAtom };
});
export function useQuote() {
  const store = useStore();
  const { quoteAtom } = useBunja(quoteBunja, [QuoteStoreScope.bind(store)]);
  return useAtomValue(quoteAtom);
}
// Place one stable boundary above both existing consumers:
// <BunjaStoreProvider><PricePanel /><Badge /></BunjaStoreProvider>
```

Allocation stays pure; the subscription starts in the effect. The late callback guard prevents a badly queued callback from writing after disposal. No transport shutdown is added: unsubscribe owns this quote listener only. If subscription service replacement is needed later, inject its stable implementation through another scope, alongside the Jotai store; changing a seed will not replace it.

Observable acceptance, to run in the application's actual React renderer with scheduler flushing: instrument subscribe/unsubscribe counters; mount panel and badge and assert one active subscription and identical atom identity; emit 42 and assert both display 42; remove either and assert the remaining display still updates with zero final cleanups; remove the last and flush, assert one cleanup; remount after completed disposal and assert fresh initial zero and a new subscription. Exercise development effect replay and scope/store replacement; separate Jotai stores must not share quote instances. A callback retained from the old subscription must not update the replacement. **Not run:** Bunja/Jotai typechecking, core lifecycle tests, or React integration; the synthetic directory has no app dependencies. These are acceptance criteria, not claimed results.

## late — minimal fix: lifetime and request generations

The boolean allows a response from a previous mount to write after remount; errors write even after unmount; overlapping requests race. Use one `createSearch(rpc)` per feature owner from [proposed.ts](./proposed.ts). It preserves `mount()` returning cleanup and async `refresh()`. The diagnostic `snapshot()` makes writes observable; use the app's existing reactive setter/atom at those guarded assignments when integrating, since ordinary mutable fields do not trigger rendering. Bind existing entry points once:

```ts
const search = createSearch(rpc); // feature composition, not a global singleton
const { mount, refresh } = search;
```

The full implementation is in the linked source. Every request captures lifetime and request generation; both successful and failed responses must pass the guard. Successful current requests clear the previous error; a current failure retains the last result and records its cause. Cleanup invalidates outstanding work, is idempotent, and cannot invalidate a later mount via an old cleanup handle. Refresh while inactive is ignored. `mount` is a single-owner adapter, not a per-component refcount API: if several views share this feature, mount once in their common owner or use Bunja to refcount that owner.

The fixture's `rpc.load()` has no abort support. This proposal does not close a transport that another feature may retain. If the real API accepts a signal, abort this owner's request at replacement/cleanup as an optimization while retaining both guards. Replace RPC/session by disposing the old feature owner and creating a new one; do not mutate its captured RPC. Old owner promises then fail their guards.

Executable checks cover out-of-order success; stale failure after current failure; visible current failure; recovery clearing error; success and failure arriving after cleanup and remount; final-disposal failure; and another feature still successfully using the same RPC. A renderer subscription check and explicit distinct-RPC replacement case remain unrun.

## keep — preserve both intended owners

Keep independent editor state and root-owned telemetry. No Bunja or shared text atom is justified. Concrete retained code, with the telemetry cleanup contract made explicit:

```tsx
import { useEffect, useState } from 'react';
declare const telemetry: { connect(): () => void };
function Editor() {
  const [text, setText] = useState('');
  return <input value={text} onChange={e => setText(e.target.value)} />;
}
function App() {
  useEffect(() => telemetry.connect(), []);
  return <><Editor /><Editor /></>;
}
```

No source change is necessary if `connect` already returns a disconnect handle, as the original concise effect implies. If the real API instead has `connect(): void` plus `disconnect()`, the only change is `useEffect(() => { telemetry.connect(); return () => telemetry.disconnect(); }, [])`. Inspect that API before choosing; do not invent a return contract silently.

Observable acceptance: type in the first input and see only its value change; editor unmount/remount resets that editor's unsaved text; removing one or both editors does not disconnect telemetry while App remains mounted; App teardown disconnects once per completed connection. In development replay, each setup is paired with cleanup and only one connection remains active after settling. No React test was run for this fixture; retention is a code-review conclusion and these are proposed renderer checks.

## Verification actually executed

Commands from the task workspace:

```text
deno check --no-config bunja-skill/eval-runs/with-skill/proposed.ts bunja-skill/eval-runs/with-skill/proposed_test.ts
exit 0
deno test --no-config bunja-skill/eval-runs/with-skill/proposed_test.ts
3 passed | 0 failed
```

The three dependency-free tests are in [proposed_test.ts](./proposed_test.ts). They execute the proposed factory and async guards, not a reimplementation or installed Bunja. No external app was modified and no messages were sent. The provided skill's example tests were not run: their repository-relative Bunja imports are not this isolated application's installed dependencies. The remaining limitation is app-level dependency/type and renderer verification for the quote and retained React owners.

## Complete proposed factory and search code

```ts
export interface StoragePort { setItem(key: string, value: string): void }
export function createScreenFactory(config: {
  endpoint: string; storage: StoragePort; storageKey: string;
  fetcher: (url: string) => Promise<unknown>;
}) {
  // Capture one immutable dependency set per screen owner, outside rendering.
  const { endpoint, storage, storageKey, fetcher } = config;
  return function screen() {
    let filter = '';
    return {
      setFilter(v: string) { filter = v; storage.setItem(storageKey, v); },
      load() { return fetcher(endpoint + '?q=' + filter); },
    };
  };
}

export function createSearch(rpc: { load(): Promise<string> }) {
  let active = false, lifetime = 0, request = 0;
  let result = '', error: unknown;
  function mount() {
    if (active) throw new Error('Search owner already mounted');
    active = true;
    const owner = ++lifetime;
    return () => {
      if (!active || lifetime !== owner) return;
      active = false; ++lifetime; ++request;
    };
  }
  async function refresh() {
    if (!active) return;
    const owner = lifetime, version = ++request;
    const current = () => active && lifetime === owner && request === version;
    try {
      const value = await rpc.load();
      if (current()) { result = value; error = undefined; }
    } catch (cause) {
      if (current()) error = cause;
    }
  }
  return { mount, refresh, snapshot: () => ({ result, error }) };
}

```
