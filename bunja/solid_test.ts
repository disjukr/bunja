import {
  assertEquals,
  assertNotStrictEquals,
  assertStrictEquals,
} from "@std/assert";
import {
  createComponent,
  createContext,
  createRoot,
  createSignal,
} from "solid-js";
import { bunja, createScope } from "./bunja.ts";
import {
  bindScope,
  BunjaStoreProvider,
  createScopeFromContext,
  useBunja,
} from "./solid.ts";

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

for (
  const mode of ["context accessor", "bindScope accessor", "explicit binding"]
) {
  const explicit = mode === "explicit binding";
  Deno.test(`Solid ${mode} lifecycle`, async () => {
    const Context = createContext<string | (() => string)>(() => "default");
    const Scope = mode === "bindScope accessor"
      ? createScope<string>()
      : createScopeFromContext(Context);
    if (mode === "bindScope accessor") bindScope(Scope, Context);
    const events: string[] = [];
    const model = bunja(() => {
      const id = bunja.use(Scope);
      bunja.effect(() => {
        events.push(`start:${id}`);
        return () => {
          events.push(`stop:${id}`);
        };
      });
      return { id };
    });
    // Exercise transitive scope discovery, including the first unbaked instance.
    const parent = bunja(() => bunja.use(model));
    let value!: () => { id: string };
    let other!: typeof value;
    let change!: (id: string) => void;
    let dispose!: () => void;
    let unmount!: () => void;
    createRoot((cleanup) => {
      dispose = cleanup;
      const [id, setId] = createSignal("a");
      change = setId;
      createComponent(BunjaStoreProvider, {
        get children() {
          return createComponent(Context.Provider, {
            value: id,
            get children() {
              const bindings = explicit ? () => [Scope.bind(id())] : undefined;
              value = useBunja(parent, bindings);
              createRoot((cleanup) => {
                unmount = cleanup;
                other = useBunja(parent, bindings);
              });
              return null;
            },
          });
        },
      });
    });
    try {
      await settle();
      const first = value();
      assertEquals(first.id, "a");
      assertStrictEquals(other(), first);
      assertEquals(events, ["start:a"]);
      change("a");
      await settle();
      assertStrictEquals(value(), first);
      for (const id of ["b", "a"]) {
        const previous = value();
        change(id);
        await settle();
        assertEquals(value().id, id);
        assertNotStrictEquals(value(), previous);
        assertStrictEquals(other(), value());
      }
      assertEquals(events, [
        "start:a",
        "start:b",
        "stop:a",
        "start:a",
        "stop:b",
      ]);
      unmount();
      await settle();
      assertEquals(events.length, 5);
    } finally {
      unmount();
      dispose();
      await settle();
    }
    assertEquals(events, [
      "start:a",
      "start:b",
      "stop:a",
      "start:a",
      "stop:b",
      "stop:a",
    ]);
  });
}

Deno.test("Solid bindScope, explicit precedence and mixed context fallback", async () => {
  const Context = createContext<string | null | (() => string | null)>(null);
  const Scope = createScope<string | null>();
  bindScope(Scope, Context);
  const Other = createContext((): string => "default");
  const OtherScope = createScopeFromContext(Other);
  const model = bunja(() => ({
    id: bunja.use(Scope),
    other: bunja.use(OtherScope),
  }));
  let value!: () => { id: string | null; other: string };
  let change!: (value: string) => void;
  let override!: (value: boolean) => void;
  let dispose!: () => void;
  createRoot((cleanup) => {
    dispose = cleanup;
    const [id, setId] = createSignal("a");
    const [explicit, setExplicit] = createSignal(true);
    change = setId;
    override = setExplicit;
    createComponent(BunjaStoreProvider, {
      get children() {
        return createComponent(Other.Provider, {
          value: id,
          get children() {
            value = useBunja(
              model,
              () => explicit() ? [OtherScope.bind("override")] : [],
            );
            return null;
          },
        });
      },
    });
  });
  try {
    await settle();
    const first = value();
    assertEquals(first, { id: null, other: "override" });
    change("b");
    await settle();
    assertStrictEquals(value(), first);
    override(false);
    await settle();
    assertEquals(value(), { id: null, other: "b" });
    change("c");
    await settle();
    assertEquals(value(), { id: null, other: "c" });
  } finally {
    dispose();
    await settle();
  }
});
