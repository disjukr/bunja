import { test } from "node:test";
import { strictEqual } from "node:assert";
import { createComponent, createContext, createRoot } from "solid-js";
import { bunja } from "./bunja.ts";
import { BunjaStoreProvider, createScopeFromContext, useBunja } from "./solid.ts";

test("server resolves scoped shared instances without mounting client effects", () => {
  const Context = createContext("default");
  const Scope = createScopeFromContext(Context);
  let mounts = 0, renders = 0;
  const model = bunja(() => {
    const id = bunja.use(Scope);
    bunja.effect(() => { mounts++; });
    return { id };
  });
  createRoot(dispose => {
    const view = createComponent(BunjaStoreProvider, {
      get children() {
        return createComponent(Context, {
          value: "request",
          get children() {
            renders++;
            const first = useBunja(model), second = useBunja(model);
            strictEqual(first(), second());
            strictEqual(first().id, "request");
            return null;
          },
        });
      },
    });
    let result: unknown = view;
    while (typeof result === "function") result = result();
    strictEqual(renders, 1);
    strictEqual(mounts, 0);
    dispose();
  });
});
