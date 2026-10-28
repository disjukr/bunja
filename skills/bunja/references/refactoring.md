# Refactor consumer ownership

Trace allocation and reads from each consumer to its state store, persistence, subscription, and RPC service. Record current externally visible behavior (including storage failures and deliberate retention) before choosing a boundary.

For coupled screens, introduce the smallest explicit scope key for the concern and align state, storage, and RPC dependencies with it. Moving only the state while looking up a mutable global service selection can send an instance's actions to the wrong injected service. When a Hook hides shareable state, actions, or resource effects, extract a React-independent core first, then assemble it in a stable bunja definition outside renders. Keep React Hook calls in the thin consumer layer; do not move the Hook itself into a molecule. Preserve UI-specific DOM/focus behavior in the view.

Move resource acquisition into effects and return disposal handles. Consider shared derived objects, subscriptions, and app-wide effects for extraction too. Use an app owner for intentionally app-wide lifetimes; retain existing ownership when extraction is difficult or its benefit does not justify the change. Do not assume a dependency outlives consumer cleanup. Add lifetime/request guards before moving asynchronous operations; cover late failures as well as successes.

Replace service imports with narrow injected interfaces where replacement is required. Keep existing public actions and state representations unless the task needs a change. Give storage and reactive stores separate scope identities when consumers need independent replacement or isolation. Avoid incidental persistence synchronization, silent error swallowing, and replacing Jotai merely because Bunja is introduced.

Finish with the ownership contract, concrete diff, and consumer integration instructions. A correct outcome can be no Bunja change.
