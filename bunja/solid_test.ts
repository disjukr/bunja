import { test } from "node:test";
import {
  deepStrictEqual,
  notStrictEqual,
  strictEqual,
} from "node:assert";
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
  test(`Solid ${mode} lifecycle`, async () => {
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
      deepStrictEqual(first.id, "a");
      strictEqual(other(), first);
      deepStrictEqual(events, ["start:a"]);
      change("a");
      await settle();
      strictEqual(value(), first);
      for (const id of ["b", "a"]) {
        const previous = value();
        change(id);
        await settle();
        deepStrictEqual(value().id, id);
        notStrictEqual(value(), previous);
        strictEqual(other(), value());
      }
      deepStrictEqual(events, [
        "start:a",
        "start:b",
        "stop:a",
        "start:a",
        "stop:b",
      ]);
      unmount();
      await settle();
      deepStrictEqual(events.length, 5);
    } finally {
      unmount();
      dispose();
      await settle();
    }
    deepStrictEqual(events, [
      "start:a",
      "start:b",
      "stop:a",
      "start:a",
      "stop:b",
      "stop:a",
    ]);
  });
}

test("Solid bindScope, explicit precedence and mixed context fallback", async () => {
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
    deepStrictEqual(first, { id: null, other: "override" });
    change("b");
    await settle();
    strictEqual(value(), first);
    override(false);
    await settle();
    deepStrictEqual(value(), { id: null, other: "b" });
    change("c");
    await settle();
    deepStrictEqual(value(), { id: null, other: "c" });
  } finally {
    dispose();
    await settle();
  }
});

test("Solid providers independently discover a shared definition", async () => {
  const scope = createScope<string>();
  const events: string[] = [];
  let initialized = 0;
  const model = bunja(() => {
    initialized++;
    const value = bunja.use(scope);
    bunja.effect(() => {
      events.push(`start:${value}`);
      return () => { events.push(`stop:${value}`); };
    });
    return { value };
  });
  const roots: (() => void)[] = [];
  const values: (() => { value: string })[] = [];
  for (const value of ["a", "b"]) {
    createRoot(dispose => {
      roots.push(dispose);
      createComponent(BunjaStoreProvider, {
        get children() {
          values.push(useBunja(model, [scope.bind(value)]));
          return null;
        },
      });
    });
  }
  try {
    await settle();
    deepStrictEqual(initialized, 2);
    deepStrictEqual(values.map(read => read().value), ["a", "b"]);
    notStrictEqual(values[0](), values[1]());
    roots[0]();
    await settle();
    deepStrictEqual(events, ["start:a", "start:b", "stop:a"]);
    deepStrictEqual(values[1]().value, "b");
  } finally {
    roots.forEach(dispose => dispose());
    await settle();
  }
  deepStrictEqual(events, ["start:a", "start:b", "stop:a", "stop:b"]);
});
