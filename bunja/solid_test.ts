import { test } from "node:test";
import {
  deepStrictEqual,
  notStrictEqual,
  strictEqual,
} from "node:assert";
import {
  createComponent,
  createEffect,
  createMemo,
  flush,
  createContext,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
} from "solid-js";
import { bunja, createScope, createBunjaStore, override } from "./bunja.ts";
import {
  bindScope,
  BunjaStoreContext,
  BunjaStoreProvider,
  createScopeFromContext,
  useBunja,
} from "./solid.ts";

const settle = async () => {
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  flush();
};

// Solid 2 providers return lazy children; consume them as a renderer would.
function renderProvider(props: Parameters<typeof BunjaStoreProvider>[0]) {
  const view = createComponent(BunjaStoreProvider, props);
  createEffect(() => {
    let value: unknown = view;
    while (typeof value === "function") value = value();
    return value;
  }, () => {});
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
      renderProvider({
        get children() {
          return createComponent(Context, {
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
    renderProvider({
      get children() {
        return createComponent(Other, {
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
      renderProvider({
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

for (const provider of [false, true]) {
  test(`Solid ${provider ? "provider" : "fallback"} survives its first consumer`, async () => {
    let mounts = 0, releases = 0, rootDisposals = 0;
    const model = bunja(() => {
      const [count, setCount] = createSignal(0);
      const doubled = createMemo(() => count() * 2);
      onCleanup(() => rootDisposals++);
      bunja.effect(() => {
        mounts++;
        setCount(1);
        return () => { releases++; };
      });
      return { count, setCount, doubled };
    });
    let first!: ReturnType<typeof useBunja<ReturnType<typeof model.init>>>;
    let second!: typeof first;
    let stopFirst!: () => void, stopSecond!: () => void, stopProvider!: () => void;
    const consumers = () => {
      createRoot(stop => { stopFirst = stop; first = useBunja(model); });
      createRoot(stop => { stopSecond = stop; second = useBunja(model); });
      return null;
    };
    createRoot(stop => {
      stopProvider = stop;
      if (provider) renderProvider({ get children() { return consumers(); } });
      else consumers();
    });
    await settle();
    strictEqual(first(), second());
    strictEqual(mounts, 1);
    strictEqual(second().doubled(), 2);
    stopFirst();
    await settle();
    strictEqual(releases, 0);
    strictEqual(rootDisposals, 0);
    second().setCount(4);
    await settle();
    strictEqual(second().doubled(), 8);
    stopSecond();
    await settle();
    strictEqual(releases, 1);
    strictEqual(rootDisposals, 1);
    stopProvider();
    await settle();
    strictEqual(releases, 1);
    let remounted!: typeof first, stopRemount!: () => void;
    createRoot(stop => {
      stopRemount = stop;
      if (provider) renderProvider({ get children() { remounted = useBunja(model); return null; } });
      else remounted = useBunja(model);
    });
    await settle();
    strictEqual(mounts, 2);
    strictEqual(remounted().count(), 1);
    stopRemount();
    await settle();
    strictEqual(releases, 2);
    strictEqual(rootDisposals, 2);
  });
}

test("Solid refs, seeds, dynamic definitions and store-local overrides", async () => {
  const service = bunja(() => "original");
  const model = bunja.withSeed(0, seed => ({ seed, service: bunja.use(service) }));
  const alternate = bunja.withSeed(0, () => ({ seed: -1, service: bunja.use(service) }));
  let value!: () => { seed: number; service: string };
  let setSeed!: (seed: number) => void, replace!: () => void, stop!: () => void;
  let store!: ReturnType<typeof createBunjaStore>;
  createRoot(dispose => {
    stop = dispose;
    const owner = getOwner();
    store = createBunjaStore({
      overrides: [override(service, () => "replacement")],
      wrapInstance: init => runWithOwner(owner, () => createRoot(init)),
    });
    onCleanup(() => store.dispose());
    const [seed, writeSeed] = createSignal(1);
    const [other, writeOther] = createSignal(false);
    setSeed = writeSeed;
    replace = () => { writeOther(true); };
    const view = createComponent(BunjaStoreContext, {
      value: store,
      get children() {
        value = useBunja(() => other() ? alternate : { bunja: model, seed: seed() });
        return null;
      },
    });
    createEffect(() => {
      let result: unknown = view;
      while (typeof result === "function") result = result();
      return result;
    }, () => {});
  });
  await settle();
  deepStrictEqual(value(), { seed: 1, service: "replacement" });
  const first = value();
  setSeed(2);
  await settle();
  // Seeds initialize instances; they do not change sharing identity.
  strictEqual(value(), first);
  deepStrictEqual(value(), { seed: 1, service: "replacement" });
  replace();
  await settle();
  deepStrictEqual(value(), { seed: -1, service: "replacement" });
  stop();
  await settle();
});

test("Solid discovers a new transitive scope in the current consumer snapshot", async () => {
  const Context = createContext((): string => "default");
  const Scope = createScopeFromContext(Context);
  const initial = bunja(() => ({ id: "initial" }));
  const leaf = bunja(() => ({ id: bunja.use(Scope) }));
  const replacement = bunja(() => bunja.use(leaf));
  let value!: () => { id: string }, change!: () => void, stop!: () => void;
  createRoot(dispose => {
    stop = dispose;
    const [id, setId] = createSignal("a");
    const [definition, setDefinition] = createSignal(initial);
    change = () => { setId("b"); setDefinition(replacement); };
    renderProvider({ get children() {
      return createComponent(Context, { value: id, get children() {
        value = useBunja(definition);
        return null;
      } });
    } });
  });
  await settle();
  strictEqual(value().id, "initial");
  change();
  await settle();
  strictEqual(value().id, "b");
  stop();
  await settle();
});
