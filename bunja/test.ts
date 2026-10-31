import { deepStrictEqual, throws } from "node:assert";
import { mock, test } from "node:test";

import { bunja, createBunjaStore, createScope } from "./bunja.ts";
import type { Bunja, BunjaRef } from "./bunja.ts";

const readNull = <T>() => (null as T);

test("basic", () => {
  const store = createBunjaStore();
  const myBunjaInstance = {};
  const myBunja = bunja(() => myBunjaInstance);
  const { value, mount } = store.get(myBunja, readNull);
  const cleanup = mount();
  cleanup();
  deepStrictEqual(value, myBunjaInstance);
});

test("basic effect", () => {
  const store = createBunjaStore();
  const mountSpy = mock.fn();
  const unmountSpy = mock.fn();
  const myBunja = bunja(() => {
    bunja.effect(() => {
      mountSpy();
      return unmountSpy;
    });
  });
  deepStrictEqual(mountSpy.mock.callCount(), 0);
  const { mount } = store.get(myBunja, readNull);
  deepStrictEqual(mountSpy.mock.callCount(), 0);
  const cleanup = mount();
  deepStrictEqual(mountSpy.mock.callCount(), 1);
  deepStrictEqual(unmountSpy.mock.callCount(), 0);
  cleanup();
  deepStrictEqual(unmountSpy.mock.callCount(), 1);
});

test("bunja that depend on other bunja", () => {
  const store = createBunjaStore();
  const [aMountSpy, aUnmountSpy] = [mock.fn(), mock.fn()];
  const [bMountSpy, bUnmountSpy] = [mock.fn(), mock.fn()];
  const aBunjaInstance = {};
  const aBunja = bunja(() => {
    bunja.effect(() => {
      aMountSpy();
      return aUnmountSpy;
    });
    return aBunjaInstance;
  });
  const bBunja = bunja(() => {
    const a = bunja.use(aBunja);
    bunja.effect(() => {
      bMountSpy();
      return bUnmountSpy;
    });
    return { a };
  });
  deepStrictEqual(aMountSpy.mock.callCount(), 0);
  deepStrictEqual(bMountSpy.mock.callCount(), 0);
  const { value, mount } = store.get(bBunja, readNull);
  deepStrictEqual(value.a, aBunjaInstance);
  deepStrictEqual(aMountSpy.mock.callCount(), 0);
  deepStrictEqual(bMountSpy.mock.callCount(), 0);
  const cleanup = mount();
  deepStrictEqual(aMountSpy.mock.callCount(), 1);
  deepStrictEqual(bMountSpy.mock.callCount(), 1);
  deepStrictEqual(aUnmountSpy.mock.callCount(), 0);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 0);
  cleanup();
  deepStrictEqual(aUnmountSpy.mock.callCount(), 1);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 1);
});

test("dependency effects mount and cleanup before consumer effects", () => {
  const store = createBunjaStore();
  const order: string[] = [];
  const dependencyBunja = bunja(() => {
    bunja.effect(() => {
      order.push("dependency mount");
      return () => order.push("dependency cleanup");
    });
  });
  const consumerBunja = bunja(() => {
    bunja.use(dependencyBunja);
    bunja.effect(() => {
      order.push("consumer mount");
      return () => order.push("consumer cleanup");
    });
  });

  const { mount } = store.get(consumerBunja, readNull);
  const cleanup = mount();
  deepStrictEqual(order, ["dependency mount", "consumer mount"]);

  cleanup();
  deepStrictEqual(order, [
    "dependency mount",
    "consumer mount",
    "dependency cleanup",
    "consumer cleanup",
  ]);
});

test("A mount first, B mount later & A unmount first, B unmount later", () => {
  const store = createBunjaStore();
  const [aMountSpy, aUnmountSpy] = [mock.fn(), mock.fn()];
  const [bMountSpy, bUnmountSpy] = [mock.fn(), mock.fn()];
  const aBunja = bunja(() => {
    bunja.effect(() => {
      aMountSpy();
      return aUnmountSpy;
    });
  });
  const bBunja = bunja(() => {
    bunja.use(aBunja);
    bunja.effect(() => {
      bMountSpy();
      return bUnmountSpy;
    });
  });
  const { mount: m1 } = store.get(aBunja, readNull);
  const c1 = m1();
  deepStrictEqual(aMountSpy.mock.callCount(), 1);
  deepStrictEqual(bMountSpy.mock.callCount(), 0);
  const { mount: m2 } = store.get(bBunja, readNull);
  const c2 = m2();
  deepStrictEqual(aMountSpy.mock.callCount(), 1);
  deepStrictEqual(bMountSpy.mock.callCount(), 1);
  deepStrictEqual(aUnmountSpy.mock.callCount(), 0);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 0);
  c1();
  deepStrictEqual(aUnmountSpy.mock.callCount(), 0);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 0);
  c2();
  deepStrictEqual(aUnmountSpy.mock.callCount(), 1);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 1);
});

