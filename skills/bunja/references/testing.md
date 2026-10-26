# Verify behavior

Run repository-local executable examples with:

```sh
deno check --no-config --import-map=skill-evals/bunja/import_map.json skills/bunja/examples/model.ts skills/bunja/examples/model_test.ts
deno test --no-config --import-map=skill-evals/bunja/import_map.json --allow-env=NODE_ENV skills/bunja/examples/model_test.ts
```

These repository-root commands use an evaluation-only import map to resolve `bunja` to the inspected source. The distributable examples use normal package imports and synthetic services. Outside this repository, resolve `bunja` with the consumer app's actual dependency configuration and run with its TypeScript/test tooling (the example tests use Deno). The repository import map and evaluation fixtures are deliberately not shipped in the skill ZIP. Verify adapters in the app's actual renderer and scheduler separately.

Assert same-domain consumers share identity and one subscription; different screen/storage/RPC identities isolate; partial removal keeps the resource alive; final removal closes exactly once; replacement resolves the new service; remount has a fresh lifetime. Resolve/reject deferred requests after replacement and final disposal. Assert no state/error writes, including when another owner keeps the underlying RPC alive. For overlapping refreshes ensure newest wins. Test actual cleanup ordering rather than assuming dependency services are usable during teardown.

These are ordinary unit tests of example behavior, not skill evaluations. True evaluations give fresh agents realistic prompts and isolated raw fixtures, with and without the skill. Use identical prompts, avoid answer/rubric leaks, and judge produced changes by lifecycle, sharing, isolation, cleanup, and preserved intent. Evaluation prompts and raw fixtures live outside this distributable skill under `skill-evals/bunja`.
