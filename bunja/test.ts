import { assertEquals, assertThrows } from "@std/assert";
import { assertSpyCalls, spy } from "@std/testing/mock";

import { bunja, createBunjaStore, createScope } from "./bunja.ts";
import type { Bunja, BunjaRef } from "./bunja.ts";

const readNull = <T>() => (null as T);

Deno.test({
  name: "basic",
  fn() {
    const store = createBunjaStore();
    const myBunjaInstance = {};
    const myBunja = bunja(() => myBunjaInstance);
    const { value, mount } = store.get(myBunja, readNull);
    const cleanup = mount();
    cleanup();
    assertEquals(value, myBunjaInstance);
  },
});

Deno.test({
  name: "basic effect",
  fn() {
    const store = createBunjaStore();
    const mountSpy = spy();
    const unmountSpy = spy();
    const myBunja = bunja(() => {
      bunja.effect(() => {
        mountSpy();
        return unmountSpy;
      });
    });
    assertSpyCalls(mountSpy, 0);
    const { mount } = store.get(myBunja, readNull);
    assertSpyCalls(mountSpy, 0);
    const cleanup = mount();
    assertSpyCalls(mountSpy, 1);
    assertSpyCalls(unmountSpy, 0);
    cleanup();
    assertSpyCalls(unmountSpy, 1);
  },
});

Deno.test({
  name: "bunja that depend on other bunja",
  fn() {
    const store = createBunjaStore();
    const [aMountSpy, aUnmountSpy] = [spy(), spy()];
    const [bMountSpy, bUnmountSpy] = [spy(), spy()];
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
    assertSpyCalls(aMountSpy, 0);
    assertSpyCalls(bMountSpy, 0);
    const { value, mount } = store.get(bBunja, readNull);
    assertEquals(value.a, aBunjaInstance);
    assertSpyCalls(aMountSpy, 0);
    assertSpyCalls(bMountSpy, 0);
    const cleanup = mount();
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 1);
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 0);
    cleanup();
    assertSpyCalls(aUnmountSpy, 1);
    assertSpyCalls(bUnmountSpy, 1);
  },
});

Deno.test({
  name: "A mount first, B mount later & A unmount first, B unmount later",
  fn() {
    const store = createBunjaStore();
    const [aMountSpy, aUnmountSpy] = [spy(), spy()];
    const [bMountSpy, bUnmountSpy] = [spy(), spy()];
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
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 0);
    const { mount: m2 } = store.get(bBunja, readNull);
    const c2 = m2();
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 1);
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 0);
    c1();
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 0);
    c2();
    assertSpyCalls(aUnmountSpy, 1);
    assertSpyCalls(bUnmountSpy, 1);
  },
});

Deno.test({
  name: "B mount first, A mount later & B unmount first, A unmount later",
  fn() {
    const store = createBunjaStore();
    const [aMountSpy, aUnmountSpy] = [spy(), spy()];
    const [bMountSpy, bUnmountSpy] = [spy(), spy()];
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
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 1);
    const { mount: m2 } = store.get(aBunja, readNull);
    const c2 = m2();
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 1);
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 0);
    c1();
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 1);
    c2();
    assertSpyCalls(aUnmountSpy, 1);
    assertSpyCalls(bUnmountSpy, 1);
  },
});

Deno.test({
  name: "injecting values into a scope when calling store.get",
  fn() {
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
  },
});

Deno.test({
  name: "scope value deduplication using hash function",
  fn() {
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
  },
});

Deno.test({
  name: "bunja.use can override scope value pairs inside a bunja init",
  fn() {
    const store = createBunjaStore();
    const aaScope = createScope<string>();
    const bbScope = createScope<string>();
    const [aMountSpy, aUnmountSpy] = [spy(), spy()];
    const [bMountSpy, bUnmountSpy] = [spy(), spy()];
    const [cMountSpy, cUnmountSpy] = [spy(), spy()];
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
    assertSpyCalls(aMountSpy, 0);
    assertSpyCalls(bMountSpy, 0);
    assertSpyCalls(cMountSpy, 0);
    const { value, mount: m1, deps: d1 } = store.get(
      cBunja,
      <T>() => "abc" as T,
    );
    assertSpyCalls(aMountSpy, 0);
    assertSpyCalls(bMountSpy, 0);
    assertSpyCalls(cMountSpy, 0);
    const c1 = m1();
    assertEquals(d1, ["abc"]);
    assertEquals(value.foo.a, value.bar.a);
    assertEquals(value.foo.scopeValue, "foo");
    assertEquals(value.bar.scopeValue, "bar");
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 2);
    assertSpyCalls(cMountSpy, 1);
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 0);
    assertSpyCalls(cUnmountSpy, 0);
    const { mount: m2, deps: d2 } = store.get(
      bBunja,
      <T>(scope: any) => ((scope === aaScope) ? "foo" : "abc") as T,
    );
    const c2 = m2();
    assertEquals(d2, ["foo", "abc"]);
    assertSpyCalls(bMountSpy, 2);
    c1();
    assertSpyCalls(aUnmountSpy, 0);
    assertSpyCalls(bUnmountSpy, 1);
    assertSpyCalls(cUnmountSpy, 1);
    c2();
    assertSpyCalls(aUnmountSpy, 1);
    assertSpyCalls(bUnmountSpy, 2);
    assertSpyCalls(cUnmountSpy, 1);
  },
});

