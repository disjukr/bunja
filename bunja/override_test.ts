import { deepStrictEqual, strictEqual, notStrictEqual, throws } from "node:assert";
import { test } from "node:test";
import { Bunja, bunja, createBunjaStore, createScope, override } from "./bunja.ts";

const readNull = <T>() => null as T;

for (const reverse of [false, true]) {
  test(`overrides isolate effective graphs in either store order (${reverse})`, () => {
    const originalScope = createScope<string>();
    const fakeScope = createScope<string>();
    let originalCalls = 0;
    const target = bunja(() => {
      originalCalls++;
      return bunja.use(originalScope);
    });
    const parent = bunja(() => bunja.use(target));
    const original = createBunjaStore();
    original.prebake(parent, <T>() => "original" as T);
    const scoped = createBunjaStore({ overrides: [override(target, () => bunja.use(fakeScope))] });
    const fixed = createBunjaStore({ overrides: [override(target, () => "fixed")] });
    for (const store of reverse ? [fixed, scoped] : [scoped, fixed]) {
      const read = <T>(scope: unknown) => {
        strictEqual(scope, fakeScope);
        return "scoped" as T;
      };
      strictEqual(store.get(parent, read).value, store === scoped ? "scoped" : "fixed");
      strictEqual(store.get(target, read).value, store === scoped ? "scoped" : "fixed");
      deepStrictEqual(store.inspect(parent).requiredScopes, store === scoped ? [fakeScope] : []);
      deepStrictEqual(store.prebake(parent, read).requiredScopes, store === scoped ? [fakeScope] : []);
    }
    strictEqual(originalCalls, 1);
    deepStrictEqual(original.inspect(parent).requiredScopes, [originalScope]);
    original.dispose(); scoped.dispose(); fixed.dispose();
  });
}

test("replacement seeds, scopes, sharing and effects use the normal lifetime machinery", () => {
  const scope = createScope<string>();
  const events: string[] = [];
  const seeds: number[] = [];
  let wrappers = 0;
  let cleanups = 0;
  const target = bunja.withSeed(10, (seed): { scope: string; seed: number } => {
    throw new Error(`original initializer ran: ${seed}`);
  });
  const store = createBunjaStore({
    wrapInstance(fn) { wrappers++; return fn(() => { cleanups++; }); },
    overrides: [override(target, seed => {
      seeds.push(seed);
      const value = bunja.use(scope);
      bunja.effect(() => {
        events.push(`start:${value}`);
        return () => { events.push(`stop:${value}`); };
      });
      return { scope: value, seed };
    })],
  });
  const first = store.get({ bunja: target, seed: 20, with: [scope.bind("a")] }, readNull);
  const shared = store.get({ bunja: target, seed: 30, with: [scope.bind("a")] }, readNull);
  const other = store.get({ bunja: target, seed: 40, with: [scope.bind("b")] }, readNull);
  strictEqual(first.value, shared.value);
  notStrictEqual(first.value, other.value);
  deepStrictEqual(first.value, { scope: "a", seed: 20 });
  deepStrictEqual(seeds, [20, 40]);
  deepStrictEqual(events, []);
  const stopFirst = first.mount();
  const stopShared = shared.mount();
  const stopOther = other.mount();
  deepStrictEqual(events, ["start:a", "start:b"]);
  stopFirst();
  deepStrictEqual(events, ["start:a", "start:b"]);
  stopShared();
  deepStrictEqual(events, ["start:a", "start:b", "stop:a"]);
  store.dispose();
  stopOther();
  deepStrictEqual(events, ["start:a", "start:b", "stop:a", "stop:b"]);
  strictEqual(cleanups, wrappers);
  store.prebake(target, <T>() => "dry-run" as T);
  strictEqual(seeds.at(-1), 10);
  strictEqual(cleanups, wrappers);
  deepStrictEqual(events, ["start:a", "start:b", "stop:a", "stop:b"]);
  store.get(target, <T>() => "unmounted" as T);
  store.dispose();
  strictEqual(cleanups, wrappers);
});

