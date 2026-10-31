import { test } from "node:test";
import { deepStrictEqual, notStrictEqual } from "node:assert";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { bunja, createBunjaStore, createScope } from "./bunja.ts";
import { BunjaStoreContext, useBunja } from "./react.ts";
import { toBunjaRenderTree } from "../devtools/react/brt.ts";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test("React switches store ownership with equal scope values and exposes store identity", async () => {
  const a = createBunjaStore();
  const b = createBunjaStore();
  const scope = createScope<string>();
  const events: string[] = [];
  let count = 0;
  const model = bunja(() => {
    const id = ++count;
    const value = bunja.use(scope);
    bunja.effect(() => {
      events.push(`start:${id}`);
      return () => { events.push(`stop:${id}`); };
    });
    return { id, value };
  });
  let value: unknown;
  function Consumer() {
    value = useBunja(model, [scope.bind("same")]);
    return null;
  }
  const tree = (store: typeof a) => createElement(BunjaStoreContext.Provider, { value: store }, createElement(Consumer));
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(tree(a)); });
    const first = value;
    deepStrictEqual(events, ["start:1"]);
    const brt = toBunjaRenderTree((renderer.root as any)._fiber);
    deepStrictEqual(brt[0].type, "component");
    if (brt[0].type === "component") deepStrictEqual(brt[0].bunjaHooks[0].storeId, a.id);
    deepStrictEqual(b.inspect(model).baked, false);
    await act(async () => { renderer.update(tree(b)); });
    await settle();
    notStrictEqual(value, first);
    deepStrictEqual(events, ["start:1", "start:2", "stop:1"]);
    deepStrictEqual(a.inspect(model).baked, true);
    deepStrictEqual(b.inspect(model).baked, true);
  } finally {
    await act(async () => { renderer?.unmount(); });
    await settle();
    a.dispose(); b.dispose();
  }
  deepStrictEqual(events, ["start:1", "start:2", "stop:1", "stop:2"]);
});