Deno.test({
  name: "seed is used only when creating a bunja instance",
  fn() {
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
  },
});

Deno.test({
  name: "bunja.use can provide seed without storing it in graph refs",
  fn() {
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
  },
});

Deno.test({
  name: "prebake rejects root seed and initializes with default seed",
  fn() {
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
      Error,
      "seed cannot be provided to `store.prebake`",
    );
  },
});

Deno.test({
  name: "bunja.will mounts only the selected dependency",
  fn() {
    const store = createBunjaStore();
    const condScope = createScope<"a" | "b">();
    const [aMountSpy, aUnmountSpy] = [spy(), spy()];
    const [bMountSpy, bUnmountSpy] = [spy(), spy()];
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
    assertSpyCalls(aMountSpy, 1);
    assertSpyCalls(bMountSpy, 0);

    cleanup();
    assertSpyCalls(aUnmountSpy, 1);
    assertSpyCalls(bUnmountSpy, 0);
  },
});

Deno.test({
  name: "relatedBunjas includes nested bunja.will dependencies",
  fn() {
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
  },
});

Deno.test({
  name: "prebake expands inactive bunja.will dependency graph",
  fn() {
    const store = createBunjaStore();
    const grandparentDependencyMountSpy = spy();
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
    assertSpyCalls(grandparentDependencyMountSpy, 0);

    const prebaked = store.prebake(consumerBunja, readNull);

    assertEquals(prebaked.relatedBunjas, [
      grandparentDependencyBunja,
      parentDependencyBunja,
    ]);
    assertEquals(consumerBunja.relatedBunjas, [
      grandparentDependencyBunja,
      parentDependencyBunja,
    ]);
    assertSpyCalls(grandparentDependencyMountSpy, 0);

    cleanup();
  },
});

Deno.test({
  name: "prebake runs each dependency once per traversal",
  fn() {
    const store = createBunjaStore();
    const requiredInitSpy = spy();
    const optionalInitSpy = spy();
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

    assertSpyCalls(requiredInitSpy, 1);
    assertSpyCalls(optionalInitSpy, 1);

    store.prebake(consumerBunja, readNull);

    assertSpyCalls(requiredInitSpy, 2);
    assertSpyCalls(optionalInitSpy, 2);
  },
});

Deno.test({
  name: "prebake disposes the dry-run wrapper",
  fn() {
    const disposeSpy = spy();
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
    assertSpyCalls(disposeSpy, 1);
  },
});

Deno.test({
  name: "bunja.will thunk can only be called during the same bunja init",
  fn() {
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
      Error,
      "same bunja init function",
    );

    cleanup();
  },
});

Deno.test({
  name: "store.get rejects circular bunja dependencies",
  fn() {
    const disposeSpy = spy();
    const store = createBunjaStore({
      wrapInstance: (fn) => fn(disposeSpy),
    });
    let bBunja!: Bunja<string>;
    const aBunja = bunja(() => bunja.use(bBunja));
    bBunja = bunja(() => bunja.use(aBunja));

    assertThrows(
      () => store.get(aBunja, readNull),
      Error,
      "Circular bunja dependency detected.",
    );
    assertSpyCalls(disposeSpy, 2);
  },
});

Deno.test({
  name: "prebake rejects circular bunja dependencies",
  fn() {
    const store = createBunjaStore();
    let bBunja!: Bunja<string>;
    const aBunja = bunja(() => bunja.use(bBunja));
    bBunja = bunja(() => bunja.use(aBunja));

    assertThrows(
      () => store.prebake(aBunja, readNull),
      Error,
      "Circular bunja dependency detected.",
    );
  },
});

Deno.test({
  name: "active optional dependency scopes are part of bunja instance identity",
  fn() {
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
  },
});

Deno.test({
  name:
    "inactive optional dependency scopes do not change bunja instance identity",
  fn() {
    const store = createBunjaStore();
    const condScope = createScope<boolean>();
    const resourceScope = createScope<string>();
    const parentDependencyMountSpy = spy();
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
    assertSpyCalls(parentDependencyMountSpy, 0);

    firstCleanup();
    secondCleanup();
  },
});

Deno.test({
  name: "duplicate optional dependency calls are mounted once",
  fn() {
    const store = createBunjaStore();
    const mountSpy = spy();
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
    assertSpyCalls(mountSpy, 1);

    cleanup();
  },
});
