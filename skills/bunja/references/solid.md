# Solid integration

Import adapters from `bunja/solid`. `useBunja` returns an **Accessor**, unlike React's direct value. Retain accessor reads in reactive computations/JSX, rather than capturing a one-time destructured value when the resolved instance can change.

```tsx
const state = useBunja(model, () => [ScreenScope.bind(props.screenId)]);
return <span>{state().screen}</span>;
```

Call from a Solid owner. Dynamic bindings can be supplied through an accessor. Scope contexts can hold values or accessors; ensure a function-valued service is not accidentally treated as a context accessor (wrap it in an object).

The adapter uses `createRoot` to wrap instances, and its provider captures the owner for those roots. Preserve this ownership when integrating Solid signals/effects; do not use an unwrapped core store for Solid reactive resources without an appropriate `wrapInstance` root strategy. Provider cleanup disposes the store. Adapter unmount cleanup is delayed with a timer: flush it before asserting final teardown or replacement. Core tests alone do not establish Solid owner/reactivity behavior.
