import { deepStrictEqual as assertEquals, throws as assertThrows } from "node:assert";
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
  assertEquals(value, myBunjaInstance);
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
  assertEquals(mountSpy.mock.callCount(), 0);
  const { mount } = store.get(myBunja, readNull);
  assertEquals(mountSpy.mock.callCount(), 0);
  const cleanup = mount();
  assertEquals(mountSpy.mock.callCount(), 1);
  assertEquals(unmountSpy.mock.callCount(), 0);
  cleanup();
  assertEquals(unmountSpy.mock.callCount(), 1);
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
  assertEquals(aMountSpy.mock.callCount(), 0);
  assertEquals(bMountSpy.mock.callCount(), 0);
  const { value, mount } = store.get(bBunja, readNull);
  assertEquals(value.a, aBunjaInstance);
  assertEquals(aMountSpy.mock.callCount(), 0);
  assertEquals(bMountSpy.mock.callCount(), 0);
  const cleanup = mount();
  assertEquals(aMountSpy.mock.callCount(), 1);
  assertEquals(bMountSpy.mock.callCount(), 1);
  assertEquals(aUnmountSpy.mock.callCount(), 0);
  assertEquals(bUnmountSpy.mock.callCount(), 0);
  cleanup();
  assertEquals(aUnmountSpy.mock.callCount(), 1);
  assertEquals(bUnmountSpy.mock.callCount(), 1);
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
  assertEquals(order, ["dependency mount", "consumer mount"]);

  cleanup();
  assertEquals(order, [
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
  assertEquals(aMountSpy.mock.callCount(), 1);
  assertEquals(bMountSpy.mock.callCount(), 0);
  const { mount: m2 } = store.get(bBunja, readNull);
  const c2 = m2();
  assertEquals(aMountSpy.mock.callCount(), 1);
  assertEquals(bMountSpy.mock.callCount(), 1);
  assertEquals(aUnmountSpy.mock.callCount(), 0);
  assertEquals(bUnmountSpy.mock.callCount(), 0);
  c1();
  assertEquals(aUnmountSpy.mock.callCount(), 0);
  assertEquals(bUnmountSpy.mock.callCount(), 0);
  c2();
  assertEquals(aUnmountSpy.mock.callCount(), 1);
  assertEquals(bUnmountSpy.mock.callCount(), 1);
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
  assertEquals(aMountSpy.mock.callCount(), 1);
  assertEquals(bMountSpy.mock.callCount(), 1);
  const { mount: m2 } = store.get(aBunja, readNull);
  const c2 = m2();
  assertEquals(aMountSpy.mock.callCount(), 1);
  assertEquals(bMountSpy.mock.callCount(), 1);
  assertEquals(aUnmountSpy.mock.callCount(), 0);
  assertEquals(bUnmountSpy.mock.callCount(), 0);
  c1();
  assertEquals(aUnmountSpy.mock.callCount(), 0);
  assertEquals(bUnmountSpy.mock.callCount(), 1);
  c2();
  assertEquals(aUnmountSpy.mock.callCount(), 1);
  assertEquals(bUnmountSpy.mock.callCount(), 1);
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
  assertEquals(scopeValue, "injected value");
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
  assertEquals(scopeValue1, "foo");
  assertEquals(scopeValue2, "foo");
  assertEquals(scopeValue3, "baaz");
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

  assertEquals(first.value.scopeValue, "foo");
  assertEquals(second.value.scopeValue, "bar");
  assertEquals(first.deps, ["foo"]);
  assertEquals(second.deps, ["bar"]);
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
  assertEquals(aMountSpy.mock.callCount(), 0);
  assertEquals(bMountSpy.mock.callCount(), 0);
  assertEquals(cMountSpy.mock.callCount(), 0);
  const { value, mount: m1, deps: d1 } = store.get(
    cBunja,
    <T>() => "abc" as T,
  );
  assertEquals(aMountSpy.mock.callCount(), 0);
  assertEquals(bMountSpy.mock.callCount(), 0);
  assertEquals(cMountSpy.mock.callCount(), 0);
  const c1 = m1();
  assertEquals(d1, ["abc"]);
  assertEquals(value.foo.a, value.bar.a);
  assertEquals(value.foo.scopeValue, "foo");
  assertEquals(value.bar.scopeValue, "bar");
  assertEquals(aMountSpy.mock.callCount(), 1);
  assertEquals(bMountSpy.mock.callCount(), 2);
  assertEquals(cMountSpy.mock.callCount(), 1);
  assertEquals(aUnmountSpy.mock.callCount(), 0);
  assertEquals(bUnmountSpy.mock.callCount(), 0);
  assertEquals(cUnmountSpy.mock.callCount(), 0);
  const { mount: m2, deps: d2 } = store.get(
    bBunja,
    <T>(scope: any) => ((scope === aaScope) ? "foo" : "abc") as T,
  );
  const c2 = m2();
  assertEquals(d2, ["foo", "abc"]);
  assertEquals(bMountSpy.mock.callCount(), 2);
  c1();
  assertEquals(aUnmountSpy.mock.callCount(), 0);
  assertEquals(bUnmountSpy.mock.callCount(), 1);
  assertEquals(cUnmountSpy.mock.callCount(), 1);
  c2();
  assertEquals(aUnmountSpy.mock.callCount(), 1);
  assertEquals(bUnmountSpy.mock.callCount(), 2);
  assertEquals(cUnmountSpy.mock.callCount(), 1);
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
  assertEquals(requiredScopes.length, 1);
  assertEquals(requiredScopes[0] === prebakeGraph.outerScope, true);
  assertEquals(
    requiredScopes.some((scope) => scope === prebakeGraph.injectedScope),
    false,
  );

  const getGraph = createGraph();
  const { value, deps } = createBunjaStore().get(
    getGraph.consumerBunja,
    readScope,
  );
  const requiredScopes2 = getGraph.consumerBunja.requiredScopes;
  assertEquals(value, { injected: "injected", outer: "outer" });
  assertEquals(deps, ["outer"]);
  assertEquals(requiredScopes2.length, 1);
  assertEquals(
    requiredScopes2[0] === getGraph.outerScope,
    true,
  );
  assertEquals(
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

  assertEquals(firstValue.seed.value, "first");
  assertEquals(secondValue, firstValue);

  firstCleanup();
  secondCleanup();

  const { value: thirdValue, mount: thirdMount } = store.get(
    { bunja: myBunja, seed: { value: "third" } },
    readNull,
  );
  const thirdCleanup = thirdMount();

  assertEquals(thirdValue.seed.value, "third");
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

  assertEquals(value, "dependency");
  assertEquals(consumerBunja.requiredBunjaRefs.length, 1);
  assertEquals("seed" in consumerBunja.requiredBunjaRefs[0], false);

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

  assertEquals(usedSeeds, ["default", "default"]);
  assertEquals("seed" in consumerBunja.requiredBunjaRefs[0], false);
  assertThrows(
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
  assertEquals(value, "a");
  assertEquals(consumerBunja.relatedBunjas, [aBunja, bBunja]);

  const cleanup = mount();
  assertEquals(aMountSpy.mock.callCount(), 1);
  assertEquals(bMountSpy.mock.callCount(), 0);

  cleanup();
  assertEquals(aUnmountSpy.mock.callCount(), 1);
  assertEquals(bUnmountSpy.mock.callCount(), 0);
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
  assertEquals(order, ["dependency mount", "consumer mount"]);

  cleanup();
  assertEquals(order, [
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
  createBunjaStore().get(getGraph.consumerBunja, readNull);

  const prebakeGraph = createConsumer();
  createBunjaStore().prebake(prebakeGraph.consumerBunja, readNull);

  assertEquals(getGraph.consumerBunja.optionalBunjaRefs.length, 1);
  assertEquals(prebakeGraph.consumerBunja.optionalBunjaRefs.length, 1);
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

  assertEquals(consumerBunja.relatedBunjas, [
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

  assertEquals(value, "consumer");
  assertEquals(consumerBunja.relatedBunjas, [parentDependencyBunja]);
  assertEquals(grandparentDependencyMountSpy.mock.callCount(), 0);

  const prebaked = store.prebake(consumerBunja, readNull);

  assertEquals(prebaked.relatedBunjas, [
    grandparentDependencyBunja,
    parentDependencyBunja,
  ]);
  assertEquals(consumerBunja.relatedBunjas, [
    grandparentDependencyBunja,
    parentDependencyBunja,
  ]);
  assertEquals(grandparentDependencyMountSpy.mock.callCount(), 0);

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

  assertEquals(requiredInitSpy.mock.callCount(), 1);
  assertEquals(optionalInitSpy.mock.callCount(), 1);

  store.prebake(consumerBunja, readNull);

  assertEquals(requiredInitSpy.mock.callCount(), 2);
  assertEquals(optionalInitSpy.mock.callCount(), 2);
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

  assertEquals(wrapCalls, 1);
  assertEquals(disposeSpy.mock.callCount(), 1);
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

  assertThrows(
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

  assertThrows(
    () => store.get(aBunja, readNull),
    (error: unknown) => error instanceof Error && error.message.includes("Circular bunja dependency detected."),
  );
  assertEquals(disposeSpy.mock.callCount(), 2);
});

test("prebake rejects circular bunja dependencies", () => {
  const store = createBunjaStore();
  let bBunja!: Bunja<string>;
  const aBunja = bunja(() => bunja.use(bBunja));
  bBunja = bunja(() => bunja.use(aBunja));

  assertThrows(
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

  assertEquals(consumerBunja.requiredScopes.length, 1);
  assertEquals(consumerBunja.requiredScopes[0] === condScope, true);
  assertEquals(first.value.parent?.resource, "a");
  assertEquals(second.value.parent?.resource, "b");
  assertEquals(first.value === second.value, false);
  assertEquals(first.deps, [true, "a"]);
  assertEquals(second.deps, [true, "b"]);
  assertEquals(mounted, ["a", "b"]);

  firstCleanup();
  assertEquals(unmounted, ["a"]);
  secondCleanup();
  assertEquals(unmounted, ["a", "b"]);
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

  assertEquals(consumerBunja.requiredScopes.length, 1);
  assertEquals(consumerBunja.requiredScopes[0] === condScope, true);
  assertEquals(first.value, second.value);
  assertEquals(first.deps, [false]);
  assertEquals(second.deps, [false]);
  assertEquals(parentDependencyMountSpy.mock.callCount(), 0);

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

  assertEquals(value.first, parentDependencyValue);
  assertEquals(value.second, parentDependencyValue);
  assertEquals(mountSpy.mock.callCount(), 1);

  cleanup();
});
