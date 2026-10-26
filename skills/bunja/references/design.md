# Decide the ownership contract

Write a small ownership table for the feature: state/resource, sharing key, isolation domain, start/end, replaceable dependencies. A screen ID, document ID, storage implementation, RPC session, and reactive store may be distinct domains. Align dependencies with the same domain: selecting another screen globally must not silently redirect an existing screen's RPC calls.

Prefer keeping independent input state local. Keep intentionally app-wide authentication, telemetry, or a long-lived transport app-wide when requirements say so. A provider or explicit owner may be the smallest sufficient fix. Choose Bunja when a shared feature needs an explicit dependency/lifetime boundary, especially when several consumers must share one subscription until the last consumer leaves.

Sharing includes derived objects and effects, not only values. Two calls to a custom Hook share code; they do not inherently share state or subscription identity. Conversely, a query cache may already provide the required sharing; inspect it before adding another layer.

Use these design essays for the four questions (sharing range, lifetime, derived-state sharing, feature cohesion), not as a source of guaranteed current API snippets:

- https://hackers.pub/@flow/2026/four-problems-with-fe-state
- https://hackers.pub/@flow/2026/bunja-solves-four-problems-with-fe-state

The public [rieul example](https://github.com/disjukr/rieul.app/commit/50827d2ed61ec9c7f5c4641efec1adedc8dba755) demonstrates storage injection, matching machine/RPC scope, and stale async guards. Translate these principles into synthetic domains; do not copy personal app data. Scope injection does not imply adding live cross-tab storage synchronization or changing error contracts.