test("B mount first, A mount later & B unmount first, A unmount later", () => {
  const store = createBunjaStore();
  const [aMountSpy, aUnmountSpy] = [mock.fn(), mock.fn()];
  const [bMountSpy, bUnmountSpy] = [mock.fn(), mock.fn()];
  const aBunja = bunja(() => {
    bunja.effect(() => {
      aMountSpy();
      return aUnmountSpy;
    });
  });
  const bBunja = bunja(() => {
    bunja.use(aBunja);
    bunja.effect(() => {
      bMountSpy();
      return bUnmountSpy;
    });
  });
  const { mount: m1 } = store.get(bBunja, readNull);
  const c1 = m1();
  deepStrictEqual(aMountSpy.mock.callCount(), 1);
  deepStrictEqual(bMountSpy.mock.callCount(), 1);
  const { mount: m2 } = store.get(aBunja, readNull);
  const c2 = m2();
  deepStrictEqual(aMountSpy.mock.callCount(), 1);
  deepStrictEqual(bMountSpy.mock.callCount(), 1);
  deepStrictEqual(aUnmountSpy.mock.callCount(), 0);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 0);
  c1();
  deepStrictEqual(aUnmountSpy.mock.callCount(), 0);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 1);
  c2();
  deepStrictEqual(aUnmountSpy.mock.callCount(), 1);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 1);
});

test("injecting values into a scope when calling store.get", () => {
  const store = createBunjaStore();
  const myScope = createScope<string>();
  const myBunja = bunja(() => {
    const scopeValue = bunja.use(myScope);
    return { scopeValue };
  });
  const readScope = <T>(): T => "injected value" as T;
  const { value: { scopeValue }, mount } = store.get(myBunja, readScope);
  const cleanup = mount();
  cleanup();
  deepStrictEqual(scopeValue, "injected value");
});

test("scope value deduplication using hash function", () => {
  const store = createBunjaStore();
  const myScope = createScope<string>(({ length }) => length);
  const myBunja = bunja(() => {
    const scopeValue = bunja.use(myScope);
    return { scopeValue };
  });
  const { value: { scopeValue: scopeValue1 }, mount: mount1 } = store.get(
    myBunja,
    <T>() => "foo" as T,
  );
  const cleanup1 = mount1();
  const { value: { scopeValue: scopeValue2 }, mount: mount2 } = store.get(
    myBunja,
    <T>() => "bar" as T,
  );
  const cleanup2 = mount2();
  const { value: { scopeValue: scopeValue3 }, mount: mount3 } = store.get(
    myBunja,
    <T>() => "baaz" as T,
  );
  const cleanup3 = mount3();
  deepStrictEqual(scopeValue1, "foo");
  deepStrictEqual(scopeValue2, "foo");
  deepStrictEqual(scopeValue3, "baaz");
  cleanup1();
  cleanup2();
  cleanup3();
});

test("root scope value pairs are included in store.get deps", () => {
  const store = createBunjaStore();
  const myScope = createScope<string>();
  const myBunja = bunja(() => {
    const scopeValue = bunja.use(myScope);
    return { scopeValue };
  });

  const first = store.get(
    { bunja: myBunja, with: [myScope.bind("foo")] },
    readNull,
  );
  const second = store.get(
    { bunja: myBunja, with: [myScope.bind("bar")] },
    readNull,
  );

  deepStrictEqual(first.value.scopeValue, "foo");
  deepStrictEqual(second.value.scopeValue, "bar");
  deepStrictEqual(first.deps, ["foo"]);
  deepStrictEqual(second.deps, ["bar"]);
});

