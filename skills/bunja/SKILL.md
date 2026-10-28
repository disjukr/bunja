---
name: bunja
description: Design, review, implement, and refactor consumer frontend state with Bunja when sharing boundaries, effect ownership, lifetime, or replaceable services matter, even without an explicit Bunja request. Consider shared derived objects, subscriptions, and app-wide concerns as well as feature state; keep existing ownership when migration costs outweigh its benefits.
---

# Bunja consumer workflow

1. Establish desired sharing, isolation, lifetime, and replacement behavior: which consumers share an instance, which must differ, who keeps it alive, and what happens when a service changes.
2. Find concrete evidence of mismatch in the app: coupled screens, duplicate subscriptions, stale responses, persistence attached to the wrong concern, or cleanup that outlives its owner. Several useEffect calls in one component are a signal to review whether state and effects for separate concerns could be extracted and shared. The count alone does not establish a defect; UI-specific effects can stay with their component. Do not infer a defect merely from the use of a global store or Hook.
3. Choose **keep**, **minimal fix**, or **Bunja**, with a reason tied to that evidence. Consider Bunja for global state and effects too when extraction is straightforward and useful; retain existing ownership when adoption is difficult or the benefit does not justify the change. Respect the user's architecture. Bunja manages lifetime; existing state libraries, including Jotai, can remain. Do not force adoption for simple local state.
4. Separate roles: Bunja owns instance sharing, lifetime, and DI; the app's existing signal/atom primitives own reactive state; extract shareable logic from React Hooks into a React-independent core, compose it in Bunja, and let views consume it directly through `useBunja` and state-library bindings rather than adding a custom Hook wrapper. Keep initialization pure, dependency declarations static, resources in effects, and async writes guarded by lifetime and request generation.
5. Explain how consumers bind scopes, share instances, replace dependencies, and release resources, including intended app-wide retention.

Read only relevant references:

- [design](references/design.md): decide ownership and applicability.
- [patterns](references/patterns.md): scope, seed, static graph, resource and service recipes.
- [refactoring](references/refactoring.md): preserve contracts while changing ownership.
- [React](references/react.md) or [Solid](references/solid.md): framework integration.

This is a consumer skill. Avoid library maintenance, release work, or universal state-library replacement rules. The references and example describe consumer usage.
