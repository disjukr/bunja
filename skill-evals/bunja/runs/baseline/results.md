# Baseline consumer-state review

Source: only `prompts.json` in this directory. These are proposed replacements for synthetic fixtures, not changes to a running application.

## screens

The module globals accidentally couple every screen. Put mutable filter state in each screen instance; bind endpoint and storage at construction. Keep the returned UI contract (`setFilter` and `load`) unchanged. Construct each instance once for its screen lifetime (for example, in a React lazy state initializer), not on every render.

```ts
type StoragePort = Pick<Storage, 'setItem'>;
type ScreenOptions = {
  endpoint: string;
  storage: StoragePort;
  storageKey: string; // Stable distinct screen identity, even for equal endpoints.
  request?: typeof fetch;
};

export function createScreen({
  endpoint, storage, storageKey, request = fetch,
}: ScreenOptions) {
  let filter = '';
  return {
    setFilter(value: string) {
      filter = value;
      storage.setItem(storageKey, value);
    },
    load() {
      const url = new URL(endpoint, 'https://screen.invalid');
      url.searchParams.set('q', filter);
      // Preserve relative endpoints and any existing query/hash.
      const target = /^[a-z][a-z\d+.-]*:/i.test(endpoint)
        ? url.href
        : endpoint.startsWith('//')
          ? '//' + url.host + url.pathname + url.search + url.hash
          : endpoint.startsWith('/')
            ? url.pathname + url.search + url.hash
            : url.pathname.slice(1) + url.search + url.hash;
      return request(target);
    },
  };
}

// Composition boundary; no eager module-level localStorage access.
export function screen() {
  return createScreen({
    endpoint: 'a', storage: globalThis.localStorage,
    storageKey: 'inventory:default:filter',
  });
}
// Two actual screen owners supply distinct identities and endpoints:
// createScreen({ endpoint: '/inventory/a', storage, storageKey: 'left:filter' })
// createScreen({ endpoint: '/inventory/b', storage, storageKey: 'right:filter' })
// Preview: supply { setItem(k, v) { values.set(k, v); } } backed by a new Map.
```

For arbitrary relative paths containing `..`, prefer resolving against the app's real base URL and passing the resolved URL to fetch. The sample above assumes the fixture's simple endpoint paths. There is no storage read because the original fixture starts with an empty filter; adding restoration would change behavior. Persistence failures retain the original throw behavior.

Observable acceptance: changing left to `red & blue` leaves right's request empty; left requests its own endpoint with `q=red+%26+blue`. Distinct keys preserve both writes even with shared storage. Two previews with separate Maps cannot affect each other or browser storage. Returned method names and fetch response behavior remain unchanged.

## hook

Hook-local state creates two subscriptions. The quote is shared state whose upstream subscription should exist while at least one consumer is subscribed. Use one stable atom in the same existing Jotai store for both consumers.

```ts
import { atom, useAtomValue } from 'jotai';

// subscribePrice must return an unsubscribe function.
const quoteAtom = atom(0);
quoteAtom.onMount = (setQuote) => {
  let live = true;
  const unsubscribe = subscribePrice((value: number) => {
    if (live) setQuote(value);
  });
  return () => {
    live = false;
    unsubscribe();
  };
};

export function useQuote(): number {
  return useAtomValue(quoteAtom);
}
```

Keep both panel and badge under the same existing Provider/store; separate Providers intentionally produce separate subscriptions. Do not create the atom inside the Hook. The guard prevents callbacks from a disposed subscription overwriting the value after remount. The atom retains its last quote between mounts; whether a remount should reset it is a product decision absent from the fixture.