test("bunja.use can override scope value pairs inside a bunja init", () => {
  const store = createBunjaStore();
  const aaScope = createScope<string>();
  const bbScope = createScope<string>();
  const [aMountSpy, aUnmountSpy] = [mock.fn(), mock.fn()];
  const [bMountSpy, bUnmountSpy] = [mock.fn(), mock.fn()];
  const [cMountSpy, cUnmountSpy] = [mock.fn(), mock.fn()];
  const aBunja = bunja(() => {
    bunja.effect(() => (aMountSpy(), aUnmountSpy));
    return {};
  });
  const bBunja = bunja(() => {
    const a = bunja.use(aBunja);
    const scopeValue = bunja.use(aaScope);
    bunja.use(bbScope);
    bunja.effect(() => (bMountSpy(), bUnmountSpy));
    return { a, scopeValue };
  });
  const cBunja = bunja(() => {
    const foo = bunja.use(bBunja, [aaScope.bind("foo")]);
    const bar = bunja.use(bBunja, [aaScope.bind("bar")]);
    bunja.effect(() => (cMountSpy(), cUnmountSpy));
    return { foo, bar };
  });
  deepStrictEqual(aMountSpy.mock.callCount(), 0);
  deepStrictEqual(bMountSpy.mock.callCount(), 0);
  deepStrictEqual(cMountSpy.mock.callCount(), 0);
  const { value, mount: m1, deps: d1 } = store.get(
    cBunja,
    <T>() => "abc" as T,
  );
  deepStrictEqual(aMountSpy.mock.callCount(), 0);
  deepStrictEqual(bMountSpy.mock.callCount(), 0);
  deepStrictEqual(cMountSpy.mock.callCount(), 0);
  const c1 = m1();
  deepStrictEqual(d1, ["abc"]);
  deepStrictEqual(value.foo.a, value.bar.a);
  deepStrictEqual(value.foo.scopeValue, "foo");
  deepStrictEqual(value.bar.scopeValue, "bar");
  deepStrictEqual(aMountSpy.mock.callCount(), 1);
  deepStrictEqual(bMountSpy.mock.callCount(), 2);
  deepStrictEqual(cMountSpy.mock.callCount(), 1);
  deepStrictEqual(aUnmountSpy.mock.callCount(), 0);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 0);
  deepStrictEqual(cUnmountSpy.mock.callCount(), 0);
  const { mount: m2, deps: d2 } = store.get(
    bBunja,
    <T>(scope: any) => ((scope === aaScope) ? "foo" : "abc") as T,
  );
  const c2 = m2();
  deepStrictEqual(d2, ["foo", "abc"]);
  deepStrictEqual(bMountSpy.mock.callCount(), 2);
  c1();
  deepStrictEqual(aUnmountSpy.mock.callCount(), 0);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 1);
  deepStrictEqual(cUnmountSpy.mock.callCount(), 1);
  c2();
  deepStrictEqual(aUnmountSpy.mock.callCount(), 1);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 2);
  deepStrictEqual(cUnmountSpy.mock.callCount(), 1);
});

test("bunja.use with scope value pairs propagates unbound required scopes", () => {
  const createGraph = () => {
    const injectedScope = createScope<string>();
    const outerScope = createScope<string>();
    const dependencyBunja = bunja(() => {
      const injected = bunja.use(injectedScope);
      const outer = bunja.use(outerScope);
      return { injected, outer };
    });
    const consumerBunja = bunja(() =>
      bunja.use(dependencyBunja, [injectedScope.bind("injected")])
    );
    return { consumerBunja, injectedScope, outerScope };
  };
  const readScope = <T>() => "outer" as T;

  const prebakeGraph = createGraph();
  const { requiredScopes } = createBunjaStore().prebake(
    prebakeGraph.consumerBunja,
    readScope,
  );
  deepStrictEqual(requiredScopes.length, 1);
  deepStrictEqual(requiredScopes[0] === prebakeGraph.outerScope, true);
  deepStrictEqual(
    requiredScopes.some((scope) => scope === prebakeGraph.injectedScope),
    false,
  );

  const getGraph = createGraph();
  const getStore = createBunjaStore();
  const { value, deps } = getStore.get(
    getGraph.consumerBunja,
    readScope,
  );
  const requiredScopes2 = getStore.inspect(getGraph.consumerBunja).requiredScopes;
  deepStrictEqual(value, { injected: "injected", outer: "outer" });
  deepStrictEqual(deps, ["outer"]);
  deepStrictEqual(requiredScopes2.length, 1);
  deepStrictEqual(
    requiredScopes2[0] === getGraph.outerScope,
    true,
  );
  deepStrictEqual(
    requiredScopes2.some((scope) => scope === getGraph.injectedScope),
    false,
  );
});

test("seed is used only when creating a bunja instance", () => {
  const store = createBunjaStore();
  const myBunja = bunja.withSeed({ value: "default" }, (seed) => ({ seed }));

  const { value: firstValue, mount: firstMount } = store.get(
    { bunja: myBunja, seed: { value: "first" } },
    readNull,
  );
  const firstCleanup = firstMount();

  const { value: secondValue, mount: secondMount } = store.get(
    { bunja: myBunja, seed: { value: "second" } },
    readNull,
  );
  const secondCleanup = secondMount();

  deepStrictEqual(firstValue.seed.value, "first");
  deepStrictEqual(secondValue, firstValue);

  firstCleanup();
  secondCleanup();

  const { value: thirdValue, mount: thirdMount } = store.get(
    { bunja: myBunja, seed: { value: "third" } },
    readNull,
  );
  const thirdCleanup = thirdMount();

  deepStrictEqual(thirdValue.seed.value, "third");
  thirdCleanup();
});

