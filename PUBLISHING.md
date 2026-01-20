# Publishing Guide

## How to Publish

To publish a new version to npm and JSR, simply create a GitHub Release:

1. Go to [Releases](../../releases) page
2. Click "Draft a new release"
3. Create a new tag with version number (e.g., `v2.3.4`)
4. Click "Publish release"

That's it! GitHub Actions will automatically:

- Update version in `package.json` and `deno.json`
- Build the package
- Publish to npm (with provenance)
- Publish to JSR (with provenance)

## Notes

- Tag format must be `vX.Y.Z` (e.g., `v2.3.4`)
- Publishing uses Trusted Publishing (OIDC) - no tokens required
- Both npm and JSR publishes happen automatically in parallel