test("active will resolves replacements; inactive will stays lazy until explicit prebake", () => {
  const enabled = createScope<boolean>();
  let original = 0;
  let initialized = 0;
  const events: string[] = [];
  const target = bunja(() => { original++; return "original"; });
  const child = bunja(() => "child");
  const parent = bunja(() => {
    const read = bunja.will(target);
    return bunja.use(enabled) ? read() : "inactive";
  });
  const store = createBunjaStore({ overrides: [override(child, () => "fake child"), override(target, () => {
    initialized++;
    bunja.effect(() => { events.push("start"); return () => { events.push("stop"); }; });
    return bunja.use(child);
  })] });
  const inactive = store.get(parent, <T>() => false as T);
  const stopInactive = inactive.mount();
  strictEqual(inactive.value, "inactive");
  strictEqual(initialized, 0);
  strictEqual(store.inspect(target).baked, false);
  const graph = store.prebake(parent, <T>() => false as T);
  deepStrictEqual(graph.relatedBunjas, [child, target]);
  strictEqual(initialized, 1);
  deepStrictEqual(events, []);
  const active = store.get(parent, <T>() => true as T);
  strictEqual(active.value, "fake child");
  const stopActive = active.mount();
  deepStrictEqual(events, ["start"]);
  stopInactive(); stopActive();
  deepStrictEqual(events, ["start", "stop"]);
  strictEqual(original, 0);
  store.dispose();
});

test("configuration is copied, descriptors allocate no Bunja, and values need explicit cleanup", () => {
  let disposed = 0;
  const fake = { dispose() { disposed++; } };
  const target = bunja(() => fake);
  const hook = (globalThis as any).__BUNJA_DEVTOOLS_GLOBAL_HOOK__;
  const count = Object.keys(hook.bunjas).length;
  const descriptor = override(target, () => fake);
  strictEqual(descriptor instanceof Bunja, false);
  strictEqual(Object.keys(hook.bunjas).length, count);
  const overrides = [descriptor];
  const store = createBunjaStore({ overrides });
  overrides.length = 0;
  (descriptor as any).init = () => { throw new Error("changed descriptor"); };
  strictEqual(store.get(target, readNull).value, fake);
  store.dispose();
  strictEqual(store.get(target, readNull).value, fake);
  store.dispose();
  strictEqual(disposed, 0);
  throws(() => createBunjaStore({ overrides: [override(target, () => fake), override(target, () => fake)] }), /Duplicate/);
});

test("replacement cycles fail in runtime and prebake without poisoning another store", () => {
  const a = bunja(() => "a");
  const b = bunja(() => bunja.use(a));
  for (const operation of ["get", "prebake"] as const) {
    const store = createBunjaStore({ overrides: [override(a, () => bunja.use(b))] });
    throws(() => store[operation](a, readNull), /Circular/);
    deepStrictEqual(store.snapshot().graphs, []);
    store.dispose();
  }
  const ordinary = createBunjaStore();
  strictEqual(ordinary.get(b, readNull).value, "a");
  ordinary.dispose();
});

test("override types come from the target; function-valued results are unambiguous", () => {
  const target = bunja.withSeed("seed", seed => seed.length);
  override(target, seed => seed.length);
  // @ts-expect-error The target fixes the result type.
  override(target, () => "wrong result");
  // @ts-expect-error The target fixes the initializer's seed type.
  override(target, (seed: number) => seed);
  // @ts-expect-error A fixed value must be returned by an initializer.
  override(target, 3);
  const fake = () => 42;
  const functionTarget = bunja(() => (): number => 0);
  const store = createBunjaStore({ overrides: [override(functionTarget, () => fake)] });
  strictEqual(store.get(functionTarget, readNull).value, fake);
  strictEqual(store.get(functionTarget, readNull).value(), 42);
  store.dispose();
});