test("bunja.use can provide seed without storing it in graph refs", () => {
  const store = createBunjaStore();
  const seededDependencyBunja = bunja.withSeed(
    { value: "default" },
    (seed) => seed.value,
  );
  const seededDependencyRef: BunjaRef<string, { value: string }> = {
    bunja: seededDependencyBunja,
    seed: { value: "dependency" },
  };
  const consumerBunja = bunja(() => {
    return bunja.use(seededDependencyRef);
  });

  const { value, mount } = store.get(consumerBunja, readNull);
  const cleanup = mount();

  deepStrictEqual(value, "dependency");
  deepStrictEqual(store.inspect(consumerBunja).requiredBunjaRefs.length, 1);
  deepStrictEqual("seed" in store.inspect(consumerBunja).requiredBunjaRefs[0], false);

  cleanup();
});

test("prebake rejects root seed and initializes with default seed", () => {
  const store = createBunjaStore();
  const usedSeeds: string[] = [];
  const myBunja = bunja.withSeed({ value: "default" }, (seed) => {
    usedSeeds.push(seed.value);
    return seed.value;
  });
  const myRef: BunjaRef<string, { value: string }> = {
    bunja: myBunja,
    seed: { value: "custom" },
  };
  const consumerBunja = bunja(() => bunja.use(myRef));

  store.prebake(myBunja, readNull);
  store.prebake(consumerBunja, readNull);

  deepStrictEqual(usedSeeds, ["default", "default"]);
  deepStrictEqual("seed" in store.inspect(consumerBunja).requiredBunjaRefs[0], false);
  throws(
    () => {
      // @ts-expect-error Prebake collects deterministic graph data only.
      store.prebake(myRef, readNull);
    },
    (error: unknown) => error instanceof Error && error.message.includes("seed cannot be provided to `store.prebake`"),
  );
});

test("bunja.will mounts only the selected dependency", () => {
  const store = createBunjaStore();
  const condScope = createScope<"a" | "b">();
  const [aMountSpy, aUnmountSpy] = [mock.fn(), mock.fn()];
  const [bMountSpy, bUnmountSpy] = [mock.fn(), mock.fn()];
  const aBunja = bunja(() => {
    bunja.effect(() => (aMountSpy(), aUnmountSpy));
    return "a";
  });
  const bBunja = bunja(() => {
    bunja.effect(() => (bMountSpy(), bUnmountSpy));
    return "b";
  });
  const consumerBunja = bunja(() => {
    const cond = bunja.use(condScope);
    const getA = bunja.will(aBunja);
    const getB = bunja.will(bBunja);
    return cond === "a" ? getA() : getB();
  });

  const { value, mount } = store.get(
    consumerBunja,
    <T>() => "a" as T,
  );
  deepStrictEqual(value, "a");
  deepStrictEqual(store.inspect(consumerBunja).relatedBunjas, [aBunja, bBunja]);

  const cleanup = mount();
  deepStrictEqual(aMountSpy.mock.callCount(), 1);
  deepStrictEqual(bMountSpy.mock.callCount(), 0);

  cleanup();
  deepStrictEqual(aUnmountSpy.mock.callCount(), 1);
  deepStrictEqual(bUnmountSpy.mock.callCount(), 0);
});

test("active bunja.will dependency effects cleanup before consumer effects", () => {
  const store = createBunjaStore();
  const order: string[] = [];
  const dependencyBunja = bunja(() => {
    bunja.effect(() => {
      order.push("dependency mount");
      return () => order.push("dependency cleanup");
    });
  });
  const consumerBunja = bunja(() => {
    const getDependency = bunja.will(dependencyBunja);
    getDependency();
    bunja.effect(() => {
      order.push("consumer mount");
      return () => order.push("consumer cleanup");
    });
  });

  const { mount } = store.get(consumerBunja, readNull);
  const cleanup = mount();
  deepStrictEqual(order, ["dependency mount", "consumer mount"]);

  cleanup();
  deepStrictEqual(order, [
    "dependency mount",
    "consumer mount",
    "dependency cleanup",
    "consumer cleanup",
  ]);
});

test("bunja.will records optional refs once when thunk is used", () => {
  const createConsumer = () => {
    const dependencyBunja = bunja(() => "dependency");
    const consumerBunja = bunja(() => {
      const getDependency = bunja.will(dependencyBunja);
      return getDependency();
    });
    return { consumerBunja };
  };

  const getGraph = createConsumer();
  const getStore = createBunjaStore();
  getStore.get(getGraph.consumerBunja, readNull);

  const prebakeGraph = createConsumer();
  const prebakeStore = createBunjaStore();
  prebakeStore.prebake(prebakeGraph.consumerBunja, readNull);

  deepStrictEqual(getStore.inspect(getGraph.consumerBunja).optionalBunjaRefs.length, 1);
  deepStrictEqual(prebakeStore.inspect(prebakeGraph.consumerBunja).optionalBunjaRefs.length, 1);
});

