# Refactor consumer ownership

Trace allocation and reads from each consumer to its state store, persistence, subscription, and RPC service. Record current externally visible behavior (including storage failures and deliberate retention) before choosing a boundary.

For coupled screens, introduce the smallest explicit scope key for the concern and align state, storage, and RPC dependencies with it. Moving only the state while looking up a mutable global service selection can send an instance's actions to the wrong injected service. When a Hook hides shareable state, actions, or resource effects, extract a React-independent core first, then assemble it in a stable bunja definition outside renders. Keep React Hook calls in the thin consumer layer; do not move the Hook itself into a molecule. Preserve UI-specific DOM/focus behavior in the view.

Move resource acquisition into effects and return disposal handles. Consider shared derived objects, subscriptions, and app-wide effects for extraction too. Use an app owner for intentionally app-wide lifetimes; retain existing ownership when extraction is difficult or its benefit does not justify the change. Do not assume a dependency outlives consumer cleanup. Add lifetime/request guards before moving asynchronous operations; cover late failures as well as successes.

Replace service imports with narrow injected interfaces where replacement is required. Keep existing public actions and state representations unless the task needs a change. Give storage and reactive stores separate scope identities when consumers need independent replacement or isolation. Avoid incidental persistence synchronization, silent error swallowing, and replacing Jotai merely because Bunja is introduced.

Finish with the ownership contract, concrete diff, and consumer integration instructions. A correct outcome can be no Bunja change.

## Test the production definition, replace its dependency

Do not introduce `createFeatureBunja(fake)` or split out a `*-model` module solely to make tests possible. Keep the production definition static and resolve it in a fresh store with a typed initializer override. Existing useful module boundaries can stay; testing alone does not require another layer.

This example puts production definitions and the test together for readability. In the app, the test imports the same `documentBunja` and `apiBunja` used by consumers:

```ts
import { deepStrictEqual, strictEqual } from "node:assert";
import { bunja, createBunjaStore, createScope, override } from "bunja";

interface Api { load(): Promise<string>; subscribe(): () => void }
const ApiScope = createScope<Api>();
export const apiBunja = bunja(() => bunja.use(ApiScope));
export const documentBunja = bunja(() => {
  const api = bunja.use(apiBunja);
  bunja.effect(() => api.subscribe());
  return { load: () => api.load() };
});

// Test: the real documentBunja runs against the replacement dependency.
const events: string[] = [];
const fake: Api = {
  load: async () => "fixture",
  subscribe: () => {
    events.push("start");
    return () => { events.push("stop"); };
  },
};
const store = createBunjaStore({ overrides: [override(apiBunja, () => fake)] });
try {
  const read = () => { throw new Error("Unexpected production scope read"); };
  const first = store.get(documentBunja, read);
  const second = store.get(documentBunja, read);
  strictEqual(first.value, second.value);
  deepStrictEqual(events, []); // get initializes; mount starts effects.
  const releaseFirst = first.mount();
  const releaseSecond = second.mount();
  deepStrictEqual(events, ["start"]);
  strictEqual(await first.value.load(), "fixture");
  releaseFirst();
  deepStrictEqual(events, ["start"]); // Another consumer still owns it.
  releaseSecond();
  deepStrictEqual(events, ["start", "stop"]);
} finally {
  store.dispose();
}
```

The override initializer replaces `apiBunja` only in this store, including transitive reads by `documentBunja`. Its effective graph no longer needs `ApiScope`; another store can still resolve the production graph. Supply overrides when creating the store, not by mutating a definition or a live store. Duplicate targets are rejected.

`override(target, init)` takes an initializer with the target's seed and result types. To inject a value, return it: `override(apiBunja, () => fake)`. For a function value, also return that function from an initializer; passing the value directly is not a separate overload. Bunja does not automatically call a fixture's `dispose` method. Let the test own an externally created fixture, or register its release in the replacement initializer's `bunja.effect` when it should follow instance lifetime.

Use behavioral assertions for scope isolation, replacement, partial/final release, and late async success/error writes. Core tests need an actual `mount` to exercise effects. Framework tests additionally cover context replacement, view subscriptions, and delayed cleanup. A core `createBunjaStore` test does not prove that a React or Solid provider lifecycle is correct.
