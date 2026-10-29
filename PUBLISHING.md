# Publishing Guide

Publication is a separate release action. Normal development and CI do not publish,
create tags, or change versions.

## Prepare locally

From the repository root, run `mise install`, `pnpm install --frozen-lockfile`,
and `pnpm check` to type-check, test and build all workspace packages.

`pnpm version:release v4.0.0-beta.1` updates both `bunja/package.json` and
`bunja/jsr.json`. It does not commit, tag or publish. Versions remain unchanged until
release preparation is explicitly requested.

## Publish a release

Create a GitHub Release with a `vX.Y.Z` or `vX.Y.Z-prerelease` tag. The release
workflow installs the same Node.js and pnpm versions from `mise.toml`, performs a
frozen install, sets the version from the tag, runs `pnpm check`, validates JSR,
then publishes npm followed by JSR. Trusted publishing uses GitHub OIDC; the job
needs `id-token: write` and the existing registry/repository trust configuration.
No persistent registry tokens are needed.

npm uses `--provenance`. Stable releases use the `latest` dist-tag; prereleases use
the first prerelease identifier (`v4.0.0-beta.1` uses `beta`). Verify both registries
if a workflow fails partway through: publishing is sequential, not atomic.

## JSR remains a distribution target

`@disjukr/bunja` retains its TypeScript source exports in `bunja/jsr.json`. The
pinned official `jsr` npm CLI runs via `pnpm exec jsr publish` from `bunja/`.
It supports GitHub OIDC and provenance. For verification without publishing:

```sh
pnpm --dir bunja exec jsr publish --dry-run --allow-dirty
```
