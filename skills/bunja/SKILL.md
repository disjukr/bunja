---
name: bunja
description: Design, review, implement, and refactor consumer frontend state with Bunja when sharing boundaries, effect ownership, lifetime, or replaceable services matter, even without an explicit Bunja request. Keep independent local state and intentional app-wide services when they already fit.
---

# Bunja consumer workflow

1. Establish desired sharing, isolation, lifetime, and replacement behavior: which consumers share an instance, which must differ, who keeps it alive, and what happens when a service changes.
2. Find concrete evidence of mismatch in the app: coupled screens, duplicate subscriptions, stale responses, persistence in the wrong domain, or cleanup that outlives its owner. Do not infer a defect merely from the use of a global store or Hook.
3. Choose **keep**, **minimal fix**, or **Bunja**, with a reason tied to that evidence. Respect the user's architecture. Bunja manages lifetime; existing state libraries, including Jotai, can remain. Do not force adoption for simple local state.
4. Inspect current installed types and the latest official source/docs before implementing. Use the latest API only; if the app cannot use it, state the constraint rather than inventing compatibility code. Keep initialization pure, dependency declarations static, resources in effects, and async writes guarded by lifetime and request generation.
5. Verify observable behavior: shared identity, isolated domains, partial/final unmount, replacement, late success/failure, and intended retention. Report what ran and what remains unverified.

Read only relevant references:

- [design](references/design.md): decide ownership and applicability.
- [patterns](references/patterns.md): scope, seed, static graph, resource and service recipes.
- [refactoring](references/refactoring.md): preserve contracts while changing ownership.
- [React](references/react.md) or [Solid](references/solid.md): framework integration.
- [testing](references/testing.md): lifecycle verification and runnable examples.

This is a consumer skill. Avoid library maintenance, release work, or universal state-library replacement rules. The files are portable Markdown and TypeScript; product compatibility requires actual runs.
