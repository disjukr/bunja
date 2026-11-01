# Solid integration

Import adapters from `bunja/solid`. `useBunja` returns an **Accessor**, unlike React's direct value. Retain accessor reads in reactive computations/JSX, rather than capturing a one-time destructured value when the resolved instance can change.

Keep view-facing state in Solid `createSignal`/stores or the app's existing reactive primitives and their supported Solid bindings. Bunja owns the instance and resources; it does not replace reactive tracking. Do not build a manual snapshot/subscription bridge for state that can already be read reactively.

```tsx
import { bunja } from "bunja";
import { BunjaStoreProvider, createScopeFromContext, useBunja } from "bunja/solid";
import { createContext, createSignal } from "solid-js";

const ScreenContext = createContext<() => string>(() => "preview");
const ScreenScope = createScopeFromContext(ScreenContext);
const counter = bunja(() => {
  bunja.use(ScreenScope);
  const [count, setCount] = createSignal(0);
  return { count, setCount };
});
function Counter() {
  const state = useBunja(counter);
  return <button onClick={() => state().setCount(n => n + 1)}>{state().count()}</button>;
}
function Screen(props: { screenId: string }) {
  return <ScreenContext value={() => props.screenId}><Counter /></ScreenContext>;
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

The example uses context component syntax and `jsxImportSource: "@solidjs/web"`. If the app already uses `bunja/solid/v1-compat`, preserve that adapter and its `<ScreenContext.Provider value={() => props.screenId}>` syntax. Do not mix adapter families in one tree.

Call from a Solid owner. `createScopeFromContext(context)` creates and registers a scope; `bindScope(existingScope, context)` registers an existing one. A scope context supplies values down the component tree; `BunjaStoreProvider` establishes a separate instance-sharing/lifetime boundary. Keep one store provider near the app root by default, as above; feature scope contexts stay inside it. Add another store only for [justified isolation](patterns.md#scope-injection), not routine scope injection.

Prefer context/provider injection as above. Reserve `useBunja(counter, () => [ScreenScope.bind(props.screenId)])` for the [limited direct-binding cases](patterns.md#scope-injection). Explicit bindings override those scopes; other scopes fall back to context. Context values may be accessors. Keep service objects stable when replacement is not intended. Wrap function-valued services in an object so they are not treated as context accessors.

The adapter uses `createRoot` to wrap instances, and its provider captures the owner for those roots. Preserve this ownership when integrating Solid signals/effects; do not use an unwrapped core store for Solid reactive resources without an appropriate `wrapInstance` root strategy. Provider cleanup disposes the store. Adapter unmount cleanup is delayed with a timer: allow for that delay when reasoning about final teardown or replacement. Keep reactive resources attached to the appropriate Solid owner.

## Dynamic refs retain static definitions

An accessor can select among existing definitions or supply a seeded ref. It must not create a new definition on each reactive evaluation:

```tsx
import { bunja } from "bunja";
import { useBunja } from "bunja/solid";
import { createSignal } from "solid-js";

const shortGreeting = bunja.withSeed("Guest", name => ({ text: `Hi ${name}` }));
const formalGreeting = bunja.withSeed("Guest", name => ({ text: `Hello ${name}` }));
function Greeting() {
  const [formal, setFormal] = createSignal(false);
  const greeting = useBunja(() => ({
    bunja: formal() ? formalGreeting : shortGreeting,
    seed: "Ada",
  }));
  return <button onClick={() => setFormal(value => !value)}>{greeting().text}</button>;
}
```

The accessor selects a definition; it does not make the seed reactive state. Two consumers choosing the same definition and scopes still share one instance. Use a scope to distinguish independent greetings. Avoid `const { text } = greeting()` when replacement should update the view; keep `greeting()` inside tracked reads and resolve actions in event callbacks.

On the server, resolution does not mount client resource effects. Test client and server conditions separately when lifecycle matters; SSR resolution alone does not validate hydration.
