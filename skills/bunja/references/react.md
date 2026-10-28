# React integration

Import `useBunja`, `BunjaStoreProvider`, and `createScopeFromContext` from `bunja/react`. `useBunja` returns the value directly. Use the state library's own Hook to subscribe to an atom or external store; Bunja does not make mutable fields reactive.

For view-facing state, use the app's existing signals/atoms and their official React Hooks. Do not default to writing an application-level `subscribe`/`getSnapshot`/`useSyncExternalStore` adapter, or forwarding a model through effect → `setState` with an `attached`/`key` handshake. This is an application integration choice, not a ban on external-store APIs or on libraries that use them internally. Preserve a required existing external-store contract when adapting it, rather than inventing a new one for Bunja. Do not add a state library solely to follow this example.

For an app already using Jotai:

```tsx
import { bunja, createScope } from "bunja";
import { useBunja } from "bunja/react";
import { atom, useAtom } from "jotai";

const ScreenScope = createScope<string>();
const counter = bunja(() => {
  bunja.use(ScreenScope);
  return { countAtom: atom(0) };
});
function View({ screenId }: { screenId: string }) {
  const { countAtom } = useBunja(counter, [ScreenScope.bind(screenId)]);
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

When molecule actions write through an injected Jotai store, bind that same store to the view's Jotai Provider or pass it in the official Hook's `store` option. In the [model example](../examples/model.ts), actions and view reads must use the same `stateStore`.

Declare model/scope definitions outside rendering. Keep injected service identities stable. Use `BunjaStoreProvider` at the intended store boundary; separate providers create separate stores, and provider disposal ends its instances. A scope context boundary and a Bunja store boundary serve different purposes.

The adapter schedules delayed unmount for effect cleanup. Account for delayed release during partial/final removal, scope replacement, and development effect replay; cleanup need not happen synchronously when a component leaves. Never acquire a socket in init just because render asked for a value. Inspect the current adapter for context binding and rendering constraints before wiring the app.
