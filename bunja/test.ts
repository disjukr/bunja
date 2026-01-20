import { assertEquals } from "@std/assert";
import { assertSpyCalls, spy } from "@std/testing/mock";

import { bunja, createBunjaStore, createScope } from "./bunja.ts";

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
  name: "fork",
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
      const foo = bunja.fork(bBunja, [aaScope.bind("foo")]);
      const bar = bunja.fork(bBunja, [aaScope.bind("bar")]);
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
