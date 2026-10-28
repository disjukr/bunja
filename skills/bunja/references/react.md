# React integration

Import `useBunja`, `BunjaStoreProvider`, and `createScopeFromContext` from `bunja/react`. `useBunja` returns the value directly. Bunja does not make mutable fields reactive.

Keep reusable state, actions, and resources independent of React's calling context. If a custom Hook encapsulates a shareable concern, extract that core before composing it in a molecule; preserving the Hook wrapper is not the goal. React Hooks are 'colored' by the Rules of Hooks: they require a React component/custom-Hook call context, so do not call them inside Bunja initialization or `bunja.effect`. Use the molecule-composed concern as the reusable unit, reducing the need for custom Hooks. Components should consume `useBunja` and the reactive library's view binding directly; do not add a custom Hook wrapper that merely forwards those calls or repackages the molecule's state/actions. DOM/focus and other UI-specific Hooks can remain in that layer.

For view-facing state, keep the app's existing signal/atom primitives. Do not default to writing an application-level `subscribe`/`getSnapshot`/`useSyncExternalStore` adapter, or forwarding a model through effect → `setState` with an `attached`/`key` handshake. This is an application integration choice, not a ban on external-store APIs or on libraries that use them internally. Preserve a required existing external-store contract when adapting it, rather than inventing a new one for Bunja. Do not add a state library solely to follow this example.

Use context/provider injection by default; reserve direct bindings for the [limited cases](patterns.md#scope-injection). For an app already using Jotai:

```tsx
import { bunja } from "bunja";
import { createContext } from "react";
import { BunjaStoreProvider, createScopeFromContext, useBunja } from "bunja/react";
import { atom } from "jotai/vanilla";
import { useAtom } from "jotai/react";

const ScreenContext = createContext("preview");
const ScreenScope = createScopeFromContext(ScreenContext);
const counter = bunja(() => {
  bunja.use(ScreenScope);
  return { countAtom: atom(0) };
});
function Counter() {
  const { countAtom } = useBunja(counter);
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
function Screen({ screenId }: { screenId: string }) {
  return <ScreenContext.Provider value={screenId}><Counter /></ScreenContext.Provider>;
}
function App() {
  return (
    <BunjaStoreProvider>
      <Screen screenId="preview" />
      <Screen screenId="settings" />
    </BunjaStoreProvider>
  );
}
```

When molecule actions write through an injected Jotai store, bind that same store to the view's Jotai Provider or pass it in the view Hook's `store` option. In the [model example](../examples/model.ts), actions and view reads must use the same `stateStore`.

Declare model/scope definitions outside rendering. Keep injected service identities stable. Keep one `BunjaStoreProvider` near the app root by default, as above. Feature scope contexts select values within that shared DI/store boundary; they do not require another store. Multiple stores require [justified isolation](patterns.md#scope-injection); disposing a store ends its instances.

The adapter schedules delayed unmount for effect cleanup. Account for delayed release during partial/final removal, scope replacement, and development effect replay; cleanup need not happen synchronously when a component leaves. Never acquire a socket in init just because render asked for a value. Inspect the current adapter for context binding and rendering constraints before wiring the app.