Jotai documents that `onMount` runs at the first subscription in a provider and its cleanup runs after the last subscription disappears: [official atom documentation](https://jotai.org/docs/core/atom). This supplies the ownership/ref-count behavior; no separate shared Hook cache is necessary.

Observable acceptance: panel alone creates one upstream subscription; mounting badge keeps the count at one; emitting 42 updates both; removing panel leaves subscription alive; removing badge unsubscribes once. Remount starts a fresh subscription, and an old queued callback cannot change the new value. Under React Strict Mode an initial subscribe/unsubscribe/subscribe sequence is acceptable; at steady state only one connection remains.

## late

A shared Boolean permits a previous mount's completion to write after remount. It also does not order concurrent refreshes, and failures currently write while inactive. Give each feature instance its own state and monotonically invalidate work at every mount, unmount, and refresh. Capture both request generation and mount identity.

```ts
export function createSearch(rpc: { load(): Promise<string> }) {
  let owner: object | undefined;
  let generation = 0;
  let result = '';
  let error: unknown = undefined;

  function mount() {
    const lease = {};
    owner = lease;
    ++generation;
    return () => {
      if (owner !== lease) return;
      owner = undefined;
      ++generation;
    };
  }

  async function refresh() {
    if (!owner) return;
    const lease = owner;
    const request = ++generation;
    error = undefined;
    const current = () => owner === lease && generation === request;
    try {
      const value = await rpc.load();
      if (!current()) return;
      result = value;
      error = undefined;
    } catch (cause) {
      if (!current()) return;
      error = cause;
    }
  }

  return { mount, refresh, read: () => ({ result, error }) };
}
```

Create one controller per feature owner, wire its mount cleanup to that feature's lifetime, and call its existing refresh action. `read` is an inspection seam here; a real reactive view should publish these accepted state changes through its existing state mechanism. The fixture has no reactive UI contract to wire. This implementation assumes one visible owner per controller; overlapping independent feature instances receive separate controllers. A failed current refresh retains the last successful result and exposes the current error. Refresh while hidden is a no-op. Mounting again keeps the last result but invalidates all pending writes. No cancellation or transport shutdown is required: the shared RPC transport can continue serving other features.

Observable acceptance: resolve first refresh after second succeeds and only the second result remains; reject first after second succeeds and no error appears. Current failures appear, and a following success clears them. Both success and failure after unmount are ignored. Old-mount completions remain ignored after remount. A delayed cleanup from an old mount does not dispose the newer mount. Two controllers do not share results or errors.

## keep

Keep both state owners. Each Editor's `useState` is already isolated exactly as requested; lifting text into shared state would break independent drafts. The root effect correctly owns app-lifetime telemetry. Make only the cleanup contract explicit if `connect` does not already return a cleanup function.

```tsx
function Editor() {
  const [text, setText] = useState('');
  return <input value={text} onChange={e => setText(e.target.value)} />;
}

function App() {
  useEffect(() => {
    const disconnect = telemetry.connect();
    return disconnect; // Existing code is correct if this is () => void.
  }, []);
  return <><Editor /><Editor /></>;
}
```

If instead its documented contract is `connect(): void` plus `disconnect(): void`, use `telemetry.connect(); return () => telemetry.disconnect();` in the effect. Do not invent both cleanup mechanisms or move telemetry into an Editor. No source change is needed when the original connect function already returns the cleanup.

Observable acceptance: typing into either editor leaves the other input unchanged; ordinary rerenders retain each draft. Adding/removing an editor does not reconnect or disconnect telemetry while App remains mounted. Unmounting App disconnects telemetry once per connection. In development Strict Mode, cleanup/reconnection may run as a lifecycle probe; steady-state connection count is one. Intentional editor unmount/remount resets its unsaved text, matching useState semantics.

## Verification actually run

See the execution record appended below. No repository dependencies, app build, browser rendering, React renderer, or installed Jotai runtime were inspected or run. Acceptance criteria above that depend on React/Jotai remain proposed integration checks. Official documentation was consulted only for Jotai atom lifetime semantics.

Execution record:

- `Get-Command node` located a mise shim. `node --version` exited 1 because the shim attempted to resolve/install configured tools and could not reach public hosts; no Node test suite ran. No escalation was requested.
- The bundled workspace-runtime lookup returned “Workspace dependency tools are only supported for local threads.”
- An initial JavaScript behavioral check through the tool's V8 runtime stopped before its first assertion because that runtime has no `URL` global. Screen request/storage checks therefore did not execute; a browser or Node runtime is still required for that sample.
- Re-ran the search controller alone in the tool's V8 runtime, removing only TypeScript annotations and the export keyword. **10 assertions passed:** latest success wins; stale failure ignored; current failure exposed while retaining the result; recovery clears error; hidden success ignored; hidden failure ignored; prior-mount success ignored after remount; old cleanup cannot dispose the current mount; hidden refresh does not call the RPC; separate controller results remain independent. Deferred promises exercised both resolution and rejection without aborting the shared transport.
- Hook/Jotai reference counting and editor/telemetry behavior were reviewed against the fixture and the cited Jotai documentation; their React integration acceptance checks were not executed.
