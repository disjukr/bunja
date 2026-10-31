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
  getOwner,
  type Owner,
  useContext,
} from "solid-js";
import { bunja, createScope, type ScopeValuePairs } from "./bunja.ts";
import {
  bindScope,
  BunjaStoreContext,
  BunjaStoreProvider,
  createScopeFromContext,
  useBunja,
} from "./solid.ts";

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

for (const explicit of [false, true]) {
  test(`Solid owner hints follow ${explicit ? "explicit" : "context"} scopes and inputs`, async () => {
    const Context = createContext((): string => "default");
    const Scope = createScopeFromContext(Context);
    const model = bunja(() => ({ id: bunja.use(Scope) }));
    const otherModel = bunja(() => ({ id: `other:${bunja.use(Scope)}` }));
    type HintOwner = Owner & {
      storeId?: string;
      bunja?: unknown;
      scopeValuePairs?: unknown;
      bunjaInstance?: { value: unknown };
    };
    let caller!: Owner;
    let storeId!: string;
    let first!: () => { id: string };
    let second!: typeof first;
    let changeScope!: (id: string) => void;
    let changeBunja!: () => void;
    let dispose!: () => void;
    let pairs: ScopeValuePairs | undefined;
    const getRef = { bunja: otherModel };
    createRoot(cleanup => {
      dispose = cleanup;
      const [id, setId] = createSignal("a");
      const [definition, setDefinition] = createSignal<typeof model | typeof getRef>(model);
      changeScope = setId;
      changeBunja = () => { setDefinition(getRef); };
      createComponent(BunjaStoreProvider, {
        get children() {
          return createComponent(Context.Provider, {
            value: id,
            get children() {
              caller = getOwner()!;
              storeId = useContext(BunjaStoreContext).id;
              const bindings = explicit
                ? () => {
                  pairs = [Scope.bind(id())];
                  return pairs;
                }
                : undefined;
              first = useBunja(definition, bindings);
              second = useBunja(model);
              return null;
            },
          });
        },
      });
    });
    const hints = () => (caller.owned as HintOwner[]).filter(node => "bunjaInstance" in node);
    try {
      await settle();
      const initial = hints();
      if (process.env.NODE_ENV === "production") {
        deepStrictEqual(initial, []);
      } else {
        strictEqual(initial.length, 2);
        notStrictEqual(initial[0], initial[1]);
        strictEqual(initial[0].storeId, storeId);
        strictEqual(initial[0].bunja, model);
        strictEqual(initial[0].scopeValuePairs, pairs);
        strictEqual(initial[1].scopeValuePairs, undefined);
        strictEqual(initial[0].bunjaInstance, initial[1].bunjaInstance);
      }
      changeScope("b");
      await settle();
      deepStrictEqual(first(), { id: "b" });
      if (process.env.NODE_ENV !== "production") {
        strictEqual(hints()[0], initial[0]);
        strictEqual(initial[0].scopeValuePairs, pairs);
        strictEqual(initial[0].bunjaInstance!.value, first());
        strictEqual(initial[0].bunjaInstance, initial[1].bunjaInstance);
      }
      changeBunja();
      await settle();
      deepStrictEqual(first(), { id: "other:b" });
      deepStrictEqual(second(), { id: "b" });
      if (process.env.NODE_ENV === "production") {
        deepStrictEqual(hints(), []);
      } else {
        deepStrictEqual(hints(), initial);
        strictEqual(initial[0].bunja, getRef);
        strictEqual(initial[0].scopeValuePairs, pairs);
        strictEqual(initial[0].bunjaInstance!.value, first());
        strictEqual(initial[1].bunja, model);
        strictEqual(initial[1].bunjaInstance!.value, second());
        notStrictEqual(initial[0].bunjaInstance, initial[1].bunjaInstance);
      }
    } finally {
      dispose();
      await settle();
    }
    strictEqual(caller.owned, null);
  });
}

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