test("relatedBunjas includes nested bunja.will dependencies", () => {
  const store = createBunjaStore();
  const grandparentDependencyBunja = bunja(() => "grandparent");
  const parentDependencyBunja = bunja(() => {
    bunja.will(grandparentDependencyBunja);
    return "parent";
  });
  const consumerBunja = bunja(() => {
    const getParent = bunja.will(parentDependencyBunja);
    return getParent();
  });

  const { mount } = store.get(consumerBunja, readNull);
  const cleanup = mount();

  deepStrictEqual(store.inspect(consumerBunja).relatedBunjas, [
    grandparentDependencyBunja,
    parentDependencyBunja,
  ]);

  cleanup();
});

test("prebake expands inactive bunja.will dependency graph", () => {
  const store = createBunjaStore();
  const grandparentDependencyMountSpy = mock.fn();
  const grandparentDependencyBunja = bunja(() => {
    bunja.effect(() => {
      grandparentDependencyMountSpy();
    });
    return "grandparent";
  });
  const parentDependencyBunja = bunja(() => {
    bunja.will(grandparentDependencyBunja);
    return "parent";
  });
  const consumerBunja = bunja(() => {
    bunja.will(parentDependencyBunja);
    return "consumer";
  });

  const { value, mount } = store.get(consumerBunja, readNull);
  const cleanup = mount();

  deepStrictEqual(value, "consumer");
  deepStrictEqual(store.inspect(consumerBunja).relatedBunjas, [parentDependencyBunja]);
  deepStrictEqual(grandparentDependencyMountSpy.mock.callCount(), 0);

  const prebaked = store.prebake(consumerBunja, readNull);

  deepStrictEqual(prebaked.relatedBunjas, [
    grandparentDependencyBunja,
    parentDependencyBunja,
  ]);
  deepStrictEqual(store.inspect(consumerBunja).relatedBunjas, [
    grandparentDependencyBunja,
    parentDependencyBunja,
  ]);
  deepStrictEqual(grandparentDependencyMountSpy.mock.callCount(), 0);

  cleanup();
});

test("prebake runs each dependency once per traversal", () => {
  const store = createBunjaStore();
  const requiredInitSpy = mock.fn();
  const optionalInitSpy = mock.fn();
  const requiredDependencyBunja = bunja(() => {
    requiredInitSpy();
    return "required";
  });
  const optionalDependencyBunja = bunja(() => {
    optionalInitSpy();
    return "optional";
  });
  const consumerBunja = bunja(() => {
    const required = bunja.use(requiredDependencyBunja);
    const getOptional = bunja.will(optionalDependencyBunja);
    return `${required}:${getOptional()}`;
  });

  store.prebake(consumerBunja, readNull);

  deepStrictEqual(requiredInitSpy.mock.callCount(), 1);
  deepStrictEqual(optionalInitSpy.mock.callCount(), 1);

  store.prebake(consumerBunja, readNull);

  deepStrictEqual(requiredInitSpy.mock.callCount(), 2);
  deepStrictEqual(optionalInitSpy.mock.callCount(), 2);
});

test("prebake disposes the dry-run wrapper", () => {
  const disposeSpy = mock.fn();
  let wrapCalls = 0;
  const store = createBunjaStore({
    wrapInstance: (fn) => {
      wrapCalls++;
      return fn(disposeSpy);
    },
  });
  const myBunja = bunja(() => "value");

  store.prebake(myBunja, readNull);

  deepStrictEqual(wrapCalls, 1);
  deepStrictEqual(disposeSpy.mock.callCount(), 1);
});

test("bunja.will thunk can only be called during the same bunja init", () => {
  const store = createBunjaStore();
  const parentDependencyBunja = bunja(() => "parent");
  let getParent!: () => string;
  const consumerBunja = bunja(() => {
    getParent = bunja.will(parentDependencyBunja);
    return {};
  });

  const { mount } = store.get(consumerBunja, readNull);
  const cleanup = mount();

  throws(
    () => getParent(),
    (error: unknown) => error instanceof Error && error.message.includes("same bunja init function"),
  );

  cleanup();
});

test("store.get rejects circular bunja dependencies", () => {
  const disposeSpy = mock.fn();
  const store = createBunjaStore({
    wrapInstance: (fn) => fn(disposeSpy),
  });
  let bBunja!: Bunja<string>;
  const aBunja = bunja(() => bunja.use(bBunja));
  bBunja = bunja(() => bunja.use(aBunja));

  throws(
    () => store.get(aBunja, readNull),
    (error: unknown) => error instanceof Error && error.message.includes("Circular bunja dependency detected."),
  );
  deepStrictEqual(disposeSpy.mock.callCount(), 2);
});

test("prebake rejects circular bunja dependencies", () => {
  const store = createBunjaStore();
  let bBunja!: Bunja<string>;
  const aBunja = bunja(() => bunja.use(bBunja));
  bBunja = bunja(() => bunja.use(aBunja));

  throws(
    () => store.prebake(aBunja, readNull),
    (error: unknown) => error instanceof Error && error.message.includes("Circular bunja dependency detected."),
  );
});

