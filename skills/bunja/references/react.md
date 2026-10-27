# React integration

Import `useBunja`, `BunjaStoreProvider`, and `createScopeFromContext` from `bunja/react`. `useBunja` returns the value directly. Use the state library's own Hook to subscribe to an atom or external store; Bunja does not make mutable fields reactive.

```tsx
const ScreenContext = createContext("preview");
const ScreenScope = createScopeFromContext(ScreenContext);
const model = bunja(() => ({ screen: bunja.use(ScreenScope) }));
function View() {
  const value = useBunja(model);
  return <span>{value.screen}</span>;
}
// Explicit binding is also supported:
// useBunja(model, [ScreenScope.bind(screenId)])
```

Declare model/scope definitions outside rendering. Keep injected service identities stable. Use `BunjaStoreProvider` at the intended store boundary; separate providers create separate stores, and provider disposal ends its instances. A scope context boundary and a Bunja store boundary serve different purposes.

The adapter schedules delayed unmount for effect cleanup. Account for delayed release during partial/final removal, scope replacement, and development effect replay; cleanup need not happen synchronously when a component leaves. Never acquire a socket in init just because render asked for a value. Inspect the current adapter for context binding and rendering constraints before wiring the app.
