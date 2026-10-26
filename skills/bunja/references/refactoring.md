# Refactor consumer ownership

Trace allocation and reads from each consumer to its state store, persistence, subscription, and RPC service. Record current externally visible behavior (including storage failures and deliberate retention) before choosing a boundary.

For coupled screens, introduce the smallest explicit domain key and align state, storage, and RPC dependencies with it. Moving only the state while keeping a globally selected RPC service leaves a cross-domain bug. For duplicated Hooks, extract one stable bunja definition outside renders; leave UI subscriptions to the existing state library.

Move resource acquisition into effects and return disposal handles. Preserve intentional app-wide dependencies with an explicit app owner if necessary. Do not assume a dependency outlives consumer cleanup. Add lifetime/request guards before moving asynchronous operations; cover late failures as well as successes.

Replace service imports with narrow injected interfaces where replacement is required. Keep existing public actions and state representations unless the task needs a change. Verify storage replacement and reactive-store isolation separately. Avoid incidental persistence synchronization, silent error swallowing, and replacing Jotai merely because Bunja is introduced.

Finish with the ownership contract, concrete diff, observable checks, and any untested framework behavior. A correct outcome can be no Bunja change.