test("active optional dependency scopes are part of bunja instance identity", () => {
  const store = createBunjaStore();
  const condScope = createScope<boolean>();
  const resourceScope = createScope<string>();
  const mounted: string[] = [];
  const unmounted: string[] = [];
  const parentDependencyBunja = bunja(() => {
    const resource = bunja.use(resourceScope);
    bunja.effect(() => {
      mounted.push(resource);
      return () => unmounted.push(resource);
    });
    return { resource };
  });
  const consumerBunja = bunja(() => {
    const cond = bunja.use(condScope);
    const getParent = bunja.will(parentDependencyBunja);
    return { parent: cond ? getParent() : null };
  });
  const readScope = (resource: string) => <T>(scope: unknown) =>
    (scope === condScope ? true : resource) as T;

  const first = store.get(consumerBunja, readScope("a"));
  const firstCleanup = first.mount();
  const second = store.get(consumerBunja, readScope("b"));
  const secondCleanup = second.mount();

  deepStrictEqual(store.inspect(consumerBunja).requiredScopes.length, 1);
  deepStrictEqual(store.inspect(consumerBunja).requiredScopes[0] === condScope, true);
  deepStrictEqual(first.value.parent?.resource, "a");
  deepStrictEqual(second.value.parent?.resource, "b");
  deepStrictEqual(first.value === second.value, false);
  deepStrictEqual(first.deps, [true, "a"]);
  deepStrictEqual(second.deps, [true, "b"]);
  deepStrictEqual(mounted, ["a", "b"]);

  firstCleanup();
  deepStrictEqual(unmounted, ["a"]);
  secondCleanup();
  deepStrictEqual(unmounted, ["a", "b"]);
});

test("inactive optional dependency scopes do not change bunja instance identity", () => {
  const store = createBunjaStore();
  const condScope = createScope<boolean>();
  const resourceScope = createScope<string>();
  const parentDependencyMountSpy = mock.fn();
  const parentDependencyBunja = bunja(() => {
    bunja.use(resourceScope);
    bunja.effect(() => {
      parentDependencyMountSpy();
    });
    return {};
  });
  const consumerBunja = bunja(() => {
    const cond = bunja.use(condScope);
    const getParent = bunja.will(parentDependencyBunja);
    return { parent: cond ? getParent() : null };
  });
  const readScope = (resource: string) => <T>(scope: unknown) =>
    (scope === condScope ? false : resource) as T;

  const first = store.get(consumerBunja, readScope("a"));
  const second = store.get(consumerBunja, readScope("b"));
  const firstCleanup = first.mount();
  const secondCleanup = second.mount();

  deepStrictEqual(store.inspect(consumerBunja).requiredScopes.length, 1);
  deepStrictEqual(store.inspect(consumerBunja).requiredScopes[0] === condScope, true);
  deepStrictEqual(first.value, second.value);
  deepStrictEqual(first.deps, [false]);
  deepStrictEqual(second.deps, [false]);
  deepStrictEqual(parentDependencyMountSpy.mock.callCount(), 0);

  firstCleanup();
  secondCleanup();
});

test("duplicate optional dependency calls are mounted once", () => {
  const store = createBunjaStore();
  const mountSpy = mock.fn();
  const parentDependencyValue = {};
  const parentDependencyBunja = bunja(() => {
    bunja.effect(() => {
      mountSpy();
    });
    return parentDependencyValue;
  });
  const consumerBunja = bunja(() => {
    const getParent = bunja.will(parentDependencyBunja);
    return {
      first: getParent(),
      second: getParent(),
    };
  });

  const { value, mount } = store.get(consumerBunja, readNull);
  const cleanup = mount();

  deepStrictEqual(value.first, parentDependencyValue);
  deepStrictEqual(value.second, parentDependencyValue);
  deepStrictEqual(mountSpy.mock.callCount(), 1);

  cleanup();
});

for (const first of ["get", "prebake"] as const) {
  test(`graphs are store-local after ${first}, in either store order`, () => {
    for (const reverse of [false, true]) {
      const stores = [createBunjaStore(), createBunjaStore()];
      if (reverse) stores.reverse();
      const [a, b] = stores;
      const scope = createScope<string>();
      const injected = createScope<string>();
      const calls: string[] = [];
      const leaf = bunja.withSeed("default", seed => {
        calls.push(seed);
        return [bunja.use(scope), bunja.use(injected), seed];
      });
      const parent = bunja(() => bunja.use({ bunja: leaf, seed: "child", with: [injected.bind("bound")] }));
      a[first](parent, <T>() => "a" as T);
      deepStrictEqual(b.inspect(parent).baked, false);
      deepStrictEqual(b.snapshot().graphs, []);
      deepStrictEqual(b.get(parent, <T>() => "b" as T).value, ["b", "bound", "child"]);
      deepStrictEqual(b.inspect(parent).requiredScopes, [scope]);
      deepStrictEqual(b.inspect(leaf).scopes, [scope, injected]);
      deepStrictEqual(calls, [first === "get" ? "child" : "default", "child"]);
      deepStrictEqual("baked" in parent, false);
      const result = b.prebake(parent, <T>() => "b" as T);
      result.requiredScopes.length = 0;
      deepStrictEqual(b.inspect(parent).requiredScopes, [scope]);
      a.dispose();
      deepStrictEqual(a.snapshot().graphs, []);
      deepStrictEqual(b.inspect(parent).baked, true);
      a.dispose();
      b.dispose();
    }
  });
}

