# Decide the ownership contract

Write a small ownership table for each concern: state/resource, sharing key, instance boundary, start/end, and replaceable dependencies. A concern describes related behavior; a scope value identifies which instances share that behavior. A document ID, storage implementation, service object, and reactive store can each contribute a distinct scope identity.

For example, two consumers may bind different service objects to `ServiceScope`: consumer A receives service A and consumer B receives service B. Each resolved model must keep using its own injected service for subscriptions and later actions. A call by consumer B must not change which service consumer A uses. Read the service from its scope during initialization and capture it in the instance's actions, rather than looking up a mutable global selection on each call. Consumers bound to the same service object can share an instance when their other scope bindings match.

Prefer keeping independent input state local. Global state and effects are also candidates for Bunja: authentication, telemetry, or a transport can have an app-wide owner and still be molecules. Extract them when doing so is straightforward and provides useful sharing or ownership. Keeping the existing arrangement is reasonable when migration is difficult or its cost exceeds its benefit. A provider or explicit owner may also be sufficient.

Sharing includes derived objects and effects, not only values. Two calls to a custom Hook share code; they do not inherently share a derived object or subscription instance. Look for repeated allocations, subscriptions, and effect setup across consumers, and consider whether a shared molecule can reduce those instances. A query cache may share fetched values while consumers still duplicate derived objects or subscriptions; inspect those separately. Keep an existing cache when useful, without treating it as the preferred answer to instance sharing.

Consider four questions together: which consumers need the same instance, what keeps it alive, which derived objects or effects should be shared, and which state and actions belong to one concern. Keep related state, actions, and resource ownership together behind a small consumer interface. Separate unrelated concerns so consumers can choose only the dependencies they need.

Several useEffect calls in one component are a useful prompt to inspect those boundaries: unrelated state and effects may belong to separate, shareable concerns. The number alone is not a defect, and effects tied to a particular DOM node or UI interaction can remain in the component.

## Make the contract observable

For a document service, distinguish the document key from the service implementation:

| Concern | Sharing key in one store | Lifetime | Replacement |
| --- | --- | --- | --- |
| Document actions | Document ID and service object | Mounted consumers | New service object selects a new instance |
| App transport | Service object | Explicit app consumer | Release old consumer after switching |

This small vanilla example demonstrates why the service is captured at initialization:

```ts
import { strictEqual, notStrictEqual } from "node:assert";
import { bunja, createBunjaStore, createReadScopeFn, createScope } from "bunja";

interface Service { save(id: string): string }
const DocumentScope = createScope<string>();
const ServiceScope = createScope<Service>();
const documentBunja = bunja(() => {
  const id = bunja.use(DocumentScope);
  const service = bunja.use(ServiceScope);
  return { save: () => service.save(id) };
});
const serviceA: Service = { save: id => `A:${id}` };
const serviceB: Service = { save: id => `B:${id}` };
const store = createBunjaStore();
const read = (service: Service) => createReadScopeFn(
  [DocumentScope.bind("doc-1"), ServiceScope.bind(service)],
  () => { throw new Error("Missing scope"); },
);
try {
  const a = store.get(documentBunja, read(serviceA));
  const shared = store.get(documentBunja, read(serviceA));
  const b = store.get(documentBunja, read(serviceB));
  strictEqual(a.value, shared.value);
  notStrictEqual(a.value, b.value);
  strictEqual(b.value.save(), "B:doc-1");
  strictEqual(a.value.save(), "A:doc-1");
} finally {
  store.dispose();
}
```

These actions have no reactive state or resource effects. In an actual view, expose the app's existing atoms/signals for state; for a subscription, use an effect and a mounted owner as shown in [patterns](patterns.md#resources-and-replacement). A `get`-only probe does not establish a resource lifetime.
