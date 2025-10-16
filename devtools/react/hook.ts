import type { BunjaDevtoolsGlobalHook } from "bunja";

export function getHook(): BunjaDevtoolsGlobalHook | undefined {
  return (globalThis as any).__BUNJA_DEVTOOLS_GLOBAL_HOOK__;
}