test("failed discovery is discarded, successful children remain valid", () => {
  for (const operation of ["get", "prebake"] as const) {
    const a = createBunjaStore();
    const b = createBunjaStore();
    const failedScope = createScope<string>();
    const scope = createScope<string>();
    const child = bunja(() => bunja.use(scope));
    let fail = true;
    const parent = bunja(() => {
      bunja.use(child);
      if (fail) {
        bunja.use(failedScope);
        throw new Error("failed init");
      }
      return bunja.use(scope);
    });
    throws(() => a[operation](parent, readNull), /failed init/);
    deepStrictEqual(a.inspect(parent).baked, false);
    deepStrictEqual(a.inspect(parent).scopes, []);
    deepStrictEqual(a.snapshot().graphs.map(g => g.bunjaId), [child.id]);
    deepStrictEqual(b.snapshot().graphs, []);
    fail = false;
    b[operation](parent, readNull);
    a[operation](parent, readNull);
    deepStrictEqual(a.inspect(parent).requiredScopes, [scope]);
    deepStrictEqual(b.inspect(parent).requiredScopes, [scope]);
    a.dispose(); b.dispose();
  }
});

test("static declarations are enforced per store and reset on disposal", () => {
  const store = createBunjaStore();
  const other = createBunjaStore();
  const scope = createScope<number>();
  const first = bunja(() => 1);
  const second = bunja(() => 2);
  let dependency = first;
  const parent = bunja(() => {
    bunja.use(scope);
    return bunja.use(dependency);
  });
  deepStrictEqual(store.get(parent, <T>() => 1 as T).value, 1);
  dependency = second;
  throws(() => store.get(parent, <T>() => 2 as T), /new dependency/);
  deepStrictEqual(other.get(parent, <T>() => 2 as T).value, 2);
  store.dispose();
  deepStrictEqual(store.inspect(parent).baked, false);
  deepStrictEqual(store.get(parent, <T>() => 2 as T).value, 2);
  store.dispose(); other.dispose();
});

test("observation is read-only, supports late attachment, and separates optional/active edges", () => {
  const hook = (globalThis as any).__BUNJA_DEVTOOLS_GLOBAL_HOOK__ as import("./bunja.ts").BunjaDevtoolsGlobalHook;
  const store = createBunjaStore();
  const active = createScope<boolean>();
  let initialized = 0;
  let mounted = 0;
  const child = bunja(() => { initialized++; return {}; });
  const parent = bunja(() => {
    const getChild = bunja.will(child);
    const value = bunja.use(active) ? getChild() : undefined;
    bunja.effect(() => { mounted++; return () => { mounted--; }; });
    return value;
  });
  const before = store.snapshot();
  deepStrictEqual(store.inspect(parent).baked, false);
  deepStrictEqual(store.snapshot(), before);
  const off = store.get(parent, <T>() => false as T);
  deepStrictEqual(store.inspect(parent).optionalBunjaRefs.map(ref => ref.bunja), [child]);
  deepStrictEqual(store.snapshot().instances[0].activeDependencyIds, []);
  deepStrictEqual(store.inspect(parent).relatedBunjas, [child]);
  deepStrictEqual(store.snapshot().graphs.length, 1);
  deepStrictEqual(initialized, 0);
  deepStrictEqual(mounted, 0);
  const late = hook.snapshot().find(snapshot => snapshot.storeId === store.id)!;
  deepStrictEqual(late, store.snapshot());
  throws(() => (late.graphs as unknown[]).push({}), TypeError);
  const changes: string[] = [];
  const unsubscribe = hook.on("graphChanged", event => {
    if (event.storeId === store.id) changes.push(event.bunjaId);
  });
  const on = store.get(parent, <T>() => true as T);
  deepStrictEqual(initialized, 1);
  deepStrictEqual(changes, [child.id]);
  deepStrictEqual(store.snapshot().instances.find(i => i.id === on.bunjaInstance!.id)!.activeDependencyIds, [store.snapshot().instances.find(i => i.bunjaId === child.id)!.id]);
  const cleanup = on.mount();
  const cleanup2 = on.mount();
  deepStrictEqual(mounted, 1);
  cleanup();
  deepStrictEqual(mounted, 1);
  store.dispose();
  cleanup2();
  deepStrictEqual(mounted, 0);
  deepStrictEqual(hook.stores.has(store.id), false);
  deepStrictEqual(store.snapshot().graphs, []);
  deepStrictEqual(late.instances.length, 1);
  store.get(parent, <T>() => false as T);
  deepStrictEqual(hook.stores.get(store.id)?.deref(), store);
  deepStrictEqual(changes, [child.id, parent.id]);
  unsubscribe();
  store.dispose();
});

