# Bunja consumer skill validation — 2026-10-26

## Source and scope

Validation was performed in an isolated local clone based on public HEAD `a10a9d8daa065a82caf6643a9c816df675e546bf`. The original checkout stayed unchanged, with empty `git status --short` before/after. No original application or concurrent project files were changed. The validation phase did not publish or install the skill globally. A subsequent user-authorized draft PR distributes only the skill and these evaluation artifacts; it does not authorize merge, release, or global installation.

Inspected current core source, React/Solid adapters, README, existing tests, repository tree/instructions, and official local skill-creator SKILL.md. No tracked AGENTS.md or `.agents/skills` existed at public HEAD; the original checkout had no `.agents` directory. Both design essays were read (second via direct HTML download after web-reader failure). Public rieul commit `50827d2ed61ec9c7f5c4641efec1adedc8dba755` informed synthetic storage, domain alignment, and async scenarios. Source/API rather than the still-2.0.0 manifests determined examples.

Distribution: `skills/bunja` is the single skill. Six conditional references and two executable core example files. Evaluation artifacts are outside the skill in `skill-evals/bunja`. Examples use portable `bunja` package imports; the evaluation-only `import_map.json` resolves that package to the inspected source. Core example fields are intentionally nonreactive snapshots; framework UI uses its existing reactive state mechanism.

## Ordinary verification actually run

| Check | Result |
| --- | --- |
| Official skill-creator `quick_validate.py skills/bunja` | PASS, `Skill is valid!` |
| `deno check --no-config --import-map=skill-evals/bunja/import_map.json skills/bunja/examples/model.ts skills/bunja/examples/model_test.ts` | PASS |
| `deno test --no-config --import-map=skill-evals/bunja/import_map.json --allow-env=NODE_ENV skills/bunja/examples/model_test.ts` | 5 passed, 0 failed |
| `deno test --allow-env=NODE_ENV bunja/test.ts` | 27 passed, 0 failed |
| `deno fmt --check skills/bunja/examples` | PASS |
| `git diff --check` | PASS |

Example assertions cover shared identity/one subscription, screen/service/storage isolation, seed first initialization, partial/final cleanup, fresh remount, stale success/error suppression, newest request wins, same-entry effect replay, dependency cleanup order, and selected `will` result. Existing upstream tests additionally exercise inactive optional branches. Python's missing PyYAML was installed only into the task's `validation-deps` folder for the official validator. Initial test attempts exposed a missing required `createReadScopeFn` fallback and missing NODE_ENV permission; both were corrected before the passing runs.

## Independent A/B execution

Two fresh-history agents received identical four-case `prompts.json` raw snippets in separate directories. Baseline had no skill; treatment was explicitly given a snapshot of the skill. Neither received criteria, expected answers, implementation conclusions, or the other output. Agents could inspect current official public sources. No automatic selection or cross-product evaluation was performed. The treatment snapshot preceded the later addition of the storage example/test and extra replay test; its workflow and six reference instructions were already present, except the test command's environment flag correction.

Criteria were recorded in `criteria.md` before reviewing outputs. The table judges concrete proposed code and acceptance checks, not actual renderer execution:

| Case | Baseline behavioral review | With-skill behavioral review | Executed evidence |
| --- | --- | --- | --- |
| Coupled screens / service replacement | PASS: per-owner filter/endpoint, injected storage and keys | PASS: explicit owner factory, captured aligned dependencies and replacement | Treatment screen/storage test passed; baseline URL runtime check could not run |
| Shared Hook duplicates state/subscription | PASS: Jotai atom `onMount`, same store, partial/final ownership | PASS: stable bunja, Jotai-store scope, effect owns listener | Both proposed renderer checks only; no React/Jotai execution |
| Late async response after owner gone | PASS: owner lease + generation guards success/error | PASS: lifetime + request guards, remount and retained transport | Baseline 10 V8 assertions reported; treatment 2 async Deno tests passed |
| Local state / intended app service | PASS: keeps editor state and root telemetry | PASS: keeps both owners, checks cleanup contract | Code review; renderer checks unrun |

Baseline outputs: `runs/baseline/results.md`. It inspected Jotai official docs and executed its search controller through V8. Its Node shim could not resolve tools/network and V8 lacked `URL`; those limitations are retained verbatim in its record.

Treatment outputs: `runs/with-skill/results.md`, `proposed.ts`, `proposed_test.ts`. The parent independently reran `deno check --no-config` on both files and `deno test --no-config .../proposed_test.ts`: **3 passed, 0 failed**. The count is one screen/storage test plus two async tests, covering two of the four evaluation cases. The Hook and negative local/app-service cases were substantively reviewed, with their renderer acceptance checks unrun. These tests validate the proposed minimal fixes, not Bunja's renderer integration. Its Bunja quote code is a reviewed proposal with explicit unrun framework acceptance checks.

No measured improvement is established: both agents satisfied the behavioral rubric in this small comparison. The skill-guided run retained minimal fixes for screens/async, chose Bunja for a shared resource, and kept unrelated local/app-wide state. Do not report a fabricated accuracy score or treat unit-test counts as skill-evaluation success rates.

## Limits

No actual React/Solid renderer runs, no implicit-trigger selection test, and no Claude/Codex cross-product compatibility runs. Markdown portability is a target only. Framework examples in references are contextual sketches; executable/typechecked examples are the core `.ts` files. No unresolved implementation blocker; renderer/product verification remains a stated limitation rather than a claim of compatibility.

Final packaging review found repository-relative source imports in the original example files; these were corrected to package imports, with the repository-only map kept outside the ZIP. All internal Markdown links are relative within the skill. Repository React/Solid examples configure Vite apps but provide no installed renderer test suite or adapter tests, so no new renderer tooling/dependencies were introduced solely for this review.

A fresh independent reviewer read both evaluation outputs and core/adapter source, finding no substantive API, negative-applicability, scope, or privacy issue. It flagged outdated path/import descriptions in the report and historical treatment output. The report was corrected and the raw treatment output explicitly labeled historical. Extracted ZIP examples were independently typechecked and rerun outside the repository: 5 passed, 0 failed, using the evaluation import map to resolve the dependency. This verifies package layout with a supplied dependency mapping, not an install in another AI product.

The existing PR workflow (`.github/workflows/test.yml`) runs `deno test --allow-env` only in `bunja/`. It covers the 27 core tests, not the skill examples or evaluation artifacts. The local checks above provide the skill-specific evidence; CI success alone must not be presented as skill validation.
