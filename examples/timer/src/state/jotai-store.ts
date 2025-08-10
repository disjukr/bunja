import { createScope } from "bunja";
import { createStore } from "jotai";

export type JotaiStore = ReturnType<typeof createStore>;

/**
 * Scope for sharing jotai store across bunja instances
 */
export const JotaiStoreScope = createScope<JotaiStore>();
