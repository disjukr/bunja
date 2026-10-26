# Current consumer patterns

Use `bunja`, `createScope`, `createReadScopeFn`, and `createBunjaStore` from `bunja`. The executable [model](../examples/model.ts) uses the package import. Resolve it through the consumer app's dependency configuration.

## Identity and initialization

`bunja.use(Scope)` makes the scope value part of instance resolution in a store. Default scope hashing uses identity; stabilize service objects rather than allocating them per render. A custom hash deliberately merges values: do not hash services by a label if replacing an implementation must create another instance. Unread scopes do not automatically isolate a bunja; scopes used by active dependencies also affect resolution.

`bunja.withSeed(defaultSeed, seed => ...)` supplies creation data. Pass `{ bunja: formBunja, seed: { title: "Draft" } }` to a consumer. Seed is not an identity key and later seeds do not update an existing matching instance. Use a scope for separate drafts and state actions for updates. Never use a seed to replace a live storage/RPC service.

## Static dependency graph

Call `bunja.use` and `bunja.will` unconditionally in stable order inside initialization. Targets and scope bindings must remain static across initializations; runtime selection belongs in scopes or an unconditional `will` declaration followed by a conditional thunk call. Dynamic seeds are allowed.

```ts
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

Inject storage/RPC implementations through scopes, and inject the state store too when it defines a separate domain. Read persistence during instance initialization rather than at module import. Resolve a replacement scope value and release old consumers; changing a seed will not replace a service.

Cleanup alone does not cancel promises. Invalidate a lifetime token, abort where supported, and check both lifetime and request generation before success **and error** writes. A boolean alone can accept an old response after remount. Also invalidate on in-instance service/session replacement, and stop stream iterators/subscriptions. Do not reset a shared instance when only one of several consumers leaves.
