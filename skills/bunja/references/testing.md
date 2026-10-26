# Verify behavior

The [model](../examples/model.ts) uses synthetic services and normal `bunja` package imports. Resolve the package with the consumer app's actual dependency configuration and typecheck with its existing tooling. The accompanying [model tests](../examples/model_test.ts) use Deno; run them with that dependency configuration and permission to read `NODE_ENV` (`--allow-env=NODE_ENV`). They exercise the core store without a browser. Verify adapters in the app's actual renderer and scheduler separately.

Assert same-domain consumers share identity and one subscription; different screen/storage/RPC identities isolate; partial removal keeps the resource alive; final removal closes exactly once; replacement resolves the new service; remount has a fresh lifetime. Resolve/reject deferred requests after replacement and final disposal. Assert no state/error writes, including when another owner keeps the underlying RPC alive. For overlapping refreshes ensure newest wins. Test actual cleanup ordering rather than assuming dependency services are usable during teardown.

For intentional local state and app-wide services, verify the intended ownership remains: independent inputs do not change each other, and removing a feature does not dispose an app-owned service. A passing core-store test does not prove framework renderer behavior.
