import { bunja, createBunjaStore, createReadScopeFn } from "bunja";
import {
  model,
  ModeScope,
  preferences,
  ScreenScope,
  selected,
  type Service,
  ServiceScope,
  StorageScope,
} from "./model.ts";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function fixture() {
  let starts = 0, stops = 0;
  const requests: ReturnType<typeof Promise.withResolvers<string>>[] = [];
  const service: Service = {
    subscribe() {
      starts++;
      return () => {
        stops++;
      };
    },
    load() {
      const d = Promise.withResolvers<string>();
      requests.push(d);
      return d.promise;
    },
  };
  return { service, requests, counts: () => [starts, stops] };
}
const read = (screen: string, service: Service) =>
  createReadScopeFn([
    ScreenScope.bind(screen),
    ServiceScope.bind(service),
  ], () => {
    throw new Error("unbound scope");
  });

Deno.test("sharing, screen/service isolation, seed first initialization, partial/final cleanup", () => {
  const store = createBunjaStore(), a = fixture(), b = fixture();
  const first = store.get(
    { bunja: model, seed: { title: "first" } },
    read("one", a.service),
  );
  const stop1 = first.mount();
  const second = store.get(
    { bunja: model, seed: { title: "ignored" } },
    read("one", a.service),
  );
  const stop2 = second.mount();
  assert(
    first.value === second.value && second.value.snapshot().title === "first",
    "seed must not key or update instance",
  );
  const other = store.get(model, read("two", a.service));
  const stop3 = other.mount();
  const replacement = store.get(model, read("one", b.service));
  const stop4 = replacement.mount();
  assert(
    other.value !== first.value && replacement.value !== first.value,
    "scope domains isolate",
  );
  stop1();
  assert(a.counts().join() === "2,0", "partial cleanup retains subscription");
  stop2();
  assert(a.counts().join() === "2,1", "final cleanup stops only its domain");
  const fresh = store.get(model, read("one", a.service));
  const stop5 = fresh.mount();
  assert(
    fresh.value !== first.value && fresh.value.snapshot().title === "",
    "remount is fresh",
  );
  stop3();
  stop4();
  stop5();
  store.dispose();
  assert(
    a.counts().join() === "3,3" && b.counts().join() === "1,1",
    "each resource stops once",
  );
});
Deno.test("newest request wins; late success/failure cannot write after final cleanup or replacement", async () => {
  const store = createBunjaStore(), a = fixture(), b = fixture();
  const entry = store.get(model, read("one", a.service));
  const stop = entry.mount();
  const old = entry.value.refresh(), newer = entry.value.refresh();
  a.requests[1].resolve("new");
  await newer;
  a.requests[0].resolve("old");
  await old;
  assert(
    entry.value.snapshot().title === "new",
    "old request cannot overtake new",
  );
  const lateSuccess = entry.value.refresh(),
    lateFailure = entry.value.refresh();
  stop();
  const replacement = store.get(model, read("one", b.service));
  const stopNew = replacement.mount();
  a.requests[2].resolve("late");
  a.requests[3].reject(new Error("late error"));
  await Promise.all([lateSuccess, lateFailure]);
  assert(
    entry.value.snapshot().title === "new" &&
      entry.value.snapshot().error === undefined,
    "disposed state unchanged",
  );
  assert(replacement.value.snapshot().title === "", "replacement untouched");
  stopNew();
  store.dispose();
});
Deno.test("storage domains share, replace, isolate screens, and reload next lifetime", () => {
  const store = createBunjaStore();
  function memory() {
    const values = new Map<string, string>();
    return {
      values,
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    };
  }
  const a = memory(), b = memory();
  const get = (screen: string, storage = a) =>
    store.get(
      preferences,
      createReadScopeFn(
        [ScreenScope.bind(screen), StorageScope.bind(storage)],
        () => {
          throw new Error("unbound");
        },
      ),
    );
  const first = get("one"),
    same = get("one"),
    other = get("two"),
    replaced = get("one", b);
  const stops = [first.mount(), same.mount(), other.mount(), replaced.mount()];
  first.value.set("red");
  assert(
    first.value === same.value && same.value.read() === "red",
    "same storage/screen shares",
  );
  assert(
    other.value.read() === "" && replaced.value.read() === "",
    "screen and storage replacements isolate",
  );
  assert(
    a.values.get("filter:one") === "red" && b.values.size === 0,
    "writes use injected storage",
  );
  stops.forEach((stop) => stop());
  a.values.set("filter:one", "external");
  const next = get("one");
  const stop = next.mount();
  assert(
    next.value !== first.value && next.value.read() === "external",
    "new lifetime reloads storage",
  );
  stop();
  store.dispose();
});

Deno.test("generation guard survives replay of the same entry", async () => {
  const store = createBunjaStore(), f = fixture();
  const entry = store.get(model, read("one", f.service));
  const stop = entry.mount();
  const pending = entry.value.refresh();
  stop();
  const stopAgain = entry.mount();
  f.requests[0].resolve("from previous lifetime");
  await pending;
  assert(
    entry.value.snapshot().title === "",
    "active boolean alone cannot guard a replay",
  );
  stopAgain();
  store.dispose();
});

Deno.test("dependency cleanup precedes consumer; will selects only active branch", () => {
  const order: string[] = [];
  const dep = bunja(() => {
    bunja.effect(() => () => {
      order.push("dep");
    });
  });
  const consumer = bunja(() => {
    bunja.use(dep);
    bunja.effect(() => () => {
      order.push("consumer");
    });
  });
  const store = createBunjaStore();
  store.get(consumer, () => {
    throw new Error("unexpected scope");
  }).mount()();
  assert(
    order.join() === "dep,consumer",
    "cleanup order is part of resource contract",
  );
  const entry = store.get(
    selected,
    createReadScopeFn([ModeScope.bind("b")], () => {
      throw new Error("unbound scope");
    }),
  );
  const stop = entry.mount();
  assert(entry.value === "b", "will chooses branch");
  stop();
  store.dispose();
});