test("an existing legacy devtools hook keeps its listeners when extended", async () => {
  const globals = globalThis as any;
  const original = globals.__BUNJA_DEVTOOLS_GLOBAL_HOOK__;
  const listeners = Object.fromEntries(Object.keys(original.listeners)
    .filter(key => key !== "graphChanged").map(key => [key, new Set<Function>()]));
  let created = 0;
  listeners.storeCreated.add(() => { created++; });
  const legacy = {
    bunjas: {}, scopes: {}, listeners,
    emit(type: string, event: unknown) {
      for (const listener of listeners[type]) listener(event);
    },
    on(type: string, listener: Function) {
      listeners[type].add(listener);
      return () => listeners[type].delete(listener);
    },
  };
  globals.__BUNJA_DEVTOOLS_GLOBAL_HOOK__ = legacy;
  try {
    const url = new URL("./bunja.ts", import.meta.url);
    url.search = "legacy-hook";
    const { createBunjaStore, bunja } = await import(url.href);
    const store = createBunjaStore();
    const model = bunja(() => 1);
    store.get(model, readNull);
    deepStrictEqual(created, 1);
    deepStrictEqual(globals.__BUNJA_DEVTOOLS_GLOBAL_HOOK__, legacy);
    deepStrictEqual(globals.__BUNJA_DEVTOOLS_GLOBAL_HOOK__.snapshot()[0].graphs[0].bunjaId, model.id);
    store.dispose();
  } finally {
    globals.__BUNJA_DEVTOOLS_GLOBAL_HOOK__ = original;
  }
});

test("failed init preserves a mounted shared child and its committed graph", () => {
  const store = createBunjaStore();
  const scope = createScope<string>();
  let effects = 0;
  const child = bunja(() => {
    const value = bunja.use(scope);
    bunja.effect(() => { effects++; return () => { effects--; }; });
    return { value };
  });
  const live = store.get(child, <T>() => "shared" as T);
  const cleanup = live.mount();
  const graph = store.inspect(child);
  const parent = bunja(() => {
    bunja.use(child);
    throw new Error("parent failed");
  });
  for (const operation of ["get", "prebake"] as const) {
    throws(() => store[operation](parent, <T>() => "shared" as T), /parent failed/);
    deepStrictEqual(store.inspect(child), graph);
    deepStrictEqual(store.inspect(parent).baked, false);
    deepStrictEqual(store.get(child, <T>() => "shared" as T).value === live.value, true);
    deepStrictEqual(effects, 1);
  }
  cleanup();
  deepStrictEqual(effects, 0);
  store.dispose();
});

test("wrapper failure after initialization does not roll back a committed instance graph", () => {
  let fail = true;
  const store = createBunjaStore({
    wrapInstance(fn) {
      const value = fn(() => {});
      if (fail) throw new Error("wrapper failed");
      return value;
    },
  });
  let calls = 0;
  const model = bunja(() => { calls++; return {}; });
  throws(() => store.get(model, readNull), /wrapper failed/);
  deepStrictEqual(store.snapshot().instances.length, 1);
  deepStrictEqual(store.inspect(model).baked, true);
  fail = false;
  store.get(model, readNull);
  deepStrictEqual(calls, 1);
  store.dispose();
});

test("nested snapshot collections cannot mutate store graph or binding tuples", () => {
  const store = createBunjaStore();
  const scope = createScope<string>();
  const child = bunja(() => bunja.use(scope));
  const parent = bunja(() => bunja.use(child, [scope.bind("bound")]));
  store.get(parent, readNull);
  const graph = store.inspect(parent);
  throws(() => (graph.requiredBunjaRefs as unknown[]).pop(), TypeError);
  throws(() => (graph.requiredBunjaRefs[0].scopeValuePairs[0] as any)[1] = "changed", TypeError);
  throws(() => (graph.relatedBunjas as unknown[]).pop(), TypeError);
  throws(() => (store.inspect(child).requiredScopes as unknown[]).pop(), TypeError);
  throws(() => (store.snapshot().instances[0].activeDependencyIds as unknown[]).push("changed"), TypeError);
  deepStrictEqual(store.get(parent, readNull).value, "bound");
  deepStrictEqual(store.inspect(child).requiredScopes, [scope]);
  deepStrictEqual(store.inspect(parent), graph);
  store.dispose();
});
