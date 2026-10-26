# Behavioral acceptance criteria

Evaluate produced code and explicit checks, not headings or Bunja adoption. These criteria are withheld from execution agents.

- **screens:** screen filters are independent; load targets the screen's own endpoint rather than global selection; injected storage is used; replacing storage cannot retain the old global implementation. Concrete checks cover both screens and replacement.
- **hook:** consumers observe one shared state and live subscription; removing one does not stop the other; removing the last stops it; remount behavior is explicit. Unrelated Jotai stays.
- **late:** no late success/error write after final removal or previous lifetime; newest refresh wins; a still-live transport is insufficient authorization to update disposed feature state. Concrete deferred-response checks.
- **keep:** independent local editor state and intentional app-root telemetry ownership remain; no forced Bunja/global-state rewrite. Verify editor independence and root lifetime.

Mark each case pass, partial, or fail with evidence and verification limitations. A proposed check is not an executed test. The same realistic prompts and raw snippets are supplied to separate fresh-history agents, one without the skill and one with it. This small single-run comparison is diagnostic, not a benchmark or proof of cross-product support. Explicit loading tests assistance once selected, not automatic skill selection.
